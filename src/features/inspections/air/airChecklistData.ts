import type { ChecklistItemDef } from '../../../components/form';
import { DOCUMENTS_REVIEWED_OPTIONS } from '../water/waterChecklistData';

// Table 7 of the printed Air Monitoring form - the compliance checklist,
// question for question and in its order, one list per printed group.
// Wording follows the template with whitespace normalised and its evident
// typos corrected ("Part Rule 25" -> "Part 7 Rule 25"); citations are
// otherwise as printed, and a row that inherits its citation from the row
// above (blank first cell on the form) repeats it here so every entry is
// self-describing.
//
// Keys, not positions, identify a stored answer (see airChecklistsForSave
// in airTypes.ts): several questions share one citation, and the list will
// be revised.

export const AIR_CHECKLIST_DAO_2004_26: ChecklistItemDef[] = [
  { key: 'dao2004-26-r19-s1-valid-pto', group: 'DAO 2004-26', ref: 'Rule 19 Section 1', requirement: 'All emission sources have a valid Permit to Operate' },
  { key: 'dao2004-26-r19-s3-as-built-conforms', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'As built design of the installation conforms with submitted engineering plans and specifications' },
  { key: 'dao2004-26-r19-s3-control-facilities-operational', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'Declared control facilities are installed and operational' },
  { key: 'dao2004-26-r19-s3-located-as-proposed', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'Installation is located as proposed on the vicinity map (plant and machinery layout)' },
  { key: 'dao2004-26-r19-s3-design-capacity-within-declared', group: 'DAO 2004-26', ref: 'Rule 19 Section 3', requirement: 'Facility design capacity is within the capacity declared in application for permit to operate' },
  { key: 'dao2004-26-r19-s5-temporary-pto-valid', group: 'DAO 2004-26', ref: 'Rule 19 Section 5', requirement: 'Temporary Permit to Operate is still valid' },
  { key: 'dao2004-26-r19-s6-renewal-filed-30-days', group: 'DAO 2004-26', ref: 'Rule 19 Section 6', requirement: 'Application for renewal has been filed for expiring Permit to Operate 30 days before permit expiration date' },
  { key: 'dao2004-26-r19-s9-pto-displayed', group: 'DAO 2004-26', ref: 'Rule 19 Section 9', requirement: 'Permit to Operate displayed conspicuously upon the installation or in an accessible/visible place near the installation' },
  { key: 'dao2004-26-r19-s9-pto-conditions-complied', group: 'DAO 2004-26', ref: 'Rule 19 Section 9', requirement: 'Conditions of the Permit to Operate are complied with' },
  { key: 'dao2004-26-r19-s11-operational-problems-notified-24h', group: 'DAO 2004-26', ref: 'Rule 19 Section 11', requirement: 'Plant operational problems notification submitted to EMB within 24 hours of occurrence' },
  { key: 'dao2004-26-r19-s12-quarterly-smr', group: 'DAO 2004-26', ref: 'Rule 19 Section 12', requirement: 'Quarterly submission of self-monitoring report' },
];

// The form prints four tick boxes - Q1 to Q4 - beside the quarterly-SMR
// question in place of a plain Y/N/NA. They are stored on that entry as
// `quarters`; see airChecklistsForSave.
export const SMR_QUARTER_KEY = 'dao2004-26-r19-s12-quarterly-smr';
export const SMR_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type SmrQuarter = (typeof SMR_QUARTERS)[number];

