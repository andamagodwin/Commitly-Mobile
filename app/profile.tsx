import { Stack, router } from 'expo-router';
import { Image, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useAuthStore } from '~/store/auth';
import { account } from '~/lib/appwrite';
import { useEffect, useState } from 'react';
import Octicons from '@expo/vector-icons/Octicons';
import '../global.css';

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

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [streak, setStreak] = useState<GitHubStreak | null>(null);
  const [loading, setLoading] = useState(false);

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

      // Resolve GitHub username
      try {
        const userRes = await fetch(`https://api.github.com/user/${providerUid}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          const login = userData?.login as string | undefined;
          setGithubLogin(login || null);
          
          // Fetch streak data
          if (login) {
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

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Profile',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView className="flex-1 bg-white">
        <View className="p-6">
          {user ? (
            <>
              {/* Profile Header */}
              <View className="items-center mb-8">
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} className="w-24 h-24 rounded-full mb-4" />
                ) : (
                  <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center mb-4">
                    <Text className="text-gray-500 text-2xl">👤</Text>
                  </View>
                )}
                <Text className="text-2xl font-bold text-gray-900 mb-2">
                  {user.name || 'User'}
                </Text>
                {user.email && (
                  <Text className="text-gray-600 mb-2">{user.email}</Text>
                )}
                {githubLogin && (
                  <Text className="text-blue-600 font-medium">@{githubLogin}</Text>
                )}
              </View>

              {/* GitHub Stats */}
              {streak && (
                <View className="bg-gray-50 rounded-lg p-4 mb-6">
                  <Text className="text-lg font-bold text-gray-900 mb-4">GitHub Activity</Text>
                  
                  <View className="flex-row justify-between mb-4">
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-orange-500">{streak.currentStreak.days}</Text>
                      <Text className="text-gray-600 text-sm">Current Streak</Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-green-500">{streak.longestStreak.days}</Text>
                      <Text className="text-gray-600 text-sm">Longest Streak</Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-blue-500">{streak.totalContributions}</Text>
                      <Text className="text-gray-600 text-sm">Total Contributions</Text>
                    </View>
                  </View>

                  <View className="border-t border-gray-200 pt-4">
                    <Text className="text-sm text-gray-600">
                      First contribution: {new Date(streak.firstContribution).toLocaleDateString()}
                    </Text>
                    {streak.currentStreak.days > 0 && (
                      <Text className="text-sm text-gray-600">
                        Current streak: {new Date(streak.currentStreak.start).toLocaleDateString()} - {new Date(streak.currentStreak.end).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Account Actions */}
              <View className="space-y-4">
                <TouchableOpacity 
                  onPress={fetchGithubInfo}
                  className="bg-blue-500 rounded-lg p-4 flex-row items-center justify-center"
                  disabled={loading}
                >
                  <Octicons name="sync" size={20} color="white" />
                  <Text className="text-white font-medium ml-2">
                    {loading ? 'Refreshing...' : 'Refresh GitHub Data'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogout}
                  className="bg-red-500 rounded-lg p-4 flex-row items-center justify-center"
                >
                  <Octicons name="sign-out" size={20} color="white" />
                  <Text className="text-white font-medium ml-2">Sign Out</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View className="items-center justify-center flex-1 min-h-96">
              <Text className="text-gray-500">Loading profile...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
