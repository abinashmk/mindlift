import {useEffect} from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAppSelector, useAppDispatch} from '@/store';
import {setCrisisFlag} from '@/store/chatSlice';
import {updateUserState} from '@/store/authSlice';
import {MainStackParamList} from '@/types';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

/**
 * Monitors the chat state for a crisis flag and immediately navigates
 * to CrisisScreen with no back navigation allowed.
 *
 * Must be used inside the MainStack navigator.
 */
export function useCrisisGuard() {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NavProp>();
  const crisisFlag = useAppSelector(state => state.chat.crisisFlag);
  const userState = useAppSelector(state => state.auth.userState);

  useEffect(() => {
    if (crisisFlag || userState === 'CRISIS') {
      // Update user state to CRISIS
      if (userState !== 'CRISIS') {
        dispatch(updateUserState('CRISIS'));
      }
      // Replace stack so back navigation is not possible
      navigation.reset({
        index: 0,
        routes: [{name: 'Crisis'}],
      });
    }
  }, [crisisFlag, userState, navigation, dispatch]);

  function triggerCrisis() {
    dispatch(setCrisisFlag(true));
    dispatch(updateUserState('CRISIS'));
    navigation.reset({
      index: 0,
      routes: [{name: 'Crisis'}],
    });
  }

  return {triggerCrisis};
}
