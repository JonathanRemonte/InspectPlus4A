import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { database, collections } from '../../../db/database';
import { FormSection, TextField, SelectField, DateField, DynamicRowTable, focusInput } from '../../../components/form';
import type { DynamicRow } from '../../../components/form';
import { PROVINCE_OPTIONS, getCityOptions, getBarangayOptions } from '../../../constants/provinces';
import { maskFlexibleDate, isValidFlexibleDate, FLEXIBLE_DATE_HINT, FLEXIBLE_DATE_INVALID_HINT } from '../../../utils/flexibleDate';
import { SectionEditActions } from './SectionEditActions';
import { useEditableSection } from '../hooks/useEditableSection';
import { SimpleTable } from './ComplianceReadPrimitives';
import { DenrPermitsSection } from './DenrPermitsSection';
import { CoordinateFields } from '../../location/components/CoordinateFields';
import { addressPatch } from '../../location/applyResolvedAddress';
import type { EstablishmentSnapshot, PermitSnapshotItem, ProductLineItem } from '../../../services/sync/syncTypes';
import type { EstablishmentDTO } from '../../establishments/types';

interface GeneralInformationViewProps {
  reportId: string;
  snapshot: EstablishmentSnapshot;
  permits: PermitSnapshotItem[];
  canEdit: boolean;
  onSaved: () => void;
  // The live establishments row this report points to (via estabId), kept
  // separate from `snapshot` on purpose — see liveRecordNote below.
  liveEstablishment: EstablishmentDTO | null;
  // True while useEstablishment's fetch is still in flight — distinguishes
  // "haven't resolved it yet" from "resolved to nothing" below, so the
  // unavailable banner doesn't flash on every screen load.
  liveEstablishmentLoading: boolean;
  // False for water reports, which show DENR Permits under their own
  // "3. Compliance Status" tab instead — see waterReportTabs.ts.
  showPermits?: boolean;
}

// The report's own establishmentSnapshot fields can drift from the live
// establishments row two ways: someone edits the master record later (from
// one of the establishment detail screen's own editable sections — see
// EstablishmentInfoSections), or someone edits this report's copy directly
// via patchEstablishmentSnapshot below. Neither write path touches the
// other, so nothing keeps them in sync — this just surfaces the drift
// rather than resolving or hiding it, per the report acting as a
// point-in-time record.
function valuesDiffer(a: string, b: string): boolean {
  if (a === b) return false;
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na !== nb;
  return true;
}

function liveRecordNote(current: string, live: string | undefined): string | undefined {
  if (live === undefined || live === '' || !valuesDiffer(current, live)) return undefined;
  return `Establishment record currently shows: "${live}"`;
}

const OPERATING_STATUS_OPTIONS = ['Operational', 'Temporarily Close', 'Non-Operational'];

async function patchEstablishmentSnapshot(reportId: string, patch: Partial<EstablishmentSnapshot>) {
  await database.write(async () => {
    const rec = await collections.inspectionReports.find(reportId);
    await rec.update(r => {
      r.establishmentSnapshot = { ...r.establishmentSnapshot, ...patch };
      r.updatedAt = new Date().toISOString();
      r.syncState = 'pending_update';
    });
  });
}

// ── Establishment Details ──────────────────────────────────────────────────

interface DetailsFields {
  name: string;
  formerName: string;
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  geoLat: string;
  geoLng: string;
  natureOfBusiness: string;
  psicCode: string;
  operatingStatus: string;
  operatingHoursDay: string;
  operatingDaysWeek: string;
  operatingDaysYear: string;
  operatingStatusSince: string;
}

