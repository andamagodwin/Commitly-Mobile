import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { account, appwriteClient } from '~/lib/appwrite';
import { useAuthStore } from '~/store/auth';
import { Databases, Permission, Role, Models } from 'react-native-appwrite';

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
      // Try to enrich with GitHub avatar via identities (providerUid)
      let avatarUrl: string | null = null;
      try {
        const identities = await account.listIdentities();
        const gh = identities.identities?.find((i: any) => i.provider === 'github');
        const providerUid = gh?.providerUid as string | undefined;
        if (providerUid) {
          avatarUrl = `https://avatars.githubusercontent.com/u/${providerUid}`;
        }
      } catch {}

      // Optionally upsert a profile document if env vars are present
      const dbId = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
      const collId = process.env.EXPO_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID;
      if (dbId && collId) {
        try {
          const databases = new Databases(appwriteClient);
          // Attempt to fetch existing profile
          let existing: Models.Document | null = null;
          try {
            existing = await databases.getDocument(dbId, collId, me.$id);
          } catch (e: any) {
            if (e?.code !== 404) throw e;
          }
          const data = {
            name: me.name,
            email: me.email ?? null,
            avatarUrl,
            provider: 'github',
          } as any;
          if (existing) {
            await databases.updateDocument(dbId, collId, me.$id, data);
          } else {
            await databases.createDocument(dbId, collId, me.$id, data, [
              Permission.read(Role.user(me.$id)),
              Permission.update(Role.user(me.$id)),
            ]);
          }
        } catch (e) {
          // Non-fatal; proceed
          console.warn('Profile upsert failed:', (e as any)?.message ?? e);
        }
      }

      await setAuth(
        { sessionId: session.$id },
        { id: me.$id, name: me.name, email: me.email ?? null, avatarUrl }
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
