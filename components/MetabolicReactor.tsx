import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DS, TRACKER_BLACK } from '../constants/designSystem';
import { getWorkoutUI, type WorkoutCategory } from '../constants/workoutTypes';

const STATUS_RED = DS.alert;
const STATUS_CYAN = DS.accent;
const STATUS_VIOLET = TRACKER_BLACK.SYMPTOM;
const STATUS_GREY = DS.textMuted;
const STATUS_SYMPTOM = DS.warning;

const LIGHT_BG = DS.bg;
const LIGHT_CARD = DS.surface;
const LIGHT_TEXT = DS.text;
const LIGHT_MUTED = DS.textMuted;
const LIGHT_ACCENT = DS.accent;
const LIGHT_CARB = DS.carb;
const LIGHT_STEPS = DS.protein;
const LIGHT_SPORT = TRACKER_BLACK.SYMPTOM;

export interface ReactorProps {
  baseTarget: number;
  currentCarbs: number;
  stepsBonus: number;
  sportBonus: number;
  sleepFactor?: number;
  sleepHours?: number;
  dynamicCarbLimit?: number;
  steps?: number;
  activeCalories?: number;
  symptomFactor?: number;
  symptomName?: string;
  /** Tipo ultimo workout (da Health Connect) per UI: messaggio, colore, icona */
  lastWorkoutType?: WorkoutCategory;
  /** 'light' = Material 3 light theme */
  variant?: 'dark' | 'light';
}

