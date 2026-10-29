import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Colors } from '../../design/colors';
import { useMotion } from '../../design/motion';
import { Radius } from '../../design/radius';
import { Spacing } from '../../design/spacing';
import { Type } from '../../design/typography';
import { useAuthContext } from '../../core/providers/AuthProvider';
import { region } from '../../region';
import { Skeleton } from '../../components/Skeleton';
import { HomeTabs, HomeTab, HOME_TAB_ORDER } from '../../features/home/components/HomeTabs';
import {
  ManageEstablishmentsTab,
  ManageEstablishmentsTabHandle,
} from '../../features/establishments/components/ManageEstablishmentsTab';
import {
  ManageReportsTab,
  ManageReportsTabHandle,
} from '../../features/establishments/components/ManageReportsTab';
import {
  ExportReportsTab,
  ExportReportsTabHandle,
} from '../../features/establishments/components/ExportReportsTab';
import { subscribeToSyncDataChanged } from '../../services/sync/syncEvents';
import { useUpdateCheck } from '../../features/updates/useUpdateCheck';
import { UpdateBanner } from '../../features/updates/UpdateBanner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getFormattedTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

const SKELETON_ROW_HEIGHT = 96;

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { fullName } = useAuthContext();
  const { width: pageWidth } = useWindowDimensions();
  const { reduced } = useMotion();
  const { update, dismiss: dismissUpdate } = useUpdateCheck();
  const [activeTab, setActiveTab] = useState<HomeTab>('manageReports');
  // Pages mount the first time they're shown and stay mounted after, so a
  // swipe back is instant and keeps that tab's filters/scroll — but a page
  // never visited costs nothing: Home's first paint is still one tab, one
  // query, however large the local database grows. Each tab already
  // refetches on every sync, so a stale mounted page is not a concern.
  const [visited, setVisited] = useState<ReadonlySet<HomeTab>>(() => new Set(['manageReports']));
  const [refreshingTab, setRefreshingTab] = useState<HomeTab | null>(null);
  const pagerRef = useRef<Animated.ScrollView>(null);
  const manageEstablishmentsRef = useRef<ManageEstablishmentsTabHandle>(null);
  const manageReportsRef = useRef<ManageReportsTabHandle>(null);
  const exportReportsRef = useRef<ExportReportsTabHandle>(null);
  const firstName = fullName?.trim().split(/\s+/)[0] ?? 'Inspector';

  // The pager's offset as a fractional page index, written on the UI thread
  // every scroll frame and read only by HomeTabs' underline worklet — React
  // never re-renders for it.
  const position = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(event => {
    position.set(event.contentOffset.x / pageWidth);
  });

  // Ticks the header clock once a second — cheap enough given it's just one
  // small Text re-render, and keeps the displayed time actually live.
  const [currentTime, setCurrentTime] = useState(getFormattedTime());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(getFormattedTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // A sync can complete while Home is already mounted and focused (the
  // manual "Sync Now" button, or the post-login sync landing right as this
  // screen appears) — pull-to-refresh alone wouldn't pick that up, so every
  // mounted tab also refetches whenever local data changes for any reason.
  useEffect(() => {
    return subscribeToSyncDataChanged(() => {
      manageEstablishmentsRef.current?.refresh();
      manageReportsRef.current?.refresh();
      exportReportsRef.current?.refresh();
    });
  }, []);

  const markVisited = useCallback((tabs: HomeTab[]) => {
    setVisited(prev => {
      if (tabs.every(t => prev.has(t))) return prev;
      const next = new Set(prev);
      tabs.forEach(t => next.add(t));
      return next;
    });
  }, []);

  const activate = useCallback((tab: HomeTab) => {
    setActiveTab(tab);
    markVisited([tab]);
  }, [markVisited]);

  // A tab tap drives the pager, and the pager settling drives activeTab —
  // one path for both inputs, so the bar and the pages can't disagree.
  const handleTabPress = useCallback((tab: HomeTab) => {
    activate(tab);
    pagerRef.current?.scrollTo({ x: HOME_TAB_ORDER.indexOf(tab) * pageWidth, y: 0, animated: !reduced });
  }, [activate, pageWidth, reduced]);

  const handlePagerSettle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    const tab = HOME_TAB_ORDER[Math.min(Math.max(index, 0), HOME_TAB_ORDER.length - 1)];
    if (tab !== activeTab) activate(tab);
  }, [activeTab, activate, pageWidth]);

  // Mount both neighbours the moment a drag starts, so the swipe reveals
  // real content rather than a skeleton that fills in after it settles.
  const handleDragStart = useCallback(() => {
    const index = HOME_TAB_ORDER.indexOf(activeTab);
    markVisited(HOME_TAB_ORDER.filter((_, i) => Math.abs(i - index) === 1));
  }, [activeTab, markVisited]);

  // Pull-to-refresh reloads the tab it was pulled on.
  const handleRefresh = useCallback(async (tab: HomeTab) => {
    setRefreshingTab(tab);
    try {
      if (tab === 'manageEstablishments') {
        await manageEstablishmentsRef.current?.refresh();
      } else if (tab === 'manageReports') {
        await manageReportsRef.current?.refresh();
      } else if (tab === 'exportReports') {
        await exportReportsRef.current?.refresh();
      }
    } finally {
      setRefreshingTab(null);
    }
  }, []);

  const refreshControlFor = (tab: HomeTab) => (
    <RefreshControl
      refreshing={refreshingTab === tab}
      onRefresh={() => handleRefresh(tab)}
      tintColor={Colors.navy}
      colors={[Colors.navy]}
    />
  );

  // The Manage tabs page their lists (five rows at a time), so a plain
  // ScrollView around them is fine. Export shows the whole filtered set and
  // virtualises it through its own FlatList — which only works when that
  // list is the page's scroller, so it gets the RefreshControl as a prop
  // instead of a wrapper.
  const renderPage = (tab: HomeTab) => {
    if (tab === 'exportReports') {
      return (
        <ExportReportsTab
          ref={exportReportsRef}
          focused={activeTab === 'exportReports'}
          refreshControl={refreshControlFor(tab)}
        />
      );
    }
    return (
      <ScrollView
        testID={`home-page-${tab}`}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControlFor(tab)}>
        {tab === 'manageReports' ? (
          <ManageReportsTab ref={manageReportsRef} />
        ) : (
          <ManageEstablishmentsTab ref={manageEstablishmentsRef} />
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Welcome section + sticky tab bar */}
      <View style={styles.welcomeWrap}>
        <Text style={styles.welcomeText}>Welcome back, {firstName}!</Text>
        <Text style={styles.dateText}>
          {getFormattedDate()} · {currentTime} · {region.identity.regionLabel}
        </Text>
      </View>

      {/* Sits between the greeting and the tabs so it's seen on every launch
          but never covers the content an inspector came for. */}
      {update && <UpdateBanner version={update.version} url={update.url} onDismiss={() => { void dismissUpdate(); }} />}

      {/* Sticky tab bar */}
      <HomeTabs activeTab={activeTab} onTabChange={handleTabPress} position={position} />

      {/* One page per tab, swipeable. Each page scrolls on its own, so a
          long list on one tab never moves another's scroll position. */}
      <Animated.ScrollView
        ref={pagerRef}
        testID="home-pager"
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleDragStart}
        onMomentumScrollEnd={handlePagerSettle}
        style={styles.pager}>
        {HOME_TAB_ORDER.map(tab => (
          <View key={tab} style={{ width: pageWidth }}>
            {visited.has(tab) ? (
              renderPage(tab)
            ) : (
              <View style={styles.placeholder}>
                <Skeleton height={38} radius={Radius.pill} style={styles.skeletonRow} />
                <Skeleton height={SKELETON_ROW_HEIGHT} style={styles.skeletonRow} />
                <Skeleton height={SKELETON_ROW_HEIGHT} />
              </View>
            )}
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  welcomeWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
  },
  welcomeText: {
    fontSize: Type.display.fontSize,
    lineHeight: Type.display.lineHeight,
    fontWeight: '800',
    color: Colors.navy,
    fontStyle: 'italic',
  },
  dateText: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  pager: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Mirrors the tabs' own loading layout (search pill + rows) so an
  // unvisited page looks like a tab that's about to load, not a gap.
  placeholder: {
    padding: Spacing.lg,
  },
  skeletonRow: {
    marginBottom: Spacing.md,
  },
});
