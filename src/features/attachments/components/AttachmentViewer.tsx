import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions, ViewToken } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { AppText } from '../../../components/AppText';
import { getDisplayUri } from '../attachmentUploadQueue';
import { downloadAttachmentToGallery, copyAttachmentDetails } from '../attachmentActions';
import { formatDmsPair, formatStampDate } from '../geotagStamp';
import type { Attachment } from '../../../db/models/Attachment';

interface AttachmentViewerProps {
  items: Attachment[];
  initialIndex: number;
  visible: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSaveCaption: (attachmentId: string, caption: string) => Promise<void>;
}

const UPLOAD_STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting to sync',
  uploading: 'Uploading…',
  uploaded: 'Synced',
  failed: 'Upload failed — will retry',
};

// uploadStatus alone only tracks the binary file, not the row's own
// metadata — once a photo is 'uploaded' that never changes again, even if
// a caption edited afterward puts the row back in pending_update. Mirrors
// AttachmentThumbnail's statusIcon fix: "Synced" only when both the file is
// uploaded AND the row itself has nothing left to push.
function displayUploadStatusLabel(attachment: Attachment): string {
  if (attachment.uploadStatus === 'uploaded' && attachment.syncState !== 'synced') {
    return 'Waiting to sync';
  }
  return UPLOAD_STATUS_LABEL[attachment.uploadStatus] ?? attachment.uploadStatus;
}

type ResolveState = 'loading' | 'ready' | 'unavailable';

