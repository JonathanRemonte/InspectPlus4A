import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../../components/AppText';
import { RowActionsButton, type RowAction } from '../../../components/RowActionsButton';
import { DueCountBadge } from '../../../components/DueCountBadge';
import { Colors } from '../../../design/colors';
import { Elevation } from '../../../design/elevation';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { formatEstablishmentLocation } from '../../../utils/establishmentLocation';
import { REPORT_TYPES, ReportTypeKey } from '../../../constants/reportTypes';
import { confirmResolveConflict } from '../../../services/sync/syncConflictResolution';
import type { EstablishmentDTO, ComplianceTag } from '../types';

interface EstablishmentCardProps {
  item: EstablishmentDTO;
  onPress?: (item: EstablishmentDTO) => void;
  onAdd?: (item: EstablishmentDTO) => void;
  onEdit?: (item: EstablishmentDTO) => void;
  onDelete?: (item: EstablishmentDTO) => void;
}

// ComplianceTag (the establishment-level rollup label — see
// REPORT_TYPE_TO_TAG in useEstablishment.ts) -> the ReportTypeKey that
// carries its law citation, color scheme, and icon in REPORT_TYPES — the
// same source InspectionReportHeader's type-flag pill reads from. One
// lookup here instead of a second, separately-hardcoded style map means a
// tag's law/colors/icon can never drift from what the report screens show
// for that same type, and a new report type only ever needs adding once.
const TAG_TO_REPORT_TYPE_KEY: Record<ComplianceTag, ReportTypeKey> = {
  'Air Monitoring': 'air',
  'Water Monitoring': 'water',
  'Hazwaste': 'hazwaste_generator',
  'EIA': 'eia',
  'Survey': 'survey',
};

function getTagMeta(tag: ComplianceTag) {
  const found = REPORT_TYPES.find(t => t.key === TAG_TO_REPORT_TYPE_KEY[tag]);
  if (!found) {
    return { label: tag, bg: Colors.bgLight, text: Colors.textMuted, IconAsset: undefined };
  }
  return { label: found.law || found.title, bg: found.bgColor, text: found.textColor, IconAsset: found.iconAsset };
}

const MAX_VISIBLE_TAGS = 3;

const ICON_BOX = 44;

export const EstablishmentCard: React.FC<EstablishmentCardProps> = ({
  item,
  onPress,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const visibleTags = item.complianceTags.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = item.complianceTags.length - MAX_VISIBLE_TAGS;

  // Edit/Delete are owner-only actions (see ManageEstablishmentsTab) — the
  // caller passes undefined for a jurisdiction-visible establishment that
  // isn't the current user's own, so those buttons (and the swipe distance
  // needed to reveal them) simply don't exist rather than rendering as

  // Actions the current caller has wired up. Order is the menu's order.
  const actions: RowAction[] = [
    ...(onAdd ? [{ id: 'add', label: 'Add Report', onSelect: () => onAdd(item) }] : []),
    ...(onEdit ? [{ id: 'edit', label: 'Edit', onSelect: () => onEdit(item) }] : []),
    ...(onDelete ? [{ id: 'delete', label: 'Delete', variant: 'danger' as const, onSelect: () => onDelete(item) }] : []),
  ];

  return (
    <View style={styles.rowWrap}>
      <TouchableOpacity
            style={styles.card}
        onPress={() => onPress?.(item)}
            activeOpacity={onPress ? 0.9 : 1}
            disabled={!onPress}>
            {/* Icon */}
            {/* The due count rides the building icon the way an unread count
                rides an app icon: the establishment itself isn't overdue, its
                reports are, so the badge hangs off the thing that stands for
                the establishment rather than sitting in the content. */}
            <View style={styles.iconWrap}>
              <Ionicons name="business" size={22} color={Colors.textLight} />
              <DueCountBadge summary={item.dueReports} style={styles.dueBadge} />
            </View>

            {/* Content */}
            <View style={styles.content}>
              <AppText variant="marquee" text={item.name} style={styles.name} containerStyle={styles.nameContainer} />

              {/* Location */}
              <View style={styles.locationRow}>
                <Ionicons name="location" size={10} color={Colors.conflict} />
                <AppText
                  variant="marquee"
                  text={formatEstablishmentLocation(item)}
                  style={styles.location}
                  containerStyle={styles.locationContainer}
                />
              </View>

              {/* Compliance tags */}
              <View style={styles.tagRow}>
                {visibleTags.map(tag => {
                  const meta = getTagMeta(tag);
                  return (
                    <View key={tag} style={[styles.tag, { backgroundColor: meta.bg }]}>
                      {meta.IconAsset && <meta.IconAsset width={9} height={9} />}
                      <Text style={[styles.tagText, { color: meta.text }]} numberOfLines={1}>
                        {meta.label}
                      </Text>
                    </View>
                  );
                })}
                {overflowCount > 0 && (
                  <View style={styles.tagOverflow}>
                    <Text style={styles.tagOverflowText}>+{overflowCount} more</Text>
                  </View>
                )}

                {/* Empty state — no reports yet */}
                {item.complianceTags.length === 0 && (
                  <Text style={styles.noTags}>No reports yet</Text>
                )}
              </View>

              {/* Sync status sits last in the card body, below the tags, so
                  it reads as a footer note rather than competing with the
                  name/location/tags for attention. */}
              {item.syncStatus === 'pending' && (
                <View style={styles.syncRow}>
                  <Ionicons name="cloud-upload-outline" size={10} color={Colors.pending} />
                  <Text style={styles.syncText}>Pending sync</Text>
                </View>
              )}
              {item.syncStatus === 'conflict' && (
                <TouchableOpacity
                  style={styles.syncRow}
                  onPress={() => confirmResolveConflict('establishments', item.estabId, item.name)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="alert-circle-outline" size={10} color={Colors.conflict} />
                  <Text style={[styles.syncText, { color: Colors.conflict }]}>Sync conflict</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Chevron */}
            {/* The overflow menu replaces the chevron when this row has
                actions; a row with none keeps the chevron so the trailing
                edge still reads as "tap to open". */}
            {actions.length > 0 ? (
              <RowActionsButton title={item.name} actions={actions} />
            ) : (
              <Ionicons name="chevron-forward" size={14} color={Colors.textLight} />
            )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  rowWrap: {
    marginBottom: Spacing.md,
  },
  actionAddText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  actionEditText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  actionDeleteText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    ...Elevation.raised,
  },
  iconWrap: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Overhangs the icon's top-right so it reads as a count ON the icon rather
  // than a chip beside it. Nothing here clips: the card sets no overflow.
  dueBadge: {
    position: 'absolute',
    top: -7,
    right: -10,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nameContainer: {
    marginBottom: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  location: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textMuted,
  },
  locationContainer: {
    flex: 1,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    // Now the last element in the card body (below the tags) rather than
    // sitting mid-card between location and tags, so it needs space above
    // itself instead of below.
    marginTop: Spacing.xs,
  },
  syncText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.pending,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xxs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
  },
  tagText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
  },
  tagOverflow: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
  },
  tagOverflowText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  noTags: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
});
