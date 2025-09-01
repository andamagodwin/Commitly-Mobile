import { Stack, router } from 'expo-router';
import { Image, Text, View, FlatList, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
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

type ContribWeek = {
  firstDay: string;
  days: { date: string; count: number; color: string }[];
};

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState<GitHubStreak | null>(null);
  const [ghLogin, setGhLogin] = useState<string | undefined>(undefined);
  const [ghIdentity, setGhIdentity] = useState<any>(undefined);
  const [monthPages, setMonthPages] = useState<number[]>([0, 1]); // 0 = current, 1 = previous
  type MonthData = { label: string; total: number; weeks: ContribWeek[]; loading: boolean; error?: string | null };
  const [monthData, setMonthData] = useState<Record<number, MonthData>>({});
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const { width } = useWindowDimensions();
  const horizontalPadding = 24; // matches container p-6
  const itemWidth = Math.max(280, width - horizontalPadding * 2);


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
      setLoading(true);
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
            const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=10`);
            if (reposRes.ok) {
              const repoData = await reposRes.json();
              setRepos(repoData as GitHubRepo[]);
            } else {
              console.warn('Failed to fetch repos:', reposRes.status);
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
    } finally {
      setLoading(false);
    }
  }, [ensureMonthLoaded]);

  // Helpers to compute month ranges and fetch per-month contributions
  const getMonthRange = (offset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(start);
    return { from: start, to: end, label };
  };

  // removed duplicate fetchMonth/ensureMonthLoaded definitions

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

  // Load data when user becomes available
  useEffect(() => {
    if (user) {
      fetchGithubInfo();
    }
  }, [user, fetchGithubInfo]);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: '',
          headerLeft: () => (
            user?.avatarUrl ? (
              <TouchableOpacity onPress={() => router.push('/profile')}>
                <Image source={{ uri: user.avatarUrl }} className="w-8 h-8 rounded-full ml-4" />
              </TouchableOpacity>
            ) : null
          ),
          headerTitle: () => (
            <View className="flex-row items-center justify-center flex-1">
              <Octicons name="flame" size={16} color="black" />
              <Text className="text-black font-bold text-lg ml-2">
                {streak ? streak.currentStreak.days : '0'}
              </Text>
              <Text className="text-black text-sm ml-2">
                ({streak ? streak.totalContributions : '0'} total)
              </Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/notifications')}
              className="mr-4"
            >
              <Octicons name="bell" size={20} color="black" />
            </TouchableOpacity>
          ),
          headerTitleAlign: 'center' as const,
        }} 
      />
      <View className="flex-1 p-6">
        {user ? (
          <>
            {/* Monthly Contributions Section with paging */}
            <View className="mb-8">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-bold">Contributions</Text>
                <View className="flex-row items-center">
                  {monthData[currentMonthIndex]?.loading && <ActivityIndicator size="small" />}
                  <TouchableOpacity onPress={() => {
                    if (ghLogin && ghIdentity) {
                      fetchMonth(ghLogin, ghIdentity, currentMonthIndex);
                    } else {
                      fetchGithubInfo();
                    }
                  }} className="ml-3 px-3 py-2 bg-gray-100 rounded-md">
                    <Text className="text-xs text-gray-700 font-medium">Refresh</Text>
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
                        <Text className="text-base font-semibold">
                          {data?.label || placeholderLabel}
                        </Text>
                        <Text className="text-sm text-gray-600 ml-2">
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
                            <View key={week.firstDay + wi} className="mr-1">
                              {week.days.map((day) => (
                                <View
                                  key={day.date}
                                  style={{
                                    backgroundColor: day.color || '#ebedf0',
                                    width: 12,
                                    height: 12,
                                    borderRadius: 2,
                                    marginBottom: 4,
                                  }}
                                  accessibilityLabel={`${day.date}: ${day.count} contributions`}
                                />
                              ))}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                }}
              />
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
