import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform, LayoutAnimation, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Minus, Target, User, Zap, ArrowLeft, RefreshCw, Cpu, Timer, ChevronDown, ChevronUp, Activity, Footprints, Flame, Scale } from 'lucide-react-native';

import useHealthConnect from '../hooks/useHealthConnect';
import SmartHint from '../components/SmartHint';
import { BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT_BTN, RING_TRACK, RED_ALERT } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = '@user_profile';
const PROTOCOLS = ['Keto', 'Low Carb', 'Bilanciata', 'Personalizza'];

const ACTIVITY_LEVELS = [
    { label: 'SEDENTARIO', value: 1.2 },
    { label: 'ATTIVITÀ LEGGERA', value: 1.375 },
    { label: 'MODERATA', value: 1.55 },
    { label: 'INTENSA', value: 1.725 }
];

const GENDER_OPTIONS = [
    { label: 'UOMO', value: 'male' },
    { label: 'DONNA', value: 'female' }
];

// --- BMI ---
const BMI_MIN = 15;
const BMI_MAX = 35;

function calculateBMI(weightKg: number, heightCm: number): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

function getBMILabelAndColor(bmi: number | null): { label: string; color: string } {
  if (bmi == null || bmi <= 0) return { label: '—', color: RING_TRACK };
  if (bmi < 18.5) return { label: 'Sottopeso', color: '#0EA5E9' };
  if (bmi < 25) return { label: 'Normale', color: '#10B981' };
  if (bmi < 30) return { label: 'Sovrappeso', color: '#F59E0B' };
  return { label: 'Obeso', color: RED_ALERT };
}

