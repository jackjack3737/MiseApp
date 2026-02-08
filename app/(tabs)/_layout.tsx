import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Search, ShoppingCart, PlusCircle, Stethoscope, Calendar } from 'lucide-react-native';

const TECH_GREEN = '#39FF14'; // Il tuo nuovo verde tecnico

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: TECH_GREEN, // CAMBIATO DA AZZURRO A VERDE
        tabBarInactiveTintColor: '#2d5a27', // Un verde molto scuro per le icone inattive
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideKeyboard: true,
      }}>
      
      {/* 1. ESPLORA */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Esplora',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />

      {/* 2. BIO-ADVISOR */}
      <Tabs.Screen
        name="medical"
        options={{
          title: 'Advisor',
          tabBarIcon: ({ color }) => <Stethoscope size={22} color={color} />,
        }}
      />

      {/* 3. TRACKER */}
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color }) => <PlusCircle size={28} color={color} strokeWidth={2.5} />,
        }}
      />

      {/* 4. STORICO */}
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

      {/* HIDE: Setup e Index */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="setup" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000',
    borderTopColor: '#1b3517', // Bordo verde scurissimo
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 115 : 95, 
    paddingBottom: Platform.OS === 'ios' ? 45 : 35, 
    paddingTop: 12,
    position: 'absolute',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 20,
    shadowColor: TECH_GREEN, // CAMBIATO DA AZZURRO A VERDE
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Font tecnico anche nelle Tab
  },
});