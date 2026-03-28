import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ListRenderItemInfo,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ChatMessage, MainStackParamList} from '@/types';
import {chatApi} from '@/api/chat';
import {useAppDispatch, useAppSelector} from '@/store';
import {
  addMessage,
  addMessages,
  clearSession,
  setCrisisFlag,
  setDisclosureShown,
  setIsSending,
  setSession,
} from '@/store/chatSlice';
import {updateUserState} from '@/store/authSlice';
import {ChatBubble} from '@/components/ChatBubble';
import {
  CHAT_AI_DISCLOSURE,
  COLORS_DARK,
  COLORS_LIGHT,
  FONT_SIZE,
  MIN_TAPPABLE,
  PAGE_HORIZONTAL_PADDING,
  SPACING,
} from '@/utils/constants';
import {isoNow} from '@/utils/formatters';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export function ChatScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const {sessionId, messages, crisisFlag, disclosureShown, isSending} =
    useAppSelector(state => state.chat);
  const userState = useAppSelector(state => state.auth.userState);

  const [inputText, setInputText] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const composerDisabled =
    crisisFlag || userState === 'CRISIS' || isSending;

  // Start or resume a session when screen is focused
  useFocusEffect(
    useCallback(() => {
      async function startSession() {
        if (sessionId) return; // Already have a session
        try {
          const res = await chatApi.startSession();
          dispatch(
            setSession({
              sessionId: res.data.session_id,
              sessionState: res.data.state,
              crisisFlag: res.data.crisis_flag,
            }),
          );
          if (res.data.crisis_flag) {
            dispatch(setCrisisFlag(true));
            dispatch(updateUserState('CRISIS'));
            navigation.reset({index: 0, routes: [{name: 'Crisis'}]});
          }
        } catch {
          setSessionError('Could not start chat. Please try again.');
        }
      }
      startSession();
    }, [sessionId, dispatch, navigation]),
  );

  // Load messages when session starts
  useEffect(() => {
    async function loadMessages() {
      if (!sessionId || messages.length > 0) return;
      try {
        const res = await chatApi.getMessages(sessionId);
        dispatch(addMessages(res.data));
      } catch {
        // Keep empty
      }
    }
    loadMessages();
  }, [sessionId, messages.length, dispatch]);

  // Show disclosure system message once per session
  useEffect(() => {
    if (!disclosureShown && sessionId) {
      const disclosureMsg: ChatMessage = {
        id: `disclosure-${Date.now()}`,
        sender_type: 'system',
        message_text: CHAT_AI_DISCLOSURE,
        created_at: isoNow(),
      };
      dispatch(addMessage(disclosureMsg));
      dispatch(setDisclosureShown(true));
    }
  }, [disclosureShown, sessionId, dispatch]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages.length]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text || composerDisabled) return;

    setInputText('');
    dispatch(setIsSending(true));

    // Optimistically add user message
    const optimisticMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender_type: 'user',
      message_text: text,
      created_at: isoNow(),
    };
    dispatch(addMessage(optimisticMsg));

    try {
      const res = await chatApi.sendMessage({
        session_id: sessionId,
        message_text: text,
      });

      // Add assistant response (null on crisis — no LLM reply generated)
      if (res.data.assistant_message) {
        dispatch(addMessage(res.data.assistant_message));
      }

      // Update session state
      dispatch(
        setSession({
          sessionId: res.data.session.session_id,
          sessionState: res.data.session.state,
          crisisFlag: res.data.session.crisis_flag,
        }),
      );

      // Crisis check — navigate immediately if flagged
      if (res.data.session.crisis_flag) {
        dispatch(setCrisisFlag(true));
        dispatch(updateUserState('CRISIS'));
        navigation.reset({index: 0, routes: [{name: 'Crisis'}]});
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender_type: 'system',
        message_text: 'Message failed to send. Please try again.',
        created_at: isoNow(),
      };
      dispatch(addMessage(errorMsg));
    } finally {
      dispatch(setIsSending(false));
    }
  }

  async function handleManualEscalation() {
    try {
      await chatApi.manualEscalation(sessionId, 'User requested manual help');
      navigation.navigate('MainTabs');
    } catch {
      // Navigate anyway
      navigation.navigate('MainTabs');
    }
  }

  function renderItem({item}: ListRenderItemInfo<ChatMessage>) {
    return <ChatBubble message={item} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, {backgroundColor: colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      {/* Header */}
      <View style={[styles.header, {borderBottomColor: colors.border, backgroundColor: colors.surface}]}>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          Support Chat
        </Text>
        <TouchableOpacity
          onPress={handleManualEscalation}
          style={[styles.helpBtn, {backgroundColor: colors.dangerLight}]}
          accessibilityRole="button"
          accessibilityLabel="Get help">
          <Text style={[styles.helpBtnText, {color: colors.danger}]}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {sessionError ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.sessionErrorText, {color: colors.danger}]}>
            {sessionError}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({animated: true})
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, {color: colors.textTertiary}]}>
                Say hello to get started.
              </Text>
            </View>
          }
        />
      )}

      {/* Disabled banner when in crisis */}
      {composerDisabled && userState === 'CRISIS' && (
        <View
          style={[
            styles.crisisBanner,
            {backgroundColor: colors.dangerLight},
          ]}>
          <Text style={[styles.crisisBannerText, {color: colors.danger}]}>
            Chat is unavailable during a crisis situation.
          </Text>
        </View>
      )}

      {/* Composer */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceSecondary,
              color: colors.textPrimary,
              opacity: composerDisabled ? 0.4 : 1,
            },
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            composerDisabled ? 'Chat unavailable' : 'Type a message…'
          }
          placeholderTextColor={colors.textTertiary}
          editable={!composerDisabled}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={composerDisabled || !inputText.trim() || isSending}
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                composerDisabled || !inputText.trim()
                  ? colors.border
                  : colors.primary,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{disabled: composerDisabled || !inputText.trim()}}>
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  helpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    minHeight: MIN_TAPPABLE / 1.5,
    justifyContent: 'center',
  },
  helpBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  messageList: {
    paddingVertical: SPACING.md,
    gap: 2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: PAGE_HORIZONTAL_PADDING,
  },
  sessionErrorText: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyChatText: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
  crisisBanner: {
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  crisisBannerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: FONT_SIZE.md,
    maxHeight: 120,
    lineHeight: FONT_SIZE.md * 1.4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
});
