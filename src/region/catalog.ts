import type { ComplianceTagEntry, ReportType, ReportTypeDisplay } from '../core/region/contract';
import { Colors } from '../design/colors';
import type { RegionCollections } from './db';

// ── Create entries ───────────────────────────────────────────────────────────
export type ReportTypeKey = 'air' | 'water' | 'hazwaste_generator' | 'hazwaste_tsd' | 'eia' | 'survey';

// Only Water has a real form today — the rest are visibly disabled wherever
// a report type is picked (the home speed dial's "Soon" badge,
// AddReportSplitPanel's dimmed rows) rather than routing into today's
// placeholder screen. Single source of truth so enabling a type in one
// surface can't leave the other stale.
export const ENABLED_TYPES: ReportTypeKey[] = ['water'];

export const REPORT_TYPES: ReportType<ReportTypeKey, ReportDataKey>[] = [
  {
    key: 'air',
    dataKey: 'air_monitoring',
    shortTitle: 'Air quality',
    law: 'R.A. 8749',
    title: 'Air Quality Management',
    iconName: 'partly-sunny-outline',
    iconLibrary: 'Ionicons',
    iconAsset: require('../../assets/icons/air.svg').default,
    bgColor: Colors.air.bg,
    borderColor: Colors.air.border,
    textColor: Colors.air.text,
    route: '/inspection/new?type=air',
  },
  {
    key: 'water',
    dataKey: 'water_monitoring',
    shortTitle: 'Water quality',
    law: 'R.A. 9275',
    title: 'Water Quality Management',
    iconName: 'water-outline',
    iconLibrary: 'Ionicons',
    iconAsset: require('../../assets/icons/water.svg').default,
    bgColor: Colors.water.bg,
    borderColor: Colors.water.border,
    textColor: Colors.water.text,
    route: '/inspection/new?type=water',
  },
  {
    key: 'hazwaste_generator',
    dataKey: 'hazardous_waste',
    shortTitle: 'Hazwaste generators',
    law: 'R.A. 6969',
    title: 'Hazardous Waste Generators',
    iconName: 'warning-outline',
    iconLibrary: 'Ionicons',
    iconAsset: require('../../assets/icons/hazwaste_generator.svg').default,
    bgColor: Colors.hazwaste.bg,
    borderColor: Colors.hazwaste.border,
    textColor: Colors.hazwaste.text,
    route: '/inspection/new?type=hazwaste_generator',
  },
  {
    key: 'hazwaste_tsd',
    dataKey: 'hazardous_waste',
    shortTitle: 'Hazwaste TSD',
    law: 'R.A. 6969',
    title: 'Hazardous Waste Treaters and TSD Facilities',
    iconName: 'lock-closed-outline',
    iconLibrary: 'Ionicons',
    iconAsset: require('../../assets/icons/hazwaste_tsd.svg').default,
    bgColor: Colors.warning.bg,
    borderColor: Colors.warning.border,
    textColor: Colors.warning.text,
    route: '/inspection/new?type=hazwaste_tsd',
  },
  {
    key: 'eia',
    dataKey: 'eia',
    shortTitle: 'EIA',
    law: 'P.D. 1586',
    title: 'Environmental Impact Assessment',
    iconName: 'document-text-outline',
    iconLibrary: 'Ionicons',
    iconAsset: require('../../assets/icons/eia.svg').default,
    bgColor: Colors.eia.bg,
    borderColor: Colors.eia.border,
    textColor: Colors.eia.text,
    route: '/inspection/new?type=eia',
  },
  {
    key: 'survey',
    dataKey: 'survey',
    shortTitle: 'Site survey',
    law: 'ECC Survey Inspection',
    title: 'Site Inspection Report for New Project With/Without ECC Applications',
    iconName: 'globe-outline',
    iconLibrary: 'Ionicons',
    iconAsset: require('../../assets/icons/survey.svg').default,
    bgColor: Colors.survey.bg,
    borderColor: Colors.survey.border,
    textColor: Colors.survey.text,
    route: '/survey/new',
  },
];

// ── Recorded-report vocabulary ───────────────────────────────────────────────
export type ReportDataKey = 'air_monitoring' | 'water_monitoring' | 'hazardous_waste' | 'eia' | 'survey';

