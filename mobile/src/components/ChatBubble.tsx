import React from 'react';
import {View, Text, StyleSheet, useColorScheme} from 'react-native';
import {ChatMessage} from '@/types';
import {
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  SPACING,
} from '@/utils/constants';
import {formatTime} from '@/utils/formatters';

interface ChatBubbleProps {
  message: ChatMessage;
}

export function ChatBubble({message}: ChatBubbleProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const isUser = message.sender_type === 'user';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemWrapper}>
        <Text style={[styles.systemText, {color: colors.textTertiary}]}>
          {message.message_text}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperRight : styles.wrapperLeft,
      ]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, {backgroundColor: colors.primary}]
            : [
                styles.bubbleAssistant,
                {backgroundColor: colors.surfaceSecondary},
              ],
        ]}>
        <Text
          style={[
            styles.text,
            {
              color: isUser ? '#ffffff' : colors.textPrimary,
              lineHeight: FONT_SIZE.md * 1.4,
            },
          ]}>
          {message.message_text}
        </Text>
      </View>
      <Text
        style={[
          styles.time,
          {color: colors.textTertiary},
          isUser ? styles.timeRight : styles.timeLeft,
        ]}>
        {formatTime(message.created_at)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  wrapperLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    marginLeft: SPACING.lg,
  },
  wrapperRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    marginRight: SPACING.lg,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: FONT_SIZE.md,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    marginTop: 3,
  },
  timeLeft: {
    marginLeft: 4,
  },
  timeRight: {
    marginRight: 4,
  },
  systemWrapper: {
    alignSelf: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
  systemText: {
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