function toDetailsFields(s: EstablishmentSnapshot): DetailsFields {
  return {
    name: s.name,
    formerName: s.former_name ?? '',
    addressLine: s.address_line,
    barangay: s.barangay,
    city: s.city,
    province: s.province,
    geoLat: s.geo_lat != null ? String(s.geo_lat) : '',
    geoLng: s.geo_lng != null ? String(s.geo_lng) : '',
    natureOfBusiness: s.nature_of_business,
    psicCode: s.psic_code ?? '',
    operatingStatus: s.operating_status,
    operatingHoursDay: s.operating_hours_day != null ? String(s.operating_hours_day) : '',
    operatingDaysWeek: s.operating_days_week != null ? String(s.operating_days_week) : '',
    operatingDaysYear: s.operating_days_year != null ? String(s.operating_days_year) : '',
    operatingStatusSince: s.operating_status_since ?? '',
  };
}

function toLiveDetailsFields(e: EstablishmentDTO): DetailsFields {
  return {
    name: e.name,
    formerName: e.formerName ?? '',
    addressLine: e.addressLine,
    barangay: e.barangay,
    city: e.city,
    province: e.province,
    geoLat: e.geoLat != null ? String(e.geoLat) : '',
    geoLng: e.geoLng != null ? String(e.geoLng) : '',
    natureOfBusiness: e.natureOfBusiness,
    psicCode: e.psicCode ?? '',
    operatingStatus: e.operatingStatus,
    operatingHoursDay: e.operatingHoursDay != null ? String(e.operatingHoursDay) : '',
    operatingDaysWeek: e.operatingDaysWeek != null ? String(e.operatingDaysWeek) : '',
    operatingDaysYear: e.operatingDaysYear != null ? String(e.operatingDaysYear) : '',
    operatingStatusSince: e.operatingStatusSince ?? '',
  };
}

function fromDetailsFields(f: DetailsFields): Partial<EstablishmentSnapshot> {
  return {
    name: f.name,
    former_name: f.formerName.trim() || null,
    address_line: f.addressLine,
    barangay: f.barangay,
    city: f.city,
    province: f.province,
    geo_lat: f.geoLat ? Number(f.geoLat) : null,
    geo_lng: f.geoLng ? Number(f.geoLng) : null,
    nature_of_business: f.natureOfBusiness,
    psic_code: f.psicCode || null,
    operating_status: f.operatingStatus,
    operating_hours_day: f.operatingHoursDay ? Number(f.operatingHoursDay) : null,
    operating_days_week: f.operatingDaysWeek ? Number(f.operatingDaysWeek) : null,
    operating_days_year: f.operatingDaysYear ? Number(f.operatingDaysYear) : null,
    operating_status_since: f.operatingStatusSince || null,
  };
}

// ── Key Personnel ────────────────────────────────────────────────────────

interface PersonnelFields {
  ownerName: string;
  managingHeadName: string;
  contactPersonName: string;
  contactPersonPosition: string;
  phoneFax: string;
  email: string;
}

function toPersonnelFields(s: EstablishmentSnapshot): PersonnelFields {
  return {
    ownerName: s.owner_name,
    managingHeadName: s.managing_head_name,
    contactPersonName: s.contact_person_name,
    contactPersonPosition: s.contact_person_position,
    phoneFax: s.phone_fax,
    email: s.email,
  };
}

function toLivePersonnelFields(e: EstablishmentDTO): PersonnelFields {
  return {
    ownerName: e.ownerName,
    managingHeadName: e.managingHeadName,
    contactPersonName: e.contactPersonName,
    contactPersonPosition: e.contactPersonPosition,
    phoneFax: e.phoneFax,
    email: e.email,
  };
}

function fromPersonnelFields(f: PersonnelFields): Partial<EstablishmentSnapshot> {
  return {
    owner_name: f.ownerName,
    managing_head_name: f.managingHeadName,
    contact_person_name: f.contactPersonName,
    contact_person_position: f.contactPersonPosition,
    phone_fax: f.phoneFax,
    email: f.email,
  };
}

// ── Pollution Control Officer ────────────────────────────────────────────

interface PcoFields {
  pcoName: string;
  pcoAccreditationNo: string;
  pcoEffectivity: string;
}

