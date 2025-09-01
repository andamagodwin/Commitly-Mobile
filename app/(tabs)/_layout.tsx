import { Link, Redirect, Tabs, useRootNavigationState } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

import { HeaderButton } from '../../components/HeaderButton';
import { TabBarIcon } from '../../components/TabBarIcon';
import { useAuthStore } from '~/store/auth';

export default function TabLayout() {
  const signOut = useAuthStore((s) => s.signOut);
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <HeaderButton />
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
          headerRight: () => (
            <TouchableOpacity onPress={signOut} style={{ paddingRight: 12 }}>
              <Text>Sign out</Text>
            </TouchableOpacity>
          ),
        }}
      />
  </Tabs>
  </>
  );
}
