import { Stack } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '~/store/auth';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <View style={styles.container}>
        {user ? (
          <View style={{ gap: 12 }}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} />
            ) : null}
            <Text style={{ fontSize: 22, fontWeight: '700' }}>Welcome, {user.name || 'User'}</Text>
            {user.email ? <Text style={{ color: '#555' }}>{user.email}</Text> : null}
            <Text style={{ marginTop: 16 }}>You’re signed in via GitHub (Appwrite).</Text>
          </View>
        ) : (
          <Text>Loading your profile…</Text>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
});
