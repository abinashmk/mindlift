import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';

import {InterventionEvent, MainStackParamList} from '@/types';
import {interventionsApi} from '@/api/interventions';
import {useAppDispatch, useAppSelector} from '@/store';
import {setInterventions} from '@/store/metricsSlice';
import {InterventionCard} from '@/components/InterventionCard';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export function InterventionsListScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const {interventions} = useAppSelector(state => state.metrics);
  const [refreshing, setRefreshing] = useState(false);

  const loadInterventions = useCallback(async () => {
    try {
      const res = await interventionsApi.getTodayInterventions();
      dispatch(setInterventions(res.data));
    } catch {
      // Keep stale
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadInterventions();
    }, [loadInterventions]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadInterventions();
    setRefreshing(false);
  }

  function renderItem({item}: {item: InterventionEvent}) {
    return (
      <InterventionCard
        intervention={item}
        onPress={() =>
          navigation.navigate('InterventionDetail', {eventId: item.event_id})
        }
      />
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Text style={[styles.backIcon, {color: colors.primary}]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          Actions
        </Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={interventions}
        keyExtractor={item => item.event_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{height: SPACING.sm}} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              No actions for today. Check back tomorrow.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: 56,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  list: {
    padding: PAGE_HORIZONTAL_PADDING,
    paddingTop: SPACING.md,
    paddingBottom: 32,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: SPACING.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
});
