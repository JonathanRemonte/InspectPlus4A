import { mapWater } from './water';
import { fullWaterBundle, emptyWaterBundle, malformedWaterBundle, fullWaterCompliance, signatories } from './fixtures';
import { TICKED, UNTICKED } from './primitives';
// eslint-disable-next-line no-restricted-imports -- mapper moves to src/region/export in Task 9
import { WATER_FINDINGS_CHECKLIST } from '../../../region/inspections/water/waterChecklistData';
import { ROW_MINIMUMS } from '../rowMinimums';
import type { TemplateData } from '../types';

const ctx = { signatories };
const rows = (d: TemplateData, key: string) => d[key] as TemplateData[];

describe('mapWater', () => {
  const full = mapWater(fullWaterBundle(), ctx);
  const empty = mapWater(emptyWaterBundle(), ctx);

  it('includes the shared block', () => {
    expect(full.gi_establishment_name).toContain('Alpha');
    expect(full.sig_inspector_name).toBe('Juan Dela Cruz');
  });

  it('places water sources on their printed rows, joining repeats', () => {
    expect(full.ws_groundwater_daily).toBe('12; 3');
    expect(full.ws_groundwater_specify).toBe('Well 2');
    expect(full.ws_others_daily).toBe('1');
    expect(full.ws_others_specify).toBe('Rainwater');
    expect(full.ws_surface_daily).toBe('');
    expect(full.ww_process_consumed).toBe('10');
    expect(full.ww_process_specify).toBe('Outlet 1');
    expect(full.ww_storm_drain_generated).toBe('2');
    expect(full.ww_cooling_consumed).toBe('');
  });

  it('pads abstracted-water rows', () => {
    const r = rows(full, 'abstracted_rows');
    expect(r).toHaveLength(ROW_MINIMUMS.abstractedWaterQuality);
    expect(r[0]).toEqual({ source: 'Ground Water', specify: 'Deep well', bod_cod: '5', tss: '10', avfp: '', heavy_metal: 'ND' });
    expect(r[1].source).toBe('');
  });

  it('ticks WWTP presence and type', () => {
    expect(full.cb_has_wwtp_yes).toBe(TICKED);
    expect(full.cb_has_wwtp_no).toBe(UNTICKED);
    expect(full.cb_wwtp_type_others).toBe(TICKED);
    expect(full.cb_wwtp_type_physical).toBe(UNTICKED);
    expect(full.wwtp_type_others).toBe('Constructed wetland');
    expect(empty.cb_has_wwtp_yes).toBe(UNTICKED);
    expect(empty.cb_has_wwtp_no).toBe(UNTICKED);
  });

  it('describes a Combined type and a non-WWTP treatment in the Others text', () => {
    const combined = mapWater({ ...fullWaterBundle(), compliance: { ...fullWaterCompliance(), wwtpType: 'Combined', wwtpTypeOther: null } }, ctx);
    expect(combined.cb_wwtp_type_others).toBe(TICKED);
    expect(combined.wwtp_type_others).toBe('Combined');
    const none = mapWater({ ...fullWaterBundle(), compliance: { ...fullWaterCompliance(), hasWwtp: false, wwtpType: null, nonWwtpTreatment: { systems: ['Septic Tank', 'Others'], other: 'Lagoon' } } }, ctx);
    expect(none.cb_has_wwtp_no).toBe(TICKED);
    expect(none.cb_wwtp_type_others).toBe(UNTICKED);
    expect(none.wwtp_type_others).toContain('Septic Tank');
    expect(none.wwtp_type_others).toContain('Lagoon');
  });

  it('pads outlets to three and prints the receiving body', () => {
    const r = rows(full, 'wwtp_outlets');
    expect(r).toHaveLength(3);
    expect(r[0].receiving_body).toBe('Calapan River (Class C)');
    expect(r[0].date_of_installation).toBe('01 May 2020');
    expect(r[1].receiving_body).toBe('Unnamed creek');
    expect(r[2].outlet_no).toBe('');
  });

  it('decodes treatment components including legacy comma strings', () => {
    const r = rows(full, 'wwtp_components');
    expect(r).toHaveLength(2);
    expect(r[0].cb_primary_screening).toBe(TICKED);
    expect(r[0].cb_primary_grit_removal).toBe(UNTICKED);
    expect(r[0].cb_primary_others).toBe(TICKED);
    expect(r[0].primary_others).toBe('Sand trap');
    expect(r[0].cb_bio_sbr).toBe(TICKED);
    expect(r[0].cb_bio_trickling_filter).toBe(TICKED);
    expect(r[0].cb_chem_disinfection).toBe(TICKED);
    expect(r[0].other_treatment).toBe('UV');
    expect(r[1].cb_primary_screening).toBe(TICKED);
    expect(r[1].cb_primary_grit_removal).toBe(TICKED);
    expect(r[1].cb_chem_others).toBe(TICKED);
    expect(r[1].chem_others).toBe('Ozonation');
  });

  it('ticks the WWTP condition and construction answers', () => {
    expect(full.cb_wwtp_condition_others).toBe(TICKED);
    expect(full.wwtp_condition_others).toBe('Under repair');
    expect(full.cb_under_construction_yes).toBe(TICKED);
    expect(full.cb_construction_reported_no).toBe(TICKED);
    expect(full.cb_construction_reported_yes).toBe(UNTICKED);
    expect(full.wwtp_construction_completion_date).toBe('01 December 2026');
    expect(full.wwtp_treatment_units_utilized).toBe('Bypass to lagoon');
    expect(empty.cb_under_construction_yes).toBe(UNTICKED);
    expect(empty.cb_under_construction_no).toBe(UNTICKED);
  });

  it('pads sampling points and their parameters', () => {
    const points = rows(full, 'sampling_points');
    expect(points).toHaveLength(2);
    expect(points[0].sampling_station).toBe('Outfall 1');
    const params = points[0].parameters as TemplateData[];
    expect(params).toHaveLength(ROW_MINIMUMS.samplingParameters);
    expect(params[1]).toEqual({ parameter_name: 'BOD', value: '60', unit: 'mg/L', denr_standard: '50', cb_compliant_y: UNTICKED, cb_compliant_n: TICKED, remarks: 'Exceeds' });
    expect((points[1].parameters as TemplateData[])[0].parameter_name).toBe('');
  });

  it('leaves sampling blank when no sampling was conducted', () => {
    const none = mapWater({ ...fullWaterBundle(), compliance: { ...fullWaterCompliance(), samplingConducted: false } }, ctx);
    const points = rows(none, 'sampling_points');
    expect(points).toHaveLength(2);
    expect(points[0].sampling_station).toBe('');
  });

  it('prints the previous inspection only when records exist', () => {
    expect(full.prev_date_of_sampling).toBe('10 November 2025');
    expect(rows(full, 'prev_parameters')[0].parameter_name).toBe('TSS');
    const no = mapWater({ ...fullWaterBundle(), compliance: { ...fullWaterCompliance(), previousInspectionSummary: { ...fullWaterCompliance().previousInspectionSummary, hasRecords: 'no' } } }, ctx);
    expect(no.prev_date_of_sampling).toBe('');
    expect(rows(no, 'prev_parameters')[0].parameter_name).toBe('');
    const neverAsked = mapWater({ ...fullWaterBundle(), compliance: { ...fullWaterCompliance(), previousInspectionSummary: { ...fullWaterCompliance().previousInspectionSummary, hasRecords: null } } }, ctx);
    expect(neverAsked.prev_date_of_sampling).toBe('10 November 2025');
  });

  it('answers the summary of findings by key', () => {
    expect(full.sf_dao2005_10_r14_1_has_dp_y).toBe(TICKED);
    expect(full.sf_dao2005_10_r14_1_has_dp_n).toBe(UNTICKED);
    expect(full.sf_dao2005_10_r14_1_has_dp_remarks).toBe('DP-2026-001');
    expect(full.sf_other_pending_litigation_na).toBe(TICKED);
    expect(full.sf_dao2005_10_r13_1_wastewater_charge_y).toBe(UNTICKED);
    for (const def of WATER_FINDINGS_CHECKLIST) {
      const slug = def.key.replace(/-/g, '_');
      expect(typeof full[`sf_${slug}_y`]).toBe('string');
      expect(typeof full[`sf_${slug}_remarks`]).toBe('string');
    }
  });

  it('pads DP conditions', () => {
    const r = rows(full, 'dp_conditions');
    expect(r).toHaveLength(ROW_MINIMUMS.dpConditions);
    expect(r[1]).toEqual({ condition_no: '2', description: 'Quarterly SMR', cb_y: UNTICKED, cb_n: TICKED, cb_na: UNTICKED, remarks: 'Late' });
  });

  it('never throws on malformed data and still pads every loop', () => {
    const m = mapWater(malformedWaterBundle(), ctx);
    expect(m.ws_groundwater_daily).toBe('');
    expect(rows(m, 'wwtp_outlets')).toHaveLength(3);
    expect(rows(m, 'wwtp_outlets')[0].outlet_no).toBe('7');
    expect(rows(m, 'wwtp_components')[0].cb_primary_screening).toBe(UNTICKED);
    expect(rows(m, 'sampling_points')[0].parameters).toHaveLength(ROW_MINIMUMS.samplingParameters);
    expect(m.sf_dao2005_10_r14_1_has_dp_y).toBe(UNTICKED);
    expect(m.sf_dao2005_10_r14_1_has_dp_remarks).toBe('');
    expect(rows(m, 'dp_conditions')[1].description).toBe('');
  });

  it('a report with no compliance row prints the water block blank', () => {
    expect(empty.ws_groundwater_daily).toBe('');
    expect(rows(empty, 'wwtp_outlets')).toHaveLength(3);
    expect(empty.sf_dao2005_10_r14_1_has_dp_y).toBe(UNTICKED);
  });
});
