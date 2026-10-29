import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {  } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { getDeviceId } from '../../../utils/device';
import {
  AttachmentParentType,
  createAttachmentRecord,
  deleteAttachmentRecords,
  updateAttachmentCaption,
  getAttachmentsForParent,
} from '../attachmentPersistence';
import { formatDmsPair, formatStampDate, reverseGeocodeLabel } from '../geotagStamp';
import { useGeotagStampCapture } from './useGeotagStampCapture';
import { withTimeout } from '../../../utils/withTimeout';
import type { Attachment } from '../../../db/models/Attachment';

// A GPS-grade fix, not the default Balanced accuracy (~100m) — Balanced
// explicitly allows the OS to skip GPS entirely and fall back to
// network-based or cached positioning to save power (see Expo's own docs on
// LocationAccuracy.Balanced). That's what let a stale/cached fix survive a
// full disconnect-and-actually-move test: no network fix + no forced GPS
// reacquisition meant the old cached position kept getting reused. High
// forces a real, current GPS reading, which works fully offline (GPS is
// satellite-based, not network-based) — correctness matters more here than
// the marginal battery/time savings Balanced buys.
const GEOTAG_ACCURACY = Location.Accuracy.High;
const LOCATION_TIMEOUT_MS = 20000;

interface UseAttachmentsResult {
  items: Attachment[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  // Which step of the "embed geotag" pipeline is currently running, or null
  // when idle — see StampStage.
  stampStage: StampStage;
  addFromCamera: () => Promise<void>;
  addFromLibrary: () => Promise<void>;
  // Bulk-only — see AttachmentsSection's multi-select flow. There's no
  // single-tile delete button.
  removeMany: (attachmentIds: string[]) => Promise<void>;
  saveCaption: (attachmentId: string, caption: string) => Promise<void>;
  refetch: () => void;
  // Hidden off-screen node the geotag-stamp compositor renders into — must
  // be mounted somewhere in the caller's tree (see AttachmentsSection) for
  // addFromCamera's "embed geotag" path to actually be able to capture a
  // stamped image. See useGeotagStampCapture.
  captureNode: ReactNode;
}

const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
};

type Geo = { geoLat: number | null; geoLng: number | null };

// Distinct stages of the "embed geotag" pipeline, surfaced to the UI as a
// proper processing indicator (see AttachmentsSection) rather than the
// small inline `busy` spinner used for quick operations like delete — this
// pipeline involves a location fix, an online geocode lookup, and a native
// view capture, any of which can take a few seconds.
export type StampStage = 'locating' | 'geocoding' | 'stamping' | 'saving' | null;

// Resolves once the inspector taps a button — true to embed a visible
// date/coordinates/DENR-seal stamp into the photo, false to save it as-is.
// This is the single control for the whole geotag pipeline (metadata capture
// + visual stamp together): declining means no location is even attempted,
// not just "no visible stamp".
async function confirmEmbedGeotag(): Promise<boolean> {
  // Dismissing (backdrop, close, hardware back) resolves null, which means
  // no stamp - the same answer the cancellable Alert gave.
  const choice = await showPrompt({
    title: 'Embed geotag on this photo?',
    message:
      'Adds the date, time, coordinates, and the DENR seal directly onto the photo. The place name is only included when it can be resolved online at the moment you take the photo.',
    actions: [
      { id: 'no', label: "Don't Embed", variant: 'cancel' },
      { id: 'yes', label: 'Embed Geotag', variant: 'default' },
    ],
  });
  return choice === 'yes';
}

