import {
  AIR_CHECKLIST_DAO_2004_26,
  AIR_CHECKLIST_DAO_2000_81,
  AIR_CHECKLIST_EMB_MC,
  AIR_CHECKLIST_APPENDIX_F,
  AIR_CHECKLIST_CONSENT_AGREEMENT,
  AIR_CHECKLIST_GROUPS,
  AIR_DOCUMENTS_REVIEWED_OPTIONS,
  SMR_QUARTER_KEY,
  SMR_QUARTERS,
} from './airChecklistData';
import { DOCUMENTS_REVIEWED_OPTIONS } from '../water/waterChecklistData';

// Table 7 of the printed Air Monitoring form: 52 questions in five groups.
// The counts are the template's, row for row (see the spec's Table 7
// table), so a dropped or duplicated transcription shows up here.

describe('the air checklist matches the printed form', () => {
  it('has the template’s question count in each group', () => {
    expect(AIR_CHECKLIST_DAO_2004_26).toHaveLength(11);
    expect(AIR_CHECKLIST_DAO_2000_81).toHaveLength(12);
    expect(AIR_CHECKLIST_EMB_MC).toHaveLength(14);
    expect(AIR_CHECKLIST_APPENDIX_F).toHaveLength(13);
    expect(AIR_CHECKLIST_CONSENT_AGREEMENT).toHaveLength(2);
  });

  it('lists the groups in template order', () => {
    expect(AIR_CHECKLIST_GROUPS.map(g => g.title)).toEqual([
      'DAO 2004-26',
      'DAO 2000-81',
      'EMB Memorandum Circulars',
      'Appendix F (Quality Assurance Procedures)',
      'For Facilities Engaged with Consent Agreement',
    ]);
    expect(AIR_CHECKLIST_GROUPS.map(g => g.items)).toEqual([
      AIR_CHECKLIST_DAO_2004_26,
      AIR_CHECKLIST_DAO_2000_81,
      AIR_CHECKLIST_EMB_MC,
      AIR_CHECKLIST_APPENDIX_F,
      AIR_CHECKLIST_CONSENT_AGREEMENT,
    ]);
  });

  it('gives every question a unique key across all five groups', () => {
    const keys = AIR_CHECKLIST_GROUPS.flatMap(g => g.items.map(i => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(52);
  });

  it('gives every question its printed group, a citation and wording', () => {
    for (const group of AIR_CHECKLIST_GROUPS) {
      for (const item of group.items) {
        expect(item.group).toBe(group.title);
        expect(item.ref.trim()).not.toBe('');
        expect(item.requirement.trim()).not.toBe('');
      }
    }
  });

  it('corrects the template’s "Part Rule 25" typo', () => {
    const refs = AIR_CHECKLIST_DAO_2000_81.map(i => i.ref);
    expect(refs.some(r => r.startsWith('Part Rule'))).toBe(false);
    expect(refs).toContain('Part 7 Rule 25 Section 5 a (3)');
    expect(refs).toContain('Part 7 Rule 25 Section 13d');
  });

  it('names the quarterly-SMR question so its Q1–Q4 ticks have a home', () => {
    const smr = AIR_CHECKLIST_DAO_2004_26.find(i => i.key === SMR_QUARTER_KEY);
    expect(smr?.requirement).toBe('Quarterly submission of self-monitoring report');
    expect(SMR_QUARTERS).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('adds Record File Folder ahead of the shared documents list', () => {
    expect(AIR_DOCUMENTS_REVIEWED_OPTIONS).toEqual(['Record File Folder', ...DOCUMENTS_REVIEWED_OPTIONS]);
  });
});
