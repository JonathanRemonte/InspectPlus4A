import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../../constants/colors';
import { describeAppVersion } from '../../../utils/version';
import { schema } from '../../../db/schema';
import { region } from '../../../region';

interface HomeFooterProps {
  // Full credits line is only for non-authenticated pages (e.g. login).
  // Authenticated pages get the plain bar with no text.
  showCredits?: boolean;
}

// The plain bar's height on every authenticated screen (showCredits=false —
// the login page's credits variant is taller and irrelevant there). This is
// the number any other chrome math (e.g. the export sheet's footer) must use
// to line up with HomeFooter — exported so styles.bar can't drift from it.
export const HOME_FOOTER_BAR_HEIGHT = 20;
const BAR_HEIGHT = HOME_FOOTER_BAR_HEIGHT;
// The credits footer's own vertical padding — unrelated to the plain bar
// above; nothing outside this file should need it.
const CREDITS_FOOTER_PADDING_VERTICAL = 4;

export const HomeFooter: React.FC<HomeFooterProps> = ({ showCredits = false }) => {
  // The one place the running version is visible - the recovery guide and
  // support both ask for it, and the footer is on every screen including
  // login, where an inspector who can't get in still needs to read it. The
  // schema version rides along: it decides whether an update migrates the
  // local store or resets it, so a screenshot answers that question too.
  const version = `${describeAppVersion()} · db ${schema.version}`;
  return (
    <LinearGradient
      colors={[Colors.navy, '#0a7a3e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={showCredits ? styles.footer : styles.bar}>
      {showCredits && (
        <>
          <Text style={styles.line}>
            {region.identity.copyrightLine}
          </Text>
          <Text style={styles.line}>
            Ideated by PEMU Oriental Mindoro, Abram Alexander Asi
          </Text>
          <Text style={styles.line}>
            Developed by Jonathan Remonte and Stephanie Kim Pineda
          </Text>
          <Text style={[styles.line, styles.versionLine]}>All Rights Reserved · {version}</Text>
        </>
      )}
      {!showCredits && (
        // Absolutely placed so the bar keeps the 20px height the app's
        // chrome insets are measured against (see appChromeFooterInset).
        <Text style={styles.versionStamp}>{version}</Text>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingVertical: CREDITS_FOOTER_PADDING_VERTICAL,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bar: {
    height: BAR_HEIGHT,
  },
  line: {
    fontSize: 7.5,
    lineHeight: 9,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  versionLine: {
    fontVariant: ['tabular-nums'],
  },
  versionStamp: {
    position: 'absolute',
    right: 10,
    top: 0,
    height: BAR_HEIGHT,
    lineHeight: BAR_HEIGHT,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    color: 'rgba(255,255,255,0.7)',
  },
});
