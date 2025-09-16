import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '~/store/auth';
import { account } from '~/lib/appwrite';
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

export default function Repos() {
  const user = useAuthStore((s) => s.user);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  
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

  // Fetch languages for a batch of repos, returning a map of repoId -> sorted top languages
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

  const fetchRepos = useCallback(async () => {
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
          
          // Fetch public repos directly from GitHub API
          if (login) {
            const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=20`);
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
          }
        }
      } catch (e) {
        console.warn('Failed to fetch GitHub data:', e);
      }
    } catch (e: any) {
      console.error('Failed to fetch repos:', e);
    } finally {
      setLoading(false);
    }
  }, [fetchLanguagesForRepos]);

  useEffect(() => {
    if (user) {
      fetchRepos();
    }
  }, [user, fetchRepos]);

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

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 p-6">
        {user ? (
          <>
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-2xl font-bold">Repositories</Text>
              {loading && <ActivityIndicator size="small" />}
              <TouchableOpacity onPress={fetchRepos} className="px-3 py-2 bg-gray-100 rounded-md">
                <Text className="text-xs text-gray-700 font-medium">Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Repositories List */}
            <FlatList
              data={repos}
              renderItem={renderRepo}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                !loading ? (
                  <View className="flex-1 justify-center items-center py-8">
                    <Text className="text-gray-500 text-center">No repositories found</Text>
                  </View>
                ) : null
              }
            />
          </>
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500 text-center">Please sign in to view repositories</Text>
          </View>
        )}
      </View>
    </View>
  );
}