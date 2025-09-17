import { ID, Query, databases, APPWRITE_DATABASE_ID, APPWRITE_PROFILES_COLLECTION_ID, Permission, Role } from '~/lib/appwrite';

export type Profile = {
  $id: string;
  userId: string; // Appwrite user id
  username?: string | null; // GitHub login
  name?: string | null;
  avatarUrl?: string | null;
  points: number; // aka sparks
  lastCommitAt?: string | null; // ISO date

};

// Fields used in collection schema:
// - userId (string, indexed, unique)
// - username (string, indexed)
// - name (string)
// - avatarUrl (string)
// - points (integer)
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
  const now = new Date().toISOString();
  const payload: any = {
    userId,
    points: 0,
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
    updatedAt: new Date().toISOString(),
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

function normalize(doc: any): Profile {
  return {
    $id: doc.$id,
    userId: doc.userId,
    username: doc.username ?? null,
    name: doc.name ?? null,
    avatarUrl: doc.avatarUrl ?? null,
    points: typeof doc.points === 'number' ? doc.points : 0,
    lastCommitAt: doc.lastCommitAt ?? null,

  };
}
