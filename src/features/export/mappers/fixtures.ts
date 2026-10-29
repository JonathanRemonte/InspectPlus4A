import type { InspectionBundle, SurveyBundle, Signatories, ExportPhoto } from '../types';
import type { WaterComplianceView } from '../../../region';

export const signatories: Signatories = {
  inspectorName: 'Juan Dela Cruz',
  inspectorPosition: 'Engineer II',
  supervisorName: 'Maria Santos',
  supervisorPosition: 'Chief, Water Quality Section',
  // Deliberately not any template's printed default (see
  // defaultApproversFor in features/export/templates/index.ts) — proves the
  // mapper prints whatever the inspector edited, not just what the form
  // used to say.
  recommendingName: 'Pedro Reyes',
  recommendingPosition: 'OIC, Regional Division',
  approverName: 'Ana Villanueva',
  approverPosition: 'Regional Director',
  additionalInspectors: [],
};

export const photos: ExportPhoto[] = [
  { attachmentId: 'a1', fileName: 'IMG_0001.jpg', caption: 'Main gate', capturedAt: '2026-09-01T02:00:00Z', geoLat: 13.4117, geoLng: 121.1803, localUri: 'file:///a1.jpg', storagePath: 'u1/a1.jpg', mimeType: 'image/jpeg' },
  { attachmentId: 'a2', fileName: 'IMG_0002.jpg', caption: null, capturedAt: '2026-09-01T02:05:00Z', geoLat: null, geoLng: null, localUri: null, storagePath: 'u1/a2.jpg', mimeType: 'image/jpeg' },
];

const snapshot = {
  estab_id: 'e1', name: 'Alpha Water Refilling', former_name: 'Alpha Aqua', address_line: '12 Rizal St.',
  barangay: 'San Vicente', city: 'Calapan City', province: 'Oriental Mindoro', geo_lat: 13.4117, geo_lng: 121.1803,
  nature_of_business: 'Water refilling', psic_code: '36000', operating_status: 'Operational',
  operating_hours_day: 8, operating_days_week: 6, operating_days_year: 300, operating_status_since: null,
  owner_name: 'A. Owner', managing_head_name: 'M. Head', pco_name: 'P. Officer', pco_accreditation_no: 'PCO-123',
  pco_effectivity: '2027-03-01', phone_fax: '043-123-4567', email: 'alpha@example.com',
  contact_person_name: 'C. Person', contact_person_position: 'Manager',
  product_lines: [
    { product_line: 'Purified water', ecc_production_rate: '1000 L', actual_production_rate: '800 L' },
    { product_line: 'Ice', ecc_production_rate: '200 kg', actual_production_rate: '150 kg' },
  ],
};

