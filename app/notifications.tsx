import { Stack } from 'expo-router';
import { Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import Octicons from '@expo/vector-icons/Octicons';
import { useAuthStore } from '~/store/auth';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  NotificationData
} from '~/lib/notificationService.appwrite';
import '../global.css';

export default function Notifications() {
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Fetch notifications when component mounts
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const userNotifications = await getUserNotifications(user.id);
        setNotifications(userNotifications);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        Alert.alert('Error', 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user?.id]);



  const handleMarkAsRead = async (notificationId: string) => {
    const success = await markNotificationAsRead(notificationId);
    if (success) {
      setNotifications(prev => 
        prev.map(notif => 
          notif.$id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      setMarkingAllRead(true);
      const success = await markAllNotificationsAsRead(user.id);
      if (success) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true }))
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to mark all notifications as read');
    } finally {
      setMarkingAllRead(false);
    }
  };



  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return { name: 'check-circle' as const, color: '#10b981' };
      case 'warning': return { name: 'alert' as const, color: '#f59e0b' };
      case 'error': return { name: 'x-circle' as const, color: '#ef4444' };
      default: return { name: 'info' as const, color: '#3b82f6' };
    }
  };

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
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
          headerStyle: {
            backgroundColor: '#5e28ca', // Tailwind gray-50
          },
          headerTintColor: '#fff', // Text color
          headerTitleStyle: {
            fontWeight: 'bold',
          }
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          {loading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-gray-500 text-lg font-medium mt-4">
                Loading notifications...
              </Text>
            </View>
          ) : notifications.length > 0 ? (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-900">
                  Recent Notifications ({notifications.filter(n => !n.read).length} unread)
                </Text>
                <TouchableOpacity 
                  onPress={handleMarkAllAsRead}
                  disabled={markingAllRead}
                >
                  <Text className="text-blue-600 text-sm font-medium">
                    {markingAllRead ? 'Marking...' : 'Mark all as read'}
                  </Text>
                </TouchableOpacity>
              </View>

              {notifications.map((notification) => {
                const icon = getNotificationIcon(notification.type);
                
                return (
                  <TouchableOpacity
                    key={notification.$id}
                    className={`mb-3 p-4 rounded-lg border ${
                      notification.read 
                        ? 'bg-white border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                    onPress={() => !notification.read && handleMarkAsRead(notification.$id)}
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
                          {formatTime(notification.createdAt)}
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
