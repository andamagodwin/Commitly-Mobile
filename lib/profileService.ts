import { ID, Query, databases, APPWRITE_DATABASE_ID, APPWRITE_PROFILES_COLLECTION_ID, Permission, Role } from '~/lib/appwrite';

export type Profile = {
  $id: string;
  userId: string; // Appwrite user id
  username?: string | null; // GitHub login
  name?: string | null;
  avatarUrl?: string | null;
  points: number; // aka sparks
  todaysCommits: number; // Daily commits count
  dailyGoal: number; // Daily commits goal (default: 5)
  lastCommitAt?: string | null; // ISO date
};

// Fields used in collection schema:
// - userId (string, indexed, unique)
// - username (string, indexed)
// - name (string)
// - avatarUrl (string)
// - points (integer)
// - todaysCommits (integer)
// - dailyGoal (integer, default: 5)
// - lastCommitAt (datetime)

// Note: createdAt is provided by Appwrite system timestamps

export async function getOrCreateProfile(userId: string, data?: Partial<Profile>): Promise<Profile> {
  const db = APPWRITE_DATABASE_ID;
  const col = APPWRITE_PROFILES_COLLECTION_ID;

  // Try to find an existing profile by userId
  const existing = await databases.listDocuments(db, col, [Query.equal('userId', userId), Query.limit(1)]);
  if (existing.total > 0) {
    const doc = existing.documents[0] as any;
    return normalize(doc);
  }

  // Create a new profile with owner permissions
  const payload: any = {
    userId,
    points: 0,
    todaysCommits: 0,
    dailyGoal: 5, // Default daily goal
    lastCommitAt: null,
    ...data,
  };
  const permissions = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
  const created = await databases.createDocument(db, col, ID.unique(), payload, permissions);
  return normalize(created as any);
}

export async function addPoints(userId: string, delta: number, context?: { lastCommitAt?: string }) {
  const db = APPWRITE_DATABASE_ID;
  const col = APPWRITE_PROFILES_COLLECTION_ID;

  const existing = await databases.listDocuments(db, col, [Query.equal('userId', userId), Query.limit(1)]);
  if (existing.total === 0) {
    await getOrCreateProfile(userId, { points: Math.max(0, delta) });
    return;
  }
  const doc = existing.documents[0] as any;
  const newPoints = Math.max(0, (doc.points ?? 0) + delta);
  const updated = await databases.updateDocument(db, col, doc.$id, {
    points: newPoints,
    ...(context?.lastCommitAt ? { lastCommitAt: context.lastCommitAt } : {}),
  });
  return normalize(updated as any);
}

export async function getPoints(userId: string): Promise<number> {
  const db = APPWRITE_DATABASE_ID;
  const col = APPWRITE_PROFILES_COLLECTION_ID;
  const existing = await databases.listDocuments(db, col, [Query.equal('userId', userId), Query.limit(1)]);
  if (existing.total === 0) return 0;
  const doc = existing.documents[0] as any;
  return typeof doc.points === 'number' ? doc.points : 0;
}

export async function awardCommitPoints(userId: string, commitSha?: string): Promise<Profile | null> {
  try {
    const now = new Date().toISOString();
    const updatedProfile = await addPoints(userId, 25, { lastCommitAt: now });
    console.log(`Awarded 25 points to user ${userId} for commit ${commitSha || 'unknown'}`);
    return updatedProfile || null;
  } catch (error) {
    console.error('Failed to award commit points:', error);
    return null;
  }
}

export async function updateDailyGoal(userId: string, newGoal: number): Promise<Profile | null> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_PROFILES_COLLECTION_ID;

    // Validate goal (1-50 commits)
    if (newGoal < 1 || newGoal > 50) {
      throw new Error('Daily goal must be between 1 and 50 commits');
    }

    const existing = await databases.listDocuments(db, col, [Query.equal('userId', userId), Query.limit(1)]);
    if (existing.total === 0) {
      throw new Error('Profile not found');
    }

    const doc = existing.documents[0];
    const updated = await databases.updateDocument(db, col, doc.$id, { dailyGoal: newGoal });
    console.log(`Updated daily goal to ${newGoal} for user ${userId}`);
    return normalize(updated);
  } catch (error) {
    console.error('Failed to update daily goal:', error);
    return null;
  }
}

export async function updateProfileWithGitHubUsername(userId: string, githubUsername: string): Promise<Profile | null> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_PROFILES_COLLECTION_ID;

    const existing = await databases.listDocuments(db, col, [Query.equal('userId', userId), Query.limit(1)]);
    if (existing.total === 0) {
      console.warn('No profile found to update with GitHub username');
      return null;
    }

    const profile = existing.documents[0] as any;
    const updated = await databases.updateDocument(db, col, profile.$id, {
      username: githubUsername,
    });

    console.log(`✅ Updated profile with GitHub username: ${githubUsername}`);
    return normalize(updated as any);
  } catch (error) {
    console.error('Failed to update profile with GitHub username:', error);
    return null;
  }
}

function normalize(doc: any): Profile {
  return {
    $id: doc.$id,
    userId: doc.userId,
    username: doc.username ?? null,
    name: doc.name ?? null,
    avatarUrl: doc.avatarUrl ?? null,
    points: typeof doc.points === 'number' ? doc.points : 0,
    todaysCommits: typeof doc.todaysCommits === 'number' ? doc.todaysCommits : 0,
    dailyGoal: typeof doc.dailyGoal === 'number' ? doc.dailyGoal : 5,
    lastCommitAt: doc.lastCommitAt ?? null,
  };
}