export const AIR_CHECKLIST_DAO_2000_81: ChecklistItemDef[] = [
  { key: 'dao2000-81-p7-r25-s5a1-no-dark-smoke-measures', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (1)', requirement: 'Person in charge of the plant/ equipment has sufficient measures to ensure that no dark smoke is discharging from any stack in the establishment (e.g. window view of stack, mirror to reflect top of stack, smoke, density indicator, CCTV, etc.)' },
  { key: 'dao2000-81-p7-r25-s5a2-oil-burning-heaters', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (2)', requirement: 'All oil-burning equipment has heaters capable of heating oil to a temperature appropriate for the oil and burner' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-power-plant', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is fossil fuel-fired power plant over 10MW rating installed with Continuous Emission Monitoring System (CEMS) for particulates, sulfur oxide and NOx' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-petroleum-refinery', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is petroleum refinery/petrochemical industry installed with CEMS for particulates, sulfur oxide, and NOx' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-copper-smelter', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is primary copper smelter installed with CEMS for particulates, sulfur oxide and NOx' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-steel-plant', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is steel plant installed with CEMS for particulates and sulfur oxide' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-ferro-alloy', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is ferro-alloy production facility installed with CEMS for particulates' },
  { key: 'dao2000-81-p7-r25-s5a3-cems-cement-plant', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5 a (3)', requirement: 'Establishment is a cement plant installed with CEMS for particulates' },
  { key: 'dao2000-81-p7-r25-s5b-misc-equipment-pcf', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 5b', requirement: 'Miscellaneous equipment like re-heating furnace, smoke oven, bake oven, coffee heaters, varnish kettles, etc. are installed with pollution control facilities.' },
  { key: 'dao2000-81-p7-r25-s13a-dust-controls', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 13a', requirement: 'Establishment has precautionary controls for dusts generated during vehicular movement, transportation of materials, construction, etc. (List controls identified)' },
  { key: 'dao2000-81-p7-r25-s13b-voc-controls', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 13b', requirement: 'Establishment has precautionary controls for volatile organic compounds or organic solvent emissions generated during storing, pumping, handling, processing, etc. (List controls identified)' },
  { key: 'dao2000-81-p7-r25-s13d-no-open-burning', group: 'DAO 2000-81', ref: 'Part 7 Rule 25 Section 13d', requirement: 'No open burning activity in the establishment' },
];

// Rows 31-43 of the form—the MC 2007-003 (2) sub-heading and its entries—share
// one citation; all thirteen entries inherit it, so it is repeated on each.
export const AIR_CHECKLIST_EMB_MC: ChecklistItemDef[] = [
  { key: 'emb-mc-2009-004-gensets-1250kw-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2009-004', requirement: 'Standby Gensets with capacity greater than or equal to 1,250 KW undergo annual emission testing (with 3 test runs). These gensets should not have the potential to emit more than 100 ton/year of regulated pollutant.' },
  { key: 'emb-mc-2007-003-boiler-251hp-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Boiler rate at greater than or equal to 251HP undergo bi-annual emission testing (with 3 test runs)' },
  { key: 'emb-mc-2007-003-sources-100tpy-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Other sources that have potential to emit equal to or greater than 100 tons per year of regulated pollutant undergo bi-annual emission testing (with 3 test runs).' },
  { key: 'emb-mc-2007-003-boiler-100-250hp-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Boiler rated between 100 to 250 HP undergo annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-genset-600-1249kw-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Diesel generator rated at 600 to 1,249 KW undergo annual testing (3 test runs)' },
  { key: 'emb-mc-2007-003-sources-30-100tpy-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Other sources that have the potential to emit greater than 30 but less than 100 tons per year of regulated pollutant undergo annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-hap-sources-annual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Sources of emissions of hazardous air pollutants included in PCL (DAO 1998-58) undergo annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-steel-making-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Emission sources of steel-making plants undergo bi-annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-ferro-alloy-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Emission sources of ferro-alloy making plants undergo bi-annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-glass-making-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Emission sources of glass-making plants undergo bi-annual emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-boiler-99hp-biennial', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Boiler rated at 99HP or less undergo biennial emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-genset-599kw-biennial', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Diesel generator rated at 599KW or less undergo biennial emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-sources-10-30tpy-biennial', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Other sources that have potential to emit at least 10 tons per year but less than 30 tons per year of regulated pollutant undergo biennial emission testing (3 test runs)' },
  { key: 'emb-mc-2007-003-bunker-fuel-biannual', group: 'EMB Memorandum Circulars', ref: 'MC 2007-003 (2)', requirement: 'Sources using Bunker Fuel Oil, blended fuels involving Bunker Fuel Oil, or sulfur content of 1% or more undergo bi-annual emission testing' },
];

// Printed as a sub-heading inside the EMB MC block, but these thirteen cite
// 40 CFR 60 Appendix F sections rather than memorandum circulars, and were
// asked for as their own column (checklist_appendix_f).
export const AIR_CHECKLIST_APPENDIX_F: ChecklistItemDef[] = [
  { key: 'appendix-f-s6-8-cems-installation-change-notified', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (8)', requirement: 'Notification has been sent to EMB for any changes made in the CEMS installation' },
  { key: 'appendix-f-s6-8-cems-qaqc-plan-change-notified', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (8)', requirement: 'Notification has been sent to EMB for any changes made in the CEMS quality assurance and quality control plan' },
  { key: 'appendix-f-s6-5-cems-audited-40cfr60', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (5)', requirement: 'Each CEMS is audited and conducted in accordance to 40 CFR part 60 Appendix F' },
  { key: 'appendix-f-s6-6-rata-annual', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (6)', requirement: 'Relative Accuracy Test Audit (RATA) is performed annually by industries in the presence of EMB personnel' },
  { key: 'appendix-f-s6-7-calibration-gases-quarterly-audit', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (7)', requirement: 'Calibration gases are subject to audit or relative accuracy audit test every quarter' },
  { key: 'appendix-f-s6-7-alternative-audits-approved', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (7)', requirement: 'Other alternative quarterly audits employed by the establishment are approved by EMB' },
  { key: 'appendix-f-s6-9-malfunction-7-days-notified', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 6 (9)', requirement: 'EMB Director and Regional Director have been notified of CEMS malfunction that lasted seven (7) consecutive days' },
  { key: 'appendix-f-s7-1-startup-shutdown-records', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 7 (1)', requirement: 'Records of occurrence and duration of any start-up, shut-down or malfunction in the operation of any source or control facility is available in the establishment' },
  { key: 'appendix-f-s7-2-cems-maintenance-records', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 7 (2)', requirement: 'Records of audits, performance testing, evaluations, calibration checks, adjustments and maintenance of any continuous emission monitors that have been installed pursuant to Rule IX Section 5 DAO 2008-81 are available in the establishment' },
  { key: 'appendix-f-s8-1-smr-excess-emissions', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (1)', requirement: 'SMR includes data on the time intervals, date and magnitude of excess emissions, nature and cause of the excess, corrective actions taken, and preventive measures adopted.' },
  { key: 'appendix-f-s8-2-smr-averaging-period', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (2)', requirement: 'SMR includes information on the averaging period used for data reporting corresponding to the averaging period specified in the emission test period used to determine compliance with an emission standard for the pollutant/source category in question.' },
  { key: 'appendix-f-s8-3-smr-inoperative-periods', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (3)', requirement: 'SMR includes information on time and date for each period during which the continuous monitoring system was inoperative and the nature of system repairs and adjustments made in the CEMS/COMS' },
  { key: 'appendix-f-s8-4-smr-75-percent-capture', group: 'Appendix F (Quality Assurance Procedures)', ref: 'Section 8 (4)', requirement: 'SMR data measurements are within 75% data capture rate?' },
];

// Cite DAO 2000-81 but are printed under their own heading and apply only
// to establishments under a Consent Agreement; their own column
// (checklist_consent_agreement) rather than folded into DAO 2000-81.
export const AIR_CHECKLIST_CONSENT_AGREEMENT: ChecklistItemDef[] = [
  { key: 'consent-dao2000-81-p7-r25-s9a-ems-18-months', group: 'For Facilities Engaged with Consent Agreement', ref: 'DAO 2000-81 Part 7 Rule 25 Section 9 (a)', requirement: 'EMS established within 18 months upon entering Consent Agreement with EMB' },
  { key: 'consent-dao2000-81-p7-r25-s9b-emp-6-months', group: 'For Facilities Engaged with Consent Agreement', ref: 'DAO 2000-81 Part 7 Rule 25 Section 9 (b)', requirement: 'Environmental Management Plan derived from EMS process submitted within 6 months after entering Consent Agreement with EMB' },
];

// The five groups as the form prints them, in its order - what a read-only
// view iterates and what the column-per-group storage is keyed to.
export const AIR_CHECKLIST_GROUPS: readonly { title: string; items: ChecklistItemDef[] }[] = [
  { title: 'DAO 2004-26', items: AIR_CHECKLIST_DAO_2004_26 },
  { title: 'DAO 2000-81', items: AIR_CHECKLIST_DAO_2000_81 },
  { title: 'EMB Memorandum Circulars', items: AIR_CHECKLIST_EMB_MC },
  { title: 'Appendix F (Quality Assurance Procedures)', items: AIR_CHECKLIST_APPENDIX_F },
  { title: 'For Facilities Engaged with Consent Agreement', items: AIR_CHECKLIST_CONSENT_AGREEMENT },
];

// Table 9's "List of Documents Reviewed". The air form prints "Record File
// Folder" as its first box; the water form's list (which the rest of this
// is) lacks it. Its own constant so the water form's checkbox row does not
// change under the air work.
export const AIR_DOCUMENTS_REVIEWED_OPTIONS: string[] = [
  'Record File Folder',
  ...DOCUMENTS_REVIEWED_OPTIONS,
];
