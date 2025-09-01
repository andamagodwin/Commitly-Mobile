import { Stack } from 'expo-router';
import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import Octicons from '@expo/vector-icons/Octicons';
import '../global.css';

type Notification = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
};

export default function Notifications() {
  // Mock notifications data
  const notifications: Notification[] = [
    {
      id: '1',
      title: 'Welcome to Commitly!',
      message: 'Thanks for joining Commitly. Start tracking your GitHub activity and build better coding habits.',
      timestamp: '2025-09-01T10:00:00Z',
      read: false,
      type: 'info'
    },
    {
      id: '2',
      title: 'GitHub Connected',
      message: 'Your GitHub account has been successfully connected. We can now track your contributions.',
      timestamp: '2025-09-01T09:30:00Z',
      read: true,
      type: 'success'
    },
    {
      id: '3',
      title: 'Streak Alert',
      message: 'Great job! You\'re on a 4-day contribution streak. Keep it up!',
      timestamp: '2025-08-31T18:00:00Z',
      read: true,
      type: 'success'
    },
    {
      id: '4',
      title: 'New Feature Available',
      message: 'Check out the new contributions chart in your profile to visualize your coding activity.',
      timestamp: '2025-08-30T14:00:00Z',
      read: false,
      type: 'info'
    }
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return { name: 'check-circle' as const, color: '#10b981' };
      case 'warning': return { name: 'alert' as const, color: '#f59e0b' };
      case 'error': return { name: 'x-circle' as const, color: '#ef4444' };
      default: return { name: 'info' as const, color: '#3b82f6' };
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {notifications.length > 0 ? (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-900">
                  Recent Notifications
                </Text>
                <TouchableOpacity>
                  <Text className="text-blue-600 text-sm font-medium">
                    Mark all as read
                  </Text>
                </TouchableOpacity>
              </View>

              {notifications.map((notification) => {
                const icon = getNotificationIcon(notification.type);
                
                return (
                  <TouchableOpacity
                    key={notification.id}
                    className={`mb-3 p-4 rounded-lg border ${
                      notification.read 
                        ? 'bg-white border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <View className="flex-row items-start">
                      <View className="mr-3 mt-1">
                        <Octicons 
                          name={icon.name} 
                          size={20} 
                          color={icon.color} 
                        />
                      </View>
                      
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className={`font-semibold ${
                            notification.read ? 'text-gray-900' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </Text>
                          {!notification.read && (
                            <View className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </View>
                        
                        <Text className={`text-sm mb-2 ${
                          notification.read ? 'text-gray-600' : 'text-gray-700'
                        }`}>
                          {notification.message}
                        </Text>
                        
                        <Text className="text-xs text-gray-500">
                          {formatTime(notification.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View className="flex-1 items-center justify-center py-20">
              <Octicons name="bell-slash" size={48} color="#9ca3af" />
              <Text className="text-gray-500 text-lg font-medium mt-4 mb-2">
                No notifications
              </Text>
              <Text className="text-gray-400 text-center px-8">
                You&apos;re all caught up! New notifications will appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
