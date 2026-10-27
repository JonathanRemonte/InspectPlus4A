import {
  AIR_CHECKLIST_DAO_2004_26,
  AIR_CHECKLIST_DAO_2000_81,
  AIR_CHECKLIST_EMB_MC,
  AIR_CHECKLIST_APPENDIX_F,
  AIR_CHECKLIST_CONSENT_AGREEMENT,
  SMR_QUARTER_KEY,
} from './airChecklistData';
import {
  airChecklistsForSave,
  airChecklistsFromRecord,
  describeSmrQuarters,
  emptyAirComplianceForm,
  ptoConditionsForSave,
  ptoConditionsFromRecord,
  EMISSION_SOURCE_KEYS,
} from './airTypes';

// The boundary between the air form's state and the compliance_air record:
// five keyed checklists (plus the quarterly-SMR ticks riding on one entry),
// PTO conditions snake_cased for storage, and the empty form a screen
// starts from.

describe('emptyAirComplianceForm', () => {
  it('starts with one numbered emission source and one numbered PTO condition', () => {
    const form = emptyAirComplianceForm();
    expect(form.emissionSources).toHaveLength(1);
    expect(form.emissionSources[0].source_no).toBe('1');
    expect(Object.keys(form.emissionSources[0]).sort()).toEqual([...EMISSION_SOURCE_KEYS].sort());
    expect(form.ptoConditions).toEqual([{ conditionNo: '1', description: '', compliant: null, remarks: '' }]);
  });

  it('holds one unanswered value per question in each of the five lists', () => {
    const form = emptyAirComplianceForm();
    expect(form.checklistDao200426).toHaveLength(AIR_CHECKLIST_DAO_2004_26.length);
    expect(form.checklistDao200081).toHaveLength(AIR_CHECKLIST_DAO_2000_81.length);
    expect(form.checklistEmbMc).toHaveLength(AIR_CHECKLIST_EMB_MC.length);
    expect(form.checklistAppendixF).toHaveLength(AIR_CHECKLIST_APPENDIX_F.length);
    expect(form.checklistConsentAgreement).toHaveLength(AIR_CHECKLIST_CONSENT_AGREEMENT.length);
    expect(form.checklistEmbMc.every(v => v.compliant === null && v.remarks === '')).toBe(true);
    expect(form.smrQuarters).toEqual([]);
    expect(form.documentsReviewed).toEqual([]);
    expect(form.otherObservations).toBe('');
    expect(form.remarksRecommendations).toBe('');
  });
});

