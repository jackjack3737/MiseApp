import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from '../../components/HomeScreen';

const BG_APP = '#FFFFFF';

export default function HomeTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      // Breve delay così AsyncStorage (scritture dal Tracker) è aggiornato prima del refresh
      const t = setTimeout(() => setRefreshKey((k) => k + 1), 150);
      return () => clearTimeout(t);
    }, [])
  );
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={BG_APP} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <HomeScreen refreshKey={refreshKey} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG_APP },
  safe: { flex: 1, backgroundColor: BG_APP },
});
