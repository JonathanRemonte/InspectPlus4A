import React, { useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, Modal, StyleSheet } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmptyState } from '../../../components/EmptyState';
import { Section } from '../../../components/Section';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { useGuardedPress } from '../../../utils/useGuardedPress';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { SelectField } from '../../../components/form';
import { EstablishmentCard } from './EstablishmentCard';
import { archiveEstablishmentRecord } from '../../inspections/establishmentPersistence';
import {
  useEstablishments,
  useEstablishmentFilterOptions,
  EstablishmentFilters,
  canManageAllRecords,
} from '../hooks/useEstablishment';
import type { EstablishmentDTO, ComplianceTag } from '../types';

const PAGE_SIZE = 5;
const ALL_OPTION = 'All';
const COMPLIANCE_TAG_OPTIONS: ComplianceTag[] = [
  'Air Monitoring',
  'Water Monitoring',
  'Hazwaste',
  'EIA',
  'Survey',
];

export interface ManageEstablishmentsTabHandle {
  refresh: () => Promise<void>;
}

export const ManageEstablishmentsTab = forwardRef<ManageEstablishmentsTabHandle>((_props, ref) => {
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [inspectorUid, setInspectorUid] = useState('');
  const [complianceTag, setComplianceTag] = useState<ComplianceTag | ''>('');

  const { provinceOptions, inspectorOptions } = useEstablishmentFilterOptions();
  // The inspector's own assigned municipalities — narrows the (already
  // province-wide-visible) list further, it's not an access boundary.
  const { municipalities, session, role } = useAuthContext();
  const currentUid = (session as { user?: { id?: string } } | null)?.user?.id ?? '';
  const isDeveloper = canManageAllRecords(role ?? '');

  // Stable reference so the filter object only changes when a filter
  // value actually changes — a fresh object literal on every render would
  // re-trigger the data-fetching effect in useEstablishments on a loop.
  const filters: EstablishmentFilters = useMemo(
    () => ({ province, city, inspectorUid, complianceTag }),
    [province, city, inspectorUid, complianceTag],
  );
  const activeFilterCount = [province, city, inspectorUid, complianceTag].filter(Boolean).length;

  // Real WatermelonDB query — replaces MOCK_ESTABLISHMENTS
  const { establishments, loading, error, refetch } = useEstablishments(search, filters);

  // Exposes an awaitable refresh to the parent screen's pull-to-refresh.
  useImperativeHandle(ref, () => ({ refresh: refetch }), [refetch]);

  const totalPages = Math.max(1, Math.ceil(establishments.length / PAGE_SIZE));
  const paginated  = establishments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setProvince('');
    setCity('');
    setInspectorUid('');
    setComplianceTag('');
    setPage(1);
  }, []);

  const selectedInspectorName =
    inspectorOptions.find(o => o.uid === inspectorUid)?.name ?? ALL_OPTION;

  // ── Action handlers ─────────────────────────────────────────────────────────
  // Tap the card itself → open the establishment detail screen.
  const handleOpen = useGuardedPress((item: EstablishmentDTO) => {
    router.push({ pathname: '/establishment/[id]', params: { id: item.estabId } });
  });

  // + Add → navigate to report type selection, carrying the establishment id
  // as a param so the form can pre-fill the snapshot from the master record.
  const handleAdd = useGuardedPress((item: EstablishmentDTO) => {
    router.push({
      pathname: '/report/new',
      params: { estabId: item.estabId },
    });
  });

  const handleEdit = useCallback((item: EstablishmentDTO) => {
    // TODO: navigate to establishment edit screen
    console.log('[ManageReports] Edit establishment:', item.estabId);
  }, []);

  // Establishment "delete" archives the record (see archiveEstablishmentRecord)
  // rather than hard-deleting it — the remote table has no soft-delete column
  // and would reject a hard delete once the establishment has any report
  // history. RLS only grants delete/update rights to the record's own
  // inspector, so this is only ever reachable via a self-owned card — see
  // the isSelf gate applied where EstablishmentCard is rendered below.
  const handleDelete = useCallback(async (item: EstablishmentDTO) => {
    const choice = await showPrompt({
      title: 'Delete establishment?',
      message: `"${item.name}" will be removed from your establishment list. This can be undone by contacting an administrator.`,
      tone: 'danger',
      actions: [
        { id: 'cancel', label: 'Cancel', variant: 'cancel' },
        { id: 'delete', label: 'Delete', variant: 'danger' },
      ],
    });
    if (choice !== 'delete') return;
try {
          await archiveEstablishmentRecord(item.estabId);
          refetch();
        } catch (err) {
          console.error('[ManageEstablishmentsTab] Failed to delete establishment:', err);
          void showPrompt({ title: 'Delete failed', message: err instanceof Error ? err.message : 'Something went wrong.', tone: 'danger' });
        }
  }, [refetch]);

  // ── Render states ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={Colors.navy} />
        <Text style={styles.stateText}>Loading establishments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.conflict} />
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.8}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search + filter trigger */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by establishment name..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={handleSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFiltersOpen(true)}
          activeOpacity={0.75}>
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

      {/* Section label + count */}
      <Section
        title="EXISTING ESTABLISHMENTS"
        right={<Text style={styles.sectionCount}>{establishments.length} total</Text>}
      />

      {/* List */}
      {paginated.length === 0 ? (
        <EmptyState
          icon="business-outline"
          message={
            search || activeFilterCount > 0
              ? 'No establishments match your search or filters.'
              : 'No establishments yet.'
          }
        />
      ) : (
        paginated.map(item => {
          // Edit/Delete are owner-only actions — matches the "own record"
          // RLS policies on the backend (see useEstablishment.ts's jurisdiction
          // comments) — except for Developer accounts, which the backend
          // additionally grants unrestricted write access (see
          // canManageAllRecords). Anyone else viewing a jurisdiction-visible
          // establishment belonging to another inspector only gets the
          // Add-report swipe action.
          const canManage = item.inspectorUid === currentUid || isDeveloper;
          return (
            <EstablishmentCard
              key={item.estabId}
              item={item}
              onPress={handleOpen}
              onAdd={handleAdd}
              onEdit={canManage ? handleEdit : undefined}
              onDelete={canManage ? handleDelete : undefined}
            />
          );
        })
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pager}>
          <TouchableOpacity
            onPress={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            activeOpacity={0.7}>
            <View style={styles.pageArrow}>
              <Ionicons
                name="chevron-back"
                size={13}
                color={page === 1 ? Colors.textLight : Colors.textMuted}
              />
              <Text style={[styles.pageArrowText, page === 1 && styles.pageDisabled]}>
                Previous
              </Text>
            </View>
          </TouchableOpacity>

          {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map(p => (
            <TouchableOpacity key={p} onPress={() => setPage(p)} activeOpacity={0.7}>
              <View style={[styles.pageNum, p === page && styles.pageNumActive]}>
                <Text style={[styles.pageNumText, p === page && styles.pageNumTextActive]}>
                  {p}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {totalPages > 4 && (
            <>
              <Text style={styles.pageDots}>…</Text>
              <TouchableOpacity onPress={() => setPage(totalPages)} activeOpacity={0.7}>
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
            activeOpacity={0.7}>
            <View style={styles.pageArrow}>
              <Text style={[styles.pageArrowText, page === totalPages && styles.pageDisabled]}>
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={page === totalPages ? Colors.textLight : Colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter sheet */}
      <Modal
        visible={filtersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersOpen(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setFiltersOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter establishments</Text>
              <TouchableOpacity onPress={() => setFiltersOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <SelectField
              label="Region"
              value={province || ALL_OPTION}
              options={[ALL_OPTION, ...provinceOptions]}
              onSelect={v => {
                setProvince(v === ALL_OPTION ? '' : v);
                setPage(1);
              }}
              style={styles.filterField}
            />

            {municipalities.length > 0 && (
              <SelectField
                label="Municipality"
                value={city || ALL_OPTION}
                options={[ALL_OPTION, ...municipalities]}
                onSelect={v => {
                  setCity(v === ALL_OPTION ? '' : v);
                  setPage(1);
                }}
                style={styles.filterField}
              />
            )}

            <SelectField
              label="Inspector assigned"
              value={selectedInspectorName}
              options={[ALL_OPTION, ...inspectorOptions.map(o => o.name)]}
              onSelect={v => {
                setInspectorUid(v === ALL_OPTION ? '' : inspectorOptions.find(o => o.name === v)?.uid ?? '');
                setPage(1);
              }}
              style={styles.filterField}
            />

            <SelectField
              label="Compliance / inspection type"
              value={complianceTag || ALL_OPTION}
              options={[ALL_OPTION, ...COMPLIANCE_TAG_OPTIONS]}
              onSelect={v => {
                setComplianceTag(v === ALL_OPTION ? '' : (v as ComplianceTag));
                setPage(1);
              }}
              style={styles.filterField}
            />

            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} activeOpacity={0.75}>
              <Text style={styles.clearBtnText}>Clear all filters</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

ManageEstablishmentsTab.displayName = 'ManageEstablishmentsTab';

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
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: Type.subheading.fontSize,
    lineHeight: Type.subheading.lineHeight,
    fontWeight: '700',
    color: Colors.navy,
  },
  // SelectField's own `group` style sets `flex: 1` for when it's used
  // side-by-side in a form row — stacked standalone here, that flex-basis-0
  // sizing collapses the field to near-zero height (its column parent, the
  // filter sheet, only has a maxHeight cap, not a definite height, so there's
  // no resolvable "extra space" for it to grow into). Clearing it back to
  // Yoga's default (content-sized) fixes the squished/overlapping layout.
  filterField: {
    flex: undefined,
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  clearBtnText: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    fontWeight: '700',
    color: Colors.conflict,
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
