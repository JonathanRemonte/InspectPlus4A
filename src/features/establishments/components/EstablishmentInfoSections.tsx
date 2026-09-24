import React, { useRef } from 'react';
import { View, Text, Switch, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';
import { FormSection, TextField, SelectField, DateField, DynamicRowTable, focusInput } from '../../../components/form';
import type { DynamicRow } from '../../../components/form';
import { AppText } from '../../../components/AppText';
import { PROVINCE_OPTIONS, getCityOptions, getBarangayOptions } from '../../../constants/provinces';
import { maskFlexibleDate, isValidFlexibleDate, FLEXIBLE_DATE_HINT, FLEXIBLE_DATE_INVALID_HINT } from '../../../utils/flexibleDate';
import { useEditableSection } from '../../inspections/hooks/useEditableSection';
import { DenrPermitsSection } from '../../inspections/components/DenrPermitsSection';
import { CoordinateFields } from '../../location/components/CoordinateFields';
import { addressPatch } from '../../location/applyResolvedAddress';
import { SectionEditActions } from '../../inspections/components/SectionEditActions';
import { patchEstablishmentRecord } from '../../inspections/establishmentPersistence';
import type { EstablishmentContentField } from '../../inspections/establishmentPersistence';
import type { EstablishmentDTO, EstablishmentOperatingStatus } from '../types';

interface EstablishmentInfoSectionsProps {
  establishment: EstablishmentDTO;
  // False for an establishment the current inspector doesn't own — every
  // section's Edit control renders nothing instead, matching the report
  // detail screen's own canEdit gating (see SectionEditActions).
  canEdit: boolean;
  // Called after any section successfully saves, so the parent can refetch
  // and every section (including this one's siblings) picks up the new
  // live values.
  onSaved: () => void;
}

const OPERATING_STATUS_OPTIONS = ['Operational', 'Temporarily Close', 'Non-Operational'];

// ── Establishment Details ──────────────────────────────────────────────────
// Name, location and business-profile fields all live in one section
// (rather than splitting location out on its own) because handleSave used
// to validate name/barangay/city/province together and block the save if
// any was empty — keeping them in a single section keeps that validation
// local to one save. See docs/superpowers/specs/2026-09-05-establishment-
// editing-convergence-decision.md.

interface DetailsFields {
  name: string;
  includeFormerName: boolean;
  formerName: string;
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  geoLat: string;
  geoLng: string;
  natureOfBusiness: string;
  psicCode: string;
  product: string;
  yearEstablished: string;
  operatingStatus: EstablishmentOperatingStatus;
  operatingHoursDay: string;
  operatingDaysWeek: string;
  operatingDaysYear: string;
  operatingStatusSince: string;
}

function toDetailsFields(e: EstablishmentDTO): DetailsFields {
  return {
    name: e.name,
    includeFormerName: !!e.formerName,
    formerName: e.formerName ?? '',
    addressLine: e.addressLine,
    barangay: e.barangay,
    city: e.city,
    province: e.province,
    geoLat: e.geoLat != null ? String(e.geoLat) : '',
    geoLng: e.geoLng != null ? String(e.geoLng) : '',
    natureOfBusiness: e.natureOfBusiness,
    psicCode: e.psicCode ?? '',
    product: e.product ?? '',
    yearEstablished: e.yearEstablished != null ? String(e.yearEstablished) : '',
    operatingStatus: e.operatingStatus,
    operatingHoursDay: e.operatingHoursDay != null ? String(e.operatingHoursDay) : '',
    operatingDaysWeek: e.operatingDaysWeek != null ? String(e.operatingDaysWeek) : '',
    operatingDaysYear: e.operatingDaysYear != null ? String(e.operatingDaysYear) : '',
    operatingStatusSince: e.operatingStatusSince ?? '',
  };
}

function fromDetailsFields(f: DetailsFields): Partial<Record<EstablishmentContentField, unknown>> {
  return {
    name: f.name,
    formerName: f.includeFormerName ? f.formerName.trim() || null : null,
    addressLine: f.addressLine,
    barangay: f.barangay,
    city: f.city,
    province: f.province,
    geoLat: f.geoLat.trim() ? Number(f.geoLat) : null,
    geoLng: f.geoLng.trim() ? Number(f.geoLng) : null,
    natureOfBusiness: f.natureOfBusiness,
    psicCode: f.psicCode || null,
    product: f.product || null,
    yearEstablished: f.yearEstablished ? Number(f.yearEstablished) : null,
    operatingStatus: f.operatingStatus,
    operatingHoursDay: f.operatingHoursDay ? Number(f.operatingHoursDay) : null,
    operatingDaysWeek: f.operatingDaysWeek ? Number(f.operatingDaysWeek) : null,
    operatingDaysYear: f.operatingDaysYear ? Number(f.operatingDaysYear) : null,
    operatingStatusSince: f.operatingStatusSince || null,
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

function toPersonnelFields(e: EstablishmentDTO): PersonnelFields {
  return {
    ownerName: e.ownerName,
    managingHeadName: e.managingHeadName,
    contactPersonName: e.contactPersonName,
    contactPersonPosition: e.contactPersonPosition,
    phoneFax: e.phoneFax,
    email: e.email,
  };
}

function fromPersonnelFields(f: PersonnelFields): Partial<Record<EstablishmentContentField, unknown>> {
  return {
    ownerName: f.ownerName,
    managingHeadName: f.managingHeadName,
    contactPersonName: f.contactPersonName,
    contactPersonPosition: f.contactPersonPosition,
    phoneFax: f.phoneFax,
    email: f.email,
  };
}

// ── Pollution Control Officer ────────────────────────────────────────────

interface PcoFields {
  pcoName: string;
  pcoAccreditationNo: string;
  pcoEffectivity: string;
}

function toPcoFields(e: EstablishmentDTO): PcoFields {
  return {
    pcoName: e.pcoName ?? '',
    pcoAccreditationNo: e.pcoAccreditationNo ?? '',
    pcoEffectivity: e.pcoEffectivity ?? '',
  };
}

function fromPcoFields(f: PcoFields): Partial<Record<EstablishmentContentField, unknown>> {
  return {
    pcoName: f.pcoName || null,
    pcoAccreditationNo: f.pcoAccreditationNo || null,
    pcoEffectivity: f.pcoEffectivity || null,
  };
}

// ── Product Lines ─────────────────────────────────────────────────────────

function toProductLinesFields(e: EstablishmentDTO): DynamicRow[] {
  return e.productLines.length
    ? e.productLines.map(p => ({ ...p }))
    : [{ product_line: '', ecc_production_rate: '', actual_production_rate: '' }];
}

function fromProductLinesFields(rows: DynamicRow[]): Partial<Record<EstablishmentContentField, unknown>> {
  return {
    productLines: rows
      .filter(r => r.product_line?.trim())
      .map(r => ({
        product_line: r.product_line ?? '',
        ecc_production_rate: r.ecc_production_rate ?? '',
        actual_production_rate: r.actual_production_rate ?? '',
      })),
  };
}

// ── Section components ───────────────────────────────────────────────────
// Each section owns its own useEditableSection call and refs, and is
// wrapped in React.memo — matching GeneralInformationView's convention on
// the report side, so editing a field in one section only re-renders that
// section, not its siblings.

interface DetailsSectionProps {
  establishment: EstablishmentDTO;
  canEdit: boolean;
  onSaved: () => void;
}

const DetailsSection = React.memo(function DetailsSection({ establishment, canEdit, onSaved }: DetailsSectionProps) {
  const formerNameRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const natureRef = useRef<TextInput>(null);
  const psicRef = useRef<TextInput>(null);
  const latRef = useRef<TextInput>(null);
  const lngRef = useRef<TextInput>(null);
  const productRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const hoursRef = useRef<TextInput>(null);
  const daysWeekRef = useRef<TextInput>(null);
  const daysYearRef = useRef<TextInput>(null);
  const sinceRef = useRef<TextInput>(null);

  const details = useEditableSection<DetailsFields>({
    value: toDetailsFields(establishment),
    onSave: async fields => {
      if (!fields.name.trim() || !fields.barangay.trim() || !fields.city.trim() || !fields.province.trim()) {
        throw new Error('Establishment Name, Barangay, City, and Province are required.');
      }
      await patchEstablishmentRecord({ estabId: establishment.estabId, fields: fromDetailsFields(fields) });
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
        <TextField label="Establishment Name" value={details.draft.name} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, name: v }))} textCase="upper" required={details.editing} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(formerNameRef.current)} />
      </View>
      {details.editing && (
        <View style={styles.switchRow}>
          <Switch
            value={details.draft.includeFormerName}
            onValueChange={includeFormerName => details.setDraft(d => ({ ...d, includeFormerName }))}
            trackColor={{ false: Colors.border, true: Colors.greenLight }}
            thumbColor={Colors.white}
          />
          <Text style={styles.switchLabel}>Include former establishment name</Text>
        </View>
      )}
      {(details.editing ? details.draft.includeFormerName : !!details.draft.formerName) && (
        <View style={styles.row}>
          <TextField ref={formerNameRef} label="Former Establishment Name" value={details.draft.formerName} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, formerName: v }))} textCase="upper" placeholder="—" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(latRef.current)} />
        </View>
      )}
      <CoordinateFields
        lat={details.draft.geoLat}
        lng={details.draft.geoLng}
        onChange={({ lat, lng, address }) => details.setDraft(d => ({ ...d, geoLat: lat, geoLng: lng, ...addressPatch(address) }))}
        readOnly={!details.editing}
        packName={`estab:${establishment.estabId}`}
        latRef={latRef}
        lngRef={lngRef}
        onLngSubmitEditing={() => focusInput(addressRef.current)}
      />
      <View style={styles.row}>
        <TextField ref={addressRef} label="Address" value={details.draft.addressLine} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, addressLine: v }))} placeholder="Street / building / lot no. (if known)" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(natureRef.current)} />
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
          <TextField label="Province" value={details.draft.province || '—'} readOnly />
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
          <TextField label="City / Municipality" value={details.draft.city || '—'} readOnly />
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
          <TextField label="Barangay" value={details.draft.barangay || '—'} readOnly />
        )}
      </View>
      <View style={styles.row}>
        <TextField ref={natureRef} label="Nature of Business" value={details.draft.natureOfBusiness} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, natureOfBusiness: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(psicRef.current)} />
        <TextField ref={psicRef} label="PSIC Code" value={details.draft.psicCode} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, psicCode: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(productRef.current)} />
      </View>
      <View style={styles.row}>
        <TextField ref={productRef} label="Product" value={details.draft.product} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, product: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(yearRef.current)} />
        <TextField ref={yearRef} label="Year Established" value={details.draft.yearEstablished} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, yearEstablished: v }))} keyboardType="numeric" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(isNonOperational ? sinceRef.current : hoursRef.current)} />
      </View>
      <View style={styles.row}>
        {details.editing ? (
          <SelectField
            label="Status of Operation"
            value={details.draft.operatingStatus}
            options={OPERATING_STATUS_OPTIONS}
            onSelect={v => details.setDraft(d => ({ ...d, operatingStatus: v as EstablishmentOperatingStatus }))}
          />
        ) : (
          <TextField label="Status of Operation" value={details.draft.operatingStatus || '—'} readOnly />
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
          />
        </View>
      ) : (
        <View style={styles.row3}>
          <TextField ref={hoursRef} label="Operating Hours/Day" value={details.draft.operatingHoursDay} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, operatingHoursDay: v }))} keyboardType="numeric" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(daysWeekRef.current)} />
          <TextField ref={daysWeekRef} label="Operating Days/Week" value={details.draft.operatingDaysWeek} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, operatingDaysWeek: v }))} keyboardType="numeric" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(daysYearRef.current)} />
          <TextField ref={daysYearRef} label="Operating Days/Year" value={details.draft.operatingDaysYear} readOnly={!details.editing} onChangeText={v => details.setDraft(d => ({ ...d, operatingDaysYear: v }))} keyboardType="numeric" returnKeyType="done" />
        </View>
      )}
      {details.error && <Text style={styles.errorText}>{details.error}</Text>}
    </FormSection>
  );
});

