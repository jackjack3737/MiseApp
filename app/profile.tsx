import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform, LayoutAnimation, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Minus, Target, Zap, ArrowLeft, RefreshCw, Cpu, Timer, ChevronDown, ChevronUp, Activity, Footprints, Flame } from 'lucide-react-native';

// --- HOOK REALE ---
import { useHealthConnect } from '../hooks/useHealthConnect'; 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = '@user_profile';
const PROTOCOLS = ['Keto', 'Carnivora', 'Paleo', 'Low Carb'];
const TECH_GREEN = '#39FF14'; 
const DARK_TECH_GREEN = '#1b3517'; 
const BORDER_COLOR = '#1A1A1A';

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

export default function ProfileScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { isLinked, connect, data: healthData, syncData } = useHealthConnect();
  
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
      // Forza una sync appena la pagina si apre per beccare i dati freschi
      if (isLinked) syncData();
  }, []);

  // Monitora cambiamenti da Health Connect e aggiorna il peso locale se c'è un dato nuovo
  useEffect(() => {
      if (healthData && healthData.weight > 0) {
          console.log("Health Data Weight Detected:", healthData.weight);
          setWeight(healthData.weight);
      }
  }, [healthData]);

  useEffect(() => { updateTargetDate(weeksTarget); }, [weeksTarget, updateTargetDate]);

  async function loadProfile() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        // Se abbiamo dati da Health Connect, usiamo quelli, altrimenti il salvataggio locale
        const finalWeight = (healthData && healthData.weight > 0) ? healthData.weight : (p.weight || 75);
        
        setWeight(finalWeight); 
        setTargetWeight(p.targetWeight || 70);
        setWeeksTarget(p.weeksTarget || 8); setProtocol(p.protocol || 'Keto');
        setKcal(p.targetCalories || 2000); setProtein(p.protein || 150);
        setCarbs(p.carbs || 20); setFat(p.fat || 150);
        setGender(p.gender || 'male'); setActivityMult(p.activityMult || 1.2);
        setHeight(p.height || 175); setAge(p.age || 30);
      }
    } catch(e) { console.log(e); }
  }

  const generateSmartPlan = () => {
    const bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161);
    const tdee = Math.round(bmr * activityMult);
    const weightDiff = weight - targetWeight;
    const diffDays = (weeksTarget || 1) * 7;
    let targetCal = tdee;
    if (weightDiff > 0) targetCal = tdee - Math.round((weightDiff * 7700) / diffDays);
    else if (weightDiff < 0) targetCal = tdee + 300;
    updateMetabolism('kcal', Math.max(1000, targetCal));
    setTimeout(() => applyProtocolDefaults(protocol, Math.max(1000, targetCal)), 100);
  };

  const updateMetabolism = (type: string, newValue: number) => {
    let nK = kcal, nP = protein, nC = carbs, nF = fat;
    if (type === 'kcal') nK = Math.max(0, newValue);
    else if (type === 'p') nP = Math.max(0, newValue);
    else if (type === 'c') nC = Math.max(0, newValue);
    else if (type === 'f') nF = Math.max(0, newValue);
    
    // Se non stiamo toccando i grassi direttamente, ricalcolali per far tornare i conti
    if (type !== 'f') {
        nF = Math.max(0, Math.round((nK - (nP * 4) - (nC * 4)) / 9));
    }
    setKcal(nK); setProtein(nP); setCarbs(nC); setFat(nF);
  };

  const applyProtocolDefaults = (selected: string, calorieBase: number = kcal) => {
    setProtocol(selected);
    let newC = 20, newP = 150;
    if (selected === 'Keto') { newC = 25; newP = Math.round((calorieBase * 0.25) / 4); }
    else if (selected === 'Carnivora') { newC = 0; newP = Math.round((calorieBase * 0.40) / 4); }
    else if (selected === 'Paleo') { newC = 60; newP = Math.round((calorieBase * 0.30) / 4); }
    else { newC = 100; newP = Math.round((calorieBase * 0.35) / 4); }
    const newF = Math.max(0, Math.round((calorieBase - (newP * 4) - (newC * 4)) / 9));
    setCarbs(newC); setProtein(newP); setFat(newF); setKcal(calorieBase);
  };

  async function saveProfile() {
    try {
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
              style={[styles.dropdownBtn, isOpen && {borderColor: TECH_GREEN}]} 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onToggle();
              }}
              activeOpacity={0.8}
            >
                <Text style={styles.dropdownText}>{selectedLabel}</Text>
                {isOpen ? <ChevronUp size={16} color={TECH_GREEN} /> : <ChevronDown size={16} color={TECH_GREEN} />}
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
                            <Text style={[styles.dropdownItemText, opt.value === value && {color: TECH_GREEN}]}>
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
            <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
                <TouchableOpacity onPress={() => router.back()} style={{paddingRight:5}}>
                    <ArrowLeft size={24} color={TECH_GREEN} />
                </TouchableOpacity>
                <Target size={24} color={TECH_GREEN} />
                <Text style={styles.title}>BIOMETRIA_DI_SISTEMA</Text>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveBtnText}>SALVA</Text>
            </TouchableOpacity>
        </View>

        {/* STATUS DEVICE & SENSORI (Aggiornato per mostrare i dati) */}
        <View style={[styles.statusBadge, isLinked ? styles.activeStatus : styles.inactiveStatus]}>
            <View style={{flex: 1}}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom: 5}}>
                    <Cpu size={14} color={isLinked ? TECH_GREEN : '#2d5a27'} />
                    <Text style={[styles.statusText, {color: isLinked ? TECH_GREEN : '#2d5a27'}]}>
                        {isLinked ? "HARDWARE_CONNESSO" : "SENSORI_OFFLINE"}
                    </Text>
                </View>
                {/* Visualizzazione dati sensori se connesso */}
                {isLinked && (
                    <View style={styles.sensorRow}>
                        <View style={styles.sensorItem}>
                            <Footprints size={12} color="#666" />
                            <Text style={styles.sensorVal}>{healthData.steps || 0}</Text>
                        </View>
                        <View style={styles.sensorItem}>
                            <Flame size={12} color="#666" />
                            <Text style={styles.sensorVal}>{Math.round(healthData.calories || 0)} <Text style={{fontSize:8}}>KCAL</Text></Text>
                        </View>
                    </View>
                )}
            </View>
            
            <TouchableOpacity onPress={isLinked ? syncData : connect} style={styles.refreshBtn}>
                <RefreshCw size={12} color="#000" />
            </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>PROFILO_UTENTE</Text>
        <View style={[styles.card, { zIndex: 1000 }]}>
            <CustomDropdown label="SESSO_BIOLOGICO" value={gender} options={GENDER_OPTIONS} isOpen={showGenderMenu} onToggle={() => { setShowGenderMenu(!showGenderMenu); setShowActivityMenu(false); }} onSelect={setGender} />
            <CustomDropdown label="COEFFICIENTE_ATTIVITÀ" value={activityMult} options={ACTIVITY_LEVELS} isOpen={showActivityMenu} onToggle={() => { setShowActivityMenu(!showActivityMenu); setShowGenderMenu(false); }} onSelect={setActivityMult} />
            <View style={{flexDirection:'row', gap:10}}>
                 <View style={styles.inputBox}><Text style={styles.fieldLabel}>ETÀ</Text><TextInput style={styles.textInput} keyboardType="numeric" value={age.toString()} onChangeText={(t) => setAge(Number(t))}/></View>
                 <View style={styles.inputBox}><Text style={styles.fieldLabel}>ALTEZZA_CM</Text><TextInput style={styles.textInput} keyboardType="numeric" value={height.toString()} onChangeText={(t) => setHeight(Number(t))}/></View>
            </View>
        </View>

        <Text style={styles.sectionTitle}>CALIBRAZIONE_TARGET</Text>
        <View style={[styles.card, { zIndex: 1 }]}>
            <View style={styles.row}>
                <View style={styles.inputBox}>
                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                        <Text style={styles.fieldLabel}>PESO_ATTUALE</Text>
                        {isLinked && healthData.weight > 0 && <Text style={{color: TECH_GREEN, fontSize: 8, fontWeight:'bold'}}>AUTO-SYNC</Text>}
                    </View>
                    <TextInput 
                        style={styles.textInput} 
                        keyboardType="numeric" 
                        value={weight.toString()} 
                        onChangeText={(t) => setWeight(Number(t))}
                    />
                </View>
                <View style={styles.inputBox}><Text style={[styles.fieldLabel, {color: TECH_GREEN}]}>PESO_OBIETTIVO</Text><TextInput style={[styles.textInput, {borderColor: TECH_GREEN, color: TECH_GREEN}]} keyboardType="numeric" value={targetWeight.toString()} onChangeText={(t) => setTargetWeight(Number(t))}/></View>
            </View>
            
            <View style={styles.weeksFocusGroup}>
                <Text style={styles.fieldLabel}>DURATA_STIMATA (SETTIMANE)</Text>
                <TextInput 
                  style={[styles.textInput, {marginBottom: 10}]} 
                  keyboardType="numeric" 
                  value={weeksTarget.toString()} 
                  onChangeText={(t) => setWeeksTarget(Number(t) || 0)}
                  onFocus={() => {
                    setTimeout(() => scrollRef.current?.scrollTo({ y: 450, animated: true }), 100);
                  }}
                />
                <View style={styles.dateInfoBox}>
                    <Timer size={14} color={TECH_GREEN} />
                    <Text style={styles.dateInfoText}>DEADLINE: {targetDateLabel}</Text>
                </View>
            </View>

            <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>MODE: {Number(weight - targetWeight) >= 0 ? 'DEFICIT_ATTIVO' : 'ANABOLIC_SURPLUS'}</Text>
                <Text style={styles.summaryText}>DELTA: {Math.abs(Number((weight - targetWeight).toFixed(1)))} KG IN {weeksTarget * 7} GIORNI</Text>
            </View>

            <TouchableOpacity style={styles.calculateBtn} onPress={generateSmartPlan}><Zap size={14} color="#000" fill="#000" /><Text style={styles.calculateBtnText}>ESEGUI_CALCOLO</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>CONFIG_MACRO</Text>
        <View style={styles.protocolGrid}>
          {PROTOCOLS.map(p => (
            <TouchableOpacity key={p} onPress={() => applyProtocolDefaults(p)} style={[styles.protocolPill, protocol === p && styles.protocolPillActive]}>
              <Text style={[styles.protocolPillText, protocol === p && {color: '#000'}]}>{p.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
            <ControlRowTech label="OBIETTIVO CALORICO (KCAL)" value={kcal} type="kcal" color={TECH_GREEN} update={updateMetabolism} />
            <View style={styles.macroGrid}>
              <ControlRowTech label="PROTEINE (G)" value={protein} type="p" color="#FFF" update={updateMetabolism} />
              <ControlRowTech label="CARBOIDRATI (G)" value={carbs} type="c" color="#FFF" update={updateMetabolism} />
              <ControlRowTech label="GRASSI (G)" value={fat} type="f" color="#FFF" update={updateMetabolism} />
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
        <Text style={[styles.fieldLabel, {marginBottom: 8}]}>{label}</Text>
        <View style={styles.inputActionRow}>
            <TouchableOpacity onPress={() => update(type, value - (type === 'kcal' ? 50 : 5))} style={styles.actionBtn}><Minus size={16} color={TECH_GREEN}/></TouchableOpacity>
            <TextInput style={[styles.valueInput, {color}]} keyboardType="numeric" value={value.toString()} onChangeText={(txt) => update(type, parseInt(txt) || 0)}/>
            <TouchableOpacity onPress={() => update(type, value + (type === 'kcal' ? 50 : 5))} style={styles.actionBtn}><Plus size={16} color={TECH_GREEN}/></TouchableOpacity>
        </View>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, paddingBottom: 15 },
  title: { color: TECH_GREEN, fontSize: 13, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  saveBtn: { backgroundColor: TECH_GREEN, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 2 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 11 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#050505', borderLeftWidth: 3, borderLeftColor: '#2d5a27', marginBottom: 25 },
  activeStatus: { borderLeftColor: TECH_GREEN, backgroundColor: '#0a120a' },
  inactiveStatus: { borderLeftColor: '#2d5a27' },
  statusText: { fontSize: 10, fontWeight: '900', marginLeft: 10, fontFamily: 'monospace' },
  sensorRow: { flexDirection: 'row', marginTop: 8, gap: 15, paddingLeft: 24 },
  sensorItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sensorVal: { color: '#CCC', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
  
  refreshBtn: { backgroundColor: TECH_GREEN, padding: 6, borderRadius: 2 },
  sectionTitle: { color: TECH_GREEN, fontSize: 11, fontWeight: '900', marginBottom: 10, opacity: 0.8 },
  
  card: { backgroundColor: '#080808', padding: 18, borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginBottom: 25 },
  fieldLabel: { color: TECH_GREEN, fontSize: 9, fontWeight: '900', marginBottom: 6, fontFamily: 'monospace', opacity: 0.7 },
  textInput: { backgroundColor: '#000', height: 45, borderBottomWidth: 1, borderBottomColor: DARK_TECH_GREEN, color: '#FFF', fontSize: 17, fontWeight: 'bold', paddingHorizontal: 10, fontFamily: 'monospace' },
  inputBox: { flex: 1 },

  dropdownContainer: { marginBottom: 15, position: 'relative' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000', borderWidth: 1, borderColor: DARK_TECH_GREEN, padding: 12, height: 45 },
  dropdownText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' },
  dropdownList: { 
    backgroundColor: '#080808', 
    borderWidth: 1, 
    borderColor: TECH_GREEN, 
    position: 'absolute', 
    top: 65, 
    left: 0, 
    right: 0, 
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5
  },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#111', backgroundColor: '#080808' },
  dropdownItemText: { color: '#666', fontSize: 12, fontFamily: 'monospace' },

  row: { flexDirection: 'row', gap: 10 },
  weeksFocusGroup: { backgroundColor: '#000', borderRadius: 8, marginTop: 10 },
  dateInfoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 },
  dateInfoText: { color: TECH_GREEN, fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  calculateBtn: { backgroundColor: TECH_GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, marginTop: 20 },
  calculateBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  summaryBox: { backgroundColor: '#0a120a', padding: 12, marginTop: 5, borderWidth: 1, borderColor: DARK_TECH_GREEN },
  summaryText: { color: TECH_GREEN, fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', letterSpacing: 0.5 },
  protocolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  protocolPill: { flex: 1, minWidth: '45%', paddingVertical: 12, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center', backgroundColor: '#050505' },
  protocolPillActive: { backgroundColor: TECH_GREEN, borderColor: TECH_GREEN },
  protocolPillText: { color: TECH_GREEN, fontSize: 10, fontWeight: '900' },
  controlRow: { marginBottom: 22 },
  inputActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', padding: 5, borderWidth: 1, borderColor: '#111' },
  actionBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
  valueInput: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace' },
  macroGrid: { marginTop: 10 },
  resetBtnAction: { marginTop: 20, padding: 15, borderStyle: 'dotted', borderWidth: 1, borderColor: '#400' },
  resetBtnText: { color: '#600', fontSize: 9, fontWeight: 'bold', textAlign: 'center', fontFamily: 'monospace' }
});