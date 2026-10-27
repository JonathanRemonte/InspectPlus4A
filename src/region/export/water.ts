import type { YnValue } from '../../components/form';
import { formatReportDate } from '../../utils/formatReportDate';
import type { WaterComplianceView } from '..';
import { WATER_FINDINGS_CHECKLIST, WWTP_TYPE_OTHERS, WWTP_CONDITION_OTHERS } from '../inspections/water/waterChecklistData';
import { decodeWwtpComponent, describeNonWwtpTreatment, findingsValuesFromEntries } from '../inspections/water/waterTypes';
import { ROW_MINIMUMS } from '../../features/export/rowMinimums';
import type { InspectionBundle, MapContext, TemplateData } from '../../features/export/types';
import { mapCommon } from '../../features/export/mappers/common';
import { asArray, cb, joinNonEmpty, normalizeLabel, padRows, text } from '../../features/export/mappers/primitives';

// Water Quality Management form, sections 4–6 and III. Everything here reads
// the compliance_water row through WaterComplianceView; the shared sections
// come from mapCommon.

const WATER_SOURCE_ROWS: [string, string[]][] = [
  ['surface', ['surfacewater']],
  ['groundwater', ['groundwater']],
  ['utilities', ['waterutilities', 'utilities']],
  ['desalination', ['desalination']],
  ['recycled', ['recycled']],
];
const WASTEWATER_ROWS: [string, string[]][] = [
  ['process', ['process', 'processwater']],
  ['domestic', ['domestic', 'domesticwastewater']],
  ['cooling', ['cooling', 'coolingwater']],
  ['maintenance', ['maintenance']],
  ['storm_drain', ['stormdrain', 'storm']],
];

// Groups rows by printed label, joining repeats with "; " so a second
// groundwater source still appears rather than silently overwriting.
function fixedRows(
  prefix: string,
  rows: Record<string, unknown>[],
  labelKey: string,
  rowDefs: [string, string[]][],
  columns: [string, (row: Record<string, unknown>) => string][],
): TemplateData {
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const label = normalizeLabel(row[labelKey]);
    const def = rowDefs.find(([, aliases]) => aliases.includes(label));
    const key = def ? def[0] : 'others';
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  const out: TemplateData = {};
  for (const key of [...rowDefs.map(([k]) => k), 'others']) {
    const bucket = buckets.get(key) ?? [];
    for (const [col, read] of columns) {
      out[`${prefix}_${key}_${col}`] = joinNonEmpty(bucket.map(read), '; ');
    }
  }
  return out;
}

function ynBoxes(prefix: string, value: unknown): TemplateData {
  const v = value as YnValue;
  return { [`${prefix}_y`]: cb(v === 'Y'), [`${prefix}_n`]: cb(v === 'N'), [`${prefix}_na`]: cb(v === 'NA') };
}

function parameterRows(raw: unknown, min: number): TemplateData[] {
  return padRows(
    asArray(raw).map(p => ({
      parameter_name: text(p.parameterName),
      value: text(p.value),
      unit: text(p.unit),
      denr_standard: text(p.denrStandard),
      cb_compliant_y: cb(p.compliant === 'Y'),
      cb_compliant_n: cb(p.compliant === 'N'),
      remarks: text(p.remarks),
    })),
    min,
    () => ({ parameter_name: '', value: '', unit: '', denr_standard: '', cb_compliant_y: cb(false), cb_compliant_n: cb(false), remarks: '' }),
  );
}

const has = (list: string[], option: string) => list.some(x => normalizeLabel(x) === normalizeLabel(option));

function componentRow(stored: Record<string, unknown>): TemplateData {
  const c = decodeWwtpComponent(stored);
  return {
    outlet_no: c.outletNo,
    wwtp: c.wwtp,
    cb_primary_screening: cb(has(c.primaryTreatment, 'Screening')),
    cb_primary_grit_removal: cb(has(c.primaryTreatment, 'Grit Removal')),
    cb_primary_oil_water_separator: cb(has(c.primaryTreatment, 'Oil/Water Separator')),
    cb_primary_equalization_tank: cb(has(c.primaryTreatment, 'Equalization Tank')),
    cb_primary_others: cb(has(c.primaryTreatment, 'Others')),
    primary_others: c.primaryTreatmentOther,
    cb_bio_activated_sludge: cb(has(c.biologicalTreatment, 'Activated Sludge')),
    cb_bio_anaerobic_digestion: cb(has(c.biologicalTreatment, 'Anaerobic Digestion')),
    cb_bio_abr: cb(has(c.biologicalTreatment, 'Anaerobic Baffled Reactor (ABR)')),
    cb_bio_reed_bed: cb(has(c.biologicalTreatment, 'Reed Bed System')),
    cb_bio_trickling_filter: cb(has(c.biologicalTreatment, 'Trickling Filter')),
    cb_bio_oxidation_batch: cb(has(c.biologicalTreatment, 'Oxidation/Stabilization Batch')),
    cb_bio_sbr: cb(has(c.biologicalTreatment, 'Sequencing Batch Reactor')),
    cb_bio_others: cb(has(c.biologicalTreatment, 'Others')),
    bio_others: c.biologicalTreatmentOther,
    cb_chem_ph_adjustment: cb(has(c.chemicalTreatment, 'pH Adjustment')),
    cb_chem_disinfection: cb(has(c.chemicalTreatment, 'Disinfection')),
    cb_chem_redox: cb(has(c.chemicalTreatment, 'Redox')),
    cb_chem_flocculation: cb(has(c.chemicalTreatment, 'Flocculation/Coagulation')),
    cb_chem_others: cb(has(c.chemicalTreatment, 'Others')),
    chem_others: c.chemicalTreatmentOther,
    other_treatment: c.otherTreatment,
  };
}

