import { INSPECTION_TYPE_LABELS } from './useEstablishment';
import { REPORT_TYPE_DISPLAY } from '../../../constants/reportTypeDisplay';

// useEstablishment.ts constructs a real WatermelonDB SQLiteAdapter at import
// time (via db/database.ts), which needs the native JSI binding that isn't
// present under plain Jest — see establishmentPersistence.test.ts for the
// same rationale. Stub it out so importing this module for INSPECTION_TYPE_LABELS
// doesn't drag in the native adapter. jest.mock calls are hoisted above
// imports by babel-plugin-jest-hoist regardless of where they're written, so
// this still applies before the import above actually resolves.
jest.mock('../../../db/database', () => ({ database: {}, collections: {} }));

// Both inspectorNames.ts and AuthProvider.tsx (via services/supabase/auth.ts)
// transitively import services/supabase/client.ts, which calls
// createClient(ENV.supabaseUrl, ...) at module load time — that throws
// under Jest because EXPO_PUBLIC_SUPABASE_URL isn't populated in this
// environment. None of it is exercised by INSPECTION_TYPE_LABELS, so stub
// the client module out rather than touch env/jest config.
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));

describe('INSPECTION_TYPE_LABELS', () => {
  it('is derived from REPORT_TYPE_DISPLAY: same keys, same labels', () => {
    const expectedEntries = Object.fromEntries(
      Object.entries(REPORT_TYPE_DISPLAY).map(([key, meta]) => [key, meta.label]),
    );
    expect(INSPECTION_TYPE_LABELS).toEqual(expectedEntries);
  });

  // Regression coverage for existing consumers (ManageReportsTab,
  // InspectionReportDetailScreen, EstablishmentDetailScreen), which index
  // this map with a raw stored reportType string and expect these exact,
  // previously hand-maintained labels back. Assert the resolved values
  // imported as symbols (REPORT_TYPE_DISPLAY[...].label), not restated
  // string literals, so a drift in either place fails this test.
  // The keys are the region's own (src/region/__tests__/reportTypeDisplay.test.ts
  // pins which ones); a region with no report types has none to check.
  const ALL_DATA_KEYS = Object.keys(REPORT_TYPE_DISPLAY);
  const itEachKey = ALL_DATA_KEYS.length > 0 ? it.each(ALL_DATA_KEYS) : it.skip.each([['(none)']]);

  itEachKey('%s label matches REPORT_TYPE_DISPLAY exactly', (key) => {
    expect(INSPECTION_TYPE_LABELS[key]).toBe(REPORT_TYPE_DISPLAY[key].label);
  });
});
