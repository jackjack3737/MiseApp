import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BioStatusScreen from '../../components/BioStatusScreen';
import { TRACKER_BLACK } from '../../constants/trackerBlack';

export default function BioStatusTab() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={TRACKER_BLACK.BG} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* HEADER: SX Calendar → History | Titolo | DX hint + Advisor */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/history')}
            style={styles.headerIconBtn}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={24} color={TRACKER_BLACK.TEXT} />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title} numberOfLines={1}>Corpo</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Salute e dati</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/medical')}
              style={styles.advisorBtn}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Ionicons name="medkit-outline" size={24} color={TRACKER_BLACK.ACCENT} />
              <Text style={styles.advisorLabel}>Advisor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* IL COMPONENTE PRINCIPALE CON I 15 ALGORITMI */}
        <BioStatusScreen />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TRACKER_BLACK.BG },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TRACKER_BLACK.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: { padding: 8 },
  headerTitleBlock: { flex: 1, flexDirection: 'column', justifyContent: 'center', minWidth: 0 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  advisorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 115, 232, 0.12)',
  },
  advisorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TRACKER_BLACK.ACCENT,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TRACKER_BLACK.TEXT,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  subtitle: {
    fontSize: 12,
    color: TRACKER_BLACK.TEXT_MUTED,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  });