export function fullWaterCompliance(): WaterComplianceView {
  return {
    kind: 'water',
    complianceId: 'c1',
    waterSources: [
      { source_type: 'Groundwater', daily_m3: '12', annual_m3: '3600', specify: '' },
      { source_type: 'Others', daily_m3: '1', annual_m3: '300', specify: 'Rainwater' },
      { source_type: 'Groundwater', daily_m3: '3', annual_m3: '900', specify: 'Well 2' },
    ],
    wastewaterSources: [
      { use_type: 'Process', consumed_m3_day: '10', generated_m3_day: '8', outlet_info: 'Outlet 1' },
      { use_type: 'Storm drain', consumed_m3_day: '', generated_m3_day: '2', outlet_info: 'Creek' },
    ],
    abstractedWaterQuality: [
      { source: 'Ground Water', specify: 'Deep well', bod_cod: '5', tss: '10', avfp: '', heavy_metal: 'ND' },
    ],
    hasWwtp: true,
    nonWwtpTreatment: {},
    wwtpType: 'Others',
    wwtpTypeOther: 'Constructed wetland',
    wwtpDetails: [
      { outletNo: '1', wwtpDetail: 'SBR', dateOfInstallation: '2020-05-01', designCapacity: '50', annualMaintenanceCost: '100000', outletLocation: 'North', receivingBodyOfWater: 'Calapan River (Class C)', receivingBodyOfWaterOther: '', flowMeterDevice: 'Ultrasonic', flowRate: '40' },
      { outletNo: '2', wwtpDetail: 'Septic', dateOfInstallation: '', designCapacity: '', annualMaintenanceCost: '', outletLocation: '', receivingBodyOfWater: '', receivingBodyOfWaterOther: 'Unnamed creek', flowMeterDevice: '', flowRate: '' },
    ],
    wwtpComponents: [
      { outletNo: '1', wwtp: 'SBR', primaryTreatment: ['Screening', 'Others'], primaryTreatmentOther: 'Sand trap', biologicalTreatment: ['Sequencing Batch Reactor', 'Trickling Filter'], biologicalTreatmentOther: '', chemicalTreatment: ['Disinfection'], chemicalTreatmentOther: '', otherTreatment: 'UV' },
      { outletNo: '2', wwtp: 'Septic', primaryTreatment: 'Screening, Grit Removal', primaryTreatmentOther: '', biologicalTreatment: '', biologicalTreatmentOther: '', chemicalTreatment: 'Ozonation', chemicalTreatmentOther: '', otherTreatment: '' },
    ],
    wwtpCondition: 'Others',
    wwtpConditionOther: 'Under repair',
    wwtpUnderConstruction: true,
    wwtpConstructionReported: false,
    wwtpConstructionUnits: 'Clarifier',
    wwtpConstructionCompletionDate: '2026-12-01',
    wwtpTreatmentUnitsUtilized: 'Bypass to lagoon',
    samplingConducted: true,
    samplingClassification: 'Effluent',
    samplingPoints: [
      { pointNo: '1', samplingStation: 'Outfall 1', samplingTime: '10:30 AM', typeOfSample: 'Grab', remarks: '', parameters: [
        { parameterName: 'pH', value: '7.2', unit: '', denrStandard: '6.0-9.0', compliant: 'Y', remarks: '' },
        { parameterName: 'BOD', value: '60', unit: 'mg/L', denrStandard: '50', compliant: 'N', remarks: 'Exceeds' },
      ] },
    ],
    previousInspectionSummary: {
      hasRecords: 'yes', dateOfSampling: '2025-11-10', samplingStation: 'Outfall 1', samplingTime: '9:00 AM', typeOfSample: 'Grab',
      parameters: [{ parameterName: 'TSS', value: '20', unit: 'mg/L', denrStandard: '100', compliant: 'Y', remarks: '' }],
    },
    checklistDao200510: [
      { key: 'dao2005-10-r14-1-has-dp', legal_ref: 'DAO 2005-10 Rule 14.1', requirement: 'Does the establishment have a discharge permit?', compliant: 'Y', remarks: 'DP-2026-001' },
      { key: 'other-pending-litigation', legal_ref: 'Other Requirements', requirement: 'Are there any pending litigation/PAB cases?', compliant: 'NA', remarks: '' },
      { key: 'retired-section-1', compliant: 'N', remarks: 'ignored' },
    ],
    dpConditions: [
      { conditionNo: '1', description: 'Maintain flow meter', compliant: 'Y', remarks: '' },
      { conditionNo: '2', description: 'Quarterly SMR', compliant: 'N', remarks: 'Late' },
    ],
    otherObservations: 'Line 1\nLine 2',
    remarksRecommendations: 'Renew DP',
    documentsReviewed: ['Synology', 'SMR Online', 'Others', 'Field notebook'],
  };
}

export function fullWaterBundle(): InspectionBundle {
  return {
    kind: 'inspection',
    report: {
      reportId: 'r1', estabId: 'e1', inspectorUid: 'u1', purposeId: 'p1', reportType: 'water_monitoring',
      reportControlNo: 'WQ-2026-001', inspectionDate: '2026-09-05', reportStatus: 'submitted', syncState: 'synced', syncStatus: 'synced',
      establishmentSnapshot: snapshot,
      permitsSnapshot: [
        { envi_law: 'PD 1586', permit_type: 'ECC', permit_serial: 'ECC-1', issued_date: '2020-01-01', expiry_date: '2030-01-01' },
        { envi_law: 'PD 1586', permit_type: 'ECC Amendment', permit_serial: 'ECC-2', issued_date: '2022-01-01', expiry_date: '2030-01-01' },
        { envi_law: 'RA 6969', permit_type: 'Hazardous Waste ID', permit_serial: 'GR-4B-001', issued_date: '2021-02-02', expiry_date: '2026-02-02' },
        { envi_law: 'RA 9275', permit_type: 'Discharge Permit', permit_serial: 'DP-2026-001', issued_date: '2026-01-15', expiry_date: '2027-01-14' },
        { envi_law: 'RA 8749', permit_type: 'Permit to Operate', permit_serial: 'PO-77', issued_date: '2025-06-01', expiry_date: '2030-06-01' },
        { envi_law: 'LLDA', permit_type: 'Clearance', permit_serial: 'LL-1', issued_date: '2024-01-01', expiry_date: '2025-01-01' },
      ],
      createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-06T00:00:00Z',
    },
    purpose: {
      inspectionDate: '2026-09-05',
      verifyInfo: true,
      verifyInfoRows: [
        { itemKey: 'pmpin', label: 'PMPIN Application', status: 'new', remarks: '' },
        { itemKey: 'hazwaste_id', label: 'Hazardous Waste ID Registration', status: null, remarks: '' },
        { itemKey: 'hazwaste_transporter', label: 'Hazardous Waste Transporter Registration', status: null, remarks: '' },
        { itemKey: 'hazwaste_tsd', label: 'Hazardous Waste TSD Registration', status: null, remarks: '' },
        { itemKey: 'pto_air', label: 'Permit to Operate Air Pollution', status: 'renewal', remarks: '' },
        { itemKey: 'discharge_permit', label: 'Discharge Permit', status: 'renewal', remarks: '' },
      ],
      determineCompliance: true,
      investigateComplaints: false,
      checkCommitments: true,
      commitmentRows: [
        { itemKey: 'industrial_ecowatch', label: 'Industrial EcoWatch', checked: false, remarks: '' },
        { itemKey: 'pepp', label: 'PEPP', checked: true, remarks: '' },
        { itemKey: 'pab', label: 'PAB', checked: false, remarks: '' },
        { itemKey: 'others', label: 'Others', checked: true, remarks: 'Green Choice' },
      ],
      others: 'Follow-up on complaint #12',
    },
    compliance: fullWaterCompliance(),
    photos,
  };
}

