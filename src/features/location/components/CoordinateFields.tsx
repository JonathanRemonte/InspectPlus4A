import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField, focusInput } from '../../../components/form';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { LocationPickerModal, type PickedLocation } from './LocationPickerModal';

export interface CoordinateFieldsProps {
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
  readOnly?: boolean;
  // See LocationPickerModal.packName.
  packName: string;
  // Focus chain — the same refs and handlers the surrounding forms already
  // pass to their TextFields. Latitude's "next" always goes to Longitude.
  latRef?: React.RefObject<TextInput | null>;
  lngRef?: React.RefObject<TextInput | null>;
  onLngSubmitEditing?: () => void;
  lngReturnKeyType?: 'next' | 'done';
  onLatFocus?: () => void;
  onLngFocus?: () => void;
  latChangeNote?: string;
  lngChangeNote?: string;
}

// The one Latitude/Longitude row every form uses, plus the button that
// opens the map picker. Values stay strings in the caller's state; the
// picker's numbers are stringified here so callers never see a number.
export const CoordinateFields: React.FC<CoordinateFieldsProps> = ({
  lat,
  lng,
  onChange,
  readOnly = false,
  packName,
  latRef,
  lngRef,
  onLngSubmitEditing,
  lngReturnKeyType = 'next',
  onLatFocus,
  onLngFocus,
  latChangeNote,
  lngChangeNote,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const localLngRef = React.useRef<TextInput>(null);
  const resolvedLngRef = lngRef ?? localLngRef;

  const handleConfirm = (picked: PickedLocation) => {
    setPickerOpen(false);
    onChange({ lat: String(picked.lat), lng: String(picked.lng) });
  };

  if (readOnly) {
    return (
      <View style={styles.row}>
        <TextField label="Latitude" value={lat || '—'} readOnly changeNote={latChangeNote} />
        <TextField label="Longitude" value={lng || '—'} readOnly changeNote={lngChangeNote} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TextField
        ref={latRef}
        label="Latitude"
        value={lat}
        onChangeText={next => onChange({ lat: next, lng })}
        keyboardType="numeric"
        placeholder="e.g. 11.144"
        textCase="none"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => focusInput(resolvedLngRef.current)}
        onFocus={onLatFocus}
        changeNote={latChangeNote}
      />
      <TextField
        ref={resolvedLngRef}
        label="Longitude"
        value={lng}
        onChangeText={next => onChange({ lat, lng: next })}
        keyboardType="numeric"
        placeholder="e.g. 119.395"
        textCase="none"
        returnKeyType={lngReturnKeyType}
        blurOnSubmit={lngReturnKeyType === 'done'}
        onSubmitEditing={onLngSubmitEditing}
        onFocus={onLngFocus}
        changeNote={lngChangeNote}
      />
      {/* Bottom-aligned with the inputs (not the labels), and carrying the
          same bottom margin TextField's wrapper does so the row's height
          doesn't change. */}
      <TouchableOpacity
        style={styles.pinBtn}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Pin on map">
        <Ionicons name="map-outline" size={18} color={Colors.navy} />
      </TouchableOpacity>

      <LocationPickerModal
        visible={pickerOpen}
        initialLat={lat}
        initialLng={lng}
        packName={packName}
        onCancel={() => setPickerOpen(false)}
        onConfirm={handleConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pinBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    width: 40,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
