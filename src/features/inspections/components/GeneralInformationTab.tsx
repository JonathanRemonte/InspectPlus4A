import React, { useRef } from 'react';
import { View, Text, Switch, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import {
  FormSection,
  TextField,
  SelectField,
  DateField,
  DynamicRowTable,
  focusInput,
} from '../../../components/form';
import { PROVINCE_OPTIONS, getCityOptions, getBarangayOptions } from '../../../constants/provinces';
import { maskFlexibleDate, isValidFlexibleDate, FLEXIBLE_DATE_HINT, FLEXIBLE_DATE_INVALID_HINT } from '../../../utils/flexibleDate';
import { CoordinateFields } from '../../location/components/CoordinateFields';
import { addressPatch } from '../../location/applyResolvedAddress';
import type { GeneralInfoFormState } from '../types';

const OPERATING_STATUS_OPTIONS = ['Operational', 'Temporarily Close', 'Non-Operational'];

interface GeneralInformationTabProps {
  value: GeneralInfoFormState;
  onChange: (value: GeneralInfoFormState) => void;
  // Names the offline tile pack the map picker caches — the establishment
  // this report is for, or null while it's still being created.
  estabId: string | null;
}

export const GeneralInformationTab: React.FC<GeneralInformationTabProps> = ({
  value,
  onChange,
  estabId,
}) => {
  // Establishment Details → Key Personnel → PCO, in visual order. The
  // Establishment Name field is read-only (pre-filled) so it's skipped —
  // it can't take focus. SelectField (Status of Operation) opens a picker
  // rather than accepting typed input, so it's skipped too; the field
  // before it hands off straight to the field after.
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
  const ownerRef = useRef<TextInput>(null);
  const headRef = useRef<TextInput>(null);
  const contactNameRef = useRef<TextInput>(null);
  const contactPositionRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const pcoNameRef = useRef<TextInput>(null);
  const pcoAccredRef = useRef<TextInput>(null);

  const isNonOperational = value.operatingStatus !== 'Operational';

  return (
    <View>
      <FormSection icon="business-outline" title="Establishment Details">
        <View style={styles.row}>
          <TextField
            label="Establishment Name"
            value={value.name}
            onChangeText={name => onChange({ ...value, name })}
            textCase="upper"
            required
            readOnly
            hint="Pre-filled from the establishment master record"
          />
        </View>
        <View style={styles.switchRow}>
          <Switch
            value={value.includeFormerName}
            onValueChange={includeFormerName => onChange({ ...value, includeFormerName })}
            trackColor={{ false: Colors.border, true: Colors.greenLight }}
            thumbColor={Colors.white}
          />
          <Text style={styles.switchLabel}>Include former establishment name</Text>
        </View>
        {value.includeFormerName && (
          <View style={styles.row}>
            <TextField
              ref={formerNameRef}
              label="Former Establishment Name"
              value={value.formerName}
              onChangeText={formerName => onChange({ ...value, formerName })}
              textCase="upper"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(latRef.current)}

            />
          </View>
        )}
        <CoordinateFields
          lat={value.geoLat}
          lng={value.geoLng}
          onChange={({ lat, lng, address }) => onChange({ ...value, geoLat: lat, geoLng: lng, ...addressPatch(address) })}
          packName={estabId ? `estab:${estabId}` : 'estab:pending'}
          latRef={latRef}
          lngRef={lngRef}
          onLngSubmitEditing={() => focusInput(addressRef.current)}
        />
        <View style={styles.row}>
          <TextField
            ref={addressRef}
            label="Address"
            value={value.addressLine}
            onChangeText={addressLine => onChange({ ...value, addressLine })}
            placeholder="Street / building / lot no. (if known)"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(natureRef.current)}

          />
        </View>
        <View style={styles.row}>
          <SelectField
            label="Province"
            value={value.province}
            options={PROVINCE_OPTIONS}
            onSelect={province => onChange({ ...value, province, city: '', barangay: '' })}
            required
          />
          <SelectField
            label="City / Municipality"
            value={value.city}
            options={getCityOptions(value.province)}
            onSelect={city => onChange({ ...value, city, barangay: '' })}
            placeholder={value.province ? 'Select…' : 'Select province first'}
            disabled={!value.province}
            required
          />
        </View>
        <View style={styles.row}>
          <SelectField
            label="Barangay"
            value={value.barangay}
            options={getBarangayOptions(value.province, value.city)}
            onSelect={barangay => onChange({ ...value, barangay })}
            placeholder={value.city ? 'Select…' : 'Select city/municipality first'}
            disabled={!value.city}
            required
          />
        </View>
        <View style={styles.row}>
          <TextField
            ref={natureRef}
            label="Nature of Business"
            value={value.natureOfBusiness}
            onChangeText={natureOfBusiness => onChange({ ...value, natureOfBusiness })}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(psicRef.current)}

          />
          <TextField
            ref={psicRef}
            label="PSIC Code"
            value={value.psicCode}
            onChangeText={psicCode => onChange({ ...value, psicCode })}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(isNonOperational ? sinceRef.current : hoursRef.current)}

          />
        </View>
        <View style={styles.row}>
          <SelectField
            label="Status of Operation"
            value={value.operatingStatus}
            options={OPERATING_STATUS_OPTIONS}
            onSelect={operatingStatus => onChange({ ...value, operatingStatus })}
            required
          />
        </View>
        {isNonOperational ? (
          <View style={styles.row}>
            <TextField
              ref={sinceRef}
              label="Closed / Non-Operational Since"
              value={value.operatingStatusSince}
              onChangeText={raw => onChange({ ...value, operatingStatusSince: maskFlexibleDate(raw) })}
              textCase="none"
              placeholder="mm-dd-yyyy, mm-yyyy, or yyyy"
              hint={isValidFlexibleDate(value.operatingStatusSince) ? FLEXIBLE_DATE_HINT : FLEXIBLE_DATE_INVALID_HINT}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(ownerRef.current)}
            />
          </View>
        ) : (
          <View style={styles.row3}>
            <TextField
              ref={hoursRef}
              label="Operating Hours/Day"
              value={value.operatingHoursDay}
              onChangeText={operatingHoursDay => onChange({ ...value, operatingHoursDay })}
              keyboardType="numeric"
              placeholder="e.g. 8"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(daysWeekRef.current)}

            />
            <TextField
              ref={daysWeekRef}
              label="Operating Days/Week"
              value={value.operatingDaysWeek}
              onChangeText={operatingDaysWeek => onChange({ ...value, operatingDaysWeek })}
              keyboardType="numeric"
              placeholder="e.g. 5"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(daysYearRef.current)}

            />
            <TextField
              ref={daysYearRef}
              label="Operating Days/Year"
              value={value.operatingDaysYear}
              onChangeText={operatingDaysYear => onChange({ ...value, operatingDaysYear })}
              keyboardType="numeric"
              placeholder="e.g. 260"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(ownerRef.current)}

            />
          </View>
        )}
      </FormSection>

      <FormSection icon="person-outline" title="Key Personnel">
        <View style={styles.row}>
          <TextField
            ref={ownerRef}
            label="Owner"
            value={value.ownerName}
            onChangeText={ownerName => onChange({ ...value, ownerName })}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(headRef.current)}

          />
          <TextField
            ref={headRef}
            label="Managing Head / Plant Manager"
            value={value.managingHeadName}
            onChangeText={managingHeadName => onChange({ ...value, managingHeadName })}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(contactNameRef.current)}

          />
        </View>
        <View style={styles.row}>
          <TextField
            ref={contactNameRef}
            label="Contact Person"
            value={value.contactPersonName}
            onChangeText={contactPersonName => onChange({ ...value, contactPersonName })}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(contactPositionRef.current)}

          />
          <TextField
            ref={contactPositionRef}
            label="Contact Person Position"
            value={value.contactPersonPosition}
            onChangeText={contactPersonPosition => onChange({ ...value, contactPersonPosition })}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(phoneRef.current)}

          />
        </View>
        <View style={styles.row}>
          <TextField
            ref={phoneRef}
            label="Phone / Fax"
            value={value.phoneFax}
            onChangeText={phoneFax => onChange({ ...value, phoneFax })}
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(emailRef.current)}

          />
          <TextField
            ref={emailRef}
            label="Email Address"
            value={value.email}
            onChangeText={email => onChange({ ...value, email })}
            textCase="none"
            keyboardType="email-address"
            required
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(pcoNameRef.current)}

          />
        </View>
      </FormSection>

      <FormSection icon="leaf-outline" title="Pollution Control Officer">
        <View style={styles.row}>
          <TextField
            ref={pcoNameRef}
            label="PCO Full Name"
            value={value.pcoName}
            onChangeText={pcoName => onChange({ ...value, pcoName })}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => focusInput(pcoAccredRef.current)}

          />
          <TextField
            ref={pcoAccredRef}
            label="PCO Accreditation No."
            value={value.pcoAccreditationNo}
            onChangeText={pcoAccreditationNo => onChange({ ...value, pcoAccreditationNo })}
            returnKeyType="done"

          />
        </View>
        <View style={styles.row}>
          <DateField
            label="PCO Accreditation Effectivity"
            value={value.pcoEffectivity}
            onChange={pcoEffectivity => onChange({ ...value, pcoEffectivity })}
          />
        </View>
      </FormSection>

      <FormSection icon="cube-outline" title="Product Lines">
        <DynamicRowTable
          columns={[
            { key: 'product_line', label: 'Product Line', width: 160, placeholder: 'e.g. Beer Production' },
            { key: 'ecc_production_rate', label: 'Declared Rate', width: 100, type: 'number', placeholder: '0' },
            { key: 'actual_production_rate', label: 'Actual Rate', width: 100, type: 'number', placeholder: '0' },
          ]}
          rows={value.productLines}
          onChange={productLines => onChange({ ...value, productLines })}
          addLabel="Add Product Line"
        />
      </FormSection>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  row3: {
    flexDirection: 'row',
    gap: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.navy,
  },
});
