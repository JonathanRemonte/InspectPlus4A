import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../../components/AppText';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { UrgencyRibbon } from '../../../components/UrgencyRibbon';
import { REPORT_TYPE_DISPLAY, ReportDataKey } from '../../../constants/reportTypeDisplay';
import { Colors } from '../../../design/colors';
import { Duration } from '../../../design/motion';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { FONT_SCALING, Type } from '../../../design/typography';
import { getReportUrgency } from '../../../utils/reportUrgency';
import type { EstablishmentReportItem } from '../hooks/useEstablishment';

interface EstablishmentReportsSectionProps {
  reports: EstablishmentReportItem[];
  loading?: boolean;
  currentUid: string;
  // Developer accounts can manage every report, not just their own — see
  // canManageAllRecords.
  canManageAll: boolean;
  onAddReport: () => void;
  onOpenReport: (item: EstablishmentReportItem) => void;
  onDeleteReport: (item: EstablishmentReportItem) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Swipe-to-reveal Delete, matching ReportListCard's (Manage Reports tab)
// gesture treatment — this section only ever shows a single action, unlike
// ReportListCard's Edit+Delete, so revealWidth is just one ACTION_WIDTH or 0.
const ACTION_WIDTH = 72;
const OPEN_THRESHOLD_RATIO = 0.4;

const ReportRow: React.FC<{
  item: EstablishmentReportItem;
  onOpen: () => void;
  onDelete: () => void;
  showDelete: boolean;
}> = ({ item, onOpen, onDelete, showDelete }) => {
  const urgency = getReportUrgency(item.date, item.status);
  // An unrecognized type still renders — a report written by a newer app
  // version shouldn't produce a blank row on an older one. Matches
  // ReportListCard's fallback so the two components can't drift again.
  const display = REPORT_TYPE_DISPLAY[item.reportType as ReportDataKey];

  const revealWidth = showDelete ? ACTION_WIDTH : 0;
  const openThreshold = revealWidth * OPEN_THRESHOLD_RATIO;

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const close = () => {
    translateX.value = withTiming(0, { duration: Duration.base });
  };

  const panGesture = Gesture.Pan()
    .enabled(revealWidth > 0)
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate(e => {
      translateX.value = Math.min(0, Math.max(-revealWidth, startX.value + e.translationX));
    })
    .onEnd(() => {
      translateX.value = withTiming(
        translateX.value < -openThreshold ? -revealWidth : 0,
        { duration: Duration.base },
      );
    });

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // A tap while the row is swiped open snaps it shut instead of opening the
  // report — same convention as ReportListCard.
  const handlePress = () => {
    if (translateX.value < -1) {
      close();
      return;
    }
    onOpen();
  };

  const handleDelete = () => {
    close();
    onDelete();
  };

  return (
    <View style={styles.rowWrap}>
      {showDelete && (
        <View style={styles.swipeActions}>
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={handleDelete}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.title}`}>
            <Ionicons name="trash-outline" size={20} color={Colors.textWhite} />
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <GestureDetector gesture={panGesture}>
        <Animated.View style={rowAnimatedStyle}>
          <TouchableOpacity
            style={[
              styles.row,
              urgency.level === 'overdue' && styles.rowOverdue,
              urgency.level === 'due-soon' && styles.rowDueSoon,
            ]}
            onPress={handlePress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={item.title}>
            {/* See ReportListCard — same corner treatment, same reason for
                clipping inside the SVG rather than on the row. */}
            <UrgencyRibbon urgency={urgency} />

            <View style={[styles.iconWrap, { backgroundColor: display?.bgColor ?? Colors.bgLight }]}>
              <Ionicons
                name={display?.icon ?? 'document-outline'}
                size={17}
                color={display?.textColor ?? Colors.textMuted}
              />
            </View>
            <View style={styles.content}>
              <AppText variant="marquee" text={item.title} style={styles.title} />
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={10} color={Colors.textMuted} />
                <Text style={styles.date}>{formatDate(item.date)}</Text>
                {/* The pricetag icon and control number travel together as
                    one unit, pushed to the end of the row by flexGrow: 1 +
                    justifyContent: 'flex-end' on the group (below) rather
                    than sitting right after the date — the date and its icon
                    stay put at the start via their own flexShrink: 0.
                    dateRow's existing `gap` still guarantees a minimum
                    separation from the date even when the group is short
                    enough that it wouldn't otherwise need the room. (An
                    earlier version of this used
                    marginLeft: 'auto' instead, which reads as "push me to
                    the end" but silently no-ops in Yoga on some RN
                    versions when the parent row also declares `gap` — the
                    row rendered pixel-identical to no alignment at all,
                    passing every unit test because they only asserted the
                    style prop was applied, never that the group actually
                    moved. flexGrow + justifyContent doesn't depend on that
                    auto-margin/gap interaction at all.) */}
                <View style={styles.controlNoGroup}>
                  {/* Decorative: the control number text right beside it
                      already carries the meaning, so it stays out of the
                      accessibility tree — same treatment as Button.tsx's own
                      icons. Matches the calendar icon's size/color so both
                      icons in this row read as one family; flexShrink: 0
                      keeps it from being squeezed within the group. */}
                  <Ionicons
                    name="pricetag-outline"
                    size={10}
                    color={Colors.textMuted}
                    style={styles.controlNoIcon}
                    importantForAccessibility="no"
                  />
                  {/* The control number now shares the date's exact style —
                      size, line height, colour and font family — rather than
                      merely matching size, because the two are meant to read
                      as one even though the group now sits at the opposite
                      end of the row from the date. FONT_SCALING.tabular (OS
                      font scaling disabled) existed to protect this text
                      when it sat alone on its own line with no truncation;
                      it now carries numberOfLines={1}/ellipsizeMode="tail"
                      below, so an over-long value truncates rather than
                      overflowing — that's what protects the row now, so the
                      scaling opt-out would only reintroduce a new
                      inconsistency (the date growing under a large system
                      font while this stayed fixed). It switches to
                      FONT_SCALING.content, the same scaling behavior as the
                      date. flexShrink: 1 below (plus the group's own
                      flexShrink: 1/minWidth: 0) still makes this the element
                      that truncates first, so a long control number still
                      can't clip the date or push the urgency badge off the
                      row — matches ReportListCard's controlNo. It
                      deliberately carries no flexGrow: a growing child would
                      claim all of controlNoGroup's width for itself, leaving
                      justifyContent: 'flex-end' on the group nothing to push
                      against — the exact bug this task fixes. textAlign:
                      'right' below is a second line of defence in case this
                      Text's box is ever wider than its content. */}
                  <Text
                    style={styles.controlNo}
                    allowFontScaling={FONT_SCALING.content}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {item.controlNo || 'No control number yet'}
                  </Text>
                </View>
              </View>
              {/* Filing status, same chip ReportListCard shows on the
                  Manage Reports tab - without it the same report read as
                  statusless depending on which screen you opened it from.
                  Urgency stays on the corner ribbon. */}
              {item.status && (
                <Badge
                  label={item.status === 'submitted' ? 'Submitted' : 'Draft'}
                  tone={item.status === 'submitted' ? 'success' : 'warning'}
                  style={styles.statusBadge}
                />
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export const EstablishmentReportsSection: React.FC<EstablishmentReportsSectionProps> = ({
  reports,
  loading,
  currentUid,
  canManageAll,
  onAddReport,
  onOpenReport,
  onDeleteReport,
}) => (
  <View style={styles.section}>
    <View style={styles.headerRow}>
      <View style={styles.headerTitleRow}>
        <Ionicons name="document-text-outline" size={16} color={Colors.navy} />
        <Text style={styles.headerTitle}>Inspection Reports</Text>
      </View>
      {/* A section-header action, not the screen's one primary — the
          EstablishmentHeaderCard's filled Add Report already fills that
          role, so this stays outline to avoid two filled navy buttons on
          the same screen. */}
      <Button label="Add Report" icon="add" variant="outline" size="sm" onPress={onAddReport} />
    </View>

    {loading ? (
      <View style={styles.loadingState}>
        <ActivityIndicator size="small" color={Colors.navy} />
      </View>
    ) : reports.length === 0 ? (
      <EmptyState icon="document-outline" message="No reports filed yet for this establishment." />
    ) : (
      reports.map(item => (
        <ReportRow
          key={item.key}
          item={item}
          onOpen={() => onOpenReport(item)}
          onDelete={() => onDeleteReport(item)}
          // Delete is only wired up for inspection reports, and only for
          // the inspector who owns the record or a Developer account —
          // matches the "own record" / Developer-full-access delete RLS
          // policies on the backend.
          showDelete={item.kind === 'inspection' && (item.inspectorUid === currentUid || canManageAll)}
        />
      ))
    )}
  </View>
);

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Type.subheading.fontSize,
    lineHeight: Type.subheading.lineHeight,
    fontWeight: '700',
    color: Colors.navy,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  rowWrap: {
    marginBottom: Spacing.md,
  },
  swipeActions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  // Same "delete" red as ReportListCard/EstablishmentCard's swipe actions —
  // this row previously hardcoded its own separate red hex instead of
  // reusing it.
  deleteAction: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.conflict,
  },
  deleteActionText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  rowDueSoon: {
    borderColor: Colors.warning.border,
    backgroundColor: Colors.warning.bg,
  },
  rowOverdue: {
    borderColor: Colors.hazwaste.border,
    backgroundColor: Colors.hazwaste.bg,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  // Matches ReportListCard's "title" token choice.
  title: {
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    marginTop: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  // Matches ReportListCard's "date" token choice. Fixed width in the row —
  // the control number is what shrinks/truncates, not the date.
  date: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  controlNo: {
    // Identical to the date's style below — size, line height, colour and
    // font family — now that the two share one row and are meant to read as
    // one, even though the group sits at the opposite end from the date.
    // There is no fontFamily override here (it used to be 'monospace'):
    // dropping it leaves this on the same default family as the date, which
    // is what "same font style" means for this row.
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textMuted,
    // Must SHRINK (so a long value truncates within controlNoGroup, together
    // with numberOfLines/ellipsizeMode above) but must NEVER GROW. flex: 1
    // here was the actual bug: it's shorthand for flexGrow: 1 too, so the
    // text grew to fill controlNoGroup completely, leaving
    // justifyContent: 'flex-end' on the group zero free space to distribute
    // — the text rendered flush against the group's (and row's) start
    // instead of its end. flexShrink: 1 alone keeps the truncation without
    // reintroducing that growth. textAlign: 'right' is a second line of
    // defence: even if this Text's box ever ends up wider than its content
    // for some other reason, the glyphs still sit right-aligned inside it.
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  // Never squeezed by a long control number sharing the row — same
  // flexShrink: 0 guard as the date and urgency badge.
  controlNoIcon: {
    flexShrink: 0,
  },
  // Glues the pricetag icon and control number text together as one unit
  // and pushes that unit to the end of dateRow by growing to fill the row's
  // remaining space (flexGrow: 1) and right-aligning its own children
  // (justifyContent: 'flex-end') — dateRow deliberately keeps
  // flexDirection: 'row' rather than justifyContent: 'space-between', which
  // would also spread the date, icon and badge apart. flexShrink: 1 plus
  // minWidth: 0 (rather than the default flexShrink: 0 every other dateRow
  // child pins explicitly) let this group give way when a long control
  // number would otherwise overflow the row, so controlNo's own flex: 1/
  // numberOfLines still get a chance to truncate it instead of the row
  // overflowing. The icon and text stay adjacent (only the `gap` above
  // separates them) so flex-end carries them to the row's end together —
  // the icon can't be stranded mid-row on its own.
  controlNoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
