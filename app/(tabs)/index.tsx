import { Stack, router } from 'expo-router';
import { Image, Text, View, FlatList, ActivityIndicator, TouchableOpacity, useWindowDimensions, Modal, TextInput, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '~/store/auth';
import { account, subscribeToProfileUpdates } from '~/lib/appwrite';
import { getOrCreateProfile, updateProfileWithGitHubUsername, updateDailyGoal } from '~/lib/profileService';
import Octicons from '@expo/vector-icons/Octicons';
import LottieView from 'lottie-react-native';
import '../../global.css';

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

type ContribWeek = {
  firstDay: string;
  days: { date: string; count: number; color: string }[];
};

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [streak, setStreak] = useState<GitHubStreak | null>(null);
  const [ghLogin, setGhLogin] = useState<string | undefined>(undefined);
  const [ghIdentity, setGhIdentity] = useState<any>(undefined);
  const [points, setPoints] = useState<number>(0);
  const [todaysCommits, setTodaysCommits] = useState<number>(0);
  const [dailyGoal, setDailyGoal] = useState<number>(5);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [newGoalInput, setNewGoalInput] = useState<string>('');
  const [monthPages, setMonthPages] = useState<number[]>([0, 1]); // 0 = current, 1 = previous
  type MonthData = { label: string; total: number; weeks: ContribWeek[]; loading: boolean; error?: string | null };
  const [monthData, setMonthData] = useState<Record<number, MonthData>>({});
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const { width } = useWindowDimensions();
  const horizontalPadding = 24; // matches container p-6
  const itemWidth = Math.max(280, width - horizontalPadding * 2);
  // Contribution cell styling
  const CELL_SIZE = 24;
  const CELL_RADIUS = 4;
  const CELL_GAP = 4;
  const WEEK_GAP = 20;

  // Greeting logic
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning 🌞' : hour < 18 ? 'Good afternoon' : 'Good evening';


  const fetchMonth = useCallback(async (login: string, identity: any, offset: number) => {
    const { from, to, label } = getMonthRange(offset);
    setMonthData((prev) => ({
      ...prev,
      [offset]: { ...(prev[offset] || { weeks: [] as ContribWeek[] }), label, total: prev[offset]?.total || 0, loading: true, error: null },
    }));

    try {
      const token = identity?.providerAccessToken || (process.env.EXPO_PUBLIC_GITHUB_TOKEN as string | undefined);
      if (!token) {
        setMonthData((prev) => ({
          ...prev,
          [offset]: { ...(prev[offset] || { weeks: [] as ContribWeek[] }), label, total: 0, loading: false, error: 'GitHub token not set. Add EXPO_PUBLIC_GITHUB_TOKEN.' },
        }));
        return;
      }

      const query = `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                totalContributions
                weeks { firstDay contributionDays { date color contributionCount } }
              }
            }
          }
        }
      `;

      const body = JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } });
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn('GraphQL error:', res.status, text);
        setMonthData((prev) => ({
          ...prev,
          [offset]: { ...(prev[offset] || { weeks: [] as ContribWeek[] }), label, total: 0, loading: false, error: 'Failed to load contributions.' },
        }));
        return;
      }

      const json = (await res.json()) as any;
      const calendar = json?.data?.user?.contributionsCollection?.contributionCalendar;
      const weeks = calendar?.weeks;
      if (!weeks) {
        setMonthData((prev) => ({
          ...prev,
          [offset]: { ...(prev[offset] || { weeks: [] as ContribWeek[] }), label, total: 0, loading: false, error: 'No contribution data available.' },
        }));
        return;
      }

      const normalized: ContribWeek[] = weeks.map((w: any) => ({
        firstDay: w.firstDay as string,
        days: (w.contributionDays || []).map((d: any) => ({
          date: d.date as string,
          color: (d.color as string) || '#ebedf0',
          count: (d.contributionCount as number) || 0,
        })),
      }));

      setMonthData((prev) => ({
        ...prev,
        [offset]: { label, total: calendar.totalContributions as number, weeks: normalized, loading: false, error: null },
      }));
    } catch (err) {
      console.warn('Failed to fetch contributions:', err);
      setMonthData((prev) => ({
        ...prev,
        [offset]: { ...(prev[offset] || { weeks: [] as ContribWeek[] }), label: (prev[offset]?.label || getMonthRange(offset).label), total: 0, loading: false, error: 'Failed to load contributions.' },
      }));
    }
  }, []);

  const ensureMonthLoaded = useCallback(async (login: string, identity: any, offset: number) => {
    const existing = monthData[offset];
    if (!existing || (existing && !existing.loading && existing.weeks.length === 0 && !existing.error)) {
      await fetchMonth(login, identity, offset);
    }
  }, [monthData, fetchMonth]);

  const fetchGithubInfo = useCallback(async () => {
    try {
      const identities = await account.listIdentities();
      const gh = (identities as any).identities?.find((i: any) => i.provider === 'github');
      const providerUid = gh?.providerUid as string | undefined;
      if (!providerUid) {
        console.warn('No GitHub identity found');
        return;
      }

      let login: string | undefined;
      try {
        const userRes = await fetch(`https://api.github.com/user/${providerUid}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          login = userData?.login as string | undefined;
          if (login) {
            setGhLogin(login);
            setGhIdentity(gh);
            
            // Update profile with GitHub username for webhook integration
            if (user?.id) {
              try {
                await updateProfileWithGitHubUsername(user.id, login);
              } catch (e) {
                console.warn('Failed to update profile with GitHub username:', e);
              }
            }
            
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
            await ensureMonthLoaded(login, gh, 0);
            await ensureMonthLoaded(login, gh, 1);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch GitHub data:', e);
      }
    } catch (e: any) {
      console.error('Failed to fetch GitHub info:', e);
    }
  }, [ensureMonthLoaded, user?.id]);

  // Helpers to compute month ranges and fetch per-month contributions
  const getMonthRange = (offset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(start);
    return { from: start, to: end, label };
  };

  // removed duplicate fetchMonth/ensureMonthLoaded definitions

  // Load data when user becomes available
  useEffect(() => {
    if (user) {
      fetchGithubInfo();
    }
  }, [user, fetchGithubInfo]);

  // Ensure a profile exists and load points for the header
  useEffect(() => {
    const run = async () => {
      try {
        if (!user?.id) return;
        const profile = await getOrCreateProfile(user.id, {
          name: user.name ?? null,
          avatarUrl: user.avatarUrl ?? null,
        });
        setPoints(profile.points ?? 0);
        setTodaysCommits(profile.todaysCommits ?? 0);
        setDailyGoal(profile.dailyGoal ?? 5);
      } catch (e) {
        console.warn('Failed to load profile points', e);
      }
    };
    run();
  }, [user?.id, user?.name, user?.avatarUrl]);

  // Real-time subscription for profile updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 Setting up real-time profile subscription...');
    const unsubscribe = subscribeToProfileUpdates(user.id, (data) => {
      console.log('🎉 Profile updated in real-time!', data);
      setPoints(data.points);
      setTodaysCommits(data.todaysCommits);
      setDailyGoal(data.dailyGoal);
      // Optional: Show a toast or animation here
    });

    return () => {
      console.log('🔌 Unsubscribing from real-time updates');
      unsubscribe();
    };
  }, [user?.id]);

  // Handle goal update
  const handleGoalUpdate = async () => {
    if (!user?.id || !newGoalInput.trim()) return;
    
    const newGoal = parseInt(newGoalInput.trim());
    if (isNaN(newGoal) || newGoal < 1 || newGoal > 50) {
      Alert.alert('Invalid Goal', 'Please enter a number between 1 and 50');
      return;
    }

    try {
      const updatedProfile = await updateDailyGoal(user.id, newGoal);
      if (updatedProfile) {
        setDailyGoal(newGoal);
        setShowGoalModal(false);
        setNewGoalInput('');
        Alert.alert('Success', `Daily goal updated to ${newGoal} commits!`);
      } else {
        Alert.alert('Error', 'Failed to update daily goal');
      }
    } catch {
      Alert.alert('Error', 'Failed to update daily goal');
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Home',
          headerLeft: () => (
            user?.avatarUrl ? (
              <TouchableOpacity onPress={() => router.push('/profile')}>
                <Image source={{ uri: user.avatarUrl }} className="w-8 h-8 rounded-full ml-4" />
              </TouchableOpacity>
            ) : null
          ),
          headerTitle: () => (
            <View className="flex-row items-center justify-space-between flex-1">
              <View className = "flex-row items-center justify-center rounded-full px-3 py-1">
                <Image source={require('../../assets/icons/flame-hot.png')} style={{ width: 30, height: 30 }} />
                <Text className="text-[#FFB74D] font-extrabold text-lg ">
                  {streak ? streak.currentStreak.days : '0'}
                </Text>
              </View>
              
              
            </View>
          ),
          headerRight: () => (
            <View className="flex-row items-center mr-4">
              {/* Bolt icon + points */}
              <View className="flex-row items-center mr-3">
                <Image source={require('../../assets/icons/bolt.png')} style={{ width: 20, height: 20, marginRight: 4 }} />
                <Text className="text-[#f87171] font-extrabold text-lg">+{points}</Text>
              </View>
              {/* Notifications bell */}
              <TouchableOpacity onPress={() => router.push('/notifications')}>
                <Image source={require('../../assets/icons/bell.png')} style={{ width: 20, height: 20, marginRight: 4 }} />
              </TouchableOpacity>

            </View>
          ),
          headerTitleAlign: 'center' as const,
          headerStyle: { backgroundColor: '#5e28ca' },
        }} 
      />


      <View className="flex-1 p-2 bg-white">
        {user ? (
          <>
            {/* Greeting Section */}
            <View className="px-4 py-3 mb-2">
              <Text className="text-2xl">
                {greeting}, {user?.name || (user as any)?.fullName || (user as any)?.username || ghLogin || 'there'}!
              </Text>
              <Text className="text-gray-600 mt-1">Keep your streak strong 🔥</Text>
            </View>

            {/* Daily Commits Card */}
            <TouchableOpacity 
              className="mx-2 p-4 bg-blue-500 rounded-xl mb-4"
              onPress={() => {
                setNewGoalInput(dailyGoal.toString());
                setShowGoalModal(true);
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-3">
                    <LottieView
                      source={require('../../assets/animated/winking-face.json')}
                      autoPlay
                      loop
                      style={{ width: 32, height: 32 }}
                    />
                  </View>
                  <View>
                    <Text className="text-white text-lg font-semibold">Today&apos;s Commits</Text>
                    <Text className="text-blue-100 text-sm">Tap to set goal and track</Text>
                  </View>
                </View>
                <View className="items-center">
                  <Text className="text-white text-3xl font-bold">{todaysCommits}</Text>
                  <Text className="text-blue-100 text-xs">commits</Text>
                </View>
              </View>
              
              {/* Progress indicator */}
              <View className="mt-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-blue-100 text-sm">Daily Goal</Text>
                  <Text className="text-blue-100 text-sm">{todaysCommits}/{dailyGoal}</Text>
                </View>
                <View className="h-2 bg-white/20 rounded-full">
                  <View 
                    className="h-2 bg-white rounded-full" 
                    style={{ width: `${Math.min((todaysCommits / dailyGoal) * 100, 100)}%` }}
                  />
                </View>
                {todaysCommits >= dailyGoal && (
                  <Text className="text-white text-sm font-semibold mt-2">🎉 Daily goal achieved!</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Monthly Contributions Section with paging */}
            <View className="p-4 bg-green-400 rounded-xl mb-6">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-semibold text-white">Monthly Contributions</Text>
                <View className="flex-row items-center">
                  {monthData[currentMonthIndex]?.loading && <ActivityIndicator size="small" />}
                  
                  {/* Test Real-time Button */}
                  {/* <TouchableOpacity onPress={async () => {
                    if (user?.id) {
                      try {
                        console.log('🧪 Testing real-time by adding 25 points...');
                        await addPoints(user.id, 25);
                        console.log('✅ Points added to database');
                      } catch (e) {
                        console.error('❌ Failed to add points:', e);
                      }
                    }
                  }} className="px-3 py-2 bg-yellow-400 rounded-md mr-2">
                    <Text className="text-xs font-semibold text-black">Test +25</Text>
                  </TouchableOpacity> */}
                  
                  {/* Sync Button */}
                  <TouchableOpacity onPress={() => {
                    if (ghLogin && ghIdentity) {
                      fetchMonth(ghLogin, ghIdentity, currentMonthIndex);
                    } else {
                      fetchGithubInfo();
                    }
                  }} className="px-3 py-2 bg-white rounded-md">
                    <Octicons name="sync" size={20} color="black" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <FlatList
                data={monthPages}
                keyExtractor={(o) => `month-${o}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={itemWidth}
                snapToAlignment="start"
                getItemLayout={(_data, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(x / itemWidth);
                  if (!Number.isNaN(idx)) {
                    setCurrentMonthIndex(idx);
                    // Append next previous month when reaching last loaded page
                    const max = monthPages.length ? Math.max(...monthPages) : 0;
                    if (idx >= max) {
                      const next = max + 1;
                      setMonthPages((prev) => (prev.includes(next) ? prev : [...prev, next]));
                      if (ghLogin && ghIdentity) {
                        fetchMonth(ghLogin, ghIdentity, next);
                      }
                    }
                  }
                }}
                renderItem={({ item: offset }) => {
                  const data = monthData[offset];
                  const placeholderLabel = getMonthRange(offset).label;
                  return (
                    <View style={{ width: itemWidth }}>
                      <View className="flex-row items-center mb-2">
                        <Text className="text-base text-white font-semibold">
                          {data?.label || placeholderLabel}
                        </Text>
                        <Text className="text-sm text-white ml-2">
                          {typeof data?.total === 'number' ? `(${data.total})` : ''}
                        </Text>
                      </View>

                      {data?.loading && (
                        <ActivityIndicator size="small" />
                      )}
                      {data?.error && !data.loading && (
                        <Text className="text-gray-500 text-sm italic">{data.error}</Text>
                      )}
                      {!data?.loading && !data?.error && (data?.weeks?.length || 0) > 0 && (
                        <View className="flex-row pr-2">
                          {data!.weeks.map((week, wi) => (
                            <View key={week.firstDay + wi} style={{ marginRight: WEEK_GAP }}>
                              {week.days.map((day) => {
                                const bg = day.color || '#ebedf0';
                                const border = day.count > 0 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.06)';
                                return (
                                  <View
                                    key={day.date}
                                    style={{
                                      backgroundColor: bg,
                                      width: CELL_SIZE,
                                      height: CELL_SIZE,
                                      borderRadius: CELL_RADIUS,
                                      marginBottom: CELL_GAP,
                                      borderWidth: 1,
                                      borderColor: border,
                                    }}
                                    accessibilityLabel={`${day.date}: ${day.count} contributions`}
                                  />
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            </View>
          </>
        ) : (
          <Text>Loading your profile…</Text>
        )}
      </View>

      {/* Goal Setting Modal */}
      <Modal
        visible={showGoalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-xl p-6 mx-4 w-80">
            <Text className="text-xl font-bold text-gray-800 mb-4">Set Daily Goal</Text>
            <Text className="text-gray-600 mb-4">How many commits do you want to make daily?</Text>
            
            <TextInput
              value={newGoalInput}
              onChangeText={setNewGoalInput}
              placeholder="Enter goal (1-50)"
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg p-3 mb-4"
              autoFocus={true}
              selectTextOnFocus={true}
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-lg p-3"
                onPress={() => {
                  setShowGoalModal(false);
                  setNewGoalInput('');
                }}
              >
                <Text className="text-gray-800 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-blue-500 rounded-lg p-3"
                onPress={handleGoalUpdate}
              >
                <Text className="text-white text-center font-semibold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
