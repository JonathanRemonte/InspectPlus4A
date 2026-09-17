import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/colors';
import { Radius } from '../../../design/radius';
import { Spacing } from '../../../design/spacing';
import { Type } from '../../../design/typography';

// Informational only: it sits over the map and explains why the map may be
// blank. It never gates the pin, the readout, GPS or Confirm.
export const OfflineTilesBanner: React.FC = () => (
  <View style={styles.banner} testID="offline-tiles-banner" accessibilityRole="alert">
    <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning.text} />
    <Text style={styles.text}>No map tiles available offline — your pin and GPS position still work.</Text>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warning.border,
    backgroundColor: Colors.warning.bg,
  },
  text: {
    flex: 1,
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
    color: Colors.warning.text,
  },
});
