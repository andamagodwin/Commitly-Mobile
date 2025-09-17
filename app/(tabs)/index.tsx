import { Stack, router } from 'expo-router';
import { Image, Text, View, FlatList, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '~/store/auth';
import { account, subscribeToProfileUpdates } from '~/lib/appwrite';
import { getOrCreateProfile, updateProfileWithGitHubUsername } from '~/lib/profileService';
import Octicons from '@expo/vector-icons/Octicons';
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
      } catch (e) {
        console.warn('Failed to load profile points', e);
      }
    };
    run();
  }, [user?.id, user?.name, user?.avatarUrl]);

  // Real-time subscription for point updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 Setting up real-time points subscription...');
    const unsubscribe = subscribeToProfileUpdates(user.id, (newPoints) => {
      console.log('🎉 Points updated in real-time!', newPoints);
      setPoints(newPoints);
      // Optional: Show a toast or animation here
    });

    return () => {
      console.log('🔌 Unsubscribing from real-time updates');
      unsubscribe();
    };
  }, [user?.id]);

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
                <Text className="text-[#f87171] font-semibold">+{points}</Text>
              </View>
              {/* Notifications bell */}
              <TouchableOpacity onPress={() => router.push('/notifications')}>
                <Octicons name="bell" style={{ fontWeight: 'bold' }} size={20} color="black" />
              </TouchableOpacity>
            </View>
          ),
          headerTitleAlign: 'center' as const,
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

            {/* Monthly Contributions Section with paging */}
            <View className="p-4 bg-green-400 rounded-xl mb-6">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-semibold text-white">Monthly Contributions</Text>
                <View className="flex-row items-center">
                  {monthData[currentMonthIndex]?.loading && <ActivityIndicator size="small" />}
                  
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
    </>
  );
}
