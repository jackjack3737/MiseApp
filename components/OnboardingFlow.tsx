import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    OBJECTIVE_LABELS,
    ONBOARDING_COMPLETED_KEY,
    USER_PROFILE_KEY,
    type OnboardingObjective,
    type OnboardingProfilePayload,
} from '../constants/onboarding';
import { TRACKER_BLACK } from '../constants/trackerBlack';
import { useBio } from '../context/BioContext';

const ACCENT = TRACKER_BLACK.ACCENT;
const BG = TRACKER_BLACK.BG;
const CARD = TRACKER_BLACK.CARD;
const BORDER = TRACKER_BLACK.BORDER;
const TEXT = TRACKER_BLACK.TEXT;
const MUTED = TRACKER_BLACK.TEXT_MUTED;

const OBJECTIVES: OnboardingObjective[] = ['performance', 'ketosis', 'weight_loss'];

function mapObjectiveToProtocol(objective: OnboardingObjective): string {
  if (objective === 'ketosis') return 'Keto';
  if (objective === 'weight_loss') return 'Low Carb';
  return 'Bilanciata';
}

function getInitialTargets(objective: OnboardingObjective, weight: number): { kcal: number; protein: number; carbs: number; fat: number } {
  const protein = Math.round(weight * 1.6);
  if (objective === 'ketosis') return { kcal: 2000, protein, carbs: 25, fat: Math.round((2000 - protein * 4 - 25 * 4) / 9) };
  if (objective === 'weight_loss') return { kcal: 1800, protein, carbs: 50, fat: Math.round((1800 - protein * 4 - 50 * 4) / 9) };
  // performance / Bilanciata
  return { kcal: 2200, protein, carbs: 100, fat: Math.round((2200 - protein * 4 - 100 * 4) / 9) };
}

type Props = { onComplete: () => void };

export default function OnboardingFlow({ onComplete }: Props) {
  const { actions } = useBio();
  const [step, setStep] = useState(1);

  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');

  const [objective, setObjective] = useState<OnboardingObjective | null>(null);
  const [connecting, setConnecting] = useState(false);

  const canProceedStep1 = age.trim() && weight.trim() && height.trim() && !isNaN(Number(age)) && !isNaN(Number(weight)) && !isNaN(Number(height));

  const handleStep1Next = () => {
    if (!canProceedStep1) return;
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!objective) return;
    setStep(3);
  };

  const handleStep3Complete = async () => {
    setConnecting(true);
    try {
      const status = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'undetermined' as const }));
      const locationGranted = status.status === 'granted';
      if (!locationGranted) {
        Alert.alert(
          'GPS opzionale',
          'Puoi abilitare la posizione dopo da Impostazioni per meteo e consigli personalizzati.',
          [{ text: 'OK' }]
        );
      }
      actions.requestHealthPermissions();

      const w = Math.max(40, Math.min(200, Number(weight) || 75));
      const h = Math.max(140, Math.min(220, Number(height) || 175));
      const a = Math.max(16, Math.min(100, Number(age) || 30));
      const obj = objective ?? 'performance';
      const targets = getInitialTargets(obj, w);

      const profile: OnboardingProfilePayload & Record<string, unknown> = {
        age: a,
        weight: w,
        height: h,
        gender,
        objective: obj,
        targetCalories: targets.kcal,
        protocol: mapObjectiveToProtocol(obj),
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat,
        targetWeight: obj === 'weight_loss' ? Math.max(50, w - 5) : w,
        weeksTarget: 8,
        activityMult: 1.375,
      };

      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      onComplete();
    } catch (e) {
      Alert.alert('Errore', 'Impossibile salvare il profilo. Riprova.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress */}
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[styles.progressDot, s === step && styles.progressDotActive, s < step && styles.progressDotDone]}
              />
            ))}
          </View>

          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Bio-Data</Text>
              <Text style={styles.stepSubtitle}>Inserisci i tuoi dati per personalizzare gli algoritmi (restano solo sul telefono).</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Età (anni)</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="es. 30"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="es. 75"
                  placeholderTextColor={MUTED}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Altezza (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="es. 175"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.label}>Sesso</Text>
                <View style={styles.genderRow}>
                  <TouchableOpacity
                    style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                    onPress={() => setGender('male')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Uomo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                    onPress={() => setGender('female')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Donna</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, !canProceedStep1 && styles.primaryBtnDisabled]}
                onPress={handleStep1Next}
                disabled={!canProceedStep1}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Avanti</Text>
                <Ionicons name="arrow-forward" size={20} color={BG} />
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Obiettivo</Text>
              <Text style={styles.stepSubtitle}>Scegli il focus principale (potrai modificarlo dal profilo).</Text>
              <View style={styles.card}>
                {OBJECTIVES.map((obj) => (
                  <TouchableOpacity
                    key={obj}
                    style={[styles.objectiveBtn, objective === obj && styles.objectiveBtnActive]}
                    onPress={() => setObjective(obj)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.objectiveText, objective === obj && styles.objectiveTextActive]}>
                      {OBJECTIVE_LABELS[obj]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, !objective && styles.primaryBtnDisabled]}
                onPress={handleStep2Next}
                disabled={!objective}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Avanti</Text>
                <Ionicons name="arrow-forward" size={20} color={BG} />
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Connessione</Text>
              <Text style={styles.stepSubtitle}>Autorizza GPS (meteo) e sensori Salute (sonno, battito, passi) per dati precisi. Puoi saltare e abilitarli dopo.</Text>
              <View style={styles.card}>
                <View style={styles.connectionRow}>
                  <Ionicons name="location-outline" size={28} color={ACCENT} />
                  <Text style={styles.connectionLabel}>GPS → Meteo e consigli idratazione</Text>
                </View>
                <View style={styles.connectionRow}>
                  <Ionicons name="fitness-outline" size={28} color={ACCENT} />
                  <Text style={styles.connectionLabel}>Salute → Sonno, HRV, Battito, Passi</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleStep3Complete}
                disabled={connecting}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>{connecting ? 'Salvataggio...' : 'Completa e salva'}</Text>
                <Ionicons name="checkmark-circle" size={22} color={BG} />
              </TouchableOpacity>
            </>
          )}

          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color={MUTED} />
              <Text style={styles.backBtnText}>Indietro</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  keyboard: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 80 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BORDER,
  },
  progressDotActive: { backgroundColor: ACCENT, transform: [{ scale: 1.2 }] },
  progressDotDone: { backgroundColor: ACCENT },
  stepTitle: { fontSize: 26, fontWeight: '800', color: TEXT, marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 24 },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 24,
  },
  label: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT,
    fontWeight: '600',
  },
  genderRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  genderBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(0, 224, 255, 0.1)' },
  genderText: { fontSize: 15, fontWeight: '600', color: MUTED },
  genderTextActive: { color: ACCENT },
  objectiveBtn: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  objectiveBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(0, 224, 255, 0.1)' },
  objectiveText: { fontSize: 16, fontWeight: '600', color: TEXT },
  objectiveTextActive: { color: ACCENT },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  connectionLabel: { flex: 1, fontSize: 14, color: TEXT, fontWeight: '500' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: BG },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  backBtnText: { fontSize: 14, color: MUTED, fontWeight: '600' },
});
