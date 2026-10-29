// The environmental laws EMB Region 4-B issues establishment permits
// under, and the permits issued under each. These back the cascading
// Environmental Law -> Permit Type dropdowns on the DENR Permits section,
// which replaced free-text fields.
//
// Every string here must match an export row. The DOCX export pins a
// permit to its printed row by regex-matching "<permit type> <law>" (see
// PERMIT_MATCHERS in features/export/mappers/common.ts); a permit that
// matches nothing is dropped from the exported form without warning.
// denrPermits.test.ts asserts that invariant for every option below, so
// adding a permit here that the form has no row for fails the suite.
//
// Deliberately absent: RA 9003 (no establishment permit) and LLDA
// clearances (Laguna de Bay, outside Region 4-B). TSD registrations are
// absent too - the printed form has no row for one.

export const ENVIRONMENTAL_LAWS = ['PD 1586', 'RA 8749', 'RA 9275', 'RA 6969'] as const;

export type EnvironmentalLaw = (typeof ENVIRONMENTAL_LAWS)[number];

const PERMIT_TYPES_BY_LAW: Record<EnvironmentalLaw, string[]> = {
  // Philippine EIS System. Every PD 1586 permit prints on an ECC row
  // except the sanitary-landfill ECC, which has a row of its own.
  'PD 1586': ['ECC', 'ECC Amendment', 'Certificate of Non-Coverage (CNC)', 'ECC for Sanitary Landfill'],
  // Clean Air Act.
  'RA 8749': ['Permit to Operate'],
  // Clean Water Act.
  'RA 9275': ['Discharge Permit'],
  // Toxic Substances and Hazardous and Nuclear Wastes Control Act.
  'RA 6969': [
    'Hazardous Waste Generator ID',
    'DENR Registry ID',
    'Permit to Transport',
    'PCL Compliance Certificate',
    'CCO Registry',
  ],
};

// The permits selectable once a law is chosen. An unknown or empty law
// yields nothing, which is what keeps the Permit Type field empty (and
// disabled) until the inspector picks a law.
export function getPermitTypeOptions(law: string): string[] {
  return PERMIT_TYPES_BY_LAW[law as EnvironmentalLaw] ?? [];
}
