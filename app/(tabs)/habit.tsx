import { Stack } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { useAuthStore } from '~/store/auth';
import { account, appwriteClient } from '~/lib/appwrite';
import { Functions } from 'react-native-appwrite';

export default function Settings() {
  const signOut = useAuthStore((s) => s.signOut);
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<{ name: string; html_url: string; description?: string | null }[]>([]);

  const onFetchRepos = async () => {
    try {
      setLoading(true);
      // Resolve GitHub login via provider UID if possible
      const identities = await account.listIdentities();
      const gh = (identities as any).identities?.find((i: any) => i.provider === 'github');
      const providerUid = gh?.providerUid as string | undefined;
      if (!providerUid) {
        Alert.alert('GitHub not linked', 'No GitHub identity found for this user.');
        return;
      }
      let login: string | undefined;
      try {
        const res = await fetch(`https://api.github.com/user/${providerUid}`);
        if (res.ok) {
          const data = await res.json();
          login = data?.login as string | undefined;
        }
      } catch {}
      if (!login) {
        Alert.alert(
          'Cannot resolve GitHub username',
          'Please add your GitHub username in your profile or try again later.'
        );
        return;
      }
      const functionId = process.env.EXPO_PUBLIC_APPWRITE_FUNCTION_GH_REPOS_ID;
      if (!functionId) {
        Alert.alert('Missing function ID', 'Set EXPO_PUBLIC_APPWRITE_FUNCTION_GH_REPOS_ID in .env');
        return;
      }
      // Authenticate the function call with a JWT
      const jwt = await account.createJWT();
      appwriteClient.setJWT(jwt.jwt);
      const functions = new Functions(appwriteClient);
      const exec = await functions.createExecution(functionId, JSON.stringify({ login }));
      const output = exec.responseBody ? JSON.parse(exec.responseBody) : [];
      setRepos(output as any[]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Fetch failed', e?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Stack.Screen options={{ title: 'Habit' }} />
      <View style={styles.container}>
        <Text style={styles.heading}>Account</Text>
        <TouchableOpacity onPress={signOut} style={styles.button}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={[styles.heading, { marginTop: 24 }]}>GitHub</Text>
        <TouchableOpacity onPress={onFetchRepos} style={styles.buttonSecondary} disabled={loading}>
          <Text style={styles.buttonSecondaryText}>{loading ? 'Fetching…' : 'Fetch my public repos'}</Text>
        </TouchableOpacity>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : (
          <FlatList
            style={{ marginTop: 12 }}
            data={repos}
            keyExtractor={(item) => item.html_url}
            renderItem={({ item }) => (
              <View style={styles.repoItem}>
                <Text style={styles.repoName}>{item.name}</Text>
                {item.description ? <Text style={styles.repoDesc}>{item.description}</Text> : null}
                <Text style={styles.repoLink}>{item.html_url}</Text>
              </View>
            )}
          />
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
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  button: {
    backgroundColor: 'black',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#eef2ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonSecondaryText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  repoItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  repoName: { fontWeight: '700' },
  repoDesc: { color: '#555' },
  repoLink: { color: '#2563eb' },
});
