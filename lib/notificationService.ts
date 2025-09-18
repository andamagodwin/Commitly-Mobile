import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationData = {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  priority?: 'low' | 'normal' | 'high';
};

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register for push notifications and get the Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions not granted');
      return null;
    }

    try {
      // Get the Expo push token (projectId is optional for development)
      const token = await Notifications.getExpoPushTokenAsync();

      this.expoPushToken = token.data;
      console.log('📱 Expo Push Token:', token.data);

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      // For development, we can still return a mock token to continue testing
      if (__DEV__) {
        console.warn('Using development mode - push notifications may not work fully');
        const mockToken = 'development-token-' + Date.now();
        this.expoPushToken = mockToken;
        return mockToken;
      }
      return null;
    }
  }

  /**
   * Setup Android notification channel
   */
  private async setupAndroidChannel() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Commitly Notifications',
      description: 'Notifications for commit goals and achievements',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5', // Blue color
      sound: 'default',
    });

    // Additional channels for different types
    await Notifications.setNotificationChannelAsync('goals', {
      name: 'Daily Goals',
      description: 'Notifications about your daily commit goals',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('achievements', {
      name: 'Achievements',
      description: 'Celebrations for reaching milestones',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.sound !== false ? 'default' : undefined,
          priority: this.mapPriority(notification.priority),
        },
        trigger: trigger || null, // null = immediate
      });

      console.log('📅 Local notification scheduled:', identifier);
      return identifier;
    } catch (error) {
      console.error('Error scheduling local notification:', error);
      return null;
    }
  }

  /**
   * Schedule daily goal reminder
   */
  async scheduleDailyGoalReminder(hour = 20, minute = 0) {
    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };

    return this.scheduleLocalNotification(
      {
        title: '🎯 Daily Goal Check!',
        body: 'How are your commits looking today? Keep your streak strong!',
        data: { type: 'daily-reminder' },
      },
      trigger
    );
  }

  /**
   * Send achievement notification
   */
  async sendAchievementNotification(type: 'goal-reached' | 'streak-milestone' | 'points-milestone', data?: any) {
    const notifications = {
      'goal-reached': {
        title: '🎉 Daily Goal Achieved!',
        body: `Amazing! You've reached your daily commit goal. Keep it up!`,
      },
      'streak-milestone': {
        title: '🔥 Streak Milestone!',
        body: `Incredible! You've maintained your commit streak for ${data?.days || 'multiple'} days!`,
      },
      'points-milestone': {
        title: '⚡ Points Milestone!',
        body: `Fantastic! You've earned ${data?.points || 'a lot of'} points!`,
      },
    };

    const notification = notifications[type];
    if (notification) {
      return this.scheduleLocalNotification({
        ...notification,
        data: { type: 'achievement', subtype: type, ...data },
        priority: 'high',
      });
    }
  }

  /**
   * Get current push token
   */
  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('📱 All notifications cancelled');
  }

  /**
   * Cancel specific notification
   */
  async cancelNotification(identifier: string) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log('📱 Notification cancelled:', identifier);
  }

  /**
   * Map priority levels
   */
  private mapPriority(priority?: 'low' | 'normal' | 'high'): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case 'low': return Notifications.AndroidNotificationPriority.LOW;
      case 'high': return Notifications.AndroidNotificationPriority.HIGH;
      default: return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  /**
   * Add notification listeners
   */
  addNotificationListeners(handlers: {
    onNotificationReceived?: (notification: Notifications.Notification) => void;
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void;
  }) {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Notification received:', notification);
      handlers.onNotificationReceived?.(notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📱 Notification response:', response);
      handlers.onNotificationResponse?.(response);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Predefined notification templates for Commitly
export const CommitlyNotifications = {
  dailyGoalReminder: () => notificationService.scheduleDailyGoalReminder(20, 0), // 8 PM daily
  
  goalAchieved: (commits: number) => 
    notificationService.sendAchievementNotification('goal-reached', { commits }),
  
  streakMilestone: (days: number) => 
    notificationService.sendAchievementNotification('streak-milestone', { days }),
  
  pointsMilestone: (points: number) => 
    notificationService.sendAchievementNotification('points-milestone', { points }),
  
  weeklyReview: (commits: number, points: number) =>
    notificationService.scheduleLocalNotification({
      title: '📊 Weekly Review',
      body: `This week: ${commits} commits, ${points} points earned! 🎉`,
      data: { type: 'weekly-review', commits, points }
    }),
};