import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, StyleSheet } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmptyState } from '../../../components/EmptyState';
import { Section } from '../../../components/Section';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { useGuardedPress } from '../../../utils/useGuardedPress';
import { deleteInspectionReportRecord } from '../../inspections/reportPersistence';
import { AllReportItem, ReportStatusFilter, canManageAllRecords } from '../hooks/useEstablishment';
import { useReportBrowser } from '../hooks/useReportBrowser';
import { ReportFilterSheet } from './ReportFilterSheet';
import { ReportListCard } from './ReportListCard';

const PAGE_SIZE = 5;

const STATUS_FILTERS: { key: ReportStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
];

export interface ManageReportsTabHandle {
  refresh: () => Promise<void>;
}

export const ManageReportsTab = forwardRef<ManageReportsTabHandle>((_props, ref) => {
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const browser = useReportBrowser();
  const { reports, loading, error, refetch, activeFilterCount, state } = browser;

  const { municipalities, session, role } = useAuthContext();
  const currentUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';
  const isDeveloper = canManageAllRecords(role ?? '');

  // Search, status, and every filter sheet field reset pagination back to
  // page 1 — SORT ORDER deliberately does not (matching the pre-extraction
  // behavior, where only the sort SelectField's onSelect skipped the
  // setPage(1) call the other five fields all made). `state` bundles
  // sortOrder in with everything else (ReportFilterSheet needs it there to
  // render the current sort label), so this effect can't just depend on the
  // whole `state` object the way the other reset-on-change fields would
  // suggest — that would fire on a sort-only change too. Depending on the
  // individual fields below, sortOrder deliberately omitted, keeps the
  // asymmetry intact.
  useEffect(() => {
    setPage(1);
  }, [state.search, state.statusFilter, state.province, state.city, state.reportType, state.dateFrom, state.dateTo]);

  // clearFilters resets to page 1 unconditionally, even when no filter was
  // actually active (so nothing above changed and the effect wouldn't have
  // fired) — matching the original clearFilters, which called setPage(1)
  // itself on every press rather than relying on a value actually changing.
  const handleClearFilters = useCallback(() => {
    browser.clearFilters();
    setPage(1);
  }, [browser]);

  useImperativeHandle(ref, () => ({ refresh: refetch }), [refetch]);

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const paginated = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleOpen = useGuardedPress((item: AllReportItem) => {
    if (item.kind === 'inspection') {
      router.push({ pathname: '/inspection/[id]', params: { id: item.reportId } });
    } else {
      router.push({ pathname: '/survey/[id]', params: { id: item.reportId } });
    }
  });

  // Only inspection reports are deletable here, and only by their owner or a
  // Developer account — ReportListCard already hides the button otherwise.
  const handleDelete = useCallback(
    async (item: AllReportItem) => {
      if (item.kind !== 'inspection' || !(item.inspectorUid === currentUid || isDeveloper)) return;
      const choice = await showPrompt({
        title: 'Delete report?',
        message: `This report for "${item.estabName}" will be removed.`,
        tone: 'danger',
        actions: [
          { id: 'cancel', label: 'Cancel', variant: 'cancel' },
          { id: 'delete', label: 'Delete', variant: 'danger' },
        ],
      });
      if (choice !== 'delete') return;
try {
            await deleteInspectionReportRecord(item.reportId);
            refetch();
          } catch (err) {
            console.error('[ManageReportsTab] Failed to delete report:', err);
            void showPrompt({ title: 'Delete failed', message: err instanceof Error ? err.message : 'Something went wrong.', tone: 'danger' });
          }
    },
    [currentUid, isDeveloper, refetch],
  );

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={Colors.navy} />
        <Text style={styles.stateText}>Loading reports...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.conflict} />
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={refetch}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry loading reports">
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by establishment name..."
            placeholderTextColor={Colors.textMuted}
            value={state.search}
            onChangeText={browser.setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {state.search.length > 0 && (
            <TouchableOpacity
              onPress={() => browser.setSearch('')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFiltersOpen(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Filter reports">
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? Colors.textWhite : Colors.textMuted}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => {
          const isActive = state.statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => browser.setStatusFilter(f.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Show ${f.label.toLowerCase()} reports`}>
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Section title="REPORTS" right={<Text style={styles.sectionCount}>{reports.length} total</Text>} />

      {paginated.length === 0 ? (
        <EmptyState
          icon="document-outline"
          message={
            state.search || state.statusFilter !== 'all' || activeFilterCount > 0
              ? 'No reports match your filters.'
              : 'No reports yet.'
          }
        />
      ) : (
        paginated.map(item => (
          <ReportListCard
            key={item.key}
            item={item}
            currentUid={currentUid}
            canManageAll={isDeveloper}
            onPress={handleOpen}
            onEdit={handleOpen}
            onDelete={handleDelete}
          />
        ))
      )}

      {totalPages > 1 && (
        <View style={styles.pager}>
          <TouchableOpacity
            onPress={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Previous page">
            <View style={styles.pageArrow}>
              <Ionicons name="chevron-back" size={13} color={page === 1 ? Colors.textLight : Colors.textMuted} />
              <Text style={[styles.pageArrowText, page === 1 && styles.pageDisabled]}>Previous</Text>
            </View>
          </TouchableOpacity>

          {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPage(p)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Go to page ${p}`}>
              <View style={[styles.pageNum, p === page && styles.pageNumActive]}>
                <Text style={[styles.pageNumText, p === page && styles.pageNumTextActive]}>{p}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {totalPages > 4 && (
            <>
              <Text style={styles.pageDots}>…</Text>
              <TouchableOpacity
                onPress={() => setPage(totalPages)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Go to page ${totalPages}`}>
                <View style={[styles.pageNum, page === totalPages && styles.pageNumActive]}>
                  <Text style={[styles.pageNumText, page === totalPages && styles.pageNumTextActive]}>
                    {totalPages}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Next page">
            <View style={styles.pageArrow}>
              <Text style={[styles.pageArrowText, page === totalPages && styles.pageDisabled]}>Next</Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={page === totalPages ? Colors.textLight : Colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <ReportFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        browser={{ ...browser, clearFilters: handleClearFilters }}
        municipalities={municipalities}
      />
    </View>
  );
});

ManageReportsTab.displayName = 'ManageReportsTab';

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  centeredState: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    gap: Spacing.sm,
  },
  stateText: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.navy,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  retryText: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Type.bodySm.fontSize,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgLight,
  },
  filterBtnActive: {
    backgroundColor: Colors.navy,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xxs,
    backgroundColor: Colors.conflict,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: Type.caption.fontSize,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  filterChipText: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.textWhite,
  },
  sectionCount: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textLight,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  pageArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
  },
  pageArrowText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  pageDisabled: {
    color: Colors.textLight,
  },
  pageNum: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgLight,
  },
  pageNumActive: {
    backgroundColor: Colors.navy,
  },
  pageNumText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  pageNumTextActive: {
    color: Colors.textWhite,
  },
  pageDots: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
});
