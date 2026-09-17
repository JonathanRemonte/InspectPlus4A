import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { PROVINCE_OPTIONS, getCityOptions, getBarangayOptions } from '../../../constants/provinces';
import { maskFlexibleDate, isValidFlexibleDate, FLEXIBLE_DATE_HINT, FLEXIBLE_DATE_INVALID_HINT } from '../../../utils/flexibleDate';
import { TextField, SelectField, DateField, RadioGroup, useScrollToInput, focusInput } from '../../../components/form';
import { emptyGeneralInfoForm, GeneralInfoFormState } from '../types';
import { CoordinateFields } from '../../location/components/CoordinateFields';

// Card shrinks to leave room for the keyboard, capped so it never grows
// past 85% of the window when the keyboard is hidden.
const WINDOW_HEIGHT = Dimensions.get('window').height;
const MAX_CARD_HEIGHT = WINDOW_HEIGHT * 0.85;

const OPERATING_STATUS_OPTIONS = [
  { label: 'Operational', value: 'Operational' },
  { label: 'Temporarily Close', value: 'Temporarily Close' },
  { label: 'Non-Operational', value: 'Non-Operational' },
];

interface NewEstablishmentModalProps {
  visible: boolean;
  onCancel: () => void;
  // Persists the establishment locally; the modal awaits it so the button
  // can show a busy state and, on failure, keep what the user typed instead
  // of clearing it. The caller hides the modal (visible=false) on success —
  // that's what triggers this component to reset its own form state.
  onCreate: (generalInfo: GeneralInfoFormState, inspectionDate: string) => Promise<void>;
}

