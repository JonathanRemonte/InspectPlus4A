// Compile-time only — never imported at runtime. tsc fails here when this
// repo's region entry points stop satisfying the foundation contract.
import * as regionIndex from '../../region';
import * as regionDbIndex from '../../region/db';
import * as regionModulesIndex from '../../region/modules';
import type * as R from '../../region';
import type * as D from '../../region/db';
import type { ClosingFields } from '../../features/inspections/hooks/useInspectionReport';
import type { RegionDbIndex, RegionIndex, RegionModulesIndex } from './contract';

export const regionIndexCheck: RegionIndex = regionIndex;
export const regionDbIndexCheck: RegionDbIndex = regionDbIndex;
export const regionModulesIndexCheck: RegionModulesIndex = regionModulesIndex;

// Type exports foundation imports by name (listed in contract.ts). They don't
// fit an interface, so this fails tsc if one goes missing.
export type RegionTypeExportsCheck = [
  R.ReportTypeKey,
  R.ReportDataKey,
  R.ComplianceTag,
  R.RegionComplianceView,
];
export type RegionDbTypeExportsCheck = [D.RegionSyncEntityName, D.RegionDtoMap, D.RegionCollections];

// mapCommon casts the compliance view to ClosingFields, so every region view
// must carry the closing fields. Holds for a union and for `never` (no types).
export const closingFieldsCheck: [R.RegionComplianceView] extends [ClosingFields] ? true : false = true;
