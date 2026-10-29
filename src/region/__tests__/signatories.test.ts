import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorageSignatoryProvider, emptySignatories, SIGNATORIES_STORAGE_KEY } from '../../features/export/signatories';
import { defaultApproversFor } from '../../features/export/templates';

const WATER_APPROVERS = defaultApproversFor('inspection', 'water_monitoring');
const HAZWASTE_APPROVERS = defaultApproversFor('inspection', 'hazardous_waste');

describe('asyncStorageSignatoryProvider', () => {
  beforeEach(() => AsyncStorage.clear());

  it('returns null from load() when nothing is saved', async () => {
    expect(await asyncStorageSignatoryProvider.load()).toBeNull();
  });

  it('loadFor resolves each report type to its own printed default when nothing was ever saved', async () => {
    const water = await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring');
    expect(water.recommendingName).toBe(WATER_APPROVERS.recommendingName);
    expect(water.approverPosition).toBe(WATER_APPROVERS.approverPosition);

    const hazwaste = await asyncStorageSignatoryProvider.loadFor('inspection', 'hazardous_waste');
    expect(hazwaste.recommendingName).toBe(HAZWASTE_APPROVERS.recommendingName);
    expect(hazwaste.recommendingPosition).toBe(HAZWASTE_APPROVERS.recommendingPosition);
    // Hazwaste's approver is the same person as every other form even
    // though its recommending signatory differs.
    expect(hazwaste.approverName).toBe(WATER_APPROVERS.approverName);
  });

  it('ignores a corrupt value', async () => {
    await AsyncStorage.setItem(SIGNATORIES_STORAGE_KEY, '{not json');
    expect(await asyncStorageSignatoryProvider.load()).toBeNull();
    expect((await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring')).recommendingName).toBe(WATER_APPROVERS.recommendingName);
  });

  // A record saved by the previous build (2a54578 — flat approver fields,
  // no per-type storage at all) must still resolve to each type's own
  // printed default, exactly as if nothing had ever been saved for that
  // type. Its old flat fields are read by nothing here.
  it('resolves a legacy flat-approver record to each type\'s own default, not the old flat fields', async () => {
    await AsyncStorage.setItem(SIGNATORIES_STORAGE_KEY, JSON.stringify({
      inspectorName: 'A', inspectorPosition: 'B', supervisorName: 'C', supervisorPosition: 'D',
      recommendingName: 'Old Flat Recommender', recommendingPosition: 'Old Flat Position',
      approverName: 'Old Flat Approver', approverPosition: 'Old Flat Approver Position',
    }));
    const water = await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring');
    expect(water.inspectorName).toBe('A');
    expect(water.recommendingName).toBe(WATER_APPROVERS.recommendingName);
    expect(water.approverPosition).toBe(WATER_APPROVERS.approverPosition);

    const hazwaste = await asyncStorageSignatoryProvider.loadFor('inspection', 'hazardous_waste');
    expect(hazwaste.recommendingName).toBe(HAZWASTE_APPROVERS.recommendingName);
  });

  // The core scenario this task fixes: saving approvers for one report type
  // must not touch what another type prefills.
  it('remembers approvers per report type — saving for hazardous_waste leaves water_monitoring at its own default', async () => {
    const hazwasteEdit = {
      inspectorName: 'Inspector', inspectorPosition: 'Eng I', supervisorName: 'Sup', supervisorPosition: 'Chief',
      recommendingName: 'Custom Hazwaste Recommender', recommendingPosition: 'Custom Position',
      approverName: 'Custom Hazwaste Approver', approverPosition: 'Custom Approver Position',
      additionalInspectors: [],
    };
    await asyncStorageSignatoryProvider.save(hazwasteEdit, 'inspection', 'hazardous_waste');

    const hazwaste = await asyncStorageSignatoryProvider.loadFor('inspection', 'hazardous_waste');
    expect(hazwaste.recommendingName).toBe('Custom Hazwaste Recommender');
    expect(hazwaste.approverPosition).toBe('Custom Approver Position');
    // The core fields (shared across types) came through too.
    expect(hazwaste.inspectorName).toBe('Inspector');
    expect(hazwaste.supervisorName).toBe('Sup');

    // water_monitoring was never saved for — it still resolves to its OWN
    // printed default, not Hazwaste's custom values or Hazwaste's default.
    const water = await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring');
    expect(water.recommendingName).toBe(WATER_APPROVERS.recommendingName);
    expect(water.recommendingPosition).toBe(WATER_APPROVERS.recommendingPosition);
    expect(water.approverPosition).toBe(WATER_APPROVERS.approverPosition);
    // The shared core fields (inspector/supervisor) DO carry over, since
    // there's only one inspector on the device.
    expect(water.inspectorName).toBe('Inspector');

    // Saving again for water_monitoring only adds/overwrites that type's
    // entry — Hazwaste's remembered values are untouched.
    const waterEdit = { ...water, recommendingName: 'Custom Water Recommender' };
    await asyncStorageSignatoryProvider.save(waterEdit, 'inspection', 'water_monitoring');
    expect((await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring')).recommendingName).toBe('Custom Water Recommender');
    expect((await asyncStorageSignatoryProvider.loadFor('inspection', 'hazardous_waste')).recommendingName).toBe('Custom Hazwaste Recommender');
  });

  it('survey reports share one remembered-approvers slot regardless of reportType', async () => {
    const s = {
      inspectorName: 'I', inspectorPosition: 'P', supervisorName: 'S', supervisorPosition: 'SP',
      recommendingName: 'Survey Recommender', recommendingPosition: 'Survey Rec Position',
      approverName: 'Survey Approver', approverPosition: 'Survey Approver Position',
      additionalInspectors: [],
    };
    await asyncStorageSignatoryProvider.save(s, 'survey', 'survey');
    expect((await asyncStorageSignatoryProvider.loadFor('survey', 'survey')).recommendingName).toBe('Survey Recommender');
  });

  it('round-trips additionalInspectors and sanitises a malformed value', async () => {
    const s = {
      inspectorName: 'A', inspectorPosition: 'B', supervisorName: 'C', supervisorPosition: 'D',
      recommendingName: 'R', recommendingPosition: 'RP', approverName: 'AP', approverPosition: 'APP',
      additionalInspectors: [{ name: 'Second Inspector', position: 'Engineer I' }],
    };
    await asyncStorageSignatoryProvider.save(s, 'inspection', 'water_monitoring');
    expect((await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring')).additionalInspectors).toEqual(s.additionalInspectors);

    await AsyncStorage.setItem(SIGNATORIES_STORAGE_KEY, JSON.stringify({ inspectorName: 'A', additionalInspectors: [{ name: 42, position: null }, 'garbage'] }));
    const loaded = await asyncStorageSignatoryProvider.load();
    expect(loaded?.additionalInspectors).toEqual([{ name: '', position: '' }, { name: '', position: '' }]);
  });

  it('falls back to that type\'s default for a blank approver field within a saved entry', async () => {
    await asyncStorageSignatoryProvider.save({
      inspectorName: 'A', inspectorPosition: '', supervisorName: '', supervisorPosition: '',
      recommendingName: '', recommendingPosition: 'Kept Position', approverName: 'Kept Approver', approverPosition: '',
      additionalInspectors: [],
    }, 'inspection', 'water_monitoring');
    const loaded = await asyncStorageSignatoryProvider.loadFor('inspection', 'water_monitoring');
    expect(loaded.recommendingName).toBe(WATER_APPROVERS.recommendingName);
    expect(loaded.recommendingPosition).toBe('Kept Position');
    expect(loaded.approverName).toBe('Kept Approver');
    expect(loaded.approverPosition).toBe(WATER_APPROVERS.approverPosition);
  });

  it('emptySignatories prefills the inspector name and that report type\'s own default approvers', () => {
    expect(emptySignatories('Juan', 'inspection', 'water_monitoring')).toEqual({
      inspectorName: 'Juan', inspectorPosition: '', supervisorName: '', supervisorPosition: '',
      ...WATER_APPROVERS,
      additionalInspectors: [],
    });
    expect(emptySignatories('Juan', 'inspection', 'hazardous_waste').recommendingName).toBe(HAZWASTE_APPROVERS.recommendingName);
    expect(emptySignatories(null, 'inspection', 'water_monitoring').inspectorName).toBe('');
  });
});