// Follows the same fetch-once + tick-refetch shape as useInspectionReport.ts
// (no live WatermelonDB .observe() elsewhere in this app either).
//
// ensureParentId supports attaching photos before the parent row exists yet
// (the report-creation flow — see WaterFormShell's ensureDraftReport): when
// parentId is undefined, the first attempt to actually persist an attachment
// calls this to obtain (creating on demand, if needed) a real parent id.
// Never called when parentId is already set.
export function useAttachments(
  parentType: AttachmentParentType,
  parentId: string | undefined,
  ensureParentId?: () => Promise<string>
): UseAttachmentsResult {
  const { session } = useAuthContext();
  const inspectorUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';

  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [stampStage, setStampStage] = useState<StampStage>(null);

  const { captureStamp, captureNode } = useGeotagStampCapture();

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!parentId) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const records = await getAttachmentsForParent(parentType, parentId);
        if (!cancelled) setItems(records);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load attachments.');
          console.error('[useAttachments]', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [parentType, parentId, tick]);

  // A denied permission or a location fetch failure just means no geotag —
  // never blocks the capture itself.
  const tryGetLocation = useCallback(async (): Promise<Geo> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return { geoLat: null, geoLng: null };

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: GEOTAG_ACCURACY }),
        LOCATION_TIMEOUT_MS,
        'getCurrentPositionAsync'
      );
      return { geoLat: position.coords.latitude, geoLng: position.coords.longitude };
    } catch (err) {
      console.error('[useAttachments] geotag failed', err);
      return { geoLat: null, geoLng: null };
    }
  }, []);

  const addFromAsset = useCallback(
    async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }, geo: Geo) => {
      if (!inspectorUid) return;
      if (!parentId && !ensureParentId) return;

      setBusy(true);
      setError(null);
      try {
        // Resolved lazily so a parent (e.g. a not-yet-saved draft report)
        // only gets created the moment it's actually needed — not just
        // because the Attachments tab was opened.
        const resolvedParentId = parentId ?? (await ensureParentId!());
        const deviceId = await getDeviceId();
        await createAttachmentRecord({
          parentType,
          parentId: resolvedParentId,
          inspectorUid,
          deviceId,
          sourceUri: asset.uri,
          fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'photo.jpg',
          mimeType: asset.mimeType ?? 'image/jpeg',
          geoLat: geo.geoLat,
          geoLng: geo.geoLng,
        });
        refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add attachment.');
        console.error('[useAttachments] addFromAsset', err);
      } finally {
        setBusy(false);
      }
    },
    [parentType, parentId, inspectorUid, refetch, ensureParentId]
  );

  const addFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera permission is required to take a photo.');
      return;
    }

    const embedGeotag = await confirmEmbedGeotag();

    // Captured before the picker opens so it reflects where the inspector
    // was standing when they took the shot, not wherever they are once the
    // picker UI closes.
    let geo: Geo = { geoLat: null, geoLng: null };
    if (embedGeotag) {
      setStampStage('locating');
      geo = await tryGetLocation();
    }

    const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]) {
      setStampStage(null);
      return;
    }
    const asset = result.assets[0];

    const hasGeo = geo.geoLat != null && geo.geoLng != null;

    if (!embedGeotag || !hasGeo) {
      // Declined, or location genuinely unavailable (denied permission, GPS
      // off) despite opting in — save the plain photo. geo already reflects
      // either case correctly (null/null).
      setStampStage(null);
      await addFromAsset(asset, geo);
      return;
    }

    setError(null);
    try {
      const dateLabel = formatStampDate(new Date());
      const dmsLabel = formatDmsPair(geo.geoLat as number, geo.geoLng as number);

      setStampStage('geocoding');
      // Only included when it resolves — offline or a failed/slow lookup
      // just omits this line, per the confirmed requirement.
      const locationLabel = await reverseGeocodeLabel(geo.geoLat as number, geo.geoLng as number);

      setStampStage('stamping');
      const stampedUri = await captureStamp({
        photoUri: asset.uri,
        photoWidth: asset.width || 1200,
        photoHeight: asset.height || 1600,
        dateLabel,
        dmsLabel,
        locationLabel,
      });

      setStampStage('saving');
      await addFromAsset({ uri: stampedUri, fileName: asset.fileName, mimeType: 'image/jpeg' }, geo);
    } catch (err) {
      // Stamping failed for some reason (e.g. the off-screen composite
      // couldn't be captured) — don't lose the photo over it, fall back to
      // the unstamped original. The geotag metadata was already captured
      // and is kept either way.
      console.error('[useAttachments] geotag stamp failed, saving unstamped', err);
      setStampStage('saving');
      await addFromAsset(asset, geo);
    } finally {
      setStampStage(null);
    }
  }, [addFromAsset, tryGetLocation, captureStamp]);

  const addFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library permission is required to choose a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;

    // No geotag for library picks, per the confirmed requirement.
    await addFromAsset(result.assets[0], { geoLat: null, geoLng: null });
  }, [addFromAsset]);

  const removeMany = useCallback(
    async (attachmentIds: string[]) => {
      setBusy(true);
      setError(null);
      try {
        await deleteAttachmentRecords(attachmentIds);
        refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove the selected photos.');
        console.error('[useAttachments] removeMany', err);
      } finally {
        setBusy(false);
      }
    },
    [refetch]
  );

  const saveCaption = useCallback(
    async (attachmentId: string, caption: string) => {
      setError(null);
      try {
        await updateAttachmentCaption(attachmentId, caption);
        refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save the caption.');
        console.error('[useAttachments] saveCaption', err);
      }
    },
    [refetch]
  );

  return {
    items,
    loading,
    busy,
    error,
    stampStage,
    addFromCamera,
    addFromLibrary,
    removeMany,
    saveCaption,
    refetch,
    captureNode,
  };
}
