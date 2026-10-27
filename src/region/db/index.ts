// The src/region/db entry point. A leaf: src/db/schema.ts and
// src/db/database.ts import it, so nothing here may import src/db/database.
import type { Database } from '@nozbe/watermelondb';
import { migrations } from './migrations';
import { ComplianceAir } from './models/ComplianceAir';
import { ComplianceEia } from './models/ComplianceEia';
import { ComplianceHazwaste } from './models/ComplianceHazwaste';
import { ComplianceWater } from './models/ComplianceWater';
import { regionTables } from './tables';

export { ComplianceAir, ComplianceEia, ComplianceHazwaste, ComplianceWater };

export const regionDb = {
  schemaVersion: 16,
  tables: regionTables,
  migrations,
  modelClasses: [ComplianceAir, ComplianceWater, ComplianceHazwaste, ComplianceEia],
};

// Spread into src/db/database.ts's `collections`, so every existing
// collections.complianceX call site (and test mock) keeps working.
export function regionCollectionsFor(database: Database) {
  return {
    complianceAir: database.collections.get<ComplianceAir>('compliance_air'),
    complianceWater: database.collections.get<ComplianceWater>('compliance_water'),
    complianceHazwaste: database.collections.get<ComplianceHazwaste>('compliance_hazwaste'),
    complianceEia: database.collections.get<ComplianceEia>('compliance_eia'),
  };
}

export type RegionCollections = ReturnType<typeof regionCollectionsFor>;
