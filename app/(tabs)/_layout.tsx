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
        tabBarHideKeyboard: true, // Evita che il dock salga quando scrivi
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Setup',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Esplora',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color }) => <PlusCircle size={24} color={color} strokeWidth={2.5} />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'Archivio',
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: 'Spesa',
          tabBarIcon: ({ color }) => <ShoppingCart size={22} color={color} />,
        }}
      />

      {/* IL PROFILO È STATO COMPLETAMENTE ELIMINATO DA QUI */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Questa riga nasconde la tab se il file esiste ancora
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000',
    borderTopColor: '#1e1e1e',
    borderTopWidth: 1,
    // ALTEZZA MASSIMA: Alzata per separarla nettamente dai tasti di sistema
    height: Platform.OS === 'ios' ? 110 : 90, 
    // PADDING EXTRA: Spinge il contenuto molto più in alto
    paddingBottom: Platform.OS === 'ios' ? 45 : 30, 
    paddingTop: 10,
    elevation: 10, // Ombra su Android
    position: 'absolute',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
});