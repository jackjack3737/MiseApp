import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
  label: string;
  current: number;
  target: number;
  color: string;
}

export const SegmentedBar = ({ label, current, target, color }: Props) => {
  const segments = 15; // Numero di LED
  const progress = Math.min(current / target, 1);
  const activeSegments = Math.floor(progress * segments);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.values}>{current} / {target}g</Text>
      </View>
      <View style={styles.barContainer}>
        {[...Array(segments)].map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.segment, 
              { backgroundColor: i < activeSegments ? color : '#1A1A1A' }
            ]} 
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  values: { color: '#FFF', fontSize: 14, fontFamily: 'SpaceMono_400Regular' }, // Qui useremo il font mono
  barContainer: { flexDirection: 'row', gap: 4, height: 12 },
  segment: { flex: 1, borderRadius: 1 },
});