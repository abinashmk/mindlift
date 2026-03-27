import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

import {MainStackParamList} from '@/types';
import {accountApi} from '@/api/escalations';
import {Button} from '@/components/ui/Button';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'ExportRequested'>;

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 60; // 5 min max

export function ExportRequestedScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const {taskId} = route.params;

  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function poll() {
      pollCount.current += 1;
      accountApi
        .getExportStatus(taskId)
        .then(res => {
          if (res.data.status === 'ready' && res.data.download_url) {
            setDownloadUrl(res.data.download_url);
          } else if (res.data.status === 'failed') {
            setFailed(true);
          } else if (pollCount.current < MAX_POLLS) {
            timer.current = setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setFailed(true);
          }
        })
        .catch(() => {
          if (pollCount.current < MAX_POLLS) {
            timer.current = setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            setFailed(true);
          }
        });
    }

    timer.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [taskId]);

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{failed ? '⚠️' : downloadUrl ? '✅' : '📬'}</Text>

        <Text style={[styles.title, {color: colors.textPrimary}]}>
          {failed
            ? 'Export failed'
            : downloadUrl
            ? 'Export ready'
            : 'Preparing your export…'}
        </Text>

        <Text style={[styles.body, {color: colors.textSecondary}]}>
          {failed
            ? 'Something went wrong generating your export. Please try again from Settings.'
            : downloadUrl
            ? 'Your data export is ready. The link expires in 15 minutes.'
            : 'We are packaging your data. This usually takes less than a minute. You can also close this screen — we will send you an email when it is ready.'}
        </Text>

        {!downloadUrl && !failed && (
          <ActivityIndicator
            style={styles.spinner}
            color={colors.primary}
            size="large"
          />
        )}

        {downloadUrl && (
          <Button
            label="Download export"
            onPress={() => Linking.openURL(downloadUrl)}
            style={styles.btn}
          />
        )}

        <Button
          label="Back to Settings"
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {
    flex: 1,
    padding: PAGE_HORIZONTAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 56,
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  body: {
    fontSize: FONT_SIZE.md,
    lineHeight: FONT_SIZE.md * 1.4,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  spinner: {
    marginBottom: SPACING.xl,
  },
  btn: {
    width: '100%',
    marginBottom: SPACING.sm,
  },
});
