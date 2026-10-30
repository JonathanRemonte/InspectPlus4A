import { mapCommon } from '../../../features/export/mappers/common';
import { fullWaterBundle, emptyWaterBundle, malformedWaterBundle, signatories } from '../../export/fixtures';
import { TICKED, UNTICKED } from '../../../features/export/mappers/primitives';
import type { TemplateData } from '../../../features/export/types';

const ctx = { signatories };

describe('mapCommon', () => {
  const full = mapCommon(fullWaterBundle(), ctx);
  const empty = mapCommon(emptyWaterBundle(), ctx);

  it('prints the header', () => {
    expect(full.report_control_no).toBe('WQ-2026-001');
    expect(full.inspection_date).toBe('05 September 2026');
    expect(empty.report_control_no).toBe('');
    expect(empty.inspection_date).toBe('');
  });

  it('prints general information from the snapshot', () => {
    expect(full.gi_establishment_name).toBe('Alpha Water Refilling (formerly Alpha Aqua)');
    expect(full.gi_address).toBe('12 Rizal St., San Vicente, Calapan City, Oriental Mindoro');
    expect(full.gi_geo).toBe('13.411700, 121.180300');
    expect(full.gi_product).toBe('Purified water; Ice');
    expect(full.gi_year_established).toBe('');
    expect(empty.gi_year_established).toBe('2024');
    expect(full.gi_operating_hours_day).toBe('8');
    expect(full.gi_pco_effectivity).toBe('01 March 2027');
    expect(full.gi_contact_person).toBe('C. Person (Manager)');
    expect(empty.gi_contact_person).toBe('C. Person');
    expect(empty.gi_geo).toBe('');
  });

  it('pads product lines to the printed minimum and grows past it', () => {
    expect(full.product_lines).toEqual([
      { product_line: 'Purified water', ecc_production_rate: '1000 L', actual_production_rate: '800 L' },
      { product_line: 'Ice', ecc_production_rate: '200 kg', actual_production_rate: '150 kg' },
    ]);
    expect(empty.product_lines).toEqual([{ product_line: '', ecc_production_rate: '', actual_production_rate: '' }]);
  });

  it('ticks purpose boxes', () => {
    expect(full.purpose_cb_verify).toBe(TICKED);
    expect(full.purpose_cb_complaints).toBe(UNTICKED);
    expect(full.purpose_cb_others).toBe(TICKED);
    expect(full.purpose_others).toBe('Follow-up on complaint #12');
    expect(full.purpose_cb_pmpin_new).toBe(TICKED);
    expect(full.purpose_cb_pmpin_renewal).toBe(UNTICKED);
    expect(full.purpose_cb_pto_air_renewal).toBe(TICKED);
    expect(full.purpose_cb_hazwaste_id_new).toBe(UNTICKED);
    expect(full.purpose_cb_pepp).toBe(TICKED);
    expect(full.purpose_cb_pab).toBe(UNTICKED);
    expect(full.purpose_cb_commitment_others).toBe(TICKED);
    expect(full.purpose_commitment_others).toBe('Green Choice');
    expect(empty.purpose_cb_verify).toBe(UNTICKED);
    expect(empty.purpose_cb_pmpin_new).toBe(UNTICKED);
    expect(empty.purpose_others).toBe('');
  });

  it('matches permits to the printed rows and overflows the rest', () => {
    expect(full.permit_ecc1_serial).toBe('ECC-1');
    expect(full.permit_ecc1_issued).toBe('01 January 2020');
    expect(full.permit_ecc2_serial).toBe('ECC-2');
    expect(full.permit_ecc3_serial).toBe('');
    expect(full.permit_denr_registry_id_serial).toBe('GR-4B-001');
    expect(full.permit_discharge_permit_number_serial).toBe('DP-2026-001');
    expect(full.permit_discharge_permit_number_expiry).toBe('14 January 2027');
    expect(full.permit_po_number_serial).toBe('PO-77');
    expect(full.permit_pcl_compliance_certificate_serial).toBe('');
    expect(full.permits_extra).toEqual([
      { envi_law: 'LLDA', permit_type: 'Clearance', permit_serial: 'LL-1', issued_date: '01 January 2024', expiry_date: '01 January 2025' },
    ]);
    expect(empty.permits_extra).toEqual([]);
  });

  it('ticks documents reviewed and collects the unknown ones as Others text', () => {
    expect(full.doc_cb_synology).toBe(TICKED);
    expect(full.doc_cb_smr_online).toBe(TICKED);
    expect(full.doc_cb_opms).toBe(UNTICKED);
    expect(full.doc_cb_record_file_folder).toBe(UNTICKED);
    expect(full.doc_cb_others).toBe(TICKED);
    expect(full.doc_others).toBe('Field notebook');
    expect(empty.doc_cb_others).toBe(UNTICKED);
  });

  it('prints observations, remarks and signatures', () => {
    expect(full.other_observations).toBe('Line 1\nLine 2');
    expect(full.remarks_recommendations).toBe('Renew DP');
    expect(empty.other_observations).toBe('');
    expect(full.sig_inspector_name).toBe('Juan Dela Cruz');
    expect(full.sig_supervisor_position).toBe('Chief, Water Quality Section');
    expect(full.sig_recommending_name).toBe('Pedro Reyes');
    expect(full.sig_recommending_position).toBe('OIC, Regional Division');
    expect(full.sig_approver_name).toBe('Ana Villanueva');
    expect(full.sig_approver_position).toBe('Regional Director');
    // fixtures.ts' signatories has no additionalInspectors, so the loop is
    // just the primary inspector.
    expect(full.sig_inspectors).toEqual([{ sig_inspector_name: 'Juan Dela Cruz', sig_inspector_position: 'Engineer II' }]);
  });

  it('lists the primary inspector first, then each additional inspector with a non-empty trimmed name', () => {
    const ctxWithExtras = {
      signatories: {
        ...signatories,
        additionalInspectors: [
          { name: 'Second Inspector', position: 'Engineer I' },
          { name: '   ', position: 'Blank name is dropped' },
          { name: 'Third Inspector', position: '' },
        ],
      },
    };
    const out = mapCommon(fullWaterBundle(), ctxWithExtras);
    expect(out.sig_inspectors).toEqual([
      { sig_inspector_name: 'Juan Dela Cruz', sig_inspector_position: 'Engineer II' },
      { sig_inspector_name: 'Second Inspector', sig_inspector_position: 'Engineer I' },
      { sig_inspector_name: 'Third Inspector', sig_inspector_position: '' },
    ]);
    // The flat top-level tags still carry the primary inspector, for a
    // template that doesn't loop sig_inspectors.
    expect(out.sig_inspector_name).toBe('Juan Dela Cruz');
  });

  it('lays photos out two per row, numbering captions as Figure N across the report', () => {
    expect(full.photo_rows).toEqual([
      {
        left: [{ photo_id: 'a1', caption: 'Figure 1: Main gate', photo_missing_text: '(photo not downloaded)' }],
        right: [{ photo_id: 'a2', caption: 'Figure 2', photo_missing_text: '(photo not downloaded)' }],
      },
    ]);
    const three = mapCommon({ ...fullWaterBundle(), photos: [...fullWaterBundle().photos, { ...fullWaterBundle().photos[0], attachmentId: 'a3' }] }, ctx);
    expect((three.photo_rows as TemplateData[])[1]).toEqual({ left: [{ photo_id: 'a3', caption: 'Figure 3: Main gate', photo_missing_text: '(photo not downloaded)' }], right: [] });
    expect(empty.photo_rows).toEqual([]);
  });

  it('never throws on malformed data', () => {
    const m = mapCommon(malformedWaterBundle(), ctx);
    expect(m.doc_cb_synology).toBe(UNTICKED);
    expect(m.doc_others).toBe('');
    expect(m.other_observations).toBe('');
  });

  it('emits only strings and arrays of string records', () => {
    const check = (data: Record<string, unknown>) => {
      for (const v of Object.values(data)) {
        if (Array.isArray(v)) v.forEach(row => check(row as Record<string, unknown>));
        else expect(typeof v).toBe('string');
      }
    };
    check(full);
    check(empty);
  });
});