export const NewEstablishmentModal: React.FC<NewEstablishmentModalProps> = ({
  visible,
  onCancel,
  onCreate,
}) => {
  const [form, setForm] = useState<GeneralInfoFormState>(emptyGeneralInfoForm);
  const [inspectionDate, setInspectionDate] = useState('');
  const [creating, setCreating] = useState(false);
  // Reanimated shared value, synced natively with the keyboard's own
  // animation (negative height while shown) — driving the card's resize
  // from this instead of RN core's Keyboard.addListener + LayoutAnimation
  // avoids two separate systems racing to resize the same view once
  // KeyboardProvider is in the tree, which caused a visible stutter.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const scrollRef = useRef<ScrollView>(null);
  const scrollToInput = useScrollToInput(scrollRef);
  const addressRef = useRef<TextInput>(null);
  const latRef = useRef<TextInput>(null);
  const lngRef = useRef<TextInput>(null);
  const natureRef = useRef<TextInput>(null);
  const psicRef = useRef<TextInput>(null);
  const inspectionDateRef = useRef<TextInput>(null);
  const hoursRef = useRef<TextInput>(null);
  const daysWeekRef = useRef<TextInput>(null);
  const daysYearRef = useRef<TextInput>(null);
  const sinceRef = useRef<TextInput>(null);
  const isNonOperational = form.operatingStatus !== 'Operational';

  useEffect(() => {
    if (!visible) {
      setForm(emptyGeneralInfoForm());
      setInspectionDate('');
      setCreating(false);
    }
  }, [visible]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    // See the styles.overlay comment below for why bottom padding (not
    // just the card's own height) is what needs to grow.
    paddingBottom: 20 - keyboardHeight.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    // keyboardHeight.value is <= 0 (negative while the keyboard is shown),
    // so adding it here is what subtracts the keyboard's height.
    height: Math.max(280, Math.min(MAX_CARD_HEIGHT, WINDOW_HEIGHT + keyboardHeight.value - 40)),
  }));

  const canSubmit =
    form.name.trim() &&
    form.barangay.trim() &&
    form.city.trim() &&
    form.province.trim() &&
    form.natureOfBusiness.trim() &&
    inspectionDate.trim();

  const handleCreate = async () => {
    if (!canSubmit || creating) return;
    setCreating(true);
    try {
      await onCreate(form, inspectionDate);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    if (creating) return;
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Animated.View
        style={[
          styles.overlay,
          // Shrinks the region the card is centered *within* to exclude the
          // keyboard, not just the card itself — centering on the full
          // screen would only send half of any height reduction upward
          // (the other half just grows unused space above the card), so
          // the bottom of the card stayed covered. Padding the bottom by
          // the keyboard's height moves the whole centered position up,
          // effectively compressing the card upward instead of in place.
          overlayAnimatedStyle,
        ]}>
        <Animated.View
          style={[
            styles.card,
            // A definite height (not just a cap) so the ScrollView's
            // flex:1 below has real space to resolve against — with only
            // maxHeight, the container's height is "auto" (content-hug),
            // and a flex:1 child inside an auto-height column collapses to
            // ~0 since there's no fixed space left to distribute.
            cardAnimatedStyle,
          ]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="water" size={16} color={Colors.textWhite} />
              <Text style={styles.headerTitle}>New Water Inspection Report</Text>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={16} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled">
            <TextField
              label="Establishment Name"
              value={form.name}
              onChangeText={name => setForm({ ...form, name })}
              textCase="upper"
              required
              placeholder="Enter establishment or company name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(addressRef.current)}
            />
            <View style={styles.row}>
              <TextField
                ref={addressRef}
                label="Address Line"
                value={form.addressLine}
                onChangeText={addressLine => setForm({ ...form, addressLine })}
                placeholder="Street / building / lot no. (if known)"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focusInput(natureRef.current)}
                onFocus={() => scrollToInput(addressRef)}
              />
            </View>
            <View style={styles.row}>
              <SelectField
                label="Province"
                value={form.province}
                options={PROVINCE_OPTIONS}
                onSelect={province => setForm({ ...form, province, city: '', barangay: '' })}
                required
              />
              <SelectField
                label="City / Municipality"
                value={form.city}
                options={getCityOptions(form.province)}
                onSelect={city => setForm({ ...form, city, barangay: '' })}
                placeholder={form.province ? 'Select…' : 'Select province first'}
                disabled={!form.province}
                required
              />
            </View>
            <View style={styles.row}>
              <SelectField
                label="Barangay"
                value={form.barangay}
                options={getBarangayOptions(form.province, form.city)}
                onSelect={barangay => setForm({ ...form, barangay })}
                placeholder={form.city ? 'Select…' : 'Select city/municipality first'}
                disabled={!form.city}
                required
              />
            </View>
            <TextField
              ref={natureRef}
              label="Nature of Business"
              value={form.natureOfBusiness}
              onChangeText={natureOfBusiness => setForm({ ...form, natureOfBusiness })}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(psicRef.current)}
              onFocus={() => scrollToInput(natureRef)}
            />
            <TextField
              ref={psicRef}
              label="PSIC Code"
              value={form.psicCode}
              onChangeText={psicCode => setForm({ ...form, psicCode })}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(latRef.current)}
              onFocus={() => scrollToInput(psicRef)}
            />
            <CoordinateFields
              lat={form.geoLat}
              lng={form.geoLng}
              onChange={({ lat, lng }) => setForm({ ...form, geoLat: lat, geoLng: lng })}
              packName="estab:pending"
              latRef={latRef}
              lngRef={lngRef}
              onLngSubmitEditing={() => focusInput(inspectionDateRef.current)}
              onLatFocus={() => scrollToInput(latRef)}
              onLngFocus={() => scrollToInput(lngRef)}
            />
            <DateField
              ref={inspectionDateRef}
              label="Inspection Date"
              value={inspectionDate}
              onChange={setInspectionDate}
              required
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => focusInput(isNonOperational ? sinceRef.current : hoursRef.current)}
              onFocus={() => scrollToInput(inspectionDateRef)}
            />
            <RadioGroup
              label="Status of Operation"
              options={OPERATING_STATUS_OPTIONS}
              value={form.operatingStatus}
              onChange={operatingStatus => setForm({ ...form, operatingStatus })}
              required
            />
            {isNonOperational ? (
              <TextField
                ref={sinceRef}
                label="Closed / Non-Operational Since"
                value={form.operatingStatusSince}
                onChangeText={raw => setForm({ ...form, operatingStatusSince: maskFlexibleDate(raw) })}
                textCase="none"
                placeholder="mm-dd-yyyy, mm-yyyy, or yyyy"
                hint={isValidFlexibleDate(form.operatingStatusSince) ? FLEXIBLE_DATE_HINT : FLEXIBLE_DATE_INVALID_HINT}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onFocus={() => scrollToInput(sinceRef)}
              />
            ) : (
              <View style={styles.row3}>
                <TextField
                  ref={hoursRef}
                  label="Operating Hours/Day"
                  value={form.operatingHoursDay}
                  onChangeText={operatingHoursDay => setForm({ ...form, operatingHoursDay })}
                  keyboardType="numeric"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => focusInput(daysWeekRef.current)}
                  onFocus={() => scrollToInput(hoursRef)}
                />
                <TextField
                  ref={daysWeekRef}
                  label="Operating Days/Week"
                  value={form.operatingDaysWeek}
                  onChangeText={operatingDaysWeek => setForm({ ...form, operatingDaysWeek })}
                  keyboardType="numeric"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => focusInput(daysYearRef.current)}
                  onFocus={() => scrollToInput(daysWeekRef)}
                />
                <TextField
                  ref={daysYearRef}
                  label="Operating Days/Year"
                  value={form.operatingDaysYear}
                  onChangeText={operatingDaysYear => setForm({ ...form, operatingDaysYear })}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onFocus={() => scrollToInput(daysYearRef)}
                />
              </View>
            )}
            <Text style={styles.hint}>
              Key personnel, PCO details, and DENR permits can be filled in on the General
              Information tab after this report is created.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={creating}
              activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, (!canSubmit || creating) && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!canSubmit || creating}
              activeOpacity={0.85}>
              {creating ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <>
                  <Text style={styles.createText}>Create Establishment</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.textWhite} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.navy,
    borderBottomWidth: 3,
    borderBottomColor: Colors.green,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  row3: {
    flexDirection: 'row',
    gap: 10,
  },
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
    lineHeight: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.bgLight,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.green,
  },
  createBtnDisabled: {
    backgroundColor: Colors.borderLight,
  },
  createText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});
