import type { ChecklistItemDef } from '../../../components/form';

// Section 6III, "Summary of Findings" - the printed form's compliance
// checklist, question for question and in its order, grouped under the
// legal reference each block cites. Wording follows the template with its
// evident typos corrected ("wastewater change", "started in DAO 1990-35");
// the citations are as printed, including DAO 1990-25 Sec. 8.
//
// Keys, not positions, identify a stored answer (see findingsEntriesForSave
// in waterTypes.ts): three questions share Rule 14.11, and the list will be
// revised again.
export const WATER_FINDINGS_CHECKLIST: ChecklistItemDef[] = [
  { key: 'dao2005-10-r13-1-wastewater-charge', group: 'DAO 2005-10', ref: 'Rule 13.1', requirement: 'Does the establishment pay the required wastewater charge?' },
  { key: 'dao2005-10-r14-1-has-dp', group: 'DAO 2005-10', ref: 'Rule 14.1', requirement: 'Does the establishment have a discharge permit?' },
  { key: 'dao2005-10-r14-5-dp-fee', group: 'DAO 2005-10', ref: 'Rule 14.5', requirement: 'Does the establishment pay the required discharge permit fee?' },
  { key: 'dao2005-10-r14-9-dp-valid', group: 'DAO 2005-10', ref: 'Rule 14.9', requirement: 'Is the permit available and valid?' },
  { key: 'dao2005-10-r14-11-discharge-points', group: 'DAO 2005-10', ref: 'Rule 14.11', requirement: 'Do the discharge points correspond to those declared in the discharge permit?' },
  { key: 'dao2005-10-r14-11-discharge-volume', group: 'DAO 2005-10', ref: 'Rule 14.11', requirement: 'Is the volume discharged within the allowable volume declared in the discharge permit?' },
  { key: 'dao2005-10-r14-11-dp-posted', group: 'DAO 2005-10', ref: 'Rule 14.11', requirement: 'Is the permit posted in the proper area?' },
  { key: 'dao2005-10-r14-16-smr', group: 'DAO 2005-10', ref: 'Rule 14.16', requirement: 'Are the SMRs submitted quarterly and on time?' },
  { key: 'dao1990-35-s4-6-effluent-standards', group: 'DAO 1990-35', ref: 'Sec. 4-6', requirement: 'Are the effluent parameters compliant with the standards in the existing DENR effluent standards?' },
  { key: 'dao1990-35-s9-pcf-operated', group: 'DAO 1990-35', ref: 'Sec. 9', requirement: 'Are the pollution control facilities properly and continuously operated?' },
  { key: 'dao1990-35-s10-methods-of-analysis', group: 'DAO 1990-35', ref: 'Sec. 10', requirement: 'Are the methods of analysis used for effluent samples in accordance with the prescribed methods of the Department?' },
  { key: 'dao1990-25-s8-additional-requirements', group: 'DAO 1990-25', ref: 'Sec. 8', requirement: 'Does the establishment comply with the additional requirements stated in DAO 1990-35?' },
  { key: 'other-analysis-reports', group: 'Other Requirements', ref: '', requirement: 'Are the copies of water analysis reports available?' },
  { key: 'other-emb-correspondence', group: 'Other Requirements', ref: '', requirement: 'Are the correspondences between the establishment and EMB documented?' },
  { key: 'other-violations-documented', group: 'Other Requirements', ref: '', requirement: 'Are the establishment\u2019s compliance violations and exceedances documented?' },
  { key: 'other-pending-litigation', group: 'Other Requirements', ref: '', requirement: 'Are there any pending litigation/PAB cases?' },
  { key: 'other-spill-prevention-plan', group: 'Other Requirements', ref: '', requirement: 'Is there a spill prevention contingency plan?' },
  { key: 'other-spill-containment', group: 'Other Requirements', ref: '', requirement: 'Are there spill containment facilities available?' },
];

export const DOCUMENTS_REVIEWED_OPTIONS = [
  'Synology',
  'OPMS',
  'IIS Transactions',
  'CMR Online',
  'SMR Online',
  'PCO Online',
  'Others',
];

export const WATER_SOURCE_TYPES = [
  'Surface water',
  'Groundwater',
  'Water utilities',
  'Desalination',
  'Recycled',
  'Others',
];

export const WASTEWATER_USE_TYPES = [
  'Process',
  'Domestic',
  'Cooling',
  'Maintenance',
  'Storm drain',
  'Others',
];

// Section 4C (Quality of Abstracted Water) asks where the sampled water was
// drawn from in two steps: the broad source, then the specific one catered
// to it. Kept as a category -> options map so DynamicRowTable's `dependsOn`
// cascade can resolve the second dropdown from the first. Deliberately
// separate from WATER_SOURCE_TYPES above, which answers a different
// question in 4A (every supply the site draws on, utilities and recycled
// water included) - only abstracted water is sampled here.
export const ABSTRACTED_WATER_SOURCES = ['Surface Water', 'Ground Water'];

