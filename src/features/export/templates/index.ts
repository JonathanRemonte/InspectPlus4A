import { FALLBACK_APPROVERS, SURVEY_TEMPLATE_KEY, TEMPLATES } from '../../../region';

// The template files, approver defaults and unused-checkbox counts are
// region-owned (src/region/templates.ts); the lookups stay here.
export { SURVEY_TEMPLATE_KEY, TEMPLATES, UNUSED_CHECKBOXES } from '../../../region';

// The recommending/approving signatories a template prints today, before
// the inspector edits them for that report type — see
// signatories.ts' defaultApproversFor and asyncStorageSignatoryProvider's
// per-type approversByType storage. Verified against each original with
// `node scripts/docx-runs.js "<original>.docx" "<needle>"`.
export interface Approvers {
  recommendingName: string;
  recommendingPosition: string;
  approverName: string;
  approverPosition: string;
}

// The tagged EMB forms shipped in the binary, by inspection_reports.report_type
// (or 'survey'). A type with no entry can't be exported yet — the tab shows
// "No template yet" on its cards. Recipes live next to the templates; see
// scripts/docx-tag.js.
export interface TemplateEntry {
  label: string; // used in the output file name
  file: string;
  module: number;
  approvers: Approvers;
}

export function templateFor(kind: 'inspection' | 'survey', reportType: string): TemplateEntry | null {
  return (kind === 'survey' ? TEMPLATES[SURVEY_TEMPLATE_KEY] : TEMPLATES[reportType]) ?? null;
}

export function hasTemplate(kind: 'inspection' | 'survey', reportType: string): boolean {
  return templateFor(kind, reportType) !== null;
}

// The approvers a fresh Signatories should default to for this report
// type — what its template prints today, or the Water set for a type with
// no template yet (there's nothing else to default to, and it can't be
// exported anyway).
export function defaultApproversFor(kind: 'inspection' | 'survey', reportType: string): Approvers {
  return templateFor(kind, reportType)?.approvers ?? FALLBACK_APPROVERS;
}
