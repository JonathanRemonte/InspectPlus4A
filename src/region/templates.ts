import type { Approvers, TemplateEntry } from '../features/export/templates';

// No export templates until EMB4A's forms exist (Phase 3).
export const TEMPLATES: Partial<Record<string, TemplateEntry>> = {};
export const UNUSED_CHECKBOXES: Record<string, number> = {};
export const SURVEY_TEMPLATE_KEY = 'survey';

// Blank until EMB4A's signatories are configured; the export sheet lets the
// inspector fill them in.
export const FALLBACK_APPROVERS: Approvers = {
  recommendingName: '',
  recommendingPosition: '',
  approverName: '',
  approverPosition: '',
};