interface PersonnelSectionProps {
  establishment: EstablishmentDTO;
  canEdit: boolean;
  onSaved: () => void;
}

const PersonnelSection = React.memo(function PersonnelSection({ establishment, canEdit, onSaved }: PersonnelSectionProps) {
  const headRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const contactPositionRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const personnel = useEditableSection<PersonnelFields>({
    value: toPersonnelFields(establishment),
    onSave: async fields => {
      await patchEstablishmentRecord({ estabId: establishment.estabId, fields: fromPersonnelFields(fields) });
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
        <TextField label="Owner" value={personnel.draft.ownerName} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, ownerName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(headRef.current)} />
        <TextField ref={headRef} label="Managing Head / Plant Manager" value={personnel.draft.managingHeadName} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, managingHeadName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(contactRef.current)} />
      </View>
      <View style={styles.row}>
        <TextField ref={contactRef} label="Contact Person" value={personnel.draft.contactPersonName} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, contactPersonName: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(contactPositionRef.current)} />
        <TextField ref={contactPositionRef} label="Contact Person Position" value={personnel.draft.contactPersonPosition} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, contactPersonPosition: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(phoneRef.current)} />
      </View>
      <View style={styles.row}>
        <TextField ref={phoneRef} label="Phone / Fax" value={personnel.draft.phoneFax} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, phoneFax: v }))} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => focusInput(emailRef.current)} />
        <TextField ref={emailRef} label="Email Address" value={personnel.draft.email} readOnly={!personnel.editing} onChangeText={v => personnel.setDraft(d => ({ ...d, email: v }))} textCase="none" keyboardType="email-address" returnKeyType="done" />
      </View>
      {personnel.error && <Text style={styles.errorText}>{personnel.error}</Text>}
    </FormSection>
  );
});