export const ABSTRACTED_WATER_SOURCE_SPECIFICS: Record<string, string[]> = {
  'Surface Water': ['Lake', 'River', 'Seawater'],
  'Ground Water': ['Deep well'],
};

// The `options` resolver both 4C tables (create form and edit screen) hand
// to DynamicRowTable. Shared so the row key the cascade reads from lives in
// one place rather than being restated at each call site. An unrecognised
// source - including the free text older reports stored here before this
// was a dropdown - yields no choices, leaving that cell inert until the
// source is re-picked.
export const abstractedWaterSourceSpecifics = (row: Record<string, string>): string[] =>
  ABSTRACTED_WATER_SOURCE_SPECIFICS[row.source] ?? [];

// Section 5A's follow-up, asked only when the establishment has no WWTP.
// A site can run more than one of these at once - a septic tank for
// domestic waste and a separator on the motor pool is an ordinary pairing -
// so these are checkboxes, not a single choice.
export const NON_WWTP_TREATMENT_OTHERS = 'Others';

export const NON_WWTP_TREATMENT_OPTIONS = [
  'Septic Tank',
  'Oil and Water Separator (OWS)',
  NON_WWTP_TREATMENT_OTHERS,
];

// Shared by the create form and the edit screen so the question an
// inspector answers reads identically to the one a reviewer sees.
export const NON_WWTP_TREATMENT_PROMPT =
  "Select the establishment's current wastewater treatment system:";

export const NON_WWTP_TREATMENT_OTHER_LABEL = 'Others (specify)';

// Section 5B's escape hatch. Named so the two entry paths and the save rule
// (wwtpTypeOtherForSave) compare against the same value the option list
// actually offers, rather than each restating a literal.
export const WWTP_TYPE_OTHERS = 'Others';

export const WWTP_TYPE_OPTIONS = ['Physical', 'Biological', 'Chemical', 'Combined', WWTP_TYPE_OTHERS];

export const WWTP_CONDITION_OTHERS = 'Others';
export const WWTP_CONDITION_OPTIONS = [
  'Properly Maintained',
  'Inadequately Maintained',
  'Poor Maintenance',
  WWTP_CONDITION_OTHERS,
];

export const SAMPLE_TYPE_OPTIONS = ['Grab', 'Composite'];

// Section 6I's parameter dropdown. The printed form leaves the Parameter
// column blank, so this is seeded from DAO 2016-08's General Effluent
// Standards - the parameters an effluent sample is routinely analysed for -
// rather than from the template. It's a convenience list behind a typeable
// input (see ComboInput), so anything not here can still be written in.
export const WATER_QUALITY_PARAMETERS = [
  'pH',
  'Temperature',
  'Color',
  'BOD',
  'COD',
  'TSS',
  'Oil and Grease',
  'Fecal Coliform',
  'Total Coliform',
  'Dissolved Oxygen',
  'Ammonia as NH3-N',
  'Nitrate as NO3-N',
  'Phosphate',
  'Surfactants (MBAS)',
  'Chloride',
  'Sulfate',
  'Fluoride',
  'Cyanide',
  'Boron',
  'Arsenic',
  'Cadmium',
  'Chromium (Hexavalent)',
  'Copper',
  'Lead',
  'Mercury',
  'Nickel',
  'Selenium',
  'Zinc',
  'Iron',
  'Manganese',
];

// Section 6I's gate: what kind of sampling the inspector conducted, asked
// only once they say they conducted any. Stored as the label.
export const SAMPLING_CLASSIFICATION_OPTIONS = ['Ambient', 'Effluent', 'Both'];

// Section 5D's three treatment columns. A WWTP runs several units in each
// stage at once - a screen and a grit chamber ahead of an equalization tank
// is an ordinary train - so these are checkboxes rather than one choice,
// matching the printed inspection form.
// Stored value and display label are separate, as they are for
// NON_WWTP_TREATMENT_OTHERS above: the record holds 'Others' and the read-only
// card renders a ticked Others as `Others: <text>`; only the checkbox row
// shows the "(specify)" prompt.
export const TREATMENT_OTHERS = 'Others';

export const TREATMENT_OTHER_LABEL = 'Others (specify)';

export const PRIMARY_TREATMENT_OPTIONS = [
  'Screening',
  'Grit Removal',
  'Oil/Water Separator',
  'Equalization Tank',
  TREATMENT_OTHERS,
];

// The printed form reads "Tricking Filter"; the app uses the correct term.
// Deliberate, and agreed with EMB - see the design doc.
export const BIOLOGICAL_TREATMENT_OPTIONS = [
  'Activated Sludge',
  'Anaerobic Digestion',
  'Anaerobic Baffled Reactor (ABR)',
  'Reed Bed System',
  'Trickling Filter',
  'Oxidation/Stabilization Batch',
  'Sequencing Batch Reactor',
  TREATMENT_OTHERS,
];

export const CHEMICAL_TREATMENT_OPTIONS = [
  'pH Adjustment',
  'Disinfection',
  'Redox',
  'Flocculation/Coagulation',
  TREATMENT_OTHERS,
];
