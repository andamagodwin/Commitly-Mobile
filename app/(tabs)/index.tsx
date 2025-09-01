import { Stack } from 'expo-router';
import { Image, StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '~/store/auth';
import { account } from '~/lib/appwrite';

type GitHubRepo = {
  id: number;
  name: string;
  html_url: string;
  description?: string | null;
  stargazers_count: number;
  language?: string | null;
  updated_at: string;
  private: boolean;
  fork: boolean;
};

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchGithubInfo();
    }
  }, [user]);

  const fetchGithubInfo = async () => {
    try {
      setLoading(true);
      // Get GitHub identity and resolve login
      const identities = await account.listIdentities();
      const gh = (identities as any).identities?.find((i: any) => i.provider === 'github');
      const providerUid = gh?.providerUid as string | undefined;
      
      if (!providerUid) {
        console.warn('No GitHub identity found');
        return;
      }

      // Resolve GitHub username and fetch repos directly from GitHub API
      let login: string | undefined;
      try {
        const userRes = await fetch(`https://api.github.com/user/${providerUid}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          login = userData?.login as string | undefined;
          setGithubLogin(login || null);
          
          // Fetch public repos directly from GitHub API
          if (login) {
            const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=10`);
            if (reposRes.ok) {
              const repoData = await reposRes.json();
              setRepos(repoData as GitHubRepo[]);
            } else {
              console.warn('Failed to fetch repos:', reposRes.status);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch GitHub data:', e);
      }
    } catch (e: any) {
      console.error('Failed to fetch GitHub info:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderRepo = ({ item }: { item: GitHubRepo }) => (
    <View style={styles.repoItem}>
      <View style={styles.repoHeader}>
        <Text style={styles.repoName}>{item.name}</Text>
        <View style={styles.repoMeta}>
          {item.language && <Text style={styles.language}>{item.language}</Text>}
          <Text style={styles.stars}>⭐ {item.stargazers_count}</Text>
        </View>
      </View>
      {item.description && <Text style={styles.repoDesc}>{item.description}</Text>}
      <Text style={styles.updated}>Updated {new Date(item.updated_at).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <View style={styles.container}>
        {user ? (
          <>
            {/* User Profile Section */}
            <View style={styles.profileSection}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : null}
              <View style={styles.userInfo}>
                <Text style={styles.welcomeText}>Welcome, {user.name || 'User'}</Text>
                {user.email && <Text style={styles.email}>{user.email}</Text>}
                {githubLogin && <Text style={styles.githubLogin}>@{githubLogin}</Text>}
              </View>
            </View>

            {/* GitHub Repos Section */}
            <View style={styles.reposSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Repositories</Text>
                {loading && <ActivityIndicator size="small" />}
                {!loading && (
                  <TouchableOpacity onPress={fetchGithubInfo} style={styles.refreshButton}>
                    <Text style={styles.refreshText}>Refresh</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {repos.length > 0 ? (
                <FlatList
                  data={repos}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderRepo}
                  showsVerticalScrollIndicator={false}
                />
              ) : !loading ? (
                <Text style={styles.noRepos}>No repositories found</Text>
              ) : null}
            </View>
          </>
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
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  githubLogin: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  reposSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  refreshText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  repoItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  repoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  repoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  language: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stars: {
    fontSize: 12,
    color: '#6b7280',
  },
  repoDesc: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
    lineHeight: 18,
  },
  updated: {
    fontSize: 12,
    color: '#9ca3af',
  },
  noRepos: {
    textAlign: 'center',
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 32,
  },
});