export default function MetabolicReactor({ baseTarget, currentCarbs, stepsBonus, sportBonus, sleepFactor = 1.0, sleepHours, dynamicCarbLimit, steps = 0, activeCalories = 0, symptomFactor = 1.0, symptomName, lastWorkoutType, variant = 'dark' }: ReactorProps) {
  const light = variant === 'light';
  const [showDetails, setShowDetails] = useState(false);

  const workoutUI = lastWorkoutType ? getWorkoutUI(lastWorkoutType) : null;

  const totalLimit = baseTarget + stepsBonus + sportBonus;
  const safeCap = 50;
  const computedLimit = sportBonus > 5 ? totalLimit : Math.min(totalLimit, safeCap);
  const effectiveLimit = dynamicCarbLimit != null ? dynamicCarbLimit : Math.round(computedLimit);

  const progressPercent = Math.min((currentCarbs / effectiveLimit) * 100, 100);
  const isOverdrive = sportBonus > 0;
  const hasSymptom = symptomFactor < 1 && symptomName;

  const sleepPenaltyPct = sleepFactor < 1 ? Math.round((1 - sleepFactor) * 100) : 0;
  const symptomPenaltyPct = symptomFactor < 1 ? Math.round((1 - symptomFactor) * 100) : 0;
  const parts: string[] = [];
  if (sleepFactor < 1) parts.push(`⚠️ Tolleranza ridotta del ${sleepPenaltyPct}% per recupero insufficiente.`);
  if (hasSymptom) parts.push(`🩺 Protocollo antinfiammatorio (${symptomName}): -${symptomPenaltyPct}% tolleranza.`);
  if (sportBonus > 0) {
    if (workoutUI) parts.push(`⚡ ${workoutUI.message}: +${Math.round(sportBonus)}g.`);
    else parts.push(`⚡ +${Math.round(sportBonus)}g extra per ripristino glicogeno post-sport.`);
  }
  if (stepsBonus > 0) parts.push(`👣 +${Math.round(stepsBonus)}g carboidrati sbloccati dal movimento.`);
  const metabolicExplanation = parts.length > 0 ? parts.join(' | ') : 'Stato ottimale: il limite rispecchia la tua base chetogena.';
  const sportColor = workoutUI ? (light ? workoutUI.colorLight : workoutUI.color) : (light ? LIGHT_SPORT : STATUS_VIOLET);
  const statusColor = light
    ? (sleepFactor < 1 ? '#DC2626' : (hasSymptom ? '#EA580C' : (sportBonus > 0 ? sportColor : (stepsBonus > 0 ? LIGHT_STEPS : LIGHT_MUTED))))
    : (sleepFactor < 1 ? STATUS_RED : (hasSymptom ? STATUS_SYMPTOM : (sportBonus > 0 ? sportColor : (stepsBonus > 0 ? STATUS_CYAN : STATUS_GREY))));

  const displaySleepHours = sleepHours != null ? sleepHours : 7.5;
  const sleepMultiplier = sleepFactor;

  const containerStyle = light ? [styles.container, styles.containerLight] : styles.container;
  const titleStyle = light ? [styles.title, styles.titleLight] : styles.title;
  const subtitleStyle = light ? [styles.subtitle, styles.subtitleLight] : styles.subtitle;
  const bigValueStyle = light ? [styles.bigValue, styles.bigValueLight] : styles.bigValue;
  const limitStyle = light ? [styles.limit, styles.limitLight] : styles.limit;
  const barTrackStyle = light ? [styles.barTrack, styles.barTrackLight] : styles.barTrack;
  const barFillColor = light ? (isOverdrive ? sportColor : LIGHT_STEPS) : (isOverdrive ? sportColor : '#00E0FF');
  const markerStyle = light ? [styles.marker, styles.markerLight] : styles.marker;
  const detailsBoxStyle = light ? [styles.detailsBox, styles.detailsBoxLight] : styles.detailsBox;
  const labelStyle = light ? [styles.label, styles.labelLight] : styles.label;
  const valueStyle = light ? [styles.value, styles.valueLight] : styles.value;
  const capWarningStyle = light ? [styles.capWarning, styles.capWarningLight] : styles.capWarning;

  return (
    <TouchableOpacity 
      style={containerStyle} 
      activeOpacity={0.9} 
      onPress={() => setShowDetails(!showDetails)}
    >
      <View style={styles.header}>
        <View>
          <Text style={titleStyle}>NET CARBS</Text>
          <Text style={subtitleStyle}>
            {isOverdrive ? '⚡ OVERDRIVE ATTIVO' : 'METABOLISMO DINAMICO'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={bigValueStyle}>{Math.round(currentCarbs)}g <Text style={limitStyle}>/ {Math.round(effectiveLimit)}g</Text></Text>
          <Text style={[styles.metabolicStatus, { color: statusColor }]} numberOfLines={2}>{metabolicExplanation}</Text>
        </View>
      </View>

      <View style={barTrackStyle}>
        <View style={[styles.barFill, { width: `${progressPercent}%`, backgroundColor: barFillColor }]} />
        <View style={[markerStyle, { left: `${(baseTarget / effectiveLimit) * 100}%` }]} />
      </View>

      {showDetails && (
        <View style={detailsBoxStyle}>
          <View style={styles.row}>
            <Text style={labelStyle}>🧘‍♂️ Base Chetogena</Text>
            <Text style={valueStyle}>{Math.round(baseTarget)}g</Text>
          </View>
          <View style={styles.row}>
            <Text style={labelStyle}>🌙 Sonno ({displaySleepHours % 1 === 0 ? Math.round(displaySleepHours) : displaySleepHours.toFixed(1)}h)</Text>
            <Text style={valueStyle}>{sleepMultiplier === 1 ? '1.0' : sleepMultiplier.toFixed(1)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={labelStyle}>👣 Passi ({Math.round(steps)})</Text>
            <Text style={[valueStyle, { color: light ? LIGHT_STEPS : '#00E0FF' }]}>+{Math.round(stepsBonus)}g</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.labelWithIcon}>
              {workoutUI ? <Ionicons name={workoutUI.icon as any} size={16} color={sportColor} style={{ marginRight: 4 }} /> : null}
              <Text style={labelStyle}>
                {workoutUI ? '' : '🏋️ '}Sport ({Math.round(activeCalories)} kcal){workoutUI ? ` · ${workoutUI.message}` : ''}
              </Text>
            </View>
            <Text style={[valueStyle, { color: sportColor }]}>+{Math.round(sportBonus)}g</Text>
          </View>
          {hasSymptom && (
            <View style={styles.row}>
              <Text style={[labelStyle, { color: light ? '#EA580C' : STATUS_SYMPTOM }]}>🩺 Sintomo (Medical)</Text>
              <Text style={[valueStyle, { color: light ? '#EA580C' : STATUS_SYMPTOM }]}>{symptomName} (-{symptomPenaltyPct}%)</Text>
            </View>
          )}
          {(!isOverdrive && totalLimit > safeCap) && (
            <Text style={capWarningStyle}>⚠️ Bonus limitato al Cap di Sicurezza ({safeCap}g)</Text>
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
  containerLight: {
    backgroundColor: LIGHT_CARD,
    borderColor: '#E5E7EB',
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
  titleLight: { color: LIGHT_TEXT },
  subtitle: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  subtitleLight: { color: LIGHT_MUTED },
  bigValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bigValueLight: { color: LIGHT_TEXT },
  limit: {
    fontSize: 14,
    color: '#666',
  },
  limitLight: { color: LIGHT_MUTED },
  metabolicStatus: {
    fontSize: 10,
    marginTop: 6,
    maxWidth: 220,
    textAlign: 'right',
  },
  barTrack: {
    height: 12,
    backgroundColor: '#333',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  barTrackLight: { backgroundColor: LIGHT_BG },
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
  markerLight: { backgroundColor: 'rgba(0,0,0,0.2)' },
  detailsBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  detailsBoxLight: { borderTopColor: '#E5E7EB' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    color: '#AAA',
    fontSize: 14,
  },
  labelLight: { color: LIGHT_MUTED },
  value: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  valueLight: { color: LIGHT_TEXT },
  capWarning: {
    color: '#FF4444',
    fontSize: 10,
    marginTop: 5,
    fontStyle: 'italic',
  },
  capWarningLight: { color: '#DC2626' },
  sleepPenalty: {
    color: STATUS_RED,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});