function BMIVisualizer({ weight, targetWeight, height }: { weight: number; targetWeight: number; height: number }) {
  const currentBMI = calculateBMI(weight, height);
  const targetBMI = calculateBMI(targetWeight, height);
  const currentInfo = getBMILabelAndColor(currentBMI ?? 0);
  const targetInfo = targetBMI != null ? getBMILabelAndColor(targetBMI) : null;

  const toPercent = (bmi: number) => Math.max(0, Math.min(1, (bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)));

  const segmentWidths = [
    (18.5 - BMI_MIN) / (BMI_MAX - BMI_MIN),
    (25 - 18.5) / (BMI_MAX - BMI_MIN),
    (30 - 25) / (BMI_MAX - BMI_MIN),
    (BMI_MAX - 30) / (BMI_MAX - BMI_MIN),
  ];
  const colors = ['#0EA5E9', '#10B981', '#F59E0B', RED_ALERT];

  return (
    <View style={styles.bmiWrap}>
      <Text style={styles.bmiSummary}>
        Attuale: {currentBMI != null ? currentBMI.toFixed(1) : '—'} ({currentInfo.label}) → Target: {targetBMI != null ? targetBMI.toFixed(1) : '—'}
        {targetInfo ? ` (${targetInfo.label})` : ''}
      </Text>
      <View style={styles.bmiBarContainer}>
        <View style={styles.bmiBarTrack}>
          {segmentWidths.map((w, i) => (
            <View key={i} style={[styles.bmiSegment, { flex: w }, { backgroundColor: colors[i] }]} />
          ))}
        </View>
        <View style={styles.bmiMarkersRow} pointerEvents="none">
          {currentBMI != null && currentBMI > 0 && (
            <View style={[styles.bmiMarkerCurrent, { left: `${toPercent(currentBMI) * 100}%` }]} />
          )}
          {targetBMI != null && targetBMI > 0 && (
            <View style={[styles.bmiMarkerTarget, { left: `${toPercent(targetBMI) * 100}%` }]}>
              <Target size={12} color={ACCENT_BTN} strokeWidth={2.5} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  
  // --- MAPPATURA NUOVO HOOK ---
  // Usiamo 'connect' per forzare il popup dei permessi e 'refresh' per i dati normali
  const { weight: healthWeight, steps, calories, refresh, connect, openSettings, error, loading } = useHealthConnect();
  
  // Lo stato "Linkato" lo consideriamo attivo se non ci sono errori e non stiamo caricando
  const isLinked = !error && !loading;
  
  const [weight, setWeight] = useState(75);
  const [targetWeight, setTargetWeight] = useState(70);
  const [height, setHeight] = useState(175); 
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState('male');
  const [activityMult, setActivityMult] = useState(1.2);

  const [weeksTarget, setWeeksTarget] = useState(8); 
  const [targetDateLabel, setTargetDateLabel] = useState('');

  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [showGenderMenu, setShowGenderMenu] = useState(false);

  const [protocol, setProtocol] = useState('Keto');
  const [kcal, setKcal] = useState(2000);
  const [protein, setProtein] = useState(150);
  const [carbs, setCarbs] = useState(20);
  const [fat, setFat] = useState(150);

  const updateTargetDate = useCallback((weeks: number) => {
    const date = new Date();
    date.setDate(date.getDate() + (weeks * 7));
    const label = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
    setTargetDateLabel(label);
  }, []);

  useEffect(() => { 
      loadProfile();
      refresh();
  }, [refresh]);

  // Aggiorna peso da Health Connect solo se valido: non sovrascrivere con 0
  useEffect(() => {
      if (healthWeight == null || healthWeight <= 0) return;
      setWeight(parseFloat(healthWeight.toFixed(1)));
  }, [healthWeight]);

  useEffect(() => { updateTargetDate(weeksTarget); }, [weeksTarget, updateTargetDate]);

  async function loadProfile() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        const finalWeight = (healthWeight != null && healthWeight > 0) ? parseFloat(healthWeight.toFixed(1)) : (p.weight || 75);
        
        setWeight(finalWeight); 
        setTargetWeight(p.targetWeight || 70);
        setWeeksTarget(p.weeksTarget || 8); setProtocol(p.protocol || 'Keto');
        setKcal(p.targetCalories || 2000); setProtein(p.protein || 150);
        setCarbs(p.carbs || 20); setFat(p.fat || 150);
        setGender(p.gender || 'male'); setActivityMult(p.activityMult || 1.2);
        setHeight(p.height || 175); setAge(p.age || 30);
      }
    } catch(_) { /* load error */ }
  }

  const generateSmartPlan = () => {
    const safeWeight = weight || 75;
    const bmr = (10 * safeWeight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161);
    const tdee = Math.round(bmr * activityMult);
    const weightDiff = safeWeight - targetWeight;
    const diffDays = (weeksTarget || 1) * 7;
    let targetCal = tdee;
    if (weightDiff > 0) targetCal = tdee - Math.round((weightDiff * 7700) / diffDays);
    else if (weightDiff < 0) targetCal = tdee + 300;
    targetCal = Math.max(1000, targetCal);
    applyProtocolDefaults(protocol, targetCal);
  };

  const updateMetabolism = (type: string, newValue: number) => {
    let nK = kcal, nP = protein, nC = carbs, nF = fat;
    if (type === 'kcal') nK = Math.max(0, newValue);
    else if (type === 'p') nP = Math.max(0, newValue);
    else if (type === 'c') nC = Math.max(0, newValue);
    else if (type === 'f') nF = Math.max(0, newValue);
    
    if (type !== 'f') {
        nF = Math.max(0, Math.round((nK - (nP * 4) - (nC * 4)) / 9));
    }
    setKcal(nK); setProtein(nP); setCarbs(nC); setFat(nF);
  };

  /**
   * Logica "Protein First": proteine da peso (1.6 g/kg), carbo da protocollo, grassi = calorie rimanenti.
   * "Personalizza": non impone target, lascia invariati i valori attuali.
   */
  const applyProtocolDefaults = (selected: string, calorieBase: number | undefined = undefined) => {
    if (selected === 'Personalizza') {
      setProtocol(selected);
      return;
    }

    const baseKcal = calorieBase ?? kcal;
    const safeWeight = weight || 75;

    // 1. Proteine: priorità assoluta, sempre da peso (1.6 g/kg)
    const safeProtein = Math.round(safeWeight * 1.6);

    // 2. Carboidrati: valori fissi per protocollo
    let newC = 25;
    if (selected === 'Keto') newC = 25;
    else if (selected === 'Low Carb') newC = 35;
    else newC = 100; // Bilanciata

    // 3. Safety check: kcal minime per proteine + carbo + grassi essenziali (es. 20 g)
    const minFatG = 20;
    const minKcal = (safeProtein * 4) + (newC * 4) + (minFatG * 9);
    const adjustedKcal = Math.max(baseKcal, minKcal);

    // 4. Grassi: variabile di riempimento (calorie rimanenti)
    const newF = Math.max(0, Math.round((adjustedKcal - (safeProtein * 4) - (newC * 4)) / 9));

    setProtocol(selected);
    setProtein(safeProtein);
    setCarbs(newC);
    setFat(newF);
    setKcal(adjustedKcal);
  };

  async function saveProfile() {
    try {
      // STORAGE_KEY (@user_profile): Tracker legge targetCalories, protein, carbs, fat per i target macro (Tanks + Metabolic Reactor)
      const profileData = { targetCalories: kcal, protocol, protein, carbs, fat, weight, targetWeight, height, age, weeksTarget, gender, activityMult };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
      Alert.alert('LOG', 'SINCRONIZZAZIONE COMPLETATA');
      if (router.canGoBack()) router.back();
    } catch (e) { Alert.alert('ERRORE', 'DATABASE LATERALE'); }
  }

  const CustomDropdown = ({ label, value, options, isOpen, onToggle, onSelect }: any) => {
    const selectedLabel = options.find((o: any) => o.value === value)?.label || "SELEZIONA";
    return (
        <View style={[styles.dropdownContainer, { zIndex: isOpen ? 5000 : 1 }]}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TouchableOpacity 
              style={[styles.dropdownBtn, isOpen && { borderColor: ACCENT_BTN }]} 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onToggle();
              }}
              activeOpacity={0.8}
            >
                <Text style={styles.dropdownText}>{selectedLabel}</Text>
                {isOpen ? <ChevronUp size={16} color={ACCENT_BTN} /> : <ChevronDown size={16} color={ACCENT_BTN} />}
            </TouchableOpacity>
            {isOpen && (
                <View style={styles.dropdownList}>
                    {options.map((opt: any) => (
                        <TouchableOpacity 
                          key={opt.label} 
                          style={styles.dropdownItem} 
                          onPress={() => { 
                            onSelect(opt.value); 
                            onToggle(); 
                          }}
                        >
                            <Text style={[styles.dropdownItemText, opt.value === value && { color: ACCENT_BTN }]}>
                              {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{flex:1}}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
      <ScrollView 
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true} 
      >
        
        <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 5 }}>
                    <ArrowLeft size={24} color={ACCENT_BTN} />
                </TouchableOpacity>
                <User size={24} color={ACCENT_BTN} />
                <View>
                    <Text style={styles.title}>Biometria</Text>
                    <Text style={styles.headerSubtitle}>Profilo e target</Text>
                </View>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveBtnText}>Salva</Text>
            </TouchableOpacity>
        </View>

        <View style={[styles.statusBadge, isLinked ? styles.activeStatus : styles.inactiveStatus]}>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <Cpu size={14} color={isLinked ? ACCENT_BTN : TEXT_SECONDARY} />
                    <Text style={[styles.statusText, { color: isLinked ? ACCENT_BTN : TEXT_SECONDARY }]}>
                        {isLinked ? 'Hardware connesso' : 'Sensori offline'}
                    </Text>
                </View>
                {isLinked && (
                    <View style={styles.sensorRow}>
                        <View style={styles.sensorItem}>
                            <Scale size={12} color={healthWeight ? ACCENT_BTN : TEXT_SECONDARY} />
                            <Text style={[styles.sensorVal, healthWeight ? { color: ACCENT_BTN } : {}]}>
                                {healthWeight ? parseFloat(healthWeight.toFixed(1)) : '--'} <Text style={{ fontSize: 8 }}>kg</Text>
                            </Text>
                        </View>
                        <View style={styles.sensorItem}>
                            <Footprints size={12} color={TEXT_SECONDARY} />
                            <Text style={styles.sensorVal}>{steps || 0}</Text>
                        </View>
                        <View style={styles.sensorItem}>
                            <Flame size={12} color={TEXT_SECONDARY} />
                            <Text style={styles.sensorVal}>{Math.round(calories || 0)} <Text style={{ fontSize: 8 }}>kcal</Text></Text>
                        </View>
                    </View>
                )}
                {!isLinked && Platform.OS === 'android' && (
                    <TouchableOpacity onPress={openSettings} style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 12, color: ACCENT_BTN, textDecorationLine: 'underline' }}>
                            Apri impostazioni Health Connect →
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity onPress={connect} style={styles.refreshBtn} accessibilityLabel={isLinked ? 'Aggiorna sensori' : 'Connetti sensori'}>
                <RefreshCw size={12} color={CARD_BG} />
            </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Profilo utente</Text>
        <View style={[styles.card, { zIndex: 1000 }]}>
            <CustomDropdown label="SESSO_BIOLOGICO" value={gender} options={GENDER_OPTIONS} isOpen={showGenderMenu} onToggle={() => { setShowGenderMenu(!showGenderMenu); setShowActivityMenu(false); }} onSelect={setGender} />
            <CustomDropdown label="COEFFICIENTE_ATTIVITÀ" value={activityMult} options={ACTIVITY_LEVELS} isOpen={showActivityMenu} onToggle={() => { setShowActivityMenu(!showActivityMenu); setShowGenderMenu(false); }} onSelect={setActivityMult} />
            <View style={{flexDirection:'row', gap:10}}>
                 <View style={styles.inputBox}><Text style={styles.fieldLabel}>ETÀ</Text><TextInput style={styles.textInput} keyboardType="numeric" value={age.toString()} onChangeText={(t) => setAge(Number(t) || 0)}/></View>
                 <View style={styles.inputBox}><Text style={styles.fieldLabel}>ALTEZZA_CM</Text><TextInput style={styles.textInput} keyboardType="numeric" value={height.toString()} onChangeText={(t) => setHeight(Number(t) || 0)}/></View>
            </View>
        </View>

        <Text style={styles.sectionTitle}>Calibrazione target</Text>
        <SmartHint
          visible={!weight || weight === 0}
          text="👇 Inserisci il peso per calibrare l'algoritmo metabolico."
        />
        <View style={[styles.card, { zIndex: 1 }]}>
            <View style={styles.row}>
                <View style={styles.inputBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.fieldLabel}>Peso attuale</Text>
                        {isLinked && healthWeight > 0 && <Text style={{ color: ACCENT_BTN, fontSize: 8, fontWeight: 'bold' }}>Auto-sync</Text>}
                    </View>
                    <TextInput 
                        style={[styles.textInput, isLinked && healthWeight > 0 && { borderColor: ACCENT_BTN }]} 
                        keyboardType="numeric" 
                        value={weight > 0 ? weight.toString() : ''} 
                        onChangeText={(t) => setWeight(parseFloat(t) || 0)}
                    />
                </View>
                <View style={styles.inputBox}><Text style={[styles.fieldLabel, { color: ACCENT_BTN }]}>Peso obiettivo</Text><TextInput style={[styles.textInput, { borderColor: ACCENT_BTN, color: TEXT_PRIMARY }]} keyboardType="numeric" value={targetWeight.toString()} onChangeText={(t) => setTargetWeight(Number(t) || 0)}/></View>
            </View>
            
            <View style={styles.weeksFocusGroup}>
                <Text style={styles.fieldLabel}>Durata stimata (settimane)</Text>
                <TextInput 
                  style={[styles.textInput, { marginBottom: 10 }]} 
                  keyboardType="numeric" 
                  value={weeksTarget.toString()} 
                  onChangeText={(t) => setWeeksTarget(Number(t) || 0)}
                  onFocus={() => {
                    setTimeout(() => scrollRef.current?.scrollTo({ y: 450, animated: true }), 100);
                  }}
                />
                <View style={styles.dateInfoBox}>
                    <Timer size={14} color={ACCENT_BTN} />
                    <Text style={styles.dateInfoText}>Scadenza: {targetDateLabel}</Text>
                </View>
            </View>

            <TouchableOpacity
              style={styles.summaryBox}
              onPress={() => {
                const w = weight || 75;
                const bmr = (10 * w) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161);
                const tdee = Math.round(bmr * activityMult);
                Alert.alert(
                  'BMR & TDEE',
                  `Metabolismo Basale (BMR): ${Math.round(bmr)} kcal\nFormula Harris-Benedict rivisitata. È l'energia che bruci a riposo assoluto.\n\nTDEE (fabbisogno giornaliero): ${tdee} kcal\nBMR × coefficiente attività.`
                );
              }}
              activeOpacity={0.8}
            >
                <Text style={styles.summaryText}>Modalità: {Number(weight - targetWeight) >= 0 ? 'Deficit' : 'Surplus'}</Text>
                <Text style={styles.summaryText}>Delta: {Math.abs(Number((weight - targetWeight).toFixed(1)))} kg in {weeksTarget * 7} giorni</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => Alert.alert('BMI', 'Indice di massa corporea: peso (kg) / altezza² (m). Sottopeso <18.5, Normale 18.5-25, Sovrappeso 25-30, Obeso ≥30. Usato per stimare il range di peso salutare.')} activeOpacity={0.9}>
              <BMIVisualizer weight={weight} targetWeight={targetWeight} height={height} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.calculateBtn} onPress={generateSmartPlan}><Zap size={14} color={CARD_BG} fill={CARD_BG} /><Text style={styles.calculateBtnText}>Calcola</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Config macro</Text>
        <View style={styles.protocolGrid}>
          {PROTOCOLS.map(p => (
            <TouchableOpacity key={p} onPress={() => applyProtocolDefaults(p)} style={[styles.protocolPill, protocol === p && styles.protocolPillActive]}>
              <Text style={[styles.protocolPillText, protocol === p && { color: CARD_BG }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {protocol === 'Personalizza' && (
          <Text style={styles.personalizzaHint}>I macro sotto sono liberi: modificali come vuoi.</Text>
        )}

        <View style={styles.card}>
            <ControlRowTech label="Obiettivo calorico (kcal)" value={kcal} type="kcal" color={TEXT_PRIMARY} update={updateMetabolism} />
            <View style={styles.macroGrid}>
              <ControlRowTech label="Proteine (g)" value={protein} type="p" color={TEXT_PRIMARY} update={updateMetabolism} />
              <ControlRowTech label="Carboidrati (g)" value={carbs} type="c" color={TEXT_PRIMARY} update={updateMetabolism} />
              <ControlRowTech label="Grassi (g)" value={fat} type="f" color={TEXT_PRIMARY} update={updateMetabolism} />
            </View>
        </View>

        <TouchableOpacity style={styles.resetBtnAction} onPress={() => Alert.alert("RESET", "Cancellare tutti i dati?", [{text: "NO"}, {text: "SÌ", onPress: () => AsyncStorage.clear()}])}>
            <Text style={styles.resetBtnText}>WIPE_ALL_DATA</Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ControlRowTech = ({ label, value, type, color, update }: any) => (
    <View style={styles.controlRow}>
        <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>{label}</Text>
        <View style={styles.inputActionRow}>
            <TouchableOpacity onPress={() => update(type, value - (type === 'kcal' ? 50 : 5))} style={styles.actionBtn}><Minus size={16} color={ACCENT_BTN} /></TouchableOpacity>
            <TextInput style={[styles.valueInput, { color }]} keyboardType="numeric" value={value.toString()} onChangeText={(txt) => update(type, parseInt(txt) || 0)} />
            <TouchableOpacity onPress={() => update(type, value + (type === 'kcal' ? 50 : 5))} style={styles.actionBtn}><Plus size={16} color={ACCENT_BTN} /></TouchableOpacity>
        </View>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: RING_TRACK, paddingBottom: 15 },
  title: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600', marginTop: 2 },
  saveBtn: { backgroundColor: ACCENT_BTN, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { color: CARD_BG, fontWeight: '600', fontSize: 14 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: CARD_BG, borderLeftWidth: 4, borderLeftColor: RING_TRACK, marginBottom: 24, borderRadius: 12, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 } }) },
  activeStatus: { borderLeftColor: ACCENT_BTN },
  inactiveStatus: {},
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 10, color: TEXT_PRIMARY },
  sensorRow: { flexDirection: 'row', marginTop: 8, gap: 16, paddingLeft: 26 },
  sensorItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sensorVal: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  
  refreshBtn: { backgroundColor: ACCENT_BTN, padding: 8, borderRadius: 10 },
  sectionTitle: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  
  card: { backgroundColor: CARD_BG, padding: 18, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: RING_TRACK, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  fieldLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  textInput: { backgroundColor: BG, height: 46, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 10, color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600', paddingHorizontal: 12 },
  inputBox: { flex: 1 },

  dropdownContainer: { marginBottom: 16, position: 'relative' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BG, borderWidth: 1, borderColor: RING_TRACK, padding: 12, height: 46, borderRadius: 10 },
  dropdownText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  dropdownList: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 10, position: 'absolute', top: 68, left: 0, right: 0, zIndex: 9999, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: RING_TRACK },
  dropdownItemText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },

  row: { flexDirection: 'row', gap: 10 },
  weeksFocusGroup: { backgroundColor: BG, borderRadius: 12, marginTop: 12, padding: 12 },
  dateInfoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 },
  dateInfoText: { color: ACCENT_BTN, fontSize: 12, fontWeight: '600' },
  calculateBtn: { backgroundColor: ACCENT_BTN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, marginTop: 20, borderRadius: 12 },
  calculateBtnText: { color: CARD_BG, fontWeight: '600', fontSize: 15 },
  summaryBox: { backgroundColor: BG, padding: 12, marginTop: 8, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 10 },
  summaryText: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  bmiWrap: { marginTop: 16, marginBottom: 4 },
  bmiSummary: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  bmiBarContainer: { position: 'relative', height: 20 },
  bmiBarTrack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: RING_TRACK },
  bmiSegment: { height: '100%' },
  bmiMarkersRow: { position: 'absolute', left: 0, right: 0, top: 0, height: 14 },
  bmiMarkerCurrent: { position: 'absolute', width: 4, height: 20, borderRadius: 2, backgroundColor: TEXT_PRIMARY, top: -3, marginLeft: -2 },
  bmiMarkerTarget: { position: 'absolute', width: 20, height: 20, marginLeft: -10, top: -3, justifyContent: 'center', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 10, borderWidth: 2, borderColor: ACCENT_BTN },
  protocolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  protocolPill: { flex: 1, minWidth: '45%', paddingVertical: 12, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 12, alignItems: 'center', backgroundColor: BG },
  protocolPillActive: { backgroundColor: ACCENT_BTN, borderColor: ACCENT_BTN },
  protocolPillText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  personalizzaHint: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500', marginBottom: 16 },
  controlRow: { marginBottom: 20 },
  inputActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG, padding: 6, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 10 },
  actionBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 10 },
  valueInput: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY },
  macroGrid: { marginTop: 12 },
  resetBtnAction: { marginTop: 24, padding: 16, borderStyle: 'dotted', borderWidth: 1, borderColor: RED_ALERT, borderRadius: 10 },
  resetBtnText: { color: RED_ALERT, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});