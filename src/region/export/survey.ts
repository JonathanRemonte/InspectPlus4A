import { formatReportDate } from '../../utils/formatReportDate';
import type { MapContext, SurveyBundle, TemplateData } from '../../features/export/types';
import { mapPhotos, mapSignatures } from '../../features/export/mappers/common';
import { cb, normalizeLabel, numberText, text } from '../../features/export/mappers/primitives';

// Site Inspection Report header block. The survey form doesn't exist in the
// app yet, so this reads only the survey_reports columns; the site
// validation tables stay as printed until that form is built.
const DOC_TYPES: [string, string[]][] = [
  ['iee', ['ieechecklist', 'iee']],
  ['eis', ['eis']],
  ['eprmp', ['eprmp']],
  ['peis', ['peis']],
  ['permp', ['permp']],
];

export function mapSurvey(bundle: SurveyBundle, ctx: MapContext): TemplateData {
  const s = bundle.survey;
  const date = formatReportDate(s.inspectionDate);
  const purpose = normalizeLabel(s.purpose);
  const doc = normalizeLabel(s.documentType);
  const docMatch = DOC_TYPES.find(([, aliases]) => aliases.includes(doc));
  const status = normalizeLabel(s.projectStatus);

  const out: TemplateData = {
    survey_report_control_no: text(s.reportControlNumber),
    survey_inspection_date: date,
    survey_date: date,
    survey_project_name: text(s.projectName),
    survey_reference_code: text(s.referenceCode),
    survey_proponent_name: text(s.proponentName),
    survey_contact_person: text(s.contactPerson),
    survey_contact_position: text(s.contactPosition),
    survey_contact_number: text(s.contactNumber),
    survey_email: text(s.email),
    survey_project_location: text(s.projectLocation),
    survey_geo: typeof s.geoLat === 'number' && typeof s.geoLng === 'number' ? `${s.geoLat.toFixed(6)}, ${s.geoLng.toFixed(6)}` : '',
    survey_area_size: numberText(s.areaSize),
    cb_survey_purpose_ecc_amendment: cb(purpose.includes('amendment')),
    cb_survey_purpose_ecc_application: cb(!purpose.includes('amendment') && purpose.includes('ecc')),
    cb_survey_doc_others: cb(!!doc && !docMatch),
    survey_doc_others: !!doc && !docMatch ? text(s.documentType) : '',
    cb_survey_status_baseline: cb(status.includes('baseline')),
    cb_survey_status_preconstruction: cb(status.includes('preconstruction')),
    cb_survey_status_construction: cb(status.includes('construction') && !status.includes('preconstruction')),
    cb_survey_status_operation: cb(status.includes('operation') || status.includes('completed')),
    cb_survey_status_suspended: cb(status.includes('suspended')),
    cb_survey_status_abandoned: cb(status.includes('abandoned')),
    survey_other_findings: text(s.otherFindings),
    survey_remarks_recommendations: text(s.remarksRecommendations),
    ...mapSignatures(ctx),
    photo_rows: mapPhotos(bundle.photos),
  };
  for (const [key] of DOC_TYPES) out[`cb_survey_doc_${key}`] = cb(docMatch?.[0] === key);
  return out;
}
