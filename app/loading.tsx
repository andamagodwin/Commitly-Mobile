import { View, ActivityIndicator } from 'react-native';
import '../global.css';

export default function LoadingScreen() {
  return (
    <View className="flex-1 bg-white justify-center items-center">
      <View className="items-center">
        
        
      
        
        {/* Loading spinner */}
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    </View>
  );
}