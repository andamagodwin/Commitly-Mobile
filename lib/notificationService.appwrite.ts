import { ID, Query, databases, APPWRITE_DATABASE_ID, Permission, Role } from '~/lib/appwrite';

export type NotificationData = {
  id: string;
  $id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  data?: Record<string, any>; // Additional metadata
};

// Environment variable for notifications collection
const APPWRITE_NOTIFICATIONS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID as string;

/**
 * Fetch notifications for a specific user
 */
export async function getUserNotifications(userId: string, limit: number = 50): Promise<NotificationData[]> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_NOTIFICATIONS_COLLECTION_ID;

    const response = await databases.listDocuments(db, col, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(limit)
    ]);

    return response.documents.map(doc => normalizeNotification(doc as any));
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_NOTIFICATIONS_COLLECTION_ID;

    await databases.updateDocument(db, col, notificationId, {
      read: true
    });

    console.log(`✅ Marked notification ${notificationId} as read`);
    return true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_NOTIFICATIONS_COLLECTION_ID;

    // Get all unread notifications
    const unreadNotifications = await databases.listDocuments(db, col, [
      Query.equal('userId', userId),
      Query.equal('read', false),
      Query.limit(100) // Batch limit
    ]);

    // Update each notification
    const updatePromises = unreadNotifications.documents.map(doc =>
      databases.updateDocument(db, col, doc.$id, { read: true })
    );

    await Promise.all(updatePromises);
    console.log(`✅ Marked ${unreadNotifications.documents.length} notifications as read`);
    return true;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return false;
  }
}

/**
 * Create a new notification (typically called by server functions)
 */
export async function createNotification(
  userId: string, 
  title: string, 
  message: string, 
  type: NotificationData['type'] = 'info',
  data?: Record<string, any>
): Promise<NotificationData | null> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_NOTIFICATIONS_COLLECTION_ID;

    const payload = {
      userId,
      title,
      message,
      type,
      read: false,
      data: data || {}
    };

    const permissions = [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ];

    const created = await databases.createDocument(db, col, ID.unique(), payload, permissions);
    console.log(`✅ Created notification for user ${userId}: ${title}`);
    return normalizeNotification(created as any);
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const db = APPWRITE_DATABASE_ID;
    const col = APPWRITE_NOTIFICATIONS_COLLECTION_ID;

    const response = await databases.listDocuments(db, col, [
      Query.equal('userId', userId),
      Query.equal('read', false),
      Query.limit(1) // We just need the count
    ]);

    return response.total;
  } catch (error) {
    console.error('Failed to get unread notification count:', error);
    return 0;
  }
}

/**
 * Normalize notification document from Appwrite
 */
function normalizeNotification(doc: any): NotificationData {
  return {
    id: doc.$id,
    $id: doc.$id,
    userId: doc.userId,
    title: doc.title,
    message: doc.message,
    type: doc.type || 'info',
    read: doc.read || false,
    createdAt: doc.$createdAt,
    data: doc.data || {}
  };
}