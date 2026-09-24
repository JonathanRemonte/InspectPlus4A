import { formatReportDate } from '../../../utils/formatReportDate';
import { formatEstablishmentLocation } from '../../../utils/establishmentLocation';
import { DOCUMENTS_REVIEWED_OPTIONS } from '../../inspections/water/waterChecklistData';
import type { PermitSnapshotItem } from '../../../services/sync/syncTypes';
import { ROW_MINIMUMS } from '../rowMinimums';
import type { ExportPhoto, InspectionBundle, MapContext, TemplateData } from '../types';
import { asArray, cb, joinNonEmpty, normalizeLabel, numberText, padRows, text } from './primitives';

// The sections every inspection form shares: header, General Information,
// Purpose of Inspection, DENR permits, documents reviewed, the closing
// observations/remarks, signatures and the ATTACHMENTS page. Each
// report-type mapper spreads this in first, then adds its own block.

const VERIFY_ITEMS = ['pmpin', 'hazwaste_id', 'hazwaste_transporter', 'hazwaste_tsd', 'pto_air', 'discharge_permit'] as const;
const COMMITMENT_ITEMS = ['industrial_ecowatch', 'pepp', 'pab'] as const;

// Printed permit rows, in form order. `match` decides whether a snapshot
// permit belongs on that row; ECC rows take PD 1586 permits in order.
type PermitRow = 'ecc1' | 'ecc2' | 'ecc3' | 'denr_registry_id' | 'pcl_compliance_certificate' | 'cco_registry' | 'permit_to_transport' | 'po_number' | 'ecc_sanitary_landfill' | 'discharge_permit_number';
const PERMIT_ROWS: PermitRow[] = ['ecc1', 'ecc2', 'ecc3', 'denr_registry_id', 'pcl_compliance_certificate', 'cco_registry', 'permit_to_transport', 'po_number', 'ecc_sanitary_landfill', 'discharge_permit_number'];
const PERMIT_MATCHERS: [PermitRow | 'ecc', RegExp][] = [
  ['ecc_sanitary_landfill', /sanitary|landfill/],
  ['ecc', /ecc|1586/],
  ['denr_registry_id', /registry ?id|hazardous ?waste ?id|hwid|generator ?id/],
  ['pcl_compliance_certificate', /pcl/],
  ['cco_registry', /cco/],
  ['permit_to_transport', /transport/],
  ['po_number', /permit ?to ?operate|\bpto\b|po ?number|8749/],
  ['discharge_permit_number', /discharge|9275/],
];

export function permitRowFor(p: PermitSnapshotItem): PermitRow | 'ecc' | null {
  const hay = `${text(p.permit_type)} ${text(p.envi_law)}`.toLowerCase();
  for (const [row, re] of PERMIT_MATCHERS) if (re.test(hay)) return row;
  return null;
}

function mapPermits(permits: readonly PermitSnapshotItem[]): TemplateData {
  const out: TemplateData = {};
  for (const row of PERMIT_ROWS) {
    out[`permit_${row}_serial`] = '';
    out[`permit_${row}_issued`] = '';
    out[`permit_${row}_expiry`] = '';
  }
  const extra: TemplateData[] = [];
  let eccCount = 0;
  const filled = new Set<PermitRow>();
  for (const p of asArray(permits) as unknown as PermitSnapshotItem[]) {
    let row = permitRowFor(p);
    if (row === 'ecc') {
      eccCount += 1;
      row = eccCount <= 3 ? (`ecc${eccCount}` as PermitRow) : null;
    } else if (row && filled.has(row)) {
      row = null;
    }
    if (row) {
      filled.add(row);
      out[`permit_${row}_serial`] = text(p.permit_serial);
      out[`permit_${row}_issued`] = formatReportDate(p.issued_date);
      out[`permit_${row}_expiry`] = formatReportDate(p.expiry_date);
    } else {
      extra.push({
        envi_law: text(p.envi_law),
        permit_type: text(p.permit_type),
        permit_serial: text(p.permit_serial),
        issued_date: formatReportDate(p.issued_date),
        expiry_date: formatReportDate(p.expiry_date),
      });
    }
  }
  out.permits_extra = padRows(extra, ROW_MINIMUMS.permitsExtra, () => ({ envi_law: '', permit_type: '', permit_serial: '', issued_date: '', expiry_date: '' }));
  return out;
}

