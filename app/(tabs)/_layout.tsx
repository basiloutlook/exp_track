import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlusCircle, BarChart3 } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom','top']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            borderTopWidth: 0,
            borderTopColor: '#e5e7eb',
            height: 50,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Add Expense',
            tabBarIcon: ({ size, color }) => (
              <PlusCircle size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ size, color }) => (
              <BarChart3 size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}