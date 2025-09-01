import { Stack, router } from 'expo-router';
import { Image, Text, View, FlatList, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
  owner: { login: string };
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
  // Contribution cell styling
  const CELL_SIZE = 16;
  const CELL_RADIUS = 4;
  const CELL_GAP = 5;
  const WEEK_GAP = 6;
  // Repo languages map: repoId -> top languages
  const [repoLanguages, setRepoLanguages] = useState<Record<number, { name: string; color: string; bytes: number }[]>>({});
  const languageColors = useMemo<Record<string, string>>(() => ({
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Ruby: '#701516',
    PHP: '#4F5D95',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    Rust: '#DEA584',
    Shell: '#89e051',
    Scala: '#c22d40',
    HTML: '#e34c26',
    CSS: '#563d7c',
    SCSS: '#c6538c',
    Vue: '#41B883',
    Svelte: '#ff3e00',
    R: '#198CE7',
    Elixir: '#6e4a7e',
    Haskell: '#5e5086',
    'Objective-C': '#438eff',
    Zig: '#ec915c',
    Lua: '#000080',
    Perl: '#0298c3',
    GLSL: '#5686ae',
    Solidity: '#AA6746',
    TeX: '#3D6117',
  }), []);
  const getLangAbbrev = (name: string) => {
    const map: Record<string, string> = { TypeScript: 'TS', JavaScript: 'JS', Python: 'PY', 'C++': 'C++', 'C#': 'C#' };
    return map[name] || (name.length <= 3 ? name.toUpperCase() : name.slice(0, 2).toUpperCase());
  };


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

  const fetchLanguagesForRepos = useCallback(async (reposList: GitHubRepo[]) => {
    const entries = await Promise.all(
      reposList.map(async (r) => {
        try {
          const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(r.owner.login)}/${encodeURIComponent(r.name)}/languages`);
          if (!res.ok) return [r.id, []] as const;
          const json = (await res.json()) as Record<string, number>;
          const items = Object.entries(json)
            .map(([name, bytes]) => ({ name, bytes, color: languageColors[name] || '#9ca3af' }))
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 3);
          return [r.id, items] as const;
        } catch {
          return [r.id, []] as const;
        }
      })
    );
    return Object.fromEntries(entries) as Record<number, { name: string; color: string; bytes: number }[]>;
  }, [languageColors]);

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
              // Fetch languages for these repos in background
              try {
                const langs = await fetchLanguagesForRepos(repoData as GitHubRepo[]);
                setRepoLanguages(langs);
              } catch (e) {
                console.warn('Failed to fetch repo languages:', e);
              }
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
  }, [ensureMonthLoaded, fetchLanguagesForRepos]);

  // Helpers to compute month ranges and fetch per-month contributions
  const getMonthRange = (offset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(start);
    return { from: start, to: end, label };
  };

  // removed duplicate fetchMonth/ensureMonthLoaded definitions

  const renderRepo = ({ item }: { item: GitHubRepo }) => {
    const langs = repoLanguages[item.id];
    return (
      <View className="py-3 px-4 mb-2 bg-gray-50 rounded-lg border border-gray-200">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="text-base font-semibold text-gray-900 flex-1">{item.name}</Text>
          <View className="flex-row items-center">
            {/* Stacked language badges */}
            {Array.isArray(langs) && langs.length > 0 ? (
              <View className="flex-row items-center" style={{ marginRight: 6 }}>
                {langs.map((l, i) => (
                  <View
                    key={l.name + i}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: l.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: i === 0 ? 0 : -6,
                      borderWidth: 2,
                      borderColor: '#fff',
                    }}
                    accessibilityLabel={`${l.name}`}
                  >
                    <Text className="text-[8px] text-white font-bold">{getLangAbbrev(l.name)}</Text>
                  </View>
                ))}
              </View>
            ) : item.language ? (
              <View className="flex-row items-center" style={{ marginRight: 6 }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: languageColors[item.language] || '#9ca3af',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                  accessibilityLabel={`${item.language}`}
                >
                  <Text className="text-[8px] text-white font-bold">{getLangAbbrev(item.language)}</Text>
                </View>
              </View>
            ) : null}
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
  };

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
          title: 'Home',
          headerLeft: () => (
            user?.avatarUrl ? (
              <TouchableOpacity onPress={() => router.push('/profile')}>
                <Image source={{ uri: user.avatarUrl }} className="w-8 h-8 rounded-full ml-4" />
              </TouchableOpacity>
            ) : null
          ),
          headerTitle: () => (
            <View className="flex-row items-center justify-center flex-1">
              <Image source={require('../../assets/icons/fire.png')} style={{ width: 16, height: 16 }} />
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
      <View className="flex-1 p-2 bg-gray-50">
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

            {/* GitHub Repos Section */}
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-2">
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