const DOC_ROWS: [string, string][] = [
  ['record_file_folder', 'Record File Folder'],
  ...DOCUMENTS_REVIEWED_OPTIONS.filter(o => o !== 'Others').map(o => [o.toLowerCase().replace(/[^a-z0-9]+/g, '_'), o] as [string, string]),
  // Hazwaste's own form prints "HWMS" for its third documents-reviewed box
  // where Water/Air/EIA print "OPMS" — every mapper output carries both
  // keys so any of the four templates can print whichever one it has.
  ['hwms', 'HWMS'],
];

function mapDocuments(reviewed: unknown): TemplateData {
  const list = Array.isArray(reviewed) ? reviewed.map(text).filter(Boolean) : [];
  const known = new Set(DOC_ROWS.map(([, label]) => normalizeLabel(label)));
  const out: TemplateData = {};
  for (const [key, label] of DOC_ROWS) out[`doc_cb_${key}`] = cb(list.some(d => normalizeLabel(d) === normalizeLabel(label)));
  const others = list.filter(d => !known.has(normalizeLabel(d)) && normalizeLabel(d) !== 'others');
  out.doc_cb_others = cb(others.length > 0 || list.some(d => normalizeLabel(d) === 'others'));
  out.doc_others = others.join(', ');
  return out;
}

// Two photos per printed row: photo_rows[] → left[] / right[], each a 0- or
// 1-element list so the template's cell loops print nothing for a missing
// right-hand photo. Captions are numbered "Figure N" (1-based across the
// whole report) followed by the inspector's own caption when they gave one.
export function mapPhotos(photos: readonly ExportPhoto[]): TemplateData[] {
  const cells = asArray(photos).map((p, i) => {
    const photo = p as unknown as ExportPhoto;
    const n = i + 1;
    const caption = text(photo.caption).trim();
    return {
      photo_id: text(photo.attachmentId),
      caption: caption ? `Figure ${n}: ${caption}` : `Figure ${n}`,
      // The caption paragraph already prints "Figure N…", so the missing-photo
      // placeholder (printed in the drawing's own paragraph, above it) doesn't
      // repeat the figure number.
      photo_missing_text: '(photo not downloaded)',
    };
  });
  const rows: TemplateData[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push({ left: [cells[i]], right: cells[i + 1] ? [cells[i + 1]] : [] });
  }
  return padRows(rows, ROW_MINIMUMS.photoRows, () => ({ left: [], right: [] }));
}

export function mapSignatures(ctx: MapContext): TemplateData {
  // Primary inspector first, then any additional one whose trimmed name is
  // non-empty — a blank row the inspector added but never filled in (or
  // removed) is silently dropped rather than printing an empty line under
  // "Submitted by". The top-level sig_inspector_name/position stay so a
  // template that hasn't been updated to loop sig_inspectors still prints
  // the primary inspector.
  const additionalInspectorRows = asArray(ctx.signatories.additionalInspectors)
    .map(i => i as unknown as { name: string; position: string })
    .filter(i => text(i.name).trim().length > 0)
    .map(i => ({ sig_inspector_name: text(i.name), sig_inspector_position: text(i.position) }));

  return {
    sig_inspector_name: text(ctx.signatories.inspectorName),
    sig_inspector_position: text(ctx.signatories.inspectorPosition),
    sig_supervisor_name: text(ctx.signatories.supervisorName),
    sig_supervisor_position: text(ctx.signatories.supervisorPosition),
    sig_recommending_name: text(ctx.signatories.recommendingName),
    sig_recommending_position: text(ctx.signatories.recommendingPosition),
    sig_approver_name: text(ctx.signatories.approverName),
    sig_approver_position: text(ctx.signatories.approverPosition),
    sig_inspectors: [
      { sig_inspector_name: text(ctx.signatories.inspectorName), sig_inspector_position: text(ctx.signatories.inspectorPosition) },
      ...additionalInspectorRows,
    ],
  };
}

