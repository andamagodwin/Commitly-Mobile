import 'react-native-url-polyfill/auto';

import { Account, Client, Models } from 'react-native-appwrite';

export const appwriteClient = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '')
  // For React Native, set your application ID (Android package or iOS bundle ID)
  .setPlatform(
    // Fallback to a dummy if not set to avoid runtime undefined, but this should be configured
    (process.env.EXPO_PUBLIC_APPWRITE_PLATFORM_ID as string) || 'com.commitly.app'
  );

export const account = new Account(appwriteClient);

export type AppwriteSession = Models.Session;
export type AppwriteUser = Models.User<Models.Preferences>;
