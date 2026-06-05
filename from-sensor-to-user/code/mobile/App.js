import { useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Text } from 'react-native'

import { LoginScreen }       from './src/screens/LoginScreen'
import { useAuthStore }      from './src/store/useAuthStore'
import { DashboardScreen }   from './src/screens/DashboardScreen'
import { EnvironmentScreen } from './src/screens/EnvironmentScreen'
import { DevicesScreen }     from './src/screens/DevicesScreen'
import { AIScreen }          from './src/screens/AIScreen'
import { ControlScreen }     from './src/screens/ControlScreen'
import { useSocket }         from './src/hooks/useSocket'

const Tab = createBottomTabNavigator()

function TabIcon({ icon, color }) {
  return <Text style={{ fontSize: 18, color }}>{icon}</Text>
}

function AppNavigator() {
  useSocket()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#EAEDEA',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor:   '#16A34A',
        tabBarInactiveTintColor: '#9BB09B',
        tabBarLabelStyle: {
          fontFamily: 'monospace',
          fontSize: 9,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen}
        options={{ tabBarLabel: 'dashboard',   tabBarIcon: ({ color }) => <TabIcon icon="⬡" color={color} /> }} />
      <Tab.Screen name="Environment" component={EnvironmentScreen}
        options={{ tabBarLabel: 'environ',     tabBarIcon: ({ color }) => <TabIcon icon="〰" color={color} /> }} />
      <Tab.Screen name="Devices"     component={DevicesScreen}
        options={{ tabBarLabel: 'devices',     tabBarIcon: ({ color }) => <TabIcon icon="◈" color={color} /> }} />
      <Tab.Screen name="AI"          component={AIScreen}
        options={{ tabBarLabel: 'ai_health',   tabBarIcon: ({ color }) => <TabIcon icon="◆" color={color} /> }} />
      <Tab.Screen name="Control"     component={ControlScreen}
        options={{ tabBarLabel: 'control',     tabBarIcon: ({ color }) => <TabIcon icon="⊡" color={color} /> }} />
    </Tab.Navigator>
  )
}

export default function App() {
  const token = useAuthStore((s) => s.token)
  const [ready, setReady] = useState(false)

  if (!token) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LoginScreen onLoginSuccess={() => setReady(true)} />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
