import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { FlatList, View, Text, TextInput, TouchableOpacity, Keyboard, StyleSheet, RefreshControlProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Section } from '../../../components/Section';
import { Skeleton } from '../../../components/Skeleton';
import { Colors } from '../../../design/colors';
import { Elevation } from '../../../design/elevation';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { useSetFabHidden } from '../../home/context/FabVisibilityContext';
import { useScreenFooter } from '../../home/context/ScreenFooterContext';
import { useExportReports } from '../../export/hooks/useExportReports';
import { GENERATE_BOTTOM_GAP } from '../../export/exportLayout';
import { hasTemplate } from '../../export/templates';
import { asyncStorageSignatoryProvider, emptySignatories } from '../../export/signatories';
import { SignatorySheet } from '../../export/components/SignatorySheet';
import { ExportProgressBar } from '../../export/components/ExportProgressBar';
import type { ExportItem } from '../../export/exportReports';
import type { Signatories } from '../../export/types';
import { AllReportItem, canManageAllRecords } from '../hooks/useEstablishment';
import { useReportBrowser } from '../hooks/useReportBrowser';
import { ReportFilterSheet } from './ReportFilterSheet';
import { ReportListCard } from './ReportListCard';

const SKELETON_ROW_HEIGHT = 96;

export interface ExportReportsTabHandle {
  refresh: () => Promise<void>;
}

const NO_TEMPLATE_REASON = 'No template yet';
const canExport = (item: AllReportItem) => hasTemplate(item.kind, item.reportType);
// The report type the currently-open (or most recently confirmed)
// signatory sheet is for — set once in openSheet from the first selected
// item, and what runExport's save() keys off, regardless of which items a
// later retry actually passes it. See runExport below for why this can't
// just be `items[0]` of whatever's being (re)exported.
type SheetType = { kind: AllReportItem['kind']; reportType: string };
const toExportItem = (item: AllReportItem): ExportItem => ({
  key: item.key,
  kind: item.kind,
  reportId: item.reportId,
  reportType: item.reportType,
  title: item.title,
  estabName: item.estabName,
  date: item.date,
});

