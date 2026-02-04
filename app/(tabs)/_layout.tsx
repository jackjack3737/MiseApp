import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Search, ShoppingCart, PlusCircle, Stethoscope, Calendar, Home } from 'lucide-react-native';

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
      
      {/* 1. ESPLORA (Ricette e Nutrizione) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Esplora',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />

      {/* 2. BIO-ADVISOR (Il Medico AI - Gemini) */}
      <Tabs.Screen
        name="medical"
        options={{
          title: 'Advisor',
          tabBarIcon: ({ color }) => <Stethoscope size={22} color={color} />,
        }}
      />

      {/* 3. TRACKER - L'azione centrale */}
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color }) => <PlusCircle size={28} color={color} strokeWidth={2.5} />,
        }}
      />

      {/* 4. STORICO (Calendario dei pasti e bio-metriche) */}
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

      {/* HIDE: Setup e Index non appaiono nel dock */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="setup" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000',
    borderTopColor: '#1e1e1e',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 115 : 95, 
    paddingBottom: Platform.OS === 'ios' ? 45 : 35, 
    paddingTop: 12,
    position: 'absolute',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 20,
    shadowColor: '#00cec9',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});