import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { NotificationService, CommitlyNotifications } from '../../lib/notificationService';
import { useAuthStore } from '../../store/auth';

export default function TestNotifications() {
  const { user } = useAuthStore();
  const [isRegistered, setIsRegistered] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const testNotificationRegistration = async () => {
    try {
      const notificationService = NotificationService.getInstance();
      const token = await notificationService.registerForPushNotifications();
      
      if (token) {
        setIsRegistered(true);
        setPushToken(token);
        Alert.alert('Success', 'Push notifications registered successfully!');
      } else {
        Alert.alert('Error', 'Failed to register for push notifications. Make sure you\'re on a physical device.');
      }
    } catch (error) {
      console.error('Notification registration error:', error);
      Alert.alert('Error', 'Failed to register for push notifications');
    }
  };

  const testLocalNotification = async () => {
    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.scheduleLocalNotification({
        title: 'Test Notification',
        body: 'This is a test notification from Commitly! 🎉',
        data: { screen: 'test' }
      });
      Alert.alert('Success', 'Local notification scheduled! Check your notification panel.');
    } catch (error) {
      console.error('Local notification error:', error);
      Alert.alert('Error', 'Failed to schedule local notification');
    }
  };

  const testAchievementNotification = async () => {
    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.sendAchievementNotification('goal-reached', { commits: 3 });
      Alert.alert('Success', 'Achievement notification sent!');
    } catch (error) {
      console.error('Achievement notification error:', error);
      Alert.alert('Error', 'Failed to send achievement notification');
    }
  };

  const testDailyGoalNotification = async () => {
    try {
      await CommitlyNotifications.goalAchieved(5);
      Alert.alert('Success', 'Daily goal notification sent!');
    } catch (error) {
      console.error('Daily goal notification error:', error);
      Alert.alert('Error', 'Failed to send daily goal notification');
    }
  };

  return (
    <View className="flex-1 bg-gray-900 p-6">
      <Text className="text-white text-2xl font-bold mb-8">Test Notifications</Text>
      
      {user && (
        <View className="mb-6">
          <Text className="text-white mb-2">User: {user.name}</Text>
          <Text className="text-white mb-2">Email: {user.email}</Text>
        </View>
      )}

      <View className="space-y-4">
        <TouchableOpacity
          onPress={testNotificationRegistration}
          className="bg-blue-600 p-4 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            Test Notification Registration
          </Text>
        </TouchableOpacity>

        {isRegistered && (
          <View className="bg-green-800 p-4 rounded-lg">
            <Text className="text-white font-semibold mb-2">✅ Registered!</Text>
            <Text className="text-white text-xs">Token: {pushToken?.slice(0, 20)}...</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={testLocalNotification}
          className="bg-purple-600 p-4 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            Test Local Notification
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={testAchievementNotification}
          className="bg-yellow-600 p-4 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            Test Achievement Notification
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={testDailyGoalNotification}
          className="bg-green-600 p-4 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            Test Daily Goal Notification
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-8 p-4 bg-gray-800 rounded-lg">
        <Text className="text-white font-semibold mb-2">Testing Instructions:</Text>
        <Text className="text-white text-sm mb-1">1. Run this on a physical device (notifications don&apos;t work in simulators)</Text>
        <Text className="text-white text-sm mb-1">2. Test registration first</Text>
        <Text className="text-white text-sm mb-1">3. Try local notifications</Text>
        <Text className="text-white text-sm">4. Check that notifications appear even when app is backgrounded</Text>
      </View>
    </View>
  );
}