interface PcoSectionProps {
  establishment: EstablishmentDTO;
  canEdit: boolean;
  onSaved: () => void;
}

const PcoSection = React.memo(function PcoSection({ establishment, canEdit, onSaved }: PcoSectionProps) {
  const pco = useEditableSection<PcoFields>({
    value: toPcoFields(establishment),
    onSave: async fields => {
      await patchEstablishmentRecord({ estabId: establishment.estabId, fields: fromPcoFields(fields) });
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
        <TextField label="PCO Full Name" value={pco.draft.pcoName} readOnly={!pco.editing} onChangeText={v => pco.setDraft(d => ({ ...d, pcoName: v }))} returnKeyType="next" />
        <TextField label="PCO Accreditation No." value={pco.draft.pcoAccreditationNo} readOnly={!pco.editing} onChangeText={v => pco.setDraft(d => ({ ...d, pcoAccreditationNo: v }))} returnKeyType="next" />
      </View>
      <View style={styles.row}>
        {pco.editing ? (
          <DateField label="PCO Accreditation Effectivity" value={pco.draft.pcoEffectivity} onChange={v => pco.setDraft(d => ({ ...d, pcoEffectivity: v }))} />
        ) : (
          <TextField label="PCO Accreditation Effectivity" value={pco.draft.pcoEffectivity || '—'} readOnly />
        )}
      </View>
      {pco.error && <Text style={styles.errorText}>{pco.error}</Text>}
    </FormSection>
  );
});

interface ProductLinesSectionProps {
  establishment: EstablishmentDTO;
  canEdit: boolean;
  onSaved: () => void;
}

const ProductLinesSection = React.memo(function ProductLinesSection({ establishment, canEdit, onSaved }: ProductLinesSectionProps) {
  const productLines = useEditableSection<DynamicRow[]>({
    value: toProductLinesFields(establishment),
    onSave: async rows => {
      await patchEstablishmentRecord({ estabId: establishment.estabId, fields: fromProductLinesFields(rows) });
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
            { key: 'product_line', label: 'Product Line', width: 160, placeholder: 'e.g. Bottled Beer' },
            { key: 'ecc_production_rate', label: 'Declared Rate', width: 110, placeholder: '—' },
            { key: 'actual_production_rate', label: 'Actual Rate', width: 110, placeholder: '—' },
          ]}
          rows={productLines.draft}
          onChange={rows => productLines.setDraft(rows)}
          addLabel="Add Row"
        />
      ) : establishment.productLines.length === 0 ? (
        <Text style={styles.emptyText}>No product lines on record.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colProduct]}>Product Line</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Declared Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Actual Rate</Text>
          </View>
          {establishment.productLines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <AppText
                variant="marquee"
                text={line.product_line || '—'}
                style={styles.tableCell}
                containerStyle={styles.colProduct}
              />
              <Text style={[styles.tableCell, styles.colRate]}>{line.ecc_production_rate || '—'}</Text>
              <Text style={[styles.tableCell, styles.colRate]}>{line.actual_production_rate || '—'}</Text>
            </View>
          ))}
        </View>
      )}
      {productLines.error && <Text style={styles.errorText}>{productLines.error}</Text>}
    </FormSection>
  );
});

