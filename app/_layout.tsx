import '../global.css';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '~/store/auth';
import LoadingScreen from './loading';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
};

export default function RootLayout() {
  // ensure store initializes early (esp. web refresh)
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Show loading screen during auth hydration
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="loading" options={{ headerShown: false }} />
    </Stack>
  );
}