const blankComponentRow = (): TemplateData => componentRow({});

function wwtpTypeBlock(c: WaterComplianceView): TemplateData {
  const type = text(c.wwtpType);
  const listed = ['Physical', 'Biological', 'Chemical'];
  const isListed = listed.some(l => normalizeLabel(l) === normalizeLabel(type));
  const isOthers = !!type && !isListed; // 'Others' and 'Combined' both print on the Others line
  let othersText = '';
  if (c.hasWwtp === false) {
    const nw = c.nonWwtpTreatment ?? {};
    const systems = Array.isArray(nw.systems) ? nw.systems.map(text) : [];
    othersText = describeNonWwtpTreatment(systems, text(nw.other));
    if (othersText === '—') othersText = '';
  } else if (isOthers) {
    othersText = normalizeLabel(type) === normalizeLabel(WWTP_TYPE_OTHERS) ? text(c.wwtpTypeOther) : type;
  }
  return {
    cb_wwtp_type_physical: cb(normalizeLabel(type) === 'physical'),
    cb_wwtp_type_biological: cb(normalizeLabel(type) === 'biological'),
    cb_wwtp_type_chemical: cb(normalizeLabel(type) === 'chemical'),
    cb_wwtp_type_others: cb(c.hasWwtp !== false && isOthers),
    wwtp_type_others: othersText,
  };
}

function conditionBlock(c: WaterComplianceView): TemplateData {
  const cond = normalizeLabel(c.wwtpCondition);
  const isOthers = !!cond && !['properlymaintained', 'inadequatelymaintained', 'poormaintenance'].includes(cond);
  return {
    cb_wwtp_condition_properly: cb(cond === 'properlymaintained'),
    cb_wwtp_condition_inadequately: cb(cond === 'inadequatelymaintained'),
    cb_wwtp_condition_poor: cb(cond === 'poormaintenance'),
    cb_wwtp_condition_others: cb(isOthers),
    wwtp_condition_others: isOthers ? (cond === normalizeLabel(WWTP_CONDITION_OTHERS) ? text(c.wwtpConditionOther) : text(c.wwtpCondition)) : '',
    cb_under_construction_yes: cb(c.wwtpUnderConstruction === true),
    cb_under_construction_no: cb(c.wwtpUnderConstruction === false),
    cb_construction_reported_yes: cb(c.wwtpConstructionReported === true),
    cb_construction_reported_no: cb(c.wwtpConstructionReported === false),
    wwtp_construction_units: text(c.wwtpConstructionUnits),
    wwtp_construction_completion_date: formatReportDate(c.wwtpConstructionCompletionDate) || text(c.wwtpConstructionCompletionDate),
    wwtp_treatment_units_utilized: text(c.wwtpTreatmentUnitsUtilized),
  };
}

const EMPTY_WATER: WaterComplianceView = {
  kind: 'water', complianceId: '', waterSources: [], wastewaterSources: [], abstractedWaterQuality: [], hasWwtp: null,
  nonWwtpTreatment: {}, wwtpType: null, wwtpTypeOther: null, wwtpDetails: [], wwtpComponents: [], wwtpCondition: null,
  wwtpConditionOther: null, wwtpUnderConstruction: null, wwtpConstructionReported: null, wwtpConstructionUnits: null,
  wwtpConstructionCompletionDate: null, wwtpTreatmentUnitsUtilized: null, samplingConducted: null, samplingClassification: null,
  samplingPoints: [], previousInspectionSummary: { hasRecords: null, dateOfSampling: '', samplingStation: '', samplingTime: '', typeOfSample: '', parameters: [] },
  checklistDao200510: [], dpConditions: [], otherObservations: null, remarksRecommendations: null, documentsReviewed: [],
};

