import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { DS, TYPO } from '../../constants/designSystem';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: DS.accent,
        tabBarInactiveTintColor: DS.tabInactive,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* 1. HOME — "Oggi" */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Oggi',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* 2. DIARIO — "Pasti" (Tracker) */}
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Pasti',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* 3. CORPO — salute e dati (BioStatus) */}
      <Tabs.Screen
        name="biostatus"
        options={{
          title: 'Corpo',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* 4. TU — Profilo */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tu',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Schermate secondarie: nascoste dalla tab bar, raggiungibili via Stack (router.push) */}
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="medical" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: DS.tabBg,
    borderTopColor: DS.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 120 : 96,
    paddingBottom: Platform.OS === 'ios' ? 52 : 36,
    paddingTop: 12,
    position: 'absolute',
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabel: {
    ...TYPO.caption,
  },
});