function toPcoFields(s: EstablishmentSnapshot): PcoFields {
  return {
    pcoName: s.pco_name ?? '',
    pcoAccreditationNo: s.pco_accreditation_no ?? '',
    pcoEffectivity: s.pco_effectivity ?? '',
  };
}

function toLivePcoFields(e: EstablishmentDTO): PcoFields {
  return {
    pcoName: e.pcoName ?? '',
    pcoAccreditationNo: e.pcoAccreditationNo ?? '',
    pcoEffectivity: e.pcoEffectivity ?? '',
  };
}

function fromPcoFields(f: PcoFields): Partial<EstablishmentSnapshot> {
  return {
    pco_name: f.pcoName || null,
    pco_accreditation_no: f.pcoAccreditationNo || null,
    pco_effectivity: f.pcoEffectivity || null,
  };
}

// ── Product Lines ─────────────────────────────────────────────────────────

function toProductLinesFields(s: EstablishmentSnapshot): DynamicRow[] {
  return s.product_lines.map(p => ({ ...p }));
}

function fromProductLinesFields(rows: DynamicRow[]): Partial<EstablishmentSnapshot> {
  return {
    product_lines: rows
      .filter(r => r.product_line?.trim())
      .map(r => ({
        product_line: r.product_line ?? '',
        ecc_production_rate: r.ecc_production_rate ?? '',
        actual_production_rate: r.actual_production_rate ?? '',
      })) as ProductLineItem[],
  };
}

// ── Section components ───────────────────────────────────────────────────
// Each section owns its own useEditableSection call and refs, and is wrapped
// in React.memo — so editing a field in one section (a setDraft call) only
// re-renders that section, not the other four plus every changeNote diff
// across the whole form on every keystroke. `snapshot`/`liveDetails` etc.
// must stay referentially stable across unrelated parent re-renders for the
// memo to actually pay off — see the useMemo calls in GeneralInformationView.

interface DetailsSectionProps {
  reportId: string;
  snapshot: EstablishmentSnapshot;
  liveDetails: DetailsFields | null;
  // The live establishment's id, for naming the map picker's offline pack.
  // A primitive, so it doesn't disturb the memo.
  estabId: string | null;
  canEdit: boolean;
  onSaved: () => void;
}

