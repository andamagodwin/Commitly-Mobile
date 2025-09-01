import { Redirect, Tabs, useRootNavigationState } from 'expo-router';

import { useAuthStore } from '~/store/auth';
import Octicons from '@expo/vector-icons/Octicons';

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const rootState = useRootNavigationState();
  const isReady = !!rootState?.key;
  const shouldRedirect = isReady && !isAuthenticated;
  return (
    <>
      {shouldRedirect ? <Redirect href="/login" /> : null}
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'black',
        tabBarStyle: { borderTopColor: '#000000', borderTopWidth: 0.5 },
        headerShadowVisible: false,

      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Octicons name="home" color={color} size={24} />,
          headerShadowVisible: false
        }}
      />
      <Tabs.Screen
        name="habit"
        options={{
          title: 'Habit',
          tabBarIcon: ({ color }) => <Octicons name="clock" color={color} size={24} />,
        }}
      />
  </Tabs>
  </>
  );
}
