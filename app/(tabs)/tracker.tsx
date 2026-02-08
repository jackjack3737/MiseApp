import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Keyboard, Alert, RefreshControl, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Trash2, Flame, Check, X, Minus, Beef, Fish, CookingPot, Leaf, Zap, Cookie, BookOpen, Activity, Footprints, Moon, RefreshCw, Cpu, Scale, BrainCircuit, AlertTriangle, CloudRain } from 'lucide-react-native';
import { getFoodFromAI } from '../../utils/gemini-cache'; 
import { useHealthConnect } from '../../hooks/useHealthConnect'; 

// IMPORTIAMO L'ALGORITMO
import { calculateMetabolicReactor } from '../../utils/smart-algorithm';

const TECH_GREEN = '#39FF14'; 
const NEON_BLUE = '#00E0FF'; 
const RED_ALERT = '#FF3333';
const DARK_TECH_GREEN = '#1b3517';
const BORDER_COLOR = '#1A1A1A';
const MEALS = ['Colazione', 'Pranzo', 'Cena', 'Snack'];

const IconMap: any = {
  meat: <Beef size={18} color={TECH_GREEN} />,
  fish: <Fish size={18} color={TECH_GREEN} />,
  eggs: <CookingPot size={18} color={TECH_GREEN} />,
  veggies: <Leaf size={18} color={TECH_GREEN} />,
  shake: <Zap size={18} color={TECH_GREEN} />,
  snack: <Cookie size={18} color={TECH_GREEN} />,
  default: <Cpu size={18} color={TECH_GREEN} />
};