const DetailsSection = React.memo(function DetailsSection({
  reportId,
  snapshot,
  liveDetails,
  estabId,
  canEdit,
  onSaved,
}: DetailsSectionProps) {
  const formerNameRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const natureRef = useRef<TextInput>(null);
  const psicRef = useRef<TextInput>(null);
  const latRef = useRef<TextInput>(null);
  const lngRef = useRef<TextInput>(null);
  const hoursRef = useRef<TextInput>(null);
  const daysWeekRef = useRef<TextInput>(null);
  const daysYearRef = useRef<TextInput>(null);
  const sinceRef = useRef<TextInput>(null);

  const details = useEditableSection<DetailsFields>({
    value: toDetailsFields(snapshot),
    onSave: async fields => {
      await patchEstablishmentSnapshot(reportId, fromDetailsFields(fields));
      onSaved();
    },
  });

  const isNonOperational = details.draft.operatingStatus !== 'Operational';

  return (
    <FormSection
      icon="business-outline"
      title="Establishment Details"
      headerRight={
        <SectionEditActions
          editing={details.editing}
          saving={details.saving}
          onStartEdit={details.startEdit}
          onCancel={details.cancel}
          onSave={details.save}
          canEdit={canEdit}
        />
      }>
      <View style={styles.row}>
        <TextField label="Establishment Name" value={details.draft.name} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, name: v }))} textCase="upper" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(formerNameRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.name, liveDetails.name) : undefined} />
      </View>
      <View style={styles.row}>
        <TextField ref={formerNameRef} label="Former Establishment Name" value={details.draft.formerName} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, formerName: v }))} textCase="upper" placeholder="—" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(latRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.formerName, liveDetails.formerName) : undefined} />
      </View>
      <CoordinateFields
        lat={details.draft.geoLat}
        lng={details.draft.geoLng}
        onChange={({ lat, lng, address }) => details.setDraft(d => ({ ...d, geoLat: lat, geoLng: lng, ...addressPatch(address) }))}
        readOnly={!details.editing}
        packName={estabId ? `estab:${estabId}` : 'estab:pending'}
        latRef={latRef}
        lngRef={lngRef}
        onLngSubmitEditing={() => focusInput(addressRef.current)}
        latChangeNote={liveDetails ? liveRecordNote(details.draft.geoLat, liveDetails.geoLat) : undefined}
        lngChangeNote={liveDetails ? liveRecordNote(details.draft.geoLng, liveDetails.geoLng) : undefined}
      />
      <View style={styles.row}>
        <TextField ref={addressRef} label="Address" value={details.draft.addressLine} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, addressLine: v }))} placeholder="Street / building / lot no. (if known)" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(natureRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.addressLine, liveDetails.addressLine) : undefined} />
      </View>
      <View style={styles.row}>
        {details.editing ? (
          <SelectField
            label="Province"
            value={details.draft.province}
            options={PROVINCE_OPTIONS}
            onSelect={v => details.setDraft(d => ({ ...d, province: v, city: '', barangay: '' }))}
            required
          />
        ) : (
          <TextField label="Province" value={details.draft.province} readOnly changeNote={liveDetails ? liveRecordNote(details.draft.province, liveDetails.province) : undefined} />
        )}
        {details.editing ? (
          <SelectField
            label="City / Municipality"
            value={details.draft.city}
            options={getCityOptions(details.draft.province)}
            onSelect={v => details.setDraft(d => ({ ...d, city: v, barangay: '' }))}
            placeholder={details.draft.province ? 'Select…' : 'Select province first'}
            disabled={!details.draft.province}
            required
          />
        ) : (
          <TextField label="City / Municipality" value={details.draft.city} readOnly changeNote={liveDetails ? liveRecordNote(details.draft.city, liveDetails.city) : undefined} />
        )}
      </View>
      <View style={styles.row}>
        {details.editing ? (
          <SelectField
            label="Barangay"
            value={details.draft.barangay}
            options={getBarangayOptions(details.draft.province, details.draft.city)}
            onSelect={v => details.setDraft(d => ({ ...d, barangay: v }))}
            placeholder={details.draft.city ? 'Select…' : 'Select city/municipality first'}
            disabled={!details.draft.city}
            required
          />
        ) : (
          <TextField label="Barangay" value={details.draft.barangay} readOnly changeNote={liveDetails ? liveRecordNote(details.draft.barangay, liveDetails.barangay) : undefined} />
        )}
      </View>
      <View style={styles.row}>
        <TextField ref={natureRef} label="Nature of Business" value={details.draft.natureOfBusiness} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, natureOfBusiness: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(psicRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.natureOfBusiness, liveDetails.natureOfBusiness) : undefined} />
        <TextField ref={psicRef} label="PSIC Code" value={details.draft.psicCode} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, psicCode: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(isNonOperational ? sinceRef.current : hoursRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.psicCode, liveDetails.psicCode) : undefined} />
      </View>
      <View style={styles.row}>
        {details.editing ? (
          <SelectField
            label="Status of Operation"
            value={details.draft.operatingStatus}
            options={OPERATING_STATUS_OPTIONS}
            onSelect={v => details.setDraft(d => ({ ...d, operatingStatus: v }))}
          />
        ) : (
          <TextField label="Status of Operation" value={details.draft.operatingStatus} readOnly changeNote={liveDetails ? liveRecordNote(details.draft.operatingStatus, liveDetails.operatingStatus) : undefined} />
        )}
      </View>
      {isNonOperational ? (
        <View style={styles.row}>
          <TextField
            ref={sinceRef}
            label="Closed / Non-Operational Since"
            value={details.draft.operatingStatusSince}
            readOnly={!details.editing}
            onChangeText={raw => details.setDraft(d => ({ ...d, operatingStatusSince: maskFlexibleDate(raw) }))}
            textCase="none"
            placeholder="mm-dd-yyyy, mm-yyyy, or yyyy"
            hint={details.editing ? (isValidFlexibleDate(details.draft.operatingStatusSince) ? FLEXIBLE_DATE_HINT : FLEXIBLE_DATE_INVALID_HINT) : undefined}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            changeNote={liveDetails ? liveRecordNote(details.draft.operatingStatusSince, liveDetails.operatingStatusSince) : undefined}
          />
        </View>
      ) : (
        <View style={styles.row3}>
          <TextField ref={hoursRef} label="Operating Hours/Day" value={details.draft.operatingHoursDay} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, operatingHoursDay: v }))} keyboardType="numeric" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(daysWeekRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.operatingHoursDay, liveDetails.operatingHoursDay) : undefined} />
          <TextField ref={daysWeekRef} label="Operating Days/Week" value={details.draft.operatingDaysWeek} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, operatingDaysWeek: v }))} keyboardType="numeric" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(daysYearRef.current)} changeNote={liveDetails ? liveRecordNote(details.draft.operatingDaysWeek, liveDetails.operatingDaysWeek) : undefined} />
          <TextField ref={daysYearRef} label="Operating Days/Year" value={details.draft.operatingDaysYear} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, operatingDaysYear: v }))} keyboardType="numeric" returnKeyType="done" changeNote={liveDetails ? liveRecordNote(details.draft.operatingDaysYear, liveDetails.operatingDaysYear) : undefined} />
        </View>
      )}
      {details.error && <Text style={styles.errorText}>{details.error}</Text>}
    </FormSection>
  );
});

