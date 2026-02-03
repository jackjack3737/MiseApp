import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Home, Search, Calendar, ShoppingCart, PlusCircle } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#00cec9',
        tabBarInactiveTintColor: '#636e72',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideKeyboard: true,
      }}>
      
      {/* 1. SETUP - DEVE ESSERE IL FILE index.tsx */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Setup',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />

      {/* 2. ESPLORA */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Esplora',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />

      {/* 3. TRACKER - L'icona centrale Plus */}
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color }) => <PlusCircle size={26} color={color} strokeWidth={2.5} />,
        }}
      />

      {/* 4. ARCHIVIO */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Storico',
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
        }}
      />

      {/* 5. SPESA */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Spesa',
          tabBarIcon: ({ color }) => <ShoppingCart size={22} color={color} />,
        }}
      />

      {/* FORCE HIDE: Questi file non devono apparire nel dock anche se esistono */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="setup" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000',
    borderTopColor: '#1e1e1e',
    borderTopWidth: 1,
    // ALTEZZA ULTRA: Alzata ulteriormente per distanziarsi dai tasti del telefono
    height: Platform.OS === 'ios' ? 115 : 95, 
    // PADDING INFERIORE: Spinge icone e scritte verso l'alto
    paddingBottom: Platform.OS === 'ios' ? 45 : 35, 
    paddingTop: 12,
    position: 'absolute',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    // Ombra per far fluttuare il dock sul nero
    elevation: 20,
    shadowColor: '#00cec9',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});