interface ExportReportsTabProps {
  // Whether this tab is the page Home is showing. Home keeps visited pages
  // mounted so a swipe back is instant, so this component can be alive
  // behind another tab — and its pinned selection bar must not be.
  focused?: boolean;
  // This tab is its own scroller (see the FlatList below), so Home hands
  // its pull-to-refresh control in rather than wrapping the tab in one.
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export const ExportReportsTab = forwardRef<ExportReportsTabHandle, ExportReportsTabProps>(({ focused = true, refreshControl }, ref) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const browser = useReportBrowser();
  const { reports, loading, error, refetch, activeFilterCount, state } = browser;

  const { municipalities, session, role, fullName } = useAuthContext();
  const currentUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';
  const isDeveloper = canManageAllRecords(role ?? '');

  const exporter = useExportReports();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The initial value here is never actually shown — sheetOpen starts
  // false, and openSheet always overwrites it (resolved for the right
  // report type) before the sheet opens.
  const [signatories, setSignatories] = useState<Signatories>(() => emptySignatories(fullName, 'inspection', ''));
  // Set once, in openSheet — NOT re-derived from whatever items a later
  // retry passes runExport, which may be a filtered subset of a mixed
  // selection (e.g. only the Air report out of a Water+Air run, once the
  // Water one already succeeded) and would otherwise save the
  // Water-prefilled approvers under air_monitoring.
  const [sheetType, setSheetType] = useState<SheetType | null>(null);
  const busy = exporter.phase.status !== 'idle';

  // Derived from the live list rather than stored alongside it, so a
  // selection can't survive a filter change that removes the report.
  const selectedItems = useMemo(
    () => reports.filter(report => selectedKeys.has(report.key)),
    [reports, selectedKeys],
  );
  const draftCount = selectedItems.filter(report => report.status === 'draft').length;
  // The approvers a form prints are per report type — mixing Water and
  // Hazwaste in one run means whichever type's approvers the sheet shows
  // (the first selected item's) apply to every report in the run, not just
  // that one, so the sheet says so.
  const mixedTypes = useMemo(
    () => new Set(selectedItems.map(item => `${item.kind}:${item.reportType}`)).size > 1,
    [selectedItems],
  );
  // Only reports with a template can be selected/exported at all, so "every
  // report" for Select all's purposes means every exportable one — a
  // Hazwaste TSD (say) sitting in the list shouldn't stop the toggle from
  // ever reading as "all selected", nor get swept in when it fires.
  const exportable = useMemo(() => reports.filter(canExport), [reports]);
  const allSelected = exportable.length > 0 && selectedItems.length === exportable.length;

  // The FAB would sit on top of the selection bar. Restored automatically
  // when the selection clears or the tab unmounts.
  useSetFabHidden(selectedItems.length > 0);

  const toggleSelect = (item: AllReportItem) => {
    if (!canExport(item)) return;
    setSelectedKeys(previous => {
      const next = new Set(previous);
      if (next.has(item.key)) {
        next.delete(item.key);
      } else {
        next.add(item.key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    // A run in flight already freezes selection at the card level (see
    // selectDisabled below) — this closes the same door at the Select
    // all/Clear all control, which would otherwise bypass it entirely and
    // mutate selectedKeys out from under a run that's using selectedItems
    // (un-hiding the FAB over the progress bar, changing what a subsequent
    // "Retry failed" operates on).
    if (busy) return;
    setSelectedKeys(allSelected ? new Set() : new Set(exportable.map(report => report.key)));
  };

  const openSheet = async () => {
    // Prefilled from the FIRST selected item's report type — the only one
    // the sheet can sensibly key off when the selection spans several (see
    // mixedTypes above, which tells the inspector as much). Captured in
    // sheetType too, so a later save (in runExport) keys off the type the
    // sheet was actually opened/confirmed for, not whatever subset of items
    // a retry happens to pass it.
    const first = selectedItems[0];
    if (!first) return;
    const type: SheetType = { kind: first.kind, reportType: first.reportType };
    setSheetType(type);
    const loaded = await asyncStorageSignatoryProvider.loadFor(type.kind, type.reportType);
    // loadFor resolves the inspector name from storage, blank if nothing
    // was ever saved — the profile's fullName is only a fallback for that
    // "nothing saved yet" case, same as the previous emptySignatories(fullName)
    // fallback (Generate requires a non-empty inspector name to save at
    // all, so a genuinely saved record's name is never blank in practice).
    setSignatories(loaded.inspectorName ? loaded : { ...loaded, inspectorName: fullName ?? '' });
    setSheetOpen(true);
  };

  // `remember` is false for a retry (see retryFailed below): a retry reuses
  // the `signatories` the sheet was already confirmed with, saved once at
  // that confirm — re-saving it under sheetType on every retry would be at
  // best redundant, and if a filtered subset of a mixed-type run is being
  // retried, `items` no longer represents the type the sheet was actually
  // for, so it must not be used to key a save at all here (that's exactly
  // last review's bug: saving under items[0] instead of sheetType).
  const runExport = async (items: AllReportItem[], s: Signatories, remember = true) => {
    setSheetOpen(false);
    setSignatories(s);
    if (remember && sheetType) {
      // Remembering the signatories is a convenience, not a gate — a full
      // AsyncStorage or a write failure shouldn't leave the sheet closed
      // with nothing running (and, unhandled, would surface as an
      // unhandled rejection).
      try {
        await asyncStorageSignatoryProvider.save(s, sheetType.kind, sheetType.reportType);
      } catch (e) {
        console.warn('[ExportReportsTab] could not remember signatories', e);
      }
    }
    await exporter.start(items.map(toExportItem), s);
  };

  // Retrying after a run that fully failed (status 'error', thrown before
  // any per-item result existed) re-sends every selected report; retrying
  // after a run that reached 'done' with some failures re-sends only those —
  // UNLESS the failures include the orchestrator's synthetic 'export' entry
  // (a failure saving/sharing the whole export, not any one item — see
  // exportReports.ts), which matches no report's key. Filtering by
  // failedKeys against that entry alone would empty the retry set entirely
  // and runExport([]) would reset the export dir and report 0 done, silently
  // discarding every already-succeeded file. The run's items are always
  // exactly the selection (frozen while busy), so retry the whole thing.
  const retryFailed = () => {
    if (exporter.phase.status !== 'done' && exporter.phase.status !== 'error') return;
    const failedKeys =
      exporter.phase.status === 'done' ? new Set(exporter.phase.result.failures.map(f => f.key)) : null;
    const items =
      failedKeys && !failedKeys.has('export') ? selectedItems.filter(item => failedKeys.has(item.key)) : selectedItems;
    // Reuses the signatories already saved at the original confirm — a
    // retry never re-saves (see runExport's `remember` param above).
    void runExport(items, signatories, false);
  };

  // Mirrors ManageReportsTab's handle: Home drives this from pull-to-refresh
  // and the sync-data-changed subscription. selectedKeys is deliberately left
  // untouched here — selectedItems above is already derived from the live
  // `reports` list, so a report that a refresh removes (deleted, or filtered
  // out by a change synced elsewhere) silently drops out of the selection on
  // its own, while everything still present stays picked. Clearing the whole
  // selection on every refresh would punish the common case (an unrelated
  // background sync landing while the inspector is mid-pick) far more than it
  // protects against the rare one.
  useImperativeHandle(ref, () => ({ refresh: refetch }), [refetch]);

  // Registered rather than rendered inline: this component is one page of
  // HomeScreen's pager, so an absolutely-positioned bar would anchor to the
  // scrolling content and slide away instead of pinning to the viewport.
  // See useScreenFooter for why this takes a factory plus deps.
  useScreenFooter(
    () => {
      if (!focused) return null;
      // A run in flight (or just finished) replaces the selection bar
      // outright — its own Cancel/Retry/Done actions are the only ones that
      // make sense while exporter.phase isn't idle.
      if (busy) {
        return (
          <ExportProgressBar
            phase={exporter.phase}
            onCancel={exporter.cancel}
            onRetry={retryFailed}
            onDismiss={exporter.reset}
          />
        );
      }
      return selectedItems.length > 0 ? (
        <View style={styles.selectionBar}>
          {/* A template literal, not `{n} selected` — JSX would split that into
              two separate text child nodes ("1", " selected"), which the
              test's JSON.stringify(toJSON())-based assertion can't see as a
              contiguous "1 selected" substring. */}
          <Text style={styles.selectionCount}>{`${selectedItems.length} selected`}</Text>
          {draftCount > 0 && (
            <View style={styles.draftWarning}>
              <Badge label={draftCount === 1 ? '1 draft' : `${draftCount} drafts`} tone="warning" />
              <Text style={styles.draftWarningText}>
                {draftCount} of {selectedItems.length} selected{' '}
                {draftCount === 1 ? 'is a draft' : 'are drafts'} and may be incomplete.
              </Text>
            </View>
          )}
          <Button
            label="Generate"
            onPress={() => { void openSheet(); }}
            variant="primary"
            size="md"
            disabled={selectedItems.length === 0}
            fullWidth
          />
        </View>
      ) : null;
    },
    [focused, selectedItems, draftCount, exporter.phase, signatories],
  );

  // Rows go through a FlatList rather than a map: Export needs the whole
  // filtered set (not a page of five like the Manage tabs) so "select all"
  // means something, and a FlatList mounts only the visible window of it,
  // however many reports the local database accumulates. That only works
  // if this list IS the page's scroller — a FlatList nested in a ScrollView
  // measures as its full height and never virtualises — which is why the
  // search row and header ride inside ListHeaderComponent and Home passes
  // refreshControl in instead of wrapping the tab.
  const renderRow = useCallback(({ item }: { item: AllReportItem }) => (
    <ReportListCard
      item={item}
      currentUid={currentUid}
      canManageAll={isDeveloper}
      // Opening, editing, and deleting are all suppressed while
      // selecting — the row's only job here is to be picked.
      onPress={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      selectable
      selected={selectedKeys.has(item.key)}
      onToggleSelect={toggleSelect}
      // Untemplated types can't be selected at all; a run in flight
      // additionally freezes whatever is already picked, but only the
      // "no template" case gets an explanatory badge.
      selectDisabled={busy || !canExport(item)}
      selectDisabledReason={canExport(item) ? undefined : NO_TEMPLATE_REASON}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleSelect is re-created each render; selectedKeys/busy are what actually change a row
  ), [currentUid, isDeveloper, selectedKeys, busy]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Skeleton height={38} radius={Radius.pill} style={styles.skeletonRow} />
        <Skeleton height={SKELETON_ROW_HEIGHT} style={styles.skeletonRow} />
        <Skeleton height={SKELETON_ROW_HEIGHT} style={styles.skeletonRow} />
        <Skeleton height={SKELETON_ROW_HEIGHT} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          message={error}
          action={<Button label="Retry" onPress={refetch} variant="outline" size="md" />}
        />
      </View>
    );
  }

  // An element, not a component type: a component type would remount the
  // header (and blur the search field) every time the list re-renders.
  const listHeader = (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, busy && styles.controlDisabled]}>
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
            editable={!busy}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive, busy && styles.controlDisabled]}
          onPress={() => setFiltersOpen(true)}
          disabled={busy}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Filter reports">
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? Colors.textWhite : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <Section
        title="SELECT REPORTS TO EXPORT"
        right={
          reports.length > 0 ? (
            <TouchableOpacity
              style={busy && styles.controlDisabled}
              onPress={toggleSelectAll}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={allSelected ? 'Clear all reports' : 'Select all reports'}>
              <Text style={styles.selectAllText}>{allSelected ? 'Clear all' : 'Select all'}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
    </>
  );

  return (
    <>
      <FlatList
        data={reports}
        keyExtractor={keyOf}
        renderItem={renderRow}
        // renderRow closes over these, so a change must re-render the
        // visible rows even though `data` is the same array.
        extraData={selectedKeys}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            icon="document-outline"
            message={
              state.search || activeFilterCount > 0
                ? 'No reports match your filters.'
                : 'No reports to export yet.'
            }
          />
        }
        style={styles.list}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      />

      <ReportFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        browser={browser}
        municipalities={municipalities}
      />

      <SignatorySheet
        visible={sheetOpen}
        initial={signatories}
        mixedTypes={mixedTypes}
        onCancel={() => setSheetOpen(false)}
        onConfirm={s => { void runExport(selectedItems, s); }}
      />
    </>
  );
});

ExportReportsTab.displayName = 'ExportReportsTab';

const keyOf = (item: AllReportItem) => item.key;

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  skeletonRow: {
    marginBottom: Spacing.md,
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
  // Shared by every header control (filter, Select all/Clear all) that
  // freezes while a run is in flight — same reduced-emphasis treatment
  // Button.tsx's own `inactive` style uses, so a disabled control here reads
  // consistently with a disabled Button elsewhere in the app.
  controlDisabled: {
    opacity: 0.55,
  },
  selectAllText: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    fontWeight: '700',
    color: Colors.green,
  },
  selectionBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    // Raises the Generate button off the app's bottom chrome (HomeFooter),
    // matching the signatory sheet's own footer so the button lands at the
    // same y whether or not the sheet is open — see exportLayout.ts.
    paddingBottom: GENERATE_BOTTOM_GAP,
    gap: Spacing.sm,
    ...Elevation.overlay,
  },
  selectionCount: {
    fontSize: Type.subheading.fontSize,
    lineHeight: Type.subheading.lineHeight,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  draftWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  draftWarningText: {
    flex: 1,
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
});