export function mapCommon(bundle: InspectionBundle, ctx: MapContext): TemplateData {
  const { report, purpose, compliance } = bundle;
  const s = report.establishmentSnapshot ?? ({} as InspectionBundle['report']['establishmentSnapshot']);
  const lines = asArray(s.product_lines);

  const out: TemplateData = {
    report_control_no: text(report.reportControlNo),
    inspection_date: formatReportDate(report.inspectionDate),

    gi_establishment_name: s.former_name ? `${text(s.name)} (formerly ${text(s.former_name)})` : text(s.name),
    gi_address: formatEstablishmentLocation({ addressLine: s.address_line, barangay: s.barangay, city: s.city, province: s.province }),
    gi_geo: typeof s.geo_lat === 'number' && typeof s.geo_lng === 'number' ? `${s.geo_lat.toFixed(6)}, ${s.geo_lng.toFixed(6)}` : '',
    gi_nature_of_business: text(s.nature_of_business),
    gi_psic_code: text(s.psic_code),
    gi_product: joinNonEmpty(lines.map(l => l.product_line), '; '),
    gi_year_established: s.operating_status && s.operating_status !== 'Operational' ? text(s.operating_status_since) : '',
    gi_operating_hours_day: numberText(s.operating_hours_day),
    gi_operating_days_week: numberText(s.operating_days_week),
    gi_operating_days_year: numberText(s.operating_days_year),
    product_lines: padRows(
      lines.map(l => ({ product_line: text(l.product_line), ecc_production_rate: text(l.ecc_production_rate), actual_production_rate: text(l.actual_production_rate) })),
      ROW_MINIMUMS.productLines,
      () => ({ product_line: '', ecc_production_rate: '', actual_production_rate: '' }),
    ),
    gi_managing_head: text(s.managing_head_name),
    gi_pco_name: text(s.pco_name),
    gi_pco_accreditation_no: text(s.pco_accreditation_no),
    gi_pco_effectivity: formatReportDate(s.pco_effectivity),
    gi_phone_fax: text(s.phone_fax),
    gi_email: text(s.email),
    gi_contact_person: text(s.contact_person_position).trim()
      ? `${text(s.contact_person_name)} (${text(s.contact_person_position).trim()})`
      : text(s.contact_person_name),

    purpose_cb_verify: cb(!!purpose?.verifyInfo),
    purpose_cb_compliance: cb(!!purpose?.determineCompliance),
    purpose_cb_complaints: cb(!!purpose?.investigateComplaints),
    purpose_cb_commitments: cb(!!purpose?.checkCommitments),
    purpose_cb_others: cb(!!text(purpose?.others).trim()),
    purpose_others: text(purpose?.others),
    purpose_commitment_others: text(purpose?.commitmentRows?.find(r => r.itemKey === 'others')?.remarks),
    purpose_cb_commitment_others: cb(!!purpose?.commitmentRows?.find(r => r.itemKey === 'others')?.checked),

    ...mapPermits(report.permitsSnapshot ?? []),
    ...mapDocuments(compliance.kind === 'none' ? [] : compliance.documentsReviewed),
    other_observations: compliance.kind === 'none' ? '' : text(compliance.otherObservations),
    remarks_recommendations: compliance.kind === 'none' ? '' : text(compliance.remarksRecommendations),
    ...mapSignatures(ctx),
    photo_rows: mapPhotos(bundle.photos),
  };

  for (const item of VERIFY_ITEMS) {
    const status = purpose?.verifyInfoRows?.find(r => r.itemKey === item)?.status ?? null;
    out[`purpose_cb_${item}_new`] = cb(status === 'new');
    out[`purpose_cb_${item}_renewal`] = cb(status === 'renewal');
  }
  for (const item of COMMITMENT_ITEMS) {
    out[`purpose_cb_${item}`] = cb(!!purpose?.commitmentRows?.find(r => r.itemKey === item)?.checked);
  }
  return out;
}
