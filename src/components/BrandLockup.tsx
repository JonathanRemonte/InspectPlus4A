import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Logo } from './Logo';
import { region } from '../region';

// The wordmark's font-size isn't fixed — it starts at this base size, then
// gets scaled at runtime so its rendered width matches the subtitle's
// rendered width exactly (mirrors the design's own `{{ wordmarkFontSize }}`
// auto-fit, computed the same way: render once at the base size off-screen
// to measure its natural width, then scale by subtitleWidth / baseWidth).
const BASE_WORDMARK_SIZE = 34;

export const BrandLockup: React.FC = () => {
  const [fontSize, setFontSize] = useState(BASE_WORDMARK_SIZE);
  const baseWidth = useRef<number | null>(null);
  const subtitleWidth = useRef<number | null>(null);

  const fit = useCallback(() => {
    if (baseWidth.current && subtitleWidth.current) {
      setFontSize(BASE_WORDMARK_SIZE * (subtitleWidth.current / baseWidth.current));
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text
        style={styles.hiddenMeasure}
        onLayout={e => {
          baseWidth.current = e.nativeEvent.layout.width;
          fit();
        }}>
        iNSPECTPlus
      </Text>

      <Logo fontSize={fontSize} />

      <Text
        style={styles.subtitle}
        onLayout={e => {
          subtitleWidth.current = e.nativeEvent.layout.width;
          fit();
        }}>
        {region.identity.systemName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    fontSize: BASE_WORDMARK_SIZE,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
});