// --- COMPONENTE: MACRO MIXER V5 (SENSORI + SINTOMI) ---
const MacroMixer = ({ totals, targets, smartAdj, healthData }: any) => {
    // Analisi Stato Critico (Sonno O Sintomi)
    const isCriticalMode = smartAdj.sleepFeedback.includes("CRITICO") || 
                           smartAdj.sleepFeedback.includes("SCARSO") || 
                           smartAdj.sleepFeedback.includes("⚠️");
    
    // Target Dinamici
    const baseCarbTarget = targets.c;
    const bonusCarb = smartAdj.bonusCarbs;
    const totalCarbLimit = baseCarbTarget + bonusCarb;
    
    // Linea Rossa (Safety Brake) - Scatta al 50% del base se siamo in modalità critica
    const redLineValue = baseCarbTarget / 2;
    const redLinePercentage = (redLineValue / (totalCarbLimit || 1)) * 100;

    const getPct = (val: number, max: number) => Math.min((val / (max || 1)) * 100, 100);

    return (
        <View style={styles.mixerContainer}>
            {/* HEADER */}
            <View style={styles.mixerHeader}>
                 <View>
                     <Text style={styles.mixerTitle}>BIO-REACTOR V5</Text>
                     <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                        <Activity size={10} color={smartAdj.bonusCarbs > 0 ? NEON_BLUE : (isCriticalMode ? RED_ALERT : '#666')} />
                        <Text style={[styles.mixerSubtitle, {color: smartAdj.bonusCarbs > 0 ? NEON_BLUE : (isCriticalMode ? RED_ALERT : '#666')}]}>
                            {smartAdj.intensityZone.toUpperCase()}
                        </Text>
                     </View>
                 </View>
                 <View style={styles.scoreBadge}>
                     <Text style={styles.burnScore}>{smartAdj.burnScore}</Text>
                     <Text style={styles.burnLabel}>SCORE</Text>
                 </View>
            </View>

            {/* TANKS UNIFORMI */}
            <View style={styles.tanksContainer}>
                
                {/* 1. PROTEINE */}
                <View style={styles.tankWrapper}>
                    <Text style={styles.tankLabel}>PRO</Text>
                    <View style={styles.tankTrack}>
                        <View style={[styles.tankFill, { height: `${getPct(totals.p, targets.p)}%`, backgroundColor: '#FFF' }]} />
                    </View>
                    <Text style={styles.tankValue}>{totals.p}/{targets.p}g</Text>
                </View>

                {/* 2. CARBOIDRATI (Logica Avanzata) */}
                <View style={styles.tankWrapper}> 
                    <Text style={[styles.tankLabel, {color: isCriticalMode ? RED_ALERT : TECH_GREEN}]}>
                        CARB
                    </Text>
                    
                    <View style={[styles.tankTrack, isCriticalMode && {borderColor: RED_ALERT}]}>
                        <View style={[
                            styles.tankFill, 
                            { 
                                height: `${getPct(totals.c, totalCarbLimit)}%`, 
                                backgroundColor: isCriticalMode && totals.c > redLineValue ? RED_ALERT : (bonusCarb > 0 ? NEON_BLUE : TECH_GREEN) 
                            }
                        ]} />
                        
                        {/* LINEA DI BLOCCO (Se attiva) */}
                        {isCriticalMode && (
                            <View style={[styles.redDashedLine, { bottom: `${redLinePercentage}%` }]}>
                                <Text style={styles.limitLabel}>{redLineValue}g</Text>
                            </View>
                        )}
                    </View>
                    
                    <Text style={[styles.tankValue, isCriticalMode && {color: RED_ALERT}]}>
                        {totals.c}/{Math.round(totalCarbLimit)}g
                    </Text>
                </View>

                {/* 3. GRASSI */}
                <View style={styles.tankWrapper}>
                    <Text style={styles.tankLabel}>FAT</Text>
                    <View style={styles.tankTrack}>
                        <View style={[styles.tankFill, { height: `${getPct(totals.f, targets.f)}%`, backgroundColor: DARK_TECH_GREEN }]} />
                    </View>
                    <Text style={styles.tankValue}>{totals.f}/{targets.f}g</Text>
                </View>
            </View>

            {/* --- NUOVA SEZIONE: DATI SENSORI --- */}
            <View style={styles.sensorsRow}>
                <View style={styles.sensorItem}>
                    <Moon size={14} color={healthData.sleep < 6 ? RED_ALERT : '#888'} />
                    <Text style={[styles.sensorText, healthData.sleep < 6 && {color: RED_ALERT}]}>
                        {healthData.sleep || 0}h SONNO
                    </Text>
                </View>
                <View style={styles.sensorItem}>
                    <Footprints size={14} color={healthData.steps > 8000 ? TECH_GREEN : '#888'} />
                    <Text style={styles.sensorText}>{healthData.steps || 0} PASSI</Text>
                </View>
                <View style={styles.sensorItem}>
                    <Flame size={14} color={healthData.calories > 400 ? NEON_BLUE : '#888'} />
                    <Text style={styles.sensorText}>{Math.round(healthData.calories || 0)} KCAL</Text>
                </View>
            </View>

            {/* ALERT FOOTER (Feedback Testuale) */}
            {isCriticalMode ? (
                <View style={[styles.alertRow, {backgroundColor: 'rgba(255, 51, 51, 0.15)'}]}>
                    <AlertTriangle size={12} color={RED_ALERT} />
                    <Text style={[styles.alertText, {color: RED_ALERT}]}>{smartAdj.sleepFeedback.replace(/⚠️/g, '').trim()}</Text>
                </View>
            ) : smartAdj.bonusCarbs > 0 ? (
                <View style={styles.alertRow}>
                    <Flame size={12} color={NEON_BLUE} />
                    <Text style={[styles.alertText, {color: NEON_BLUE}]}>METABOLISMO ATTIVO: Bonus +{smartAdj.bonusCarbs}g</Text>
                </View>
            ) : null}
        </View>
    );
};

