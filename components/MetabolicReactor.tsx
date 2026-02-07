import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReactorProps {
  baseTarget: number;    // Es: 20g
  currentCarbs: number;  // Es: 15g mangiati
  stepsBonus: number;    // Es: +12g da passi
  sportBonus: number;    // Es: +25g da corsa
}

export default function MetabolicReactor({ baseTarget, currentCarbs, stepsBonus, sportBonus }: ReactorProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calcoli Totali
  const totalLimit = baseTarget + stepsBonus + sportBonus;
  const safeCap = 50; // Limite sicurezza (metti 60 o quello che vuoi)
  
  // Se c'è sport intenso (sportBonus > 0), il CAP viene ignorato per il recupero
  const effectiveLimit = sportBonus > 5 ? totalLimit : Math.min(totalLimit, safeCap);
  
  const progressPercent = Math.min((currentCarbs / effectiveLimit) * 100, 100);
  const isOverdrive = sportBonus > 0;

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={0.9} 
      onPress={() => setShowDetails(!showDetails)}
    >
      {/* Intestazione */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>NET CARBS</Text>
          <Text style={styles.subtitle}>
            {isOverdrive ? '⚡ OVERDRIVE ATTIVO' : 'METABOLISMO DINAMICO'}
          </Text>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={styles.bigValue}>{currentCarbs}g <Text style={styles.limit}>/ {effectiveLimit}g</Text></Text>
        </View>
      </View>

      {/* Barra Principale (Il Reattore) */}
      <View style={styles.barTrack}>
        {/* Barra Progresso Consumato */}
        <View style={[styles.barFill, { width: `${progressPercent}%`, backgroundColor: isOverdrive ? '#8A2BE2' : '#00E0FF' }]} />
        
        {/* Marker del Limite Base (i 20g originali) */}
        <View style={[styles.marker, { left: `${(baseTarget / effectiveLimit) * 100}%` }]} />
      </View>

      {/* Dettagli a Comparsa (Drill-Down) */}
      {showDetails && (
        <View style={styles.detailsBox}>
          <View style={styles.row}>
            <Text style={styles.label}>🧘‍♂️ Base Chetogena</Text>
            <Text style={styles.value}>{baseTarget}g</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>👣 Attività ({stepsBonus > 0 ? 'Attivo' : 'Sedentario'})</Text>
            <Text style={[styles.value, {color: '#00E0FF'}]}>+{stepsBonus.toFixed(1)}g</Text>
          </View>

          {sportBonus > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>🏋️ Recupero Sport</Text>
              <Text style={[styles.value, {color: '#8A2BE2'}]}>+{sportBonus}g</Text>
            </View>
          )}

          {(!isOverdrive && totalLimit > safeCap) && (
            <Text style={styles.capWarning}>⚠️ Bonus limitato al Cap di Sicurezza ({safeCap}g)</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  bigValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  limit: {
    fontSize: 14,
    color: '#666',
  },
  barTrack: {
    height: 12,
    backgroundColor: '#333',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  detailsBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#AAA',
    fontSize: 14,
  },
  value: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  capWarning: {
    color: '#FF4444',
    fontSize: 10,
    marginTop: 5,
    fontStyle: 'italic',
  }
});