describe('airChecklistsForSave / airChecklistsFromRecord', () => {
  const answered = () => {
    const form = emptyAirComplianceForm();
    form.checklistDao200426[0] = { compliant: 'Y', remarks: '' };
    form.checklistDao200081[3] = { compliant: 'NA', remarks: 'no CEMS' };
    form.checklistEmbMc[13] = { compliant: 'N', remarks: 'no bunker test' };
    form.checklistAppendixF[12] = { compliant: 'Y', remarks: '' };
    form.checklistConsentAgreement[1] = { compliant: 'N', remarks: 'EMP pending' };
    form.smrQuarters = ['Q1', 'Q3'];
    return form;
  };

  it('writes all five columns as keyed, self-describing entries', () => {
    const record = airChecklistsForSave(answered());
    expect(record.checklistDao200426[0]).toEqual({
      key: 'dao2004-26-r19-s1-valid-pto',
      legal_ref: 'DAO 2004-26 Rule 19 Section 1',
      requirement: 'All emission sources have a valid Permit to Operate',
      compliant: 'Y',
      remarks: '',
    });
    expect(record.checklistConsentAgreement[1]).toMatchObject({
      key: 'consent-dao2000-81-p7-r25-s9b-emp-6-months',
      legal_ref: 'For Facilities Engaged with Consent Agreement DAO 2000-81 Part 7 Rule 25 Section 9 (b)',
      compliant: 'N',
      remarks: 'EMP pending',
    });
    expect(record.checklistAppendixF).toHaveLength(13);
  });

  it('rides the SMR quarters on the quarterly-SMR entry and nowhere else', () => {
    const record = airChecklistsForSave(answered());
    const smr = record.checklistDao200426.find(e => e.key === SMR_QUARTER_KEY);
    expect(smr).toMatchObject({ quarters: ['Q1', 'Q3'] });
    const others = record.checklistDao200426.filter(e => e.key !== SMR_QUARTER_KEY);
    expect(others.every(e => !('quarters' in e))).toBe(true);
  });

  it('keeps the quarters whatever the Y/N/NA answer', () => {
    const form = answered();
    form.checklistDao200426[10] = { compliant: 'N', remarks: 'Q2 and Q4 missing' };
    const smr = airChecklistsForSave(form).checklistDao200426.find(e => e.key === SMR_QUARTER_KEY);
    expect(smr).toMatchObject({ compliant: 'N', quarters: ['Q1', 'Q3'] });
  });

  it('round-trips through the record', () => {
    const form = answered();
    const back = airChecklistsFromRecord(airChecklistsForSave(form));
    expect(back).toEqual({
      checklistDao200426: form.checklistDao200426,
      checklistDao200081: form.checklistDao200081,
      checklistEmbMc: form.checklistEmbMc,
      checklistAppendixF: form.checklistAppendixF,
      checklistConsentAgreement: form.checklistConsentAgreement,
      smrQuarters: ['Q1', 'Q3'],
    });
  });

  it('reads a row written before the new columns existed as blank there', () => {
    const back = airChecklistsFromRecord({
      checklistDao200426: airChecklistsForSave(answered()).checklistDao200426,
      checklistAppendixF: null,
    });
    expect(back.checklistDao200426[0]).toEqual({ compliant: 'Y', remarks: '' });
    expect(back.checklistAppendixF).toEqual(emptyAirComplianceForm().checklistAppendixF);
    expect(back.checklistConsentAgreement).toEqual(emptyAirComplianceForm().checklistConsentAgreement);
  });

  it('filters quarters to the four it knows, keeping form order, and defaults to none', () => {
    const entries = airChecklistsForSave(answered()).checklistDao200426.map(e =>
      e.key === SMR_QUARTER_KEY ? { ...e, quarters: ['Q4', 'Q9', 'Q1', 'q2'] } : e,
    );
    expect(airChecklistsFromRecord({ checklistDao200426: entries }).smrQuarters).toEqual(['Q1', 'Q4']);
    expect(airChecklistsFromRecord({ checklistDao200426: [{ key: SMR_QUARTER_KEY, compliant: 'Y' }] }).smrQuarters).toEqual([]);
    expect(airChecklistsFromRecord({}).smrQuarters).toEqual([]);
  });
});

describe('ptoConditionsForSave / ptoConditionsFromRecord', () => {
  it('snake_cases rows and drops those with no description', () => {
    expect(ptoConditionsForSave([
      { conditionNo: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { conditionNo: '2', description: '   ', compliant: null, remarks: 'stray' },
      { conditionNo: '3', description: 'Quarterly SMR', compliant: 'N', remarks: 'Q2 late' },
    ])).toEqual([
      { condition_no: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { condition_no: '3', description: 'Quarterly SMR', compliant: 'N', remarks: 'Q2 late' },
    ]);
  });

  it('reads stored entries back as form rows, tolerating missing keys', () => {
    expect(ptoConditionsFromRecord([
      { condition_no: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { description: 'No remarks key', compliant: null },
    ])).toEqual([
      { conditionNo: '1', description: 'Stack height 20 m', compliant: 'Y', remarks: '' },
      { conditionNo: '', description: 'No remarks key', compliant: null, remarks: '' },
    ]);
  });
});

describe('describeSmrQuarters', () => {
  it('lists the ticked quarters or a dash', () => {
    expect(describeSmrQuarters(['Q1', 'Q3'])).toBe('Q1, Q3');
    expect(describeSmrQuarters([])).toBe('—');
  });
});