interface PersonnelSectionProps {
  reportId: string;
  snapshot: EstablishmentSnapshot;
  livePersonnel: PersonnelFields | null;
  canEdit: boolean;
  onSaved: () => void;
}

const PersonnelSection = React.memo(function PersonnelSection({
  reportId,
  snapshot,
  livePersonnel,
  canEdit,
  onSaved,
}: PersonnelSectionProps) {
  const ownerRef = useRef<TextInput>(null);
  const headRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const contactPositionRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const personnel = useEditableSection<PersonnelFields>({
    value: toPersonnelFields(snapshot),
    onSave: async fields => {
      await patchEstablishmentSnapshot(reportId, fromPersonnelFields(fields));
      onSaved();
    },
  });

  return (
    <FormSection
      icon="person-outline"
      title="Key Personnel"
      headerRight={
        <SectionEditActions
          editing={personnel.editing}
          saving={personnel.saving}
          onStartEdit={personnel.startEdit}
          onCancel={personnel.cancel}
          onSave={personnel.save}
          canEdit={canEdit}
        />
      }>
      <View style={styles.row}>
        <TextField ref={ownerRef} label="Owner" value={personnel.draft.ownerName} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, ownerName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(headRef.current)} changeNote={livePersonnel ? liveRecordNote(personnel.draft.ownerName, livePersonnel.ownerName) : undefined} />
        <TextField ref={headRef} label="Managing Head / Plant Manager" value={personnel.draft.managingHeadName} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, managingHeadName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(contactRef.current)} changeNote={livePersonnel ? liveRecordNote(personnel.draft.managingHeadName, livePersonnel.managingHeadName) : undefined} />
      </View>
      <View style={styles.row}>
        <TextField ref={contactRef} label="Contact Person" value={personnel.draft.contactPersonName} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, contactPersonName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(contactPositionRef.current)} changeNote={livePersonnel ? liveRecordNote(personnel.draft.contactPersonName, livePersonnel.contactPersonName) : undefined} />
        <TextField ref={contactPositionRef} label="Contact Person Position" value={personnel.draft.contactPersonPosition} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, contactPersonPosition: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(phoneRef.current)} changeNote={livePersonnel ? liveRecordNote(personnel.draft.contactPersonPosition, livePersonnel.contactPersonPosition) : undefined} />
      </View>
      <View style={styles.row}>
        <TextField ref={phoneRef} label="Phone / Fax" value={personnel.draft.phoneFax} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, phoneFax: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(emailRef.current)} changeNote={livePersonnel ? liveRecordNote(personnel.draft.phoneFax, livePersonnel.phoneFax) : undefined} />
        <TextField ref={emailRef} label="Email Address" value={personnel.draft.email} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, email: v }))} textCase="none" keyboardType="email-address" returnKeyType="done" changeNote={livePersonnel ? liveRecordNote(personnel.draft.email, livePersonnel.email) : undefined} />
      </View>
      {personnel.error && <Text style={styles.errorText}>{personnel.error}</Text>}
    </FormSection>
  );
});

