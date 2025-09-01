import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { account } from '~/lib/appwrite';
import { useAuthStore } from '~/store/auth';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const rootState = useRootNavigationState();
  const isReady = !!rootState?.key;

  useEffect(() => {
    const run = async () => {
      const userId = (params.userId as string) || '';
      const secret = (params.secret as string) || '';
      if (!userId || !secret) return;
      const session = await account.createSession({ userId, secret });
      const me = await account.get();
      await setAuth(
        { sessionId: session.$id },
        { id: me.$id, name: me.name, email: me.email ?? null, avatarUrl: null }
      );
    // Navigation is handled by auth-based redirects elsewhere
    };
    run();
  }, [params, setAuth]);

  const shouldRedirect = isReady && isAuthenticated;
  return (
    <>
      <Stack.Screen options={{ title: 'Completing sign-in', headerShown: false }} />
      {shouldRedirect ? <Redirect href="/(tabs)" /> : null}
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    </>
  );
}
