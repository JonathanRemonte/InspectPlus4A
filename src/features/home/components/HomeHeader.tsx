import React, { useEffect, useState } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { showPrompt } from '../../../services/prompt/promptService';
import Reanimated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { Logo } from '../../../components/Logo';
import { useAuthContext } from '../../../core/providers/AuthProvider';
import { runManagedSync, runResetAndRedownload } from '../../../services/sync/syncOrchestrator';
import { countPendingRecords } from '../../../db/sync/watermelonAdapter';
import { UpdateRequiredError } from '../../../services/sync/appVersionGate';
import { subscribeToUpdateRequired } from '../../../services/sync/syncEvents';
import { showUpdateRequiredAlert } from '../../updates/updateRequiredAlert';
import { SyncOptionsModal, SyncDirection } from './SyncOptionsModal';

interface HomeHeaderProps {
  // Hide the avatar/logout control on pages with no active session (e.g. login).
  showAccountButton?: boolean;
  // Scroll-driven collapse progress (0 = expanded, 1 = collapsed), shared
  // with whatever screen is currently mounted below — see HeaderScrollContext.
  // A shared value (not React state) so the animation runs entirely on the
  // UI thread instead of racing the scroll handler for JS-thread time.
  collapsed?: SharedValue<number>;
  // Home always shows the full header regardless of scroll state.
  disableCollapse?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  showAccountButton = true,
  collapsed,
  disableCollapse = false,
}) => {
  const { session, signOut } = useAuthContext();
  const [syncing, setSyncing] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const uid = (session as { user?: { id?: string } } | null)?.user?.id;

  // Manual trigger — goes through the same runManagedSync path as the
  // post-login sync, so a manual tap also picks up a user switch on a
  // shared device and notifies listeners (e.g. the home lists) the same way.
  // The direction (pull only / push only / both) comes from SyncOptionsModal.
  const handleSyncNow = async (direction: SyncDirection) => {
    if (syncing || !uid) return;
    setSyncing(true);
    try {
      const result = await runManagedSync(uid, {
        skipPush: direction === 'pull',
        skipPull: direction === 'push',
      });
      setSyncModalVisible(false);
      if (!result) {
        void showPrompt({ title: 'Sync skipped', message: 'No internet connection right now.' });
        return;
      }
      void showPrompt({
        title: 'Sync complete',
        message: `Pushed: ${result.pushed ? 'yes' : 'no changes'}
Pulled: ${result.pulled ? 'yes' : 'no'}`,
      });
    } catch (err) {
      if (err instanceof UpdateRequiredError) {
        void showUpdateRequiredAlert(err.minVersion);
        return;
      }
      console.error('[HomeHeader] Sync failed:', err);
      void showPrompt({
        title: 'Sync failed',
        message: err instanceof Error ? err.message : 'Something went wrong while syncing.',
        tone: 'danger',
      });
    } finally {
      setSyncing(false);
    }
  };

  // The recovery path. Confirms with the pending count first - that number
  // is what the push step carries and what would be at stake if it
  // couldn't - then runs runResetAndRedownload, which only clears anything
  // once the push has succeeded. Failures report exactly what was and
  // wasn't done, since "did my entries get deleted?" is the question an
  // inspector will have at that moment.
  const handleReset = async () => {
    if (syncing || !uid) return;
    const pending = await countPendingRecords().catch(() => 0);
    const stake =
      pending === 0
        ? 'Nothing on this phone is waiting to sync.'
        : `${pending} ${pending === 1 ? 'entry' : 'entries'} on this phone ${pending === 1 ? 'hasn\u2019t' : 'haven\u2019t'} synced yet. ${pending === 1 ? 'It' : 'They'} will be sent to the server first; if that fails, nothing is reset.`;
    const choice = await showPrompt({
      title: 'Reset and re-download?',
      message: `${stake}

Everything already synced will be removed from this phone and downloaded again from the server. This can take a few minutes on a slow connection.`,
      tone: 'danger',
      actions: [
        { id: 'cancel', label: 'Cancel', variant: 'cancel' },
        { id: 'reset', label: 'Reset and re-download', variant: 'danger' },
      ],
    });
    if (choice !== 'reset') return;

    setSyncing(true);
    try {
      const result = await runResetAndRedownload(uid);
      setSyncModalVisible(false);
      if (!result) {
        void showPrompt({ title: 'Reset skipped', message: 'No internet connection right now. Nothing was changed.' });
        return;
      }
      void showPrompt({
        title: 'Reset complete',
        message: `Pushed: ${result.pushed ? 'yes' : 'no changes'}
Re-downloaded everything you have access to.`,
      });
    } catch (err) {
      if (err instanceof UpdateRequiredError) {
        void showUpdateRequiredAlert(err.minVersion, 'Nothing was changed.');
        return;
      }
      console.error('[HomeHeader] Reset and re-download failed:', err);
      void showPrompt({
        title: 'Reset not done',
        message: `${err instanceof Error ? err.message : 'Something went wrong.'}

Your unsynced entries are still on this phone and nothing was removed.`,
        tone: 'danger',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Surfaces the same failure when it happens from the post-login sync
  // (AuthProvider), which runs in the background and has no UI of its own
  // to report through — mirrors how other screens use
  // subscribeToSyncDataChanged for their own refetch-on-sync behavior.
  useEffect(() => {
    return subscribeToUpdateRequired(minVersion => { void showUpdateRequiredAlert(minVersion); });
  }, []);

  const handleLogout = async () => {
    try {
      // No manual navigation here — this component is rendered several
      // navigator levels deep (root Stack → (app) group → its inner Stack),
      // so an imperative root-level redirect from here can silently
      // misfire. RootNavigator (the true root) reactively redirects to
      // '/' as soon as signOut() clears the session below.
      await signOut();
    } catch (err) {
      console.warn('[HomeHeader] signOut encountered an error:', err);
      void showPrompt({
        title: 'Sign out failed',
        message: 'Something went wrong while signing out. Please try again.',
        tone: 'danger',
      });
    }
  };

  // Single derived value so every interpolation below reacts to the same
  // number — recomputed on the UI thread whenever `collapsed` changes, and
  // pinned to 0 on screens (home) that opt out of collapsing altogether.
  const progress = useDerivedValue(() => {
    return disableCollapse || !collapsed ? 0 : collapsed.value;
  }, [disableCollapse, collapsed]);

  // paddingTop/paddingBottom on `row` used to animate too, but that's a
  // second Yoga-affecting node recomputing on every scroll frame right next
  // to the two below — folded into a static value so only the height
  // animations (which actually need to reclaim layout space) pay that cost.
  // logosStyle/subtitleStyle still animate `height` (not transform) because
  // they need to genuinely reclaim layout space as the header collapses —
  // but avatarStyle has no such requirement, so it's transform/opacity only
  // (compositor-only, zero Yoga relayout) to keep at least one of these off
  // the layout thread entirely.
  const logosStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [30, 0], Extrapolation.CLAMP),
    opacity: interpolate(progress.value, [0, 0.6, 1], [1, 0, 0], Extrapolation.CLAMP),
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [16, 0], Extrapolation.CLAMP),
    opacity: interpolate(progress.value, [0, 0.6, 1], [1, 0, 0], Extrapolation.CLAMP),
  }));
  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 30 / 38], Extrapolation.CLAMP) }],
  }));

  return (
    <LinearGradient
      colors={[Colors.navy, '#0a7a3e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.header}>

      <View style={styles.row}>
        {/* Left: wordmark + small agency logos + subtitle */}
        <View style={styles.left}>
          <View style={styles.logoRow}>
            <Logo dark variant="plain" fontSize={19} />
            <Reanimated.View style={[styles.logosRow, logosStyle]}>
              <Image
                source={require('../../../../assets/denr_logo.png')}
                style={styles.agencyLogo}
                resizeMode="contain"
              />
              <Image
                source={require('../../../../assets/bagong_pilipinas_logo.png')}
                style={styles.agencyLogo}
                resizeMode="contain"
              />
            </Reanimated.View>
          </View>
          <Reanimated.View style={[styles.subtitleWrap, subtitleStyle]}>
            <Text style={styles.subtitle} numberOfLines={1}>
              EMB4B INSPECTION & MONITORING SYSTEM
            </Text>
          </Reanimated.View>
        </View>

        {/* Right: sync + avatar/logout buttons */}
        {showAccountButton && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => setSyncModalVisible(true)} activeOpacity={0.8} disabled={syncing}>
              <Reanimated.View style={[styles.avatarBtn, avatarStyle]}>
                <Ionicons
                  name={syncing ? 'sync-circle-outline' : 'cloud-upload-outline'}
                  size={22}
                  color={Colors.textWhite}
                />
              </Reanimated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}>
              <Reanimated.View style={[styles.avatarBtn, avatarStyle]}>
                <Ionicons name="person-circle-outline" size={26} color={Colors.textWhite} />
              </Reanimated.View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <SyncOptionsModal
        visible={syncModalVisible}
        syncing={syncing}
        onCancel={() => setSyncModalVisible(false)}
        onSync={handleSyncNow}
        onReset={handleReset}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  left: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  agencyLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  subtitleWrap: {
    overflow: 'hidden',
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    // Fixed size — avatarStyle scales this down visually via transform
    // rather than animating width/height, so it never triggers a layout
    // relayout while the header collapse animation is running.
    borderWidth: 1.5,
    borderColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