// How an ALREADY-RECORDED report of a given type is labeled and colored.
// The data layer only distinguishes five types: both create-flow hazwaste
// entries (generator and TSD — see ReportTypeKey in reportTypes.ts) store
// 'hazardous_waste', because the distinction only matters while choosing
// which form to open.
//
// This is the single source of truth for that vocabulary. It exists because
// ReportListCard and reportTypes.ts previously each kept their own copy and
// drifted: eia and survey ended up with each other's icons, and every card
// rendered with a hardcoded water-blue icon regardless of its actual type.
export const REPORT_TYPE_DISPLAY: Record<ReportDataKey, ReportTypeDisplay> = {
  air_monitoring: {
    label: 'Air Monitoring',
    icon: 'partly-sunny-outline',
    bgColor: Colors.air.bg,
    borderColor: Colors.air.border,
    textColor: Colors.air.text,
    badgeBg: Colors.air.badgeBg,
    badgeText: Colors.air.badgeText,
  },
  water_monitoring: {
    label: 'Water Monitoring',
    icon: 'water-outline',
    bgColor: Colors.water.bg,
    borderColor: Colors.water.border,
    textColor: Colors.water.text,
    badgeBg: Colors.water.badgeBg,
    badgeText: Colors.water.badgeText,
  },
  hazardous_waste: {
    // The generator flow's icon stands for the collapsed bucket; the TSD
    // flow keeps its own lock glyph in the create dial, where the two are
    // still distinguishable.
    label: 'Hazwaste Monitoring',
    icon: 'warning-outline',
    bgColor: Colors.hazwaste.bg,
    borderColor: Colors.hazwaste.border,
    textColor: Colors.hazwaste.text,
    badgeBg: Colors.hazwaste.badgeBg,
    badgeText: Colors.hazwaste.badgeText,
  },
  eia: {
    label: 'EIA',
    icon: 'document-text-outline',
    bgColor: Colors.eia.bg,
    borderColor: Colors.eia.border,
    textColor: Colors.eia.text,
    badgeBg: Colors.eia.badgeBg,
    badgeText: Colors.eia.badgeText,
  },
  survey: {
    label: 'Survey',
    icon: 'globe-outline',
    bgColor: Colors.survey.bg,
    borderColor: Colors.survey.border,
    textColor: Colors.survey.text,
    badgeBg: Colors.survey.badgeBg,
    badgeText: Colors.survey.badgeText,
  },
};

// inspection_reports.report_type values (see useReportFormState.ts / REPORT_TYPE
// consts in each report-type form) → the ReportTypeKey used by REPORT_TYPES,
// which carries the icon asset + colors shown when picking a report type.
export const DATA_KEY_TO_CREATE_KEY: Partial<Record<ReportDataKey, ReportTypeKey>> = {
  air_monitoring: 'air',
  water_monitoring: 'water',
  hazardous_waste: 'hazwaste_generator',
  eia: 'eia',
};

// ── Establishment compliance tags ────────────────────────────────────────────
// The rollup labels on establishment cards and the Manage Establishments
// filter, in filter order. 'Survey' comes from survey_reports, not from
// inspection_reports.report_type, so its dataKey is null.
export type ComplianceTag = 'Air Monitoring' | 'Water Monitoring' | 'Hazwaste' | 'EIA' | 'Survey';

export const SURVEY_COMPLIANCE_TAG: ComplianceTag = 'Survey';

export const COMPLIANCE_TAGS: ComplianceTagEntry<ReportTypeKey, ReportDataKey, ComplianceTag>[] = [
  { tag: 'Air Monitoring', dataKey: 'air_monitoring', createKey: 'air' },
  { tag: 'Water Monitoring', dataKey: 'water_monitoring', createKey: 'water' },
  { tag: 'Hazwaste', dataKey: 'hazardous_waste', createKey: 'hazwaste_generator' },
  { tag: 'EIA', dataKey: 'eia', createKey: 'eia' },
  { tag: SURVEY_COMPLIANCE_TAG, dataKey: null, createKey: 'survey' },
];

// Which compliance collection holds each stored report type's row; deleting
// a report also removes it. Report types without one have no entry.
export const COMPLIANCE_COLLECTIONS: Partial<Record<ReportDataKey, keyof RegionCollections>> = {
  air_monitoring: 'complianceAir',
  water_monitoring: 'complianceWater',
  hazardous_waste: 'complianceHazwaste',
  eia: 'complianceEia',
};
