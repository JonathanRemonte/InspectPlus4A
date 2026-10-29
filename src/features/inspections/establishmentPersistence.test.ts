import { resolveEstablishmentContentEdit } from './establishmentPersistence';

// resolveEstablishmentContentEdit is a pure function, but the module also
// constructs a real WatermelonDB SQLiteAdapter at import time (via
// db/database.ts) — that needs the native JSI binding, which isn't present
// under plain Jest. Stub the db module out so importing this file for its
// pure logic doesn't drag in the native adapter. jest.mock calls are
// hoisted above imports by babel-plugin-jest-hoist, so this still applies
// before the import above actually resolves.
jest.mock('../../db/database', () => ({ database: {}, collections: {} }));

const SYNCED_FIELDS = {
  name: 'Jollibee',
  formerName: null,
  addressLine: 'Trium Square',
  barangay: '56',
  city: 'Pasay',
  province: 'Palawan',
  geoLat: null,
  geoLng: null,
  natureOfBusiness: 'FoodBeverage',
  psicCode: null,
  product: null,
  yearEstablished: null,
  operatingStatus: 'Operational',
  operatingHoursDay: null,
  operatingDaysWeek: null,
  operatingDaysYear: null,
  productLines: [],
  ownerName: '',
  managingHeadName: '',
  pcoName: null,
  pcoAccreditationNo: null,
  pcoEffectivity: null,
  phoneFax: '',
  email: '',
  contactPersonName: '',
  contactPersonPosition: '',
  denrPermits: [],
};

function syncedRecord() {
  return {
    ...SYNCED_FIELDS,
    syncState: 'synced',
    lastSyncedSnapshot: JSON.stringify(SYNCED_FIELDS),
  };
}

describe('resolveEstablishmentContentEdit', () => {
  it('leaves a synced record alone when nothing changed', () => {
    const record = syncedRecord();
    const result = resolveEstablishmentContentEdit(record, { natureOfBusiness: 'FoodBeverage' });
    expect(result).toEqual({ syncState: 'synced', isDirty: false });
  });

  it('marks pending_update when a field changes from the synced baseline', () => {
    const record = syncedRecord();
    const result = resolveEstablishmentContentEdit(record, { natureOfBusiness: 'FastFood' });
    expect(result).toEqual({ syncState: 'pending_update', isDirty: true });
  });

  it('resolves back to synced when a second edit reverts to the snapshot value', () => {
    // First edit: FoodBeverage -> FastFood, still un-synced (snapshot untouched).
    const record = {
      ...syncedRecord(),
      natureOfBusiness: 'FastFood',
      syncState: 'pending_update',
      // lastSyncedSnapshot is NOT re-baselined by a local edit — only a
      // real sync (markLocalChangesAsSynced/upsertMany) touches it.
    };
    // Second edit: FastFood -> FoodBeverage, matching the original snapshot.
    const result = resolveEstablishmentContentEdit(record, { natureOfBusiness: 'FoodBeverage' });
    expect(result).toEqual({ syncState: 'synced', isDirty: true });
  });

  it('stays pending_create regardless of the diff', () => {
    const record = { ...syncedRecord(), syncState: 'pending_create', lastSyncedSnapshot: null };
    const result = resolveEstablishmentContentEdit(record, { natureOfBusiness: 'Anything' });
    expect(result).toEqual({ syncState: 'pending_create', isDirty: true });
  });

  it('falls back to pending_update when there is no snapshot yet', () => {
    const record = { ...syncedRecord(), syncState: 'synced', lastSyncedSnapshot: null };
    const result = resolveEstablishmentContentEdit(record, { natureOfBusiness: 'FastFood' });
    expect(result).toEqual({ syncState: 'pending_update', isDirty: true });
  });

  it('treats array fields structurally, not by reference', () => {
    const productLines = [{ product_line: 'Fries', ecc_production_rate: '', actual_production_rate: '' }];
    const record = {
      ...syncedRecord(),
      productLines,
      lastSyncedSnapshot: JSON.stringify({ ...SYNCED_FIELDS, productLines }),
    };

    // A structurally-identical but reference-distinct array must not be
    // treated as a change — same rule for the live-value comparison
    // (isDirty) as for the snapshot comparison (syncState).
    const result = resolveEstablishmentContentEdit(record, {
      productLines: [{ product_line: 'Fries', ecc_production_rate: '', actual_production_rate: '' }],
    });
    expect(result).toEqual({ syncState: 'synced', isDirty: false });
  });
});

// denrPermits is the first array field edited through this path (the
// establishment's permits section). Dirtiness must follow the array's
// contents, not its identity: a fresh array holding the same permits is
// not an edit, and a changed permit is - even though every such edit
// arrives as a brand-new array from the editor's draft state.
describe('resolveEstablishmentContentEdit with the permits array', () => {
  const permit = (serial: string) => ({
    envi_law: 'RA 9275',
    permit_type: 'Discharge Permit',
    permit_serial: serial,
    issued_date: '2026-01-01',
    expiry_date: '2027-01-01',
  });

  it('treats a new array holding identical permits as no edit at all', () => {
    const record = { ...syncedRecord(), denrPermits: [permit('DP-1')] };
    const result = resolveEstablishmentContentEdit(record, { denrPermits: [permit('DP-1')] });
    expect(result.isDirty).toBe(false);
  });

  it('marks the record dirty when a permit field changes', () => {
    const record = { ...syncedRecord(), denrPermits: [permit('DP-1')] };
    const result = resolveEstablishmentContentEdit(record, { denrPermits: [permit('DP-2')] });
    expect(result).toEqual({ syncState: 'pending_update', isDirty: true });
  });

  it('marks the record dirty when a permit is added or removed', () => {
    const record = { ...syncedRecord(), denrPermits: [permit('DP-1')] };
    expect(resolveEstablishmentContentEdit(record, { denrPermits: [permit('DP-1'), permit('DP-2')] }).isDirty).toBe(true);
    expect(resolveEstablishmentContentEdit(record, { denrPermits: [] }).isDirty).toBe(true);
  });
});
