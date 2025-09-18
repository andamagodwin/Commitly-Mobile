import '../global.css';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '~/store/auth';
import LoadingScreen from './loading';
import { notificationService } from '~/lib/notificationService';
import { updatePushToken } from '~/lib/profileService';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
};

export default function RootLayout() {
  // ensure store initializes early (esp. web refresh)
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Setup notifications when user is available
  useEffect(() => {
    if (!user?.id) return;

    const setupNotifications = async () => {
      try {
        // Register for push notifications
        const token = await notificationService.registerForPushNotifications();
        
        if (token && user?.id) {
          // Save token to user profile
          await updatePushToken(user.id, token);
          console.log('✅ Push token saved to profile');
        }

        // Setup notification listeners
        const removeListeners = notificationService.addNotificationListeners({
          onNotificationReceived: (notification) => {
            console.log('📱 Notification received in app:', notification.request.content);
          },
          onNotificationResponse: (response) => {
            console.log('📱 User interacted with notification:', response.notification.request.content);
            // Handle notification tap - could navigate to specific screens
            const data = response.notification.request.content.data;
            if (data?.type === 'achievement') {
              // Could navigate to achievements screen
              console.log('Achievement notification tapped');
            }
          },
        });

        // Cleanup listeners when component unmounts
        return removeListeners;
      } catch (error) {
        console.error('Error getting push token:', error);
        // Continue without push notifications - app should still work
      }
    };

    setupNotifications();
  }, [user?.id]);

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
