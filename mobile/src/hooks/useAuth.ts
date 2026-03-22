import {useAppSelector, useAppDispatch} from '@/store';
import {logout, updateUserState} from '@/store/authSlice';
import {UserState} from '@/types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(state => state.auth);

  function signOut() {
    dispatch(logout());
  }

  function setUserState(state: UserState) {
    dispatch(updateUserState(state));
  }

  const isActive = auth.userState === 'ACTIVE' || auth.userState === 'LIMITED';
  const isOnboarding = auth.userState === 'ONBOARDING';
  const isCrisis = auth.userState === 'CRISIS';

  return {
    ...auth,
    signOut,
    setUserState,
    isActive,
    isOnboarding,
    isCrisis,
  };
}