export const EstablishmentInfoSections: React.FC<EstablishmentInfoSectionsProps> = ({
  establishment,
  canEdit,
  onSaved,
}) => {
  return (
    <View>
      <DetailsSection establishment={establishment} canEdit={canEdit} onSaved={onSaved} />
      <PersonnelSection establishment={establishment} canEdit={canEdit} onSaved={onSaved} />
      <PcoSection establishment={establishment} canEdit={canEdit} onSaved={onSaved} />
      <ProductLinesSection establishment={establishment} canEdit={canEdit} onSaved={onSaved} />

      {/* The same section the report screens use, saving into the
          establishment's own permits rather than a report's snapshot.
          Reports already filed keep the permits they recorded; this list
          feeds reports created from here on. */}
      <DenrPermitsSection
        permits={establishment.denrPermits}
        canEdit={canEdit}
        onSave={next =>
          patchEstablishmentRecord({ estabId: establishment.estabId, fields: { denrPermits: next } })
        }
        onSaved={onSaved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  row3: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  switchLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.conflict,
    marginTop: Spacing.xs,
  },
  emptyText: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgMuted,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
  },
  // Was 10 — below the 11px legibility floor. Raised to Type.caption.
  tableHeaderCell: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableCell: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    color: Colors.textPrimary,
  },
  colProduct: {
    flex: 2,
  },
  colRate: {
    flex: 1,
  },
  permitList: {
    gap: Spacing.md,
  },
  permitCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  permitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    // Icon-to-text gap.
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  permitCardTitle: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    color: Colors.navy,
  },
  permitCardTitleContainer: {
    flexShrink: 1,
  },
  permitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  // Was 10.5 — below the 11px legibility floor. Raised to Type.caption.
  permitLabel: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  permitValue: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  permitValueContainer: {
    flexShrink: 1,
  },
});