interface PcoSectionProps {
  reportId: string;
  snapshot: EstablishmentSnapshot;
  livePco: PcoFields | null;
  canEdit: boolean;
  onSaved: () => void;
}

const PcoSection = React.memo(function PcoSection({ reportId, snapshot, livePco, canEdit, onSaved }: PcoSectionProps) {
  const pcoAccredRef = useRef<TextInput>(null);

  const pco = useEditableSection<PcoFields>({
    value: toPcoFields(snapshot),
    onSave: async fields => {
      await patchEstablishmentSnapshot(reportId, fromPcoFields(fields));
      onSaved();
    },
  });

  return (
    <FormSection
      icon="leaf-outline"
      title="Pollution Control Officer"
      headerRight={
        <SectionEditActions
          editing={pco.editing}
          saving={pco.saving}
          onStartEdit={pco.startEdit}
          onCancel={pco.cancel}
          onSave={pco.save}
          canEdit={canEdit}
        />
      }>
      <View style={styles.row}>
        <TextField label="PCO Full Name" value={pco.draft.pcoName} readOnly={!pco.editing} onChangeText={v => pco.setDraft(d => ({ ...d, pcoName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(pcoAccredRef.current)} changeNote={livePco ? liveRecordNote(pco.draft.pcoName, livePco.pcoName) : undefined} />
        <TextField ref={pcoAccredRef} label="PCO Accreditation No." value={pco.draft.pcoAccreditationNo} readOnly={!pco.editing} onChangeText={v => pco.setDraft(d => ({ ...d, pcoAccreditationNo: v }))} returnKeyType="done" changeNote={livePco ? liveRecordNote(pco.draft.pcoAccreditationNo, livePco.pcoAccreditationNo) : undefined} />
      </View>
      <View style={styles.row}>
        {pco.editing ? (
          <DateField
            label="PCO Accreditation Effectivity"
            value={pco.draft.pcoEffectivity}
            onChange={v => pco.setDraft(d => ({ ...d, pcoEffectivity: v }))}
          />
        ) : (
          <TextField label="PCO Accreditation Effectivity" value={pco.draft.pcoEffectivity || '—'} readOnly changeNote={livePco ? liveRecordNote(pco.draft.pcoEffectivity, livePco.pcoEffectivity) : undefined} />
        )}
      </View>
      {pco.error && <Text style={styles.errorText}>{pco.error}</Text>}
    </FormSection>
  );
});

interface ProductLinesSectionProps {
  reportId: string;
  snapshot: EstablishmentSnapshot;
  canEdit: boolean;
  onSaved: () => void;
}

const ProductLinesSection = React.memo(function ProductLinesSection({
  reportId,
  snapshot,
  canEdit,
  onSaved,
}: ProductLinesSectionProps) {
  const productLines = useEditableSection<DynamicRow[]>({
    value: toProductLinesFields(snapshot),
    onSave: async rows => {
      await patchEstablishmentSnapshot(reportId, fromProductLinesFields(rows));
      onSaved();
    },
  });

  return (
    <FormSection
      icon="cube-outline"
      title="Product Lines"
      headerRight={
        <SectionEditActions
          editing={productLines.editing}
          saving={productLines.saving}
          onStartEdit={productLines.startEdit}
          onCancel={productLines.cancel}
          onSave={productLines.save}
          canEdit={canEdit}
        />
      }>
      {productLines.editing ? (
        <DynamicRowTable
          columns={[
            { key: 'product_line', label: 'Product Line', width: 160, placeholder: 'e.g. Beer Production' },
            { key: 'ecc_production_rate', label: 'Declared Rate', width: 100, type: 'number', placeholder: '0' },
            { key: 'actual_production_rate', label: 'Actual Rate', width: 100, type: 'number', placeholder: '0' },
          ]}
          rows={productLines.draft}
          onChange={rows => productLines.setDraft(rows)}
          addLabel="Add Product Line"
        />
      ) : (
        <SimpleTable
          columns={[
            { key: 'product_line', label: 'Product Line' },
            { key: 'ecc_production_rate', label: 'Declared Rate' },
            { key: 'actual_production_rate', label: 'Actual Rate' },
          ]}
          rows={productLines.draft}
        />
      )}
      {productLines.error && <Text style={styles.errorText}>{productLines.error}</Text>}
    </FormSection>
  );
});

export const GeneralInformationView: React.FC<GeneralInformationViewProps> = ({
  reportId,
  snapshot,
  permits,
  canEdit,
  onSaved,
  liveEstablishment,
  liveEstablishmentLoading,
  showPermits = true,
}) => {
  // Memoized on `liveEstablishment` alone so these stay referentially stable
  // across re-renders that don't actually change the live record — otherwise
  // every section below would re-render on every GeneralInformationView
  // render regardless of the React.memo wrapping.
  const liveDetails = useMemo(() => (liveEstablishment ? toLiveDetailsFields(liveEstablishment) : null), [liveEstablishment]);
  const livePersonnel = useMemo(() => (liveEstablishment ? toLivePersonnelFields(liveEstablishment) : null), [liveEstablishment]);
  const livePco = useMemo(() => (liveEstablishment ? toLivePcoFields(liveEstablishment) : null), [liveEstablishment]);
  // Resolved (not loading) but nothing came back — the establishment was
  // archived, deleted, or fell outside jurisdiction visibility (see
  // useEstablishment). Distinct from "still loading": that case shows
  // nothing rather than falsely claiming the record is gone.
  const liveEstablishmentUnavailable = !liveEstablishmentLoading && !liveEstablishment;
  const [unavailableBannerDismissed, setUnavailableBannerDismissed] = useState(false);

  return (
    <View>
      {liveEstablishmentUnavailable && !unavailableBannerDismissed && (
        <View style={styles.unavailableBanner}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.warning.text} />
          <Text style={styles.unavailableBannerText}>
            Live establishment record unavailable — it may have been archived, deleted, or is outside your
            jurisdiction. Changes below can't be checked against it right now.
          </Text>
          <TouchableOpacity
            onPress={() => setUnavailableBannerDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}>
            <Ionicons name="close" size={15} color={Colors.warning.text} />
          </TouchableOpacity>
        </View>
      )}

      <DetailsSection reportId={reportId} snapshot={snapshot} liveDetails={liveDetails} estabId={liveEstablishment?.estabId ?? null} canEdit={canEdit} onSaved={onSaved} />
      <PersonnelSection reportId={reportId} snapshot={snapshot} livePersonnel={livePersonnel} canEdit={canEdit} onSaved={onSaved} />
      <PcoSection reportId={reportId} snapshot={snapshot} livePco={livePco} canEdit={canEdit} onSaved={onSaved} />
      <ProductLinesSection reportId={reportId} snapshot={snapshot} canEdit={canEdit} onSaved={onSaved} />
      {showPermits && (
        <DenrPermitsSection reportId={reportId} permits={permits} canEdit={canEdit} onSaved={onSaved} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.warning.bg,
    borderWidth: 1,
    borderColor: Colors.warning.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  unavailableBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: Colors.warning.text,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  row3: {
    flexDirection: 'row',
    gap: 14,
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.conflict,
    marginTop: -4,
    marginBottom: 8,
  },
});
