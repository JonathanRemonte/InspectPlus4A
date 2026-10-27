import { mapSurvey } from './survey';
import { fullSurveyBundle, emptySurveyBundle, signatories } from '../../features/export/mappers/fixtures';
import { TICKED, UNTICKED } from '../../features/export/mappers/primitives';

const ctx = { signatories };

describe('mapSurvey', () => {
  const full = mapSurvey(fullSurveyBundle(), ctx);
  const empty = mapSurvey(emptySurveyBundle(), ctx);

  it('prints the header block', () => {
    expect(full.survey_report_control_no).toBe('SR-2026-01');
    expect(full.survey_inspection_date).toBe('07 September 2026');
    expect(full.survey_date).toBe('07 September 2026');
    expect(full.survey_project_name).toBe('Bucayao Bridge');
    expect(full.survey_geo).toBe('13.400000, 121.200000');
    expect(full.survey_area_size).toBe('2.5');
    expect(empty.survey_geo).toBe('');
    expect(empty.survey_area_size).toBe('');
  });

  it('ticks purpose, document type and status', () => {
    expect(full.cb_survey_purpose_ecc_amendment).toBe(TICKED);
    expect(full.cb_survey_purpose_ecc_application).toBe(UNTICKED);
    expect(full.cb_survey_doc_eprmp).toBe(TICKED);
    expect(full.cb_survey_doc_others).toBe(UNTICKED);
    expect(full.cb_survey_status_construction).toBe(TICKED);
    expect(full.cb_survey_status_preconstruction).toBe(UNTICKED);
    const odd = mapSurvey({ ...fullSurveyBundle(), survey: { ...fullSurveyBundle().survey, purpose: 'ECC Application', documentType: 'Programmatic EIS', projectStatus: 'Pre-construction' } }, ctx);
    expect(odd.cb_survey_purpose_ecc_application).toBe(TICKED);
    expect(odd.cb_survey_doc_others).toBe(TICKED);
    expect(odd.survey_doc_others).toBe('Programmatic EIS');
    expect(odd.cb_survey_status_preconstruction).toBe(TICKED);
    expect(odd.cb_survey_status_construction).toBe(UNTICKED);
    expect(empty.cb_survey_purpose_ecc_application).toBe(UNTICKED);
    expect(empty.cb_survey_doc_others).toBe(UNTICKED);
  });

  it('prints findings, remarks, signatures and photos', () => {
    expect(full.survey_other_findings).toBe('Erosion at abutment');
    expect(full.survey_remarks_recommendations).toBe('Install silt fence');
    expect(full.sig_inspector_name).toBe('Juan Dela Cruz');
    expect(full.photo_rows).toHaveLength(1);
    expect(empty.photo_rows).toEqual([]);
  });
});