export default function TrackerScreen() {
  const router = useRouter();
  const { isLinked, syncData, data: healthData } = useHealthConnect();

  const [inputText, setInputText] = useState('');
  const [selectedMeal, setSelectedMeal] = useState('Pranzo');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [targets, setTargets] = useState({ kcal: 2000, c: 25, p: 160, f: 140, protocol: 'Keto' });
  const [refreshing, setRefreshing] = useState(false);
  const [symptomFactor, setSymptomFactor] = useState({ factor: 1.0, name: '' });

  const [modalVisible, setModalVisible] = useState(false);
  const [tempFood, setTempFood] = useState<any>(null);
  const [currentWeight, setCurrentWeight] = useState(100);
  const [foundRecipeId, setFoundRecipeId] = useState<string | null>(null);

  const clearLocalCache = async () => {
    try { await AsyncStorage.removeItem('gemini_cache'); } catch (e) {}
  };

  const loadData = async () => {
    try {
        const savedProfile = await AsyncStorage.getItem('@user_profile');
        if (savedProfile) {
            const p = JSON.parse(savedProfile);
            setTargets({
                kcal: parseInt(p.targetCalories) || 2000,
                c: parseInt(p.targetCarbs) || 25,
                p: parseInt(p.protein) || 160,
                f: parseInt(p.fat) || 140,
                protocol: p.protocol || 'Keto'
            });
        }
        
        // --- FIX CRUCIALE: Se non c'è dato (cancellato), torna a 1.0 ---
        const symptomData = await AsyncStorage.getItem('@user_daily_symptom_factor');
        if (symptomData) {
            setSymptomFactor(JSON.parse(symptomData));
        } else {
            setSymptomFactor({ factor: 1.0, name: '' }); // RESET DEFAULT
        }

        const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
        if (savedLogs) {
            const today = new Date().toISOString().split('T')[0];
            const todayLogs = JSON.parse(savedLogs).filter((log: any) => log.date === today);
            setLogs(todayLogs.sort((a: any, b: any) => Number(b.id) - Number(a.id)));
            calculateTotals(todayLogs);
        }
    } catch (e) { console.log(e); }
  };

  const calculateTotals = (data: any[]) => {
    const totals = data.reduce((acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        c: acc.c + (item.carbs || 0),
        p: acc.p + (item.proteins || 0),
        f: acc.f + (item.fats || 0),
    }), { kcal: 0, c: 0, p: 0, f: 0 });
    setTodayTotals(totals);
  };

  useFocusEffect(useCallback(() => { 
    loadData(); 
    if(isLinked) syncData(); 
  }, []));

  const onRefresh = async () => { 
    setRefreshing(true); 
    await clearLocalCache(); 
    await loadData(); 
    await syncData(); 
    setRefreshing(false); 
  };

  const checkForRecipe = async (foodName: string) => {
    setFoundRecipeId(null);
    try {
      const { data } = await supabase.from('recipes').select('id').ilike('title', `%${foodName}%`).maybeSingle();
      if (data) setFoundRecipeId(data.id);
    } catch (e) {}
  };

  const safeParse = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
      return 0;
  };

  async function searchFood() {
    if (!inputText.trim()) return;
    setLoading(true); Keyboard.dismiss();
    try {
        const response = await getFoodFromAI(inputText);
        let data = (typeof response === 'string') 
            ? { food_name: response, kcal: 0, carbs: 0, proteins: 0, fats: 0, weight_g: 100 }
            : response;

        if (data.isText) {
            Alert.alert("SISTEMA_IA", data.ai_advice);
            setLoading(false);
            return;
        }

        // --- FIX: PULIZIA NOME CIBO ---
        const cleanName = data.food_name.replace(/^(Colazione|Pranzo|Cena|Snack|Ecco|Dati|Risultato)[:\s- \t]*/i, '').trim();

        setCurrentWeight(data.weight_g || 100);
        setTempFood({ 
            name: cleanName, 
            kcal: safeParse(data.kcal), c: safeParse(data.carbs || data.carb), 
            p: safeParse(data.proteins || data.protein), f: safeParse(data.fats || data.fat), 
            weight_g: safeParse(data.weight_g || 100), category_icon: 'default'
        });
        await checkForRecipe(cleanName);
        setModalVisible(true);
    } catch (e) { 
        await clearLocalCache();
        Alert.alert("SISTEMA", "Rilevata anomalia nel flusso AI. Riprova."); 
    } 
    finally { setLoading(false); }
  }

  async function confirmAndSave() {
    if(!tempFood) return;
    const ratio = currentWeight / (tempFood.weight_g || 100);
    const today = new Date().toISOString().split('T')[0];
    
    const newEntry = { 
        id: Date.now().toString(), meal_type: selectedMeal, food_name: tempFood.name, 
        kcal: Math.round(tempFood.kcal * ratio), carbs: Math.round(tempFood.c * ratio), 
        proteins: Math.round(tempFood.p * ratio), fats: Math.round(tempFood.f * ratio), 
        date: today, label: `${currentWeight}g`, icon_type: 'default', recipe_id: foundRecipeId
    };

    const savedLogsJson = await AsyncStorage.getItem('@user_daily_logs');
    const currentLogs = savedLogsJson ? JSON.parse(savedLogsJson) : [];
    await AsyncStorage.setItem('@user_daily_logs', JSON.stringify([newEntry, ...currentLogs]));
    setModalVisible(false); setInputText(''); loadData();
  }

  async function deleteLog(id: string) {
      const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
      if(savedLogs) {
          const filtered = JSON.parse(savedLogs).filter((l:any)=>l.id!==id);
          await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(filtered));
          loadData();
      }
  }

  const smartAdjustment = calculateMetabolicReactor({
      steps: healthData.steps || 0,
      activeCalories: healthData.calories || 0, 
      sleepHours: healthData.sleep || 0, 
      protocol: targets.protocol as any,
      symptomFactor: symptomFactor.factor,
      symptomName: symptomFactor.name
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View>
            <Text style={styles.subtitle}>{new Date().toLocaleDateString('it-IT', { weekday: 'long' }).toUpperCase()}</Text>
            <Text style={styles.title}>DASHBOARD_LOG</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
             <RefreshCw size={20} color={TECH_GREEN} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TECH_GREEN} />}>
        <View style={{marginHorizontal: 15, marginBottom: 15}}>
             <MacroMixer totals={todayTotals} targets={targets} smartAdj={smartAdjustment} healthData={healthData} />
        </View>

        <View style={styles.inputSection}>
            <View style={styles.mealTabs}>
                {MEALS.map(meal => (
                    <TouchableOpacity key={meal} onPress={() => setSelectedMeal(meal)} style={[styles.mealTab, selectedMeal === meal && styles.mealTabActive]}>
                        <Text style={[styles.mealTabText, selectedMeal === meal && {color:'#000'}]}>{meal.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.inputWrapper}>
                <TextInput style={styles.textInput} placeholder="AGGIUNGI ALIMENTO..." placeholderTextColor={DARK_TECH_GREEN} value={inputText} onChangeText={setInputText} onSubmitEditing={searchFood} />
                <TouchableOpacity style={styles.sendBtn} onPress={searchFood} disabled={loading}>
                    {loading ? <ActivityIndicator color="#000" size="small" /> : <Plus size={24} color="#000" />}
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.logSection}>
            <Text style={styles.sectionHeader}>{'>'} DATABASE_RILEVAZIONI_ATTIVE</Text>
            {logs.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <BrainCircuit size={30} color={DARK_TECH_GREEN} />
                    <Text style={styles.emptyText}>NESSUN_RECORD_RILEVATO</Text>
                </View>
            ) : (
                logs.map((item: any) => (
                    <View key={item.id} style={styles.logItem}>
                        <View style={styles.logIcon}>{IconMap[item.icon_type] || IconMap.default}</View>
                        <View style={{flex: 1}}>
                            <View style={styles.logHeaderRow}>
                              <Text style={styles.logFoodName}>{item.food_name.toUpperCase()}</Text>
                              <Text style={styles.logKcalText}>{item.kcal} KCAL</Text>
                            </View>
                            <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                                <Text style={styles.logMeta}>
                                    {item.meal_type.toUpperCase()} • {item.label} • 
                                    <Text style={{color:'#FFF'}}> P:{item.proteins}</Text> 
                                    <Text style={{color:TECH_GREEN}}> C:{item.carbs}</Text> 
                                    <Text style={{color:DARK_TECH_GREEN}}> F:{item.fats}</Text>
                                </Text>
                                {item.recipe_id && (
                                    <TouchableOpacity onPress={() => router.push(`/recipe-detail?id=${item.recipe_id}`)}>
                                        <BookOpen size={12} color={TECH_GREEN} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}>
                            <Trash2 size={16} color="#333" />
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    {/* TITOLO FISSO PER NON COPRIRE I DATI */}
                    <Text style={styles.modalTitle}>ANALISI AI COMPLETATA</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color={TECH_GREEN} /></TouchableOpacity>
                </View>
                {tempFood && (
                    <>
                        <Text style={styles.foodNameDisplay}>{tempFood.name.toUpperCase()}</Text>
                        
                        {/* ANTEPRIMA MACRO MODALE */}
                        <View style={styles.macroPreview}>
                            <Text style={styles.macroPrevItem}>{Math.round(tempFood.kcal * (currentWeight/tempFood.weight_g))} KCAL</Text>
                            <Text style={styles.macroPrevItem}>P: {Math.round(tempFood.p * (currentWeight/tempFood.weight_g))}</Text>
                            <Text style={[styles.macroPrevItem, {color: TECH_GREEN}]}>C: {Math.round(tempFood.c * (currentWeight/tempFood.weight_g))}</Text>
                            <Text style={styles.macroPrevItem}>F: {Math.round(tempFood.f * (currentWeight/tempFood.weight_g))}</Text>
                        </View>

                        {foundRecipeId && (
                           <View style={styles.recipeFoundBadge}>
                               <BookOpen size={12} color="#000" />
                               <Text style={styles.recipeFoundText}>RICETTA_SISTEMA_DISPONIBILE</Text>
                           </View>
                        )}
                        <View style={styles.weightControl}>
                            <TouchableOpacity onPress={() => setCurrentWeight(p=>Math.max(10, p-50))} style={styles.portionBtn}><Minus color={TECH_GREEN} /></TouchableOpacity>
                            <Text style={styles.weightValue}>{currentWeight}<Text style={{fontSize: 14, color:DARK_TECH_GREEN}}>G</Text></Text>
                            <TouchableOpacity onPress={() => setCurrentWeight(p=>p+50)} style={styles.portionBtn}><Plus color={TECH_GREEN} /></TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}>
                            <Text style={styles.confirmBtnText}>MEMORIZZA_RECORD</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  subtitle: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2, fontFamily: 'monospace', opacity: 0.7 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  refreshBtn: { padding: 10, backgroundColor: '#050505', borderWidth: 1, borderColor: DARK_TECH_GREEN },
  
  mixerContainer: { backgroundColor: '#080808', padding: 20, borderTopWidth: 1, borderTopColor: BORDER_COLOR, borderWidth: 1, borderColor: '#111', borderRadius: 4 },
  mixerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'flex-start' },
  mixerTitle: { color: TECH_GREEN, fontSize: 11, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 0.5 },
  mixerSubtitle: { fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' },
  scoreBadge: { backgroundColor: '#111', padding: 5, borderRadius: 2, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  burnScore: { color: '#fff', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  burnLabel: { color: DARK_TECH_GREEN, fontSize: 7, fontWeight: 'bold' },

  tanksContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160 },
  tankWrapper: { alignItems: 'center', width: '30%' },
  tankLabel: { color: '#666', fontSize: 9, fontWeight: '900', fontFamily: 'monospace', marginBottom: 8 },
  tankTrack: { width: '100%', flex: 1, backgroundColor: '#050505', borderWidth: 1, borderColor: '#222', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 2, position: 'relative' },
  tankFill: { width: '100%', borderRadius: 1 },
  tankValue: { color: '#FFF', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace', marginTop: 8 },
  
  redDashedLine: { position: 'absolute', width: '100%', height: 2, borderColor: RED_ALERT, borderTopWidth: 1, borderStyle: 'dashed', zIndex: 10, alignItems: 'flex-end' },
  limitLabel: { color: RED_ALERT, fontSize: 7, fontWeight: '900', backgroundColor: '#000', paddingHorizontal: 2, marginTop: -8 },

  alertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 15, backgroundColor: 'rgba(0, 224, 255, 0.05)', padding: 6, borderRadius: 2 },
  alertText: { color: NEON_BLUE, fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' },

  // STILI SENSORI
  sensorsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#111' },
  sensorItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sensorText: { color: '#888', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },

  inputSection: { padding: 20 },
  mealTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mealTab: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#050505', borderWidth: 1, borderColor: '#111' },
  mealTabActive: { backgroundColor: TECH_GREEN, borderColor: TECH_GREEN },
  mealTabText: { color: TECH_GREEN, fontSize: 8, fontWeight: '900', fontFamily: 'monospace' },
  inputWrapper: { flexDirection: 'row', backgroundColor: '#050505', borderWidth: 1, borderColor: DARK_TECH_GREEN },
  textInput: { flex: 1, color: TECH_GREEN, padding: 15, fontSize: 13, fontFamily: 'monospace' },
  sendBtn: { width: 60, backgroundColor: TECH_GREEN, justifyContent: 'center', alignItems: 'center' },
  
  logSection: { paddingHorizontal: 20 },
  sectionHeader: { color: TECH_GREEN, fontSize: 9, fontWeight: '900', marginBottom: 15, fontFamily: 'monospace', opacity: 0.5 },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 15, borderBottomWidth: 1, borderBottomColor: '#111' },
  logIcon: { marginRight: 15 },
  logHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logFoodName: { color: '#fff', fontSize: 12, fontWeight: '900', fontFamily: 'monospace', flex: 1 },
  logKcalText: { color: TECH_GREEN, fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' },
  logMeta: { color: '#444', fontSize: 9, fontFamily: 'monospace', marginTop: 2 },
  deleteBtn: { padding: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 40, opacity: 0.3 },
  emptyText: { color: TECH_GREEN, fontSize: 9, fontWeight: 'bold', marginTop: 10, fontFamily: 'monospace' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#080808', padding: 25, borderTopWidth: 1, borderTopColor: TECH_GREEN },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  foodNameDisplay: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 10, fontFamily: 'monospace' },
  macroPreview: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#111', padding: 10, marginBottom: 15, borderRadius: 4, borderWidth: 1, borderColor: '#333' },
  macroPrevItem: { color: '#CCC', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  recipeFoundBadge: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor: TECH_GREEN, alignSelf:'center', paddingHorizontal:10, paddingVertical:4, borderRadius:2, marginBottom:20 },
  recipeFoundText: { color:'#000', fontSize:8, fontWeight:'bold', fontFamily:'monospace' },
  weightControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  portionBtn: { width: 60, height: 60, backgroundColor: '#000', borderWidth: 1, borderColor: DARK_TECH_GREEN, justifyContent: 'center', alignItems: 'center' },
  weightValue: { color: '#fff', fontSize: 32, fontWeight: '900', fontFamily: 'monospace' },
  confirmBtn: { backgroundColor: TECH_GREEN, height: 60, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 12, fontWeight: '900', fontFamily: 'monospace' },
});