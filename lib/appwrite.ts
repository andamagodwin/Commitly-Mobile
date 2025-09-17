import 'react-native-url-polyfill/auto';

import { Account, Client, Databases, ID, Models, Query, Permission, Role } from 'react-native-appwrite';

export const appwriteClient = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '')
  // For React Native, set your application ID (Android package or iOS bundle ID)
  .setPlatform(
    // Fallback to a dummy if not set to avoid runtime undefined, but this should be configured
    (process.env.EXPO_PUBLIC_APPWRITE_PLATFORM_ID as string) || 'com.commitly.app'
  );

export const account = new Account(appwriteClient);

// Databases client and environment-configured IDs
export const databases = new Databases(appwriteClient);
export const APPWRITE_DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID as string;
export const APPWRITE_PROFILES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID as string;

export { ID, Query };
export { Permission, Role };

export type AppwriteSession = Models.Session;
export type AppwriteUser = Models.User<Models.Preferences>;
