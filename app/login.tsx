import { useEffect, useState, useCallback } from 'react';
import { Alert, ActivityIndicator, Platform, View, Image, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { Link, Redirect, Stack, useRootNavigationState } from 'expo-router';

import { Button } from '~/components/Button';
import { Container } from '~/components/Container';
import { useAuthStore } from '~/store/auth';
import { account } from '~/lib/appwrite';
import { OAuthProvider } from 'react-native-appwrite';

export default function Login() {
  const { isLoading, isAuthenticated, hydrate, setAuth } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const rootState = useRootNavigationState();
  const isReady = !!rootState?.key;

  useEffect(() => {
    // Hydrate persisted auth on mount
    hydrate();
  }, [hydrate]);

  const shouldRedirect = isReady && !isLoading && isAuthenticated;

  // success/failure are omitted when using SDK-generated URL on native

  const completeFromUrl = useCallback(
    async (url: string) => {
      // Guard: Only handle OAuth callback once
      if ((completeFromUrl as any)._handledOnce) return;
      const parsed = Linking.parse(url);
      const userId = (parsed.queryParams?.userId as string) || '';
      const secret = (parsed.queryParams?.secret as string) || '';
      const error = parsed.queryParams?.error as string | undefined;
      if (error) {
        Alert.alert('Login failed', 'OAuth was cancelled or failed');
        return;
      }
      if (!userId || !secret) return;
      try {
        setBusy(true);
        // If a session already exists, skip creating a new one
        try {
          const existing = await account.getSession('current');
          if (existing?.$id) {
            const me = await account.get();
            await setAuth(
              { sessionId: existing.$id },
              { id: me.$id, name: me.name, email: me.email ?? null, avatarUrl: null }
            );
            (completeFromUrl as any)._handledOnce = true;
            return;
          }
        } catch {}

        const session = await account.createSession({ userId, secret });
        const me = await account.get();
        await setAuth(
          { sessionId: session.$id },
          { id: me.$id, name: me.name, email: me.email ?? null, avatarUrl: null }
        );
        (completeFromUrl as any)._handledOnce = true;
    // Navigation will happen via the auth-state effect once the root nav is ready
      } catch (e: any) {
        console.error(e);
        Alert.alert('Login failed', e?.message ?? 'Unexpected error');
      } finally {
        setBusy(false);
      }
    },
  [setAuth]
  );

  useEffect(() => {
    // Handle case where app is opened from the deep link while running or cold start
    const sub = Linking.addEventListener('url', ({ url }) => {
      completeFromUrl(url);
    });
    // Also check the initial URL once on mount
    Linking.getInitialURL().then((initial) => {
      if (initial) completeFromUrl(initial);
    });
    return () => sub.remove();
  }, [completeFromUrl]);

  const onLogin = async () => {
    try {
      setBusy(true);
      // Use SDK to generate provider URL with an HTTPS redirect registered in Appwrite (web platform)
      const httpsRedirect = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL;
      if (!httpsRedirect) {
        Alert.alert(
          'Missing OAuth redirect URL',
          'Add a Web Platform in Appwrite and set EXPO_PUBLIC_OAUTH_REDIRECT_URL to an HTTPS page that forwards to commitly://auth-callback.\n\nExample: https://yourdomain.tld/auth-callback'
        );
        return;
      }
      let urlToOpen: string | undefined;
      const res: any = await account.createOAuth2Token({
        provider: OAuthProvider.Github,
        success: httpsRedirect,
        failure: httpsRedirect,
        scopes: ['read:user', 'user:email'],
      });
      urlToOpen = typeof res === 'string' ? res : res?.href || res?.toString?.();
      if (!urlToOpen) throw new Error('Failed to build OAuth URL');
      if (Platform.OS === 'web') {
        (globalThis as any).location.assign(urlToOpen);
      } else {
        await Linking.openURL(urlToOpen);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Login error', e?.message ?? 'Unexpected error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Login' }} />
  {shouldRedirect ? <Redirect href="/(tabs)" /> : null}
      <Container>
        <View className="flex-1 items-center justify-center gap-8">
          <Image source={require('~/assets/icon.png')} style={{ width: 96, height: 96 }} />
          <Text className="text-3xl font-bold">Commitly</Text>
          <Text className="text-center text-gray-500">Sign in to continue</Text>
          <Button
            title={busy ? 'Signing in…' : 'Sign in with GitHub'}
            onPress={onLogin}
            disabled={busy}
            className="w-full max-w-[320px]"
          />
          {Platform.OS === 'web' && (
            <Text className="text-xs text-gray-400">A new tab will open to authenticate</Text>
          )}
          <Link href="/(tabs)" className="text-xs text-gray-400">
            Skip for now
          </Link>
        </View>
      </Container>
      {(isLoading || busy) && (
        <View className="absolute inset-0 items-center justify-center bg-white/50">
          <ActivityIndicator />
        </View>
      )}
    </>
  );
}