export function emptyWaterBundle(): InspectionBundle {
  return {
    kind: 'inspection',
    report: {
      reportId: 'r2', estabId: 'e2', inspectorUid: 'u1', purposeId: 'p2', reportType: 'water_monitoring',
      reportControlNo: null, inspectionDate: '', reportStatus: 'draft', syncState: 'created', syncStatus: 'pending',
      establishmentSnapshot: { ...snapshot, name: 'Beta', former_name: null, geo_lat: null, geo_lng: null, product_lines: [], operating_status: 'Temporarily Close', operating_status_since: '2024', pco_effectivity: null, contact_person_position: '' },
      permitsSnapshot: [],
      createdAt: '', updatedAt: '',
    },
    purpose: null,
    compliance: { kind: 'none' },
    photos: [],
  };
}

// Shapes an older build or a hand-edited row could hold: a JSON column that
// isn't an array, rows missing fields, unknown YnValues, treatment arrays
// stored as strings, hasRecords never asked.
export function malformedWaterBundle(): InspectionBundle {
  const full = fullWaterBundle();
  const c = fullWaterCompliance();
  return {
    ...full,
    compliance: {
      ...c,
      waterSources: 'not an array' as unknown as Record<string, unknown>[],
      wastewaterSources: [{}, { use_type: 'Cooling' }],
      abstractedWaterQuality: [null as unknown as Record<string, unknown>, { source: 'River' }],
      wwtpDetails: [{ outletNo: 7 } as unknown as WaterComplianceView['wwtpDetails'][number]],
      wwtpComponents: [{ outletNo: '1', primaryTreatment: 42 }],
      samplingPoints: [{ pointNo: '1', parameters: 'x' } as unknown as WaterComplianceView['samplingPoints'][number]],
      previousInspectionSummary: { hasRecords: null, dateOfSampling: '', samplingStation: '', samplingTime: '', typeOfSample: '', parameters: [] },
      checklistDao200510: [{ key: 'dao2005-10-r14-1-has-dp', compliant: 'maybe' as unknown as 'Y', remarks: 5 as unknown as string }],
      dpConditions: [{ conditionNo: '1', description: 'x', compliant: 'Y', remarks: 'ok' }, {} as WaterComplianceView['dpConditions'][number]],
      documentsReviewed: 'Synology' as unknown as string[],
      otherObservations: null,
      remarksRecommendations: null,
    },
  };
}

export function fullSurveyBundle(): SurveyBundle {
  return {
    kind: 'survey',
    survey: {
      surveyId: 's1', reportControlNumber: 'SR-2026-01', inspectionDate: '2026-09-07', projectName: 'Bucayao Bridge',
      referenceCode: 'REF-9', proponentName: 'DPWH', contactPerson: 'E. Ngineer', contactPosition: 'PM', contactNumber: '0917',
      email: 'pm@example.com', projectLocation: 'Bucayao, Calapan City', geoLat: 13.4, geoLng: 121.2, areaSize: 2.5,
      purpose: 'ECC Amendment', documentType: 'EPRMP', projectStatus: 'Construction', otherFindings: 'Erosion at abutment',
      remarksRecommendations: 'Install silt fence', reportStatus: 'submitted',
    },
    photos,
  };
}

export function emptySurveyBundle(): SurveyBundle {
  return {
    kind: 'survey',
    survey: {
      surveyId: 's2', reportControlNumber: null, inspectionDate: '', projectName: '', referenceCode: null, proponentName: '',
      contactPerson: null, contactPosition: null, contactNumber: null, email: null, projectLocation: '', geoLat: null, geoLng: null,
      areaSize: null, purpose: '', documentType: null, projectStatus: null, otherFindings: null, remarksRecommendations: null, reportStatus: 'draft',
    },
    photos: [],
  };
}
