import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { FormSection } from '../../../components/form';
import { Button } from '../../../components/Button';
import { useAttachments } from '../hooks/useAttachments';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { AttachmentViewer } from './AttachmentViewer';
import type { AttachmentParentType } from '../attachmentPersistence';
import type { StampStage } from '../hooks/useAttachments';

interface AttachmentsSectionProps {
  parentType: AttachmentParentType;
  // Omit while the parent (e.g. an in-progress draft report) doesn't exist
  // yet — pair with ensureParentId so the first photo add creates it on
  // demand. See WaterFormShell's ensureDraftReport.
  parentId?: string;
  ensureParentId?: () => Promise<string>;
  canEdit: boolean;
}

const STAMP_STAGE_LABEL: Record<Exclude<StampStage, null>, string> = {
  locating: 'Getting your location…',
  geocoding: 'Looking up the address…',
  stamping: 'Applying the geotag stamp…',
  saving: 'Saving photo…',
};

// Photos are additive/list-based rather than field edits, so this always
// shows its Add buttons (when canEdit) instead of following the
// Edit/Save/Cancel pattern the rest of the report detail screen uses (see
// SectionEditActions) — there's no single "draft" to commit or discard.
//
// There's no per-tile delete button — deleting is bulk-only, entered by
// long-pressing any tile, which both flips the grid into selection mode and
// selects that tile. A toolbar (Close / Delete) replaces the normal Add
// buttons while selection mode is active.
export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({ parentType, parentId, ensureParentId, canEdit }) => {
  const { items, loading, busy, error, stampStage, addFromCamera, addFromLibrary, removeMany, saveCaption, captureNode } =
    useAttachments(parentType, parentId, ensureParentId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Covers both the record-write busy flag and the (longer, multi-step)
  // geotag-embedding pipeline — a second tap while either is running would
  // launch a second camera session on top of the first.
  const actionsDisabled = busy || !!stampStage;

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const enterSelection = (attachmentId: string) => {
    if (!canEdit) return;
    setSelectionMode(true);
    setSelectedIds(new Set([attachmentId]));
  };

  const toggleSelect = (attachmentId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(attachmentId)) {
        next.delete(attachmentId);
      } else {
        next.add(attachmentId);
      }
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const choice = await showPrompt({
      title: `Delete ${ids.length} photo${ids.length === 1 ? '' : 's'}?`,
      message: 'These photos will be removed from the report.',
      tone: 'danger',
      actions: [
        { id: 'cancel', label: 'Cancel', variant: 'cancel' },
        { id: 'delete', label: 'Delete', variant: 'danger' },
      ],
    });
    if (choice !== 'delete') return;
    await removeMany(ids);
    exitSelection();
  };

  return (
    <FormSection icon="images-outline" title="Attachments">
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <TouchableOpacity style={styles.selectionCloseBtn} onPress={exitSelection} activeOpacity={0.75}>
            <Ionicons name="close" size={20} color={Colors.navy} />
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          <TouchableOpacity
            style={styles.selectionDeleteBtn}
            onPress={handleBulkDelete}
            activeOpacity={0.75}
            disabled={selectedIds.size === 0 || busy}>
            {busy ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={Colors.white} />
            )}
            <Text style={styles.selectionDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        canEdit && (
          <View style={styles.actionsRow}>
            <Button
              label="Take Photo"
              icon="camera-outline"
              variant="outline"
              onPress={addFromCamera}
              disabled={actionsDisabled}
            />
            <Button
              label="Choose from Library"
              icon="image-outline"
              variant="outline"
              onPress={addFromLibrary}
              disabled={actionsDisabled}
            />
            {busy && !stampStage && <ActivityIndicator size="small" color={Colors.navy} />}
          </View>
        )
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {loading ? (
        <ActivityIndicator size="small" color={Colors.textMuted} style={styles.loadingState} />
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>
          {canEdit ? 'No photos yet — add one above.' : 'No photos attached to this report.'}
        </Text>
      ) : (
        <View style={styles.grid}>
          {items.map((item, index) => (
            <AttachmentThumbnail
              key={item.attachmentId}
              attachment={item}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.attachmentId)}
              onPress={() => {
                if (selectionMode) {
                  toggleSelect(item.attachmentId);
                } else {
                  setViewerIndex(index);
                }
              }}
              onLongPress={() => enterSelection(item.attachmentId)}
            />
          ))}
        </View>
      )}

      {captureNode}

      <AttachmentViewer
        items={items}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        canEdit={canEdit}
        onClose={() => setViewerIndex(null)}
        onSaveCaption={saveCaption}
      />

      <Modal visible={!!stampStage} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={Colors.navy} />
            <Text style={styles.processingText}>
              {stampStage ? STAMP_STAGE_LABEL[stampStage] : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </FormSection>
  );
};

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  selectionCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectionCount: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
  },
  selectionDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.conflict,
  },
  selectionDeleteText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  loadingState: {
    marginVertical: 12,
  },
  emptyText: {
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: 12,
    color: Colors.conflict,
    marginBottom: 10,
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingCard: {
    minWidth: 220,
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  processingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.navy,
    textAlign: 'center',
  },
});