// One page of the swipeable gallery — resolves and displays a single
// attachment's image, independently of its neighbors (each page mounts its
// own resolve effect, same pattern the old single-photo viewer used).
const ViewerPage: React.FC<{ attachment: Attachment; width: number; height: number }> = ({
  attachment,
  width,
  height,
}) => {
  const [uri, setUri] = useState<string | null>(null);
  const [state, setState] = useState<ResolveState>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getDisplayUri(attachment)
      .then(resolved => {
        if (cancelled) return;
        setUri(resolved);
        setState(resolved ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [attachment]);

  return (
    <View style={[styles.page, { width, height }]}>
      {state === 'loading' && <ActivityIndicator size="large" color={Colors.white} />}
      {state === 'unavailable' && <Ionicons name="image-outline" size={40} color={Colors.textLight} />}
      {state === 'ready' && uri && <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />}
    </View>
  );
};

// Shared full-screen viewer for every attachment in the current report —
// one instance, swiped/paged between photos via a horizontal FlatList
// (rather than each thumbnail owning its own isolated single-photo modal),
// with chevron buttons as a discoverable alternative to the swipe gesture.
export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  items,
  initialIndex,
  visible,
  canEdit,
  onClose,
  onSaveCaption,
}) => {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Attachment>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // The FlatList's pages must be sized to the imageArea's own actual
  // rendered height, not the full window height — imageArea is smaller
  // than the window once the top bar, caption row, and bottom bar (all
  // siblings) take their share. Centering each page at full window height
  // left the image vertically centered relative to a box taller than what
  // was actually visible, which read as "stuck at the bottom" of the real
  // (shorter) visible area. Starts at the window height as a same-frame
  // fallback before the first onLayout fires.
  const [imageAreaHeight, setImageAreaHeight] = useState(height);
  const [downloading, setDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);

  // Re-anchor to whichever thumbnail was tapped each time the viewer opens,
  // and clear per-photo UI state left over from a previous viewing.
  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    setShowDetails(false);
    setCopyFeedback(false);
    setEditingCaption(false);
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setActiveIndex(first.index);
      setShowDetails(false);
      setCopyFeedback(false);
      setEditingCaption(false);
    }
  }).current;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      listRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    },
    [items.length]
  );

  const current = items[activeIndex];
  const hasGeo = current && current.geoLat != null && current.geoLng != null;

  const handleDownload = async () => {
    if (!current) return;
    setDownloading(true);
    try {
      await downloadAttachmentToGallery(current);
      void showPrompt({ title: 'Saved', message: 'Photo saved to your device’s Photos, in the "InspectPlus" album.' });
    } catch (err) {
      void showPrompt({ title: 'Download failed', message: err instanceof Error ? err.message : 'Something went wrong.', tone: 'danger' });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyDetails = async () => {
    if (!current) return;
    try {
      await copyAttachmentDetails(current);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    } catch (err) {
      void showPrompt({ title: 'Copy failed', message: err instanceof Error ? err.message : 'Something went wrong.', tone: 'danger' });
    }
  };

  const startEditingCaption = () => {
    if (!canEdit || !current) return;
    setCaptionDraft(current.caption ?? '');
    setEditingCaption(true);
  };

  const handleSaveCaption = async () => {
    if (!current) return;
    setSavingCaption(true);
    try {
      await onSaveCaption(current.attachmentId, captionDraft);
    } finally {
      setSavingCaption(false);
      setEditingCaption(false);
    }
  };

  if (!current) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* RN's Modal renders as its own separate native window on Android (a
          system Dialog), which doesn't inherit the host Activity's
          windowSoftInputMode resize behavior — behavior: undefined there
          meant the keyboard just overlaid the content with no adjustment
          at all. 'height' is the standard fix for keyboard-avoidance
          inside a Modal on Android. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.75}>
            <Ionicons name="chevron-down" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <AppText variant="marquee" text={current.fileName} style={styles.title} />
            {items.length > 1 && (
              <Text style={styles.pageIndicator}>{activeIndex + 1} of {items.length}</Text>
            )}
          </View>
          <View style={styles.iconBtn} />
        </View>

        {/* Deliberately a plain View, not Reanimated.View — its onLayout
            drives setImageAreaHeight, which re-renders the FlatList's
            content. Animating this container's own layout while that
            measurement also triggers a JS-thread re-render of a FlatList
            is what caused the dropped frames: the UI-thread transition and
            the JS-thread re-render were competing for the same frames.
            captionBar/detailsPanel/bottomBar have no such feedback loop, so
            they keep their layout transitions. */}
        <View
          style={styles.imageArea}
          onLayout={e => setImageAreaHeight(e.nativeEvent.layout.height)}>
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={item => item.attachmentId}
            renderItem={({ item }) => <ViewerPage attachment={item} width={width} height={imageAreaHeight} />}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          />

          {items.length > 1 && activeIndex > 0 && (
            <TouchableOpacity style={[styles.navArrow, styles.navArrowLeft]} onPress={() => goTo(activeIndex - 1)} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
          {items.length > 1 && activeIndex < items.length - 1 && (
            <TouchableOpacity style={[styles.navArrow, styles.navArrowRight]} onPress={() => goTo(activeIndex + 1)} activeOpacity={0.75}>
              <Ionicons name="chevron-forward" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {(canEdit || current.caption) && (
          <Reanimated.View style={styles.captionBar} layout={LinearTransition.duration(220)}>
            {editingCaption ? (
              <>
                <TextInput
                  style={styles.captionInput}
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  placeholder="Add a caption…"
                  placeholderTextColor="#94a3b8"
                  multiline
                  maxLength={280}
                  autoFocus
                />
                <View style={styles.captionEditActions}>
                  <TouchableOpacity onPress={() => setEditingCaption(false)} activeOpacity={0.75} style={styles.captionCancelBtn} disabled={savingCaption}>
                    <Text style={styles.captionCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveCaption} activeOpacity={0.75} style={styles.captionSaveBtn} disabled={savingCaption}>
                    {savingCaption ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.captionSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                onPress={startEditingCaption}
                disabled={!canEdit}
                activeOpacity={0.75}
                style={styles.captionRow}>
                {current.caption ? (
                  <Text style={styles.captionText}>{current.caption}</Text>
                ) : (
                  <Text style={styles.captionPlaceholder}>Add a caption…</Text>
                )}
                {canEdit && <Ionicons name="pencil" size={12} color="#94a3b8" />}
              </TouchableOpacity>
            )}
          </Reanimated.View>
        )}

        {showDetails && (
          <Reanimated.View style={styles.detailsPanel} layout={LinearTransition.duration(220)}>
            <AppText variant="marquee" text={current.fileName} style={styles.detailsTitleText} containerStyle={styles.detailsTitle} />
            <Text style={styles.detailsRow}>Captured: {formatStampDate(new Date(current.capturedAt))}</Text>
            <Text style={styles.detailsRow}>Status: {displayUploadStatusLabel(current)}</Text>
            {hasGeo ? (
              <>
                <Text style={styles.detailsRow}>DMS: {formatDmsPair(current.geoLat as number, current.geoLng as number)}</Text>
                <Text style={styles.detailsRow}>
                  Decimal: {(current.geoLat as number).toFixed(6)}, {(current.geoLng as number).toFixed(6)}
                </Text>
              </>
            ) : (
              <Text style={styles.detailsRow}>Coordinates: not recorded</Text>
            )}

            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyDetails} activeOpacity={0.75}>
              <Ionicons name={copyFeedback ? 'checkmark' : 'copy-outline'} size={13} color={Colors.navy} />
              <Text style={styles.copyBtnText}>{copyFeedback ? 'Copied' : 'Copy Details'}</Text>
            </TouchableOpacity>
          </Reanimated.View>
        )}

        <Reanimated.View style={styles.bottomBar} layout={LinearTransition.duration(220)}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDownload} activeOpacity={0.75} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="download-outline" size={21} color={Colors.white} />
            )}
            <Text style={styles.actionLabel}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowDetails(v => !v)} activeOpacity={0.75}>
            <Ionicons name={showDetails ? 'information-circle' : 'information-circle-outline'} size={22} color={Colors.white} />
            <Text style={styles.actionLabel}>Details</Text>
          </TouchableOpacity>

          {hasGeo && (
            <View style={styles.actionBtn}>
              <Ionicons name="location" size={20} color={Colors.white} />
              <Text style={styles.actionLabel}>Geotagged</Text>
            </View>
          )}
        </Reanimated.View>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  pageIndicator: {
    fontSize: 10.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 1,
  },
  imageArea: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(13,33,55,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowLeft: {
    left: 10,
  },
  navArrowRight: {
    right: 10,
  },
  captionBar: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  captionText: {
    flex: 1,
    fontSize: 12.5,
    color: '#e2e8f0',
  },
  captionPlaceholder: {
    flex: 1,
    fontSize: 12.5,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  captionInput: {
    minHeight: 44,
    maxHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: Colors.white,
    fontSize: 12.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  captionEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  captionCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  captionCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  captionSaveBtn: {
    minWidth: 56,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.green,
  },
  captionSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  detailsPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  detailsTitle: {
    marginBottom: 8,
  },
  detailsTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  detailsRow: {
    fontSize: 11.5,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  actionLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#e2e8f0',
  },
});
