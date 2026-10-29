import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuthContext } from '../core/providers/AuthProvider';
import { DatabaseProvider } from '../core/providers/DatabaseProvider';
import { PromptProvider } from '../core/providers/PromptProvider';
import { initMapCache } from '../features/location/mapConfig';
import { Colors } from '../constants/colors';

// ── Root navigator — drives routing based on live auth session ────────────────
function RootNavigator() {
  const { session, loading } = useAuthContext();
  // Supabase's onAuthStateChange fires a new `session` object on every
  // silent token refresh, not just on real login/logout — deriving a
  // stable boolean keeps the redirect effect from re-firing (and replaying
  // its transition) whenever that happens without an actual status change.
  const isAuthenticated = !!session;

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      router.replace('/home');
    } else {
      router.replace('/');
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.navy} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Shared header/footer chrome for every authenticated screen lives in
          (app)/_layout.tsx — this group's inner Stack owns per-page animation. */}
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

// ── Root layout — provider hierarchy ─────────────────────────────────────────
// Order matters:
//   GestureHandlerRootView  — must be outermost for gesture support
//   KeyboardProvider        — feeds keyboard-frame animations to every
//                             KeyboardAwareScrollView in the tree
//   SafeAreaProvider        — provides safe area insets app-wide
//   AuthProvider            — manages session state
//   DatabaseProvider        — mounts WatermelonDB (needs to be inside auth
//                             so it can eventually be seeded per-user)
//   PromptProvider          — the app's single confirm/notice surface, so
//                             showPrompt() works from anywhere, including
//                             plain modules
//   RootNavigator           — consumes auth state to drive routing
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  // Raises MapLibre's ambient tile cache once per app launch — see
  // features/location/mapConfig.ts. Fire-and-forget; nothing renders
  // differently while it runs.
  useEffect(() => {
    void initMapCache();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <DatabaseProvider>
              <PromptProvider>
                <RootNavigator />
              </PromptProvider>
            </DatabaseProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