export function mapWater(bundle: InspectionBundle, ctx: MapContext): TemplateData {
  const c = bundle.compliance.kind === 'water' ? bundle.compliance : EMPTY_WATER;

  const findings = findingsValuesFromEntries(asArray(c.checklistDao200510));
  const sf: TemplateData = {};
  WATER_FINDINGS_CHECKLIST.forEach((def, i) => {
    const slug = def.key.replace(/-/g, '_');
    Object.assign(sf, ynBoxes(`sf_${slug}`, findings[i]?.compliant));
    sf[`sf_${slug}_remarks`] = text(findings[i]?.remarks);
  });

  const prev = c.previousInspectionSummary ?? EMPTY_WATER.previousInspectionSummary;
  const showPrev = prev.hasRecords === 'yes' || (prev.hasRecords == null && !!text(prev.dateOfSampling));

  const samplingPoints = c.samplingConducted === false ? [] : asArray(c.samplingPoints);

  return {
    ...mapCommon(bundle, ctx),

    ...fixedRows('ws', asArray(c.waterSources), 'source_type', WATER_SOURCE_ROWS, [
      ['daily', r => text(r.daily_m3)],
      ['annual', r => text(r.annual_m3)],
      ['specify', r => text(r.specify)],
    ]),
    ...fixedRows('ww', asArray(c.wastewaterSources), 'use_type', WASTEWATER_ROWS, [
      ['consumed', r => text(r.consumed_m3_day)],
      ['generated', r => text(r.generated_m3_day)],
      ['specify', r => joinNonEmpty([r.outlet_info, r.specify], ' / ')],
    ]),
    abstracted_rows: padRows(
      asArray(c.abstractedWaterQuality).map(r => ({ source: text(r.source), specify: text(r.specify), bod_cod: text(r.bod_cod), tss: text(r.tss), avfp: text(r.avfp), heavy_metal: text(r.heavy_metal) })),
      ROW_MINIMUMS.abstractedWaterQuality,
      () => ({ source: '', specify: '', bod_cod: '', tss: '', avfp: '', heavy_metal: '' }),
    ),

    cb_has_wwtp_yes: cb(c.hasWwtp === true),
    cb_has_wwtp_no: cb(c.hasWwtp === false),
    ...wwtpTypeBlock(c),

    wwtp_outlets: padRows(
      asArray(c.wwtpDetails).map(d => ({
        outlet_no: text(d.outletNo),
        wwtp_detail: text(d.wwtpDetail),
        date_of_installation: formatReportDate(text(d.dateOfInstallation)) || text(d.dateOfInstallation),
        design_capacity: text(d.designCapacity),
        annual_maintenance_cost: text(d.annualMaintenanceCost),
        outlet_location: text(d.outletLocation),
        receiving_body: text(d.receivingBodyOfWaterOther).trim() || text(d.receivingBodyOfWater),
        flow_meter_device: text(d.flowMeterDevice),
        flow_rate: text(d.flowRate),
      })),
      ROW_MINIMUMS.wwtpOutlets,
      () => ({ outlet_no: '', wwtp_detail: '', date_of_installation: '', design_capacity: '', annual_maintenance_cost: '', outlet_location: '', receiving_body: '', flow_meter_device: '', flow_rate: '' }),
    ),
    wwtp_components: padRows(asArray(c.wwtpComponents).map(componentRow), ROW_MINIMUMS.wwtpComponents, blankComponentRow),
    ...conditionBlock(c),

    sampling_points: padRows(
      samplingPoints.map(p => ({
        point_no: text(p.pointNo),
        sampling_station: text(p.samplingStation),
        sampling_time: text(p.samplingTime),
        type_of_sample: text(p.typeOfSample),
        parameters: parameterRows(p.parameters, ROW_MINIMUMS.samplingParameters),
      })),
      ROW_MINIMUMS.samplingPoints,
      () => ({ point_no: '', sampling_station: '', sampling_time: '', type_of_sample: '', parameters: parameterRows([], ROW_MINIMUMS.samplingParameters) }),
    ),
    prev_date_of_sampling: showPrev ? formatReportDate(prev.dateOfSampling) || text(prev.dateOfSampling) : '',
    prev_sampling_station: showPrev ? text(prev.samplingStation) : '',
    prev_sampling_time: showPrev ? text(prev.samplingTime) : '',
    prev_type_of_sample: showPrev ? text(prev.typeOfSample) : '',
    prev_parameters: parameterRows(showPrev ? prev.parameters : [], ROW_MINIMUMS.previousParameters),

    ...sf,

    dp_conditions: padRows(
      asArray(c.dpConditions).map(d => ({ condition_no: text(d.conditionNo), description: text(d.description), ...ynBoxes('cb', d.compliant), remarks: text(d.remarks) })),
      ROW_MINIMUMS.dpConditions,
      () => ({ condition_no: '', description: '', ...ynBoxes('cb', null), remarks: '' }),
    ),
  };
}
