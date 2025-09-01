import { Stack } from 'expo-router';
import { Image, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '~/store/auth';
import { account } from '~/lib/appwrite';
import Octicons from '@expo/vector-icons/Octicons';
import '../../global.css';

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

type GitHubStreak = {
  totalContributions: number;
  firstContribution: string;
  longestStreak: {
    start: string;
    end: string;
    days: number;
  };
  currentStreak: {
    start: string;
    end: string;
    days: number;
  };
};

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [streak, setStreak] = useState<GitHubStreak | null>(null);

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
            
            // Fetch streak data
            try {
              const streakRes = await fetch(`https://api.franznkemaka.com/github-streak/stats/${encodeURIComponent(login)}`);
              if (streakRes.ok) {
                const streakData = await streakRes.json();
                setStreak(streakData as GitHubStreak);
              } else {
                console.warn('Failed to fetch streak data:', streakRes.status);
              }
            } catch (e) {
              console.warn('Failed to fetch streak data:', e);
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
    <View className="py-3 px-4 mb-2 bg-gray-50 rounded-lg border border-gray-200">
      <View className="flex-row justify-between items-start mb-1">
        <Text className="text-base font-semibold text-gray-900 flex-1">{item.name}</Text>
        <View className="flex-row items-center gap-2">
          {item.language && (
            <Text className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">
              {item.language}
            </Text>
          )}
          <Text className="text-xs text-gray-600">⭐ {item.stargazers_count}</Text>
        </View>
      </View>
      {item.description && (
        <Text className="text-sm text-gray-700 mb-1 leading-5">{item.description}</Text>
      )}
      <Text className="text-xs text-gray-400">
        Updated {new Date(item.updated_at).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: '',
          headerLeft: () => (
            user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} className="w-8 h-8 rounded-full ml-4" />
            ) : null
          ),
          headerTitle: () => (
            <View className="flex-row items-center justify-center flex-1">
              <Octicons name="flame" size={24} color="#f97316" />
              <Text className="text-orange-500 font-bold text-lg ml-2">
                {streak ? streak.currentStreak.days : '0'}
              </Text>
              <Text className="text-gray-500 text-sm ml-2">
                ({streak ? streak.totalContributions : '0'} total)
              </Text>
            </View>
          ),
          headerTitleAlign: 'center' as const,
        }} 
      />
      <View className="flex-1 p-6">
        {user ? (
          <>
            {/* User Profile Section */}
            <View className="flex-row items-center mb-6 pb-4 border-b border-gray-200">
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} className="w-16 h-16 rounded-full mr-4" />
              ) : null}
              <View className="flex-1">
                <Text className="text-xl font-bold mb-1">Welcome, {user.name || 'User'}</Text>
                {user.email && <Text className="text-sm text-gray-500 mb-1">{user.email}</Text>}
                {githubLogin && <Text className="text-sm text-blue-600 font-medium">@{githubLogin}</Text>}
              </View>
            </View>

            {/* GitHub Repos Section */}
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold">Recent Repositories</Text>
                {loading && <ActivityIndicator size="small" />}
                {!loading && (
                  <TouchableOpacity onPress={fetchGithubInfo} className="px-3 py-2 bg-gray-100 rounded-md">
                    <Text className="text-xs text-gray-700 font-medium">Refresh</Text>
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
                <Text className="text-center text-gray-500 italic mt-8">No repositories found</Text>
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
