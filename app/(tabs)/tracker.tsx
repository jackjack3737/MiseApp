import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Keyboard, Alert, RefreshControl, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Trash2, Flame, Utensils, ShieldCheck, BrainCircuit, X, Minus, Search, Beef, Fish, CookingPot, Leaf, Zap, Cookie, ArrowRight, ExternalLink, BookOpen, Activity, AlertCircle, Footprints, Timer, Move, Moon, RefreshCw } from 'lucide-react-native';
import { getFoodFromAI } from '../../utils/gemini-cache'; 

// --- HEALTH CONNECT (HOOK SICURO) ---
import { useHealthConnect } from '../../hooks/useHealthConnect'; 

// --- COSTANTI E UTILS ---
const MEALS = ['Colazione', 'Pranzo', 'Cena', 'Snack'];
const IconMap: any = {
  meat: <Beef size={18} color="#ff7675" />,
  fish: <Fish size={18} color="#74b9ff" />,
  eggs: <CookingPot size={18} color="#fdcb6e" />,
  veggies: <Leaf size={18} color="#55efc4" />,
  shake: <Zap size={18} color="#a29bfe" />,
  snack: <Cookie size={18} color="#fab1a0" />,
  default: <Utensils size={18} color="#00cec9" />
};

const getMealByTime = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Colazione';
    if (hour >= 11 && hour < 15) return 'Pranzo';
    if (hour >= 15 && hour < 19) return 'Snack';
    return 'Cena';
};

// --- COMPONENTE: MACRO MIXER ---
const MacroMixer = ({ totals, targets, stepsBonus, sportBonus, sleepMalus }: any) => {
    const baseCarbTarget = targets.c;
    const dynamicCarbTarget = Math.max(0, baseCarbTarget + stepsBonus + sportBonus - sleepMalus);
    const safeCap = 80; 
    const effectiveCarbTarget = sportBonus > 15 ? dynamicCarbTarget : Math.min(dynamicCarbTarget, safeCap);
    const isOverdrive = sportBonus > 15;
    const isSleepDeprived = sleepMalus > 0;
    const getHeight = (val: number, max: number) => Math.min((val / (max || 1)) * 100, 100);

    return (
        <View style={styles.mixerContainer}>
            <View style={styles.mixerHeader}>
                 <Text style={styles.mixerTitle}>METABOLIC MIXER</Text>
                 <Text style={[styles.mixerSubtitle, isOverdrive ? {color:'#8A2BE2'} : isSleepDeprived ? {color:'#ff7675'} : {}]}>
                    {isOverdrive ? '⚡ OVERDRIVE' : isSleepDeprived ? '⚠️ LOW SLEEP' : 'STANDARD MODE'}
                 </Text>
            </View>

            <View style={styles.barsContainer}>
                <View style={styles.barGroup}>
                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${getHeight(totals.p, targets.p)}%`, backgroundColor: '#74b9ff' }]} />
                    </View>
                    <Text style={styles.barLabel}>PRO</Text>
                    <Text style={styles.barValue}>{Math.round(totals.p)}/{targets.p}</Text>
                </View>

                <View style={styles.barGroup}>
                    <View style={[styles.barTrack, {borderColor: isOverdrive ? '#8A2BE2' : '#333'}]}>
                         {effectiveCarbTarget > baseCarbTarget && (
                             <View style={[styles.targetLine, { bottom: `${(baseCarbTarget / effectiveCarbTarget) * 100}%` }]} />
                         )}
                        <View style={[
                            styles.barFill, 
                            { 
                                height: `${getHeight(totals.c, effectiveCarbTarget)}%`, 
                                backgroundColor: isOverdrive ? '#8A2BE2' : isSleepDeprived ? '#ff7675' : '#00cec9',
                                boxShadow: isOverdrive ? '0px 0px 10px #8A2BE2' : undefined 
                            }
                        ]} />
                    </View>
                    <Text style={[styles.barLabel, {color: isOverdrive ? '#8A2BE2' : '#00cec9', fontWeight:'900'}]}>NET C.</Text>
                    <Text style={styles.barValue}>{Math.round(totals.c)}/{Math.round(effectiveCarbTarget)}</Text>
                </View>

                <View style={styles.barGroup}>
                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${getHeight(totals.f, targets.f)}%`, backgroundColor: '#ff7675' }]} />
                    </View>
                    <Text style={styles.barLabel}>FAT</Text>
                    <Text style={styles.barValue}>{Math.round(totals.f)}/{targets.f}</Text>
                </View>
            </View>

            {(isOverdrive || isSleepDeprived || stepsBonus > 0) && (
                <View style={styles.bonusRow}>
                    {stepsBonus > 0 && <Text style={styles.bonusTag}>👣 +{stepsBonus}g</Text>}
                    {sportBonus > 0 && <Text style={[styles.bonusTag, {color:'#8A2BE2'}]}>🔥 +{sportBonus}g</Text>}
                    {isSleepDeprived && <Text style={[styles.bonusTag, {color:'#ff7675'}]}>💤 -{sleepMalus}g</Text>}
                </View>
            )}
        </View>
    );
};

// --- COMPONENTE RAW HEALTH DATA ---
const HealthStatsPanel = ({ data }: any) => (
    <View style={styles.statsGrid}>
        <View style={styles.statItem}>
            <Footprints size={16} color="#00cec9" />
            <Text style={styles.statValue}>{data.steps || 0}</Text>
            <Text style={styles.statLabel}>PASSI</Text>
        </View>
        <View style={styles.statItem}>
            <Flame size={16} color="#ff7675" />
            <Text style={styles.statValue}>{Math.round(data.calories || 0)}</Text>
            <Text style={styles.statLabel}>KCAL ATT</Text>
        </View>
        <View style={styles.statItem}>
            <Moon size={16} color={data.sleep < 7 ? "#ff7675" : "#a29bfe"} />
            <Text style={[styles.statValue, data.sleep < 7 && data.sleep > 0 && {color: '#ff7675'}]}>
                {data.sleep || 0}<Text style={{fontSize:10}}>h</Text>
            </Text>
            <Text style={styles.statLabel}>SONNO</Text>
        </View>
    </View>
);

export default function TrackerScreen() {
  const router = useRouter();
  
  // --- HOOK SALUTE SICURO ---
  const { isLinked, connect, syncData, data: healthData } = useHealthConnect();

  const [inputText, setInputText] = useState('');
  const [selectedMeal, setSelectedMeal] = useState(getMealByTime());
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [targets, setTargets] = useState({ kcal: 2000, c: 25, p: 160, f: 140 });

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [tempFood, setTempFood] = useState<any>(null);
  const [mode, setMode] = useState('GRAMS'); 
  const [currentWeight, setCurrentWeight] = useState(100); 
  const [currentMultiplier, setCurrentMultiplier] = useState(1); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [foundRecipeId, setFoundRecipeId] = useState<string | null>(null);

  // --- AZIONE UTENTE: SYNC ---
  const handleSyncPress = async () => {
    const success = await connect();
    if(success) {
      console.log("Sincronizzazione riuscita");
    }
  };

  const loadData = async () => {
    try {
        const savedProfile = await AsyncStorage.getItem('@user_profile');
        if (savedProfile) {
            const p = JSON.parse(savedProfile);
            setTargets({
                kcal: parseInt(p.targetCalories) || 2000,
                c: parseInt(p.carbs) || 25,
                p: parseInt(p.protein) || 160,
                f: parseInt(p.fat) || 140,
            });
        }
        const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
        if (savedLogs) {
            let allLogs = JSON.parse(savedLogs);
            const today = new Date().toISOString().split('T')[0];
            const todayLogs = allLogs.filter((log: any) => log.date === today);
            todayLogs.sort((a: any, b: any) => Number(b.id) - Number(a.id));
            setLogs(todayLogs);
            calculateTotals(todayLogs);
        } else {
            setLogs([]);
            setTodayTotals({ kcal: 0, c: 0, p: 0, f: 0 });
        }
    } catch (e) { console.error("Errore loadData:", e); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));
  const onRefresh = async () => { 
    setRefreshing(true); 
    await loadData(); 
    await syncData(); // Sync salute al pull-to-refresh
    setRefreshing(false); 
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

  // --- LOGICA BONUS DINAMICA ---
  const netSteps = Math.max(0, (healthData.steps || 0) - 3000);
  const stepsBonus = Math.floor(netSteps / 1000) * 1.5;
  const sportBonus = Math.floor((healthData.calories || 0) / 200) * 10;
  const sleepMalus = healthData.sleep < 7 && healthData.sleep > 0 ? Math.round((7 - healthData.sleep) * 5) : 0;

  const symptomsList = logs.filter(l => l.meal_type === 'SINTOMO');
  const mealsList = logs.filter(l => l.meal_type !== 'SINTOMO');

  // FUNZIONI INPUT AI
  const checkForRecipe = async (foodName: string) => { setFoundRecipeId(null); if(!foodName) return; try { const {data}=await supabase.from('recipes').select('id').ilike('title', foodName).maybeSingle(); if(data) setFoundRecipeId(data.id); } catch(e){} };
  
  async function searchFood() {
    if (!inputText.trim()) return;
    setLoading(true); Keyboard.dismiss();
    try {
        const data = await getFoodFromAI(inputText);
        setEditingId(null); 
        const detectedWeight = data.weight_g || 100;
        setMode('GRAMS'); 
        setCurrentWeight(detectedWeight);
        setTempFood({ 
            name: data.food_name, 
            kcal: data.kcal, 
            c: data.carbs, 
            p: data.proteins, 
            f: data.fats, 
            weight_g: detectedWeight,
            category_icon: 'default', 
            recipe_id: null 
        });
        checkForRecipe(data.food_name);
        setModalVisible(true);
    } catch (e) { Alert.alert("Errore AI", "Riprova."); } finally { setLoading(false); }
  }

  const getFinalValues = () => {
      if (!tempFood) return { k: 0, c: 0, p: 0, f: 0, label: "" };
      const ratio = mode === 'PORTIONS' ? currentMultiplier : currentWeight / (tempFood.weight_g || 100);
      return { 
          k: Math.round(tempFood.kcal * ratio), 
          c: Math.round(tempFood.c * ratio), 
          p: Math.round(tempFood.p * ratio), 
          f: Math.round(tempFood.f * ratio), 
          label: mode === 'PORTIONS' ? `${currentMultiplier}x` : `${currentWeight}g` 
      };
  };

  const adjustAmount = (delta: number) => { 
      if(mode==='PORTIONS') setCurrentMultiplier(p=>Math.max(0.25, p+delta)); 
      else setCurrentWeight(p=>Math.max(10, p+(delta*10))); 
  };
  
  const setPreset = (mult: number) => {
      if (mode === 'PORTIONS') setCurrentMultiplier(mult);
      else setCurrentWeight(Math.round((tempFood.weight_g || 100) * mult));
  };

  async function confirmAndSave() {
    if(!tempFood) return;
    const final = getFinalValues(); const today = new Date().toISOString().split('T')[0];
    try {
        const savedLogsJson = await AsyncStorage.getItem('@user_daily_logs');
        let currentLogs = savedLogsJson ? JSON.parse(savedLogsJson) : [];
        const newEntry = { id: editingId || Date.now().toString(), meal_type: selectedMeal, food_name: tempFood.name, kcal: final.k, carbs: final.c, proteins: final.p, fats: final.f, date: today, label: final.label, icon_type: tempFood.category_icon || 'default', recipe_id: tempFood.recipe_id || foundRecipeId };
        if(editingId) currentLogs = currentLogs.map((l:any) => l.id === editingId ? newEntry : l);
        else currentLogs = [newEntry, ...currentLogs];
        await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(currentLogs));
        setModalVisible(false); setTempFood(null); setEditingId(null); setInputText(''); loadData();
    } catch(e) { Alert.alert("Errore", "Salvataggio fallito."); }
  }

  async function deleteLog(id: string) {
      const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
      if(savedLogs) { const filtered = JSON.parse(savedLogs).filter((l:any)=>l.id!==id); await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(filtered)); loadData(); }
  }

  const handleItemPress = (item: any) => { 
    if (item.meal_type === 'SINTOMO') return; 
    setEditingId(item.id);
    const safeLabel = item.label || '100g'; 
    const isPortion = safeLabel.includes('x');
    setMode(isPortion ? 'PORTIONS' : 'GRAMS'); 
    const numericVal = parseFloat(safeLabel) || 100;
    if (isPortion) setCurrentMultiplier(numericVal);
    else setCurrentWeight(numericVal);
    setTempFood({
        name: item.food_name, 
        kcal: item.kcal, 
        c: item.carbs, 
        p: item.proteins, 
        f: item.fats, 
        weight_g: isPortion ? 100 : numericVal,
        category_icon: item.icon_type || 'default',
        recipe_id: item.recipe_id
    }); 
    setModalVisible(true); 
  };
  
  const finalVals = getFinalValues();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
            <Text style={styles.subtitle}>{new Date().toLocaleDateString('it-IT', { weekday: 'long' }).toUpperCase()}</Text>
            <Text style={styles.title}>BIO-LOG</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleSyncPress}>
             <RefreshCw size={20} color={isLinked ? "#00cec9" : "#636e72"} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00cec9" />}>
        <View style={{marginHorizontal: 20, marginBottom: 15}}>
             <MacroMixer 
                totals={todayTotals}
                targets={targets}
                stepsBonus={stepsBonus}
                sportBonus={sportBonus}
                sleepMalus={sleepMalus}
             />
        </View>

        <View style={{marginHorizontal: 20, marginBottom: 25}}>
             <HealthStatsPanel data={healthData} />
        </View>

        <View style={styles.inputSection}>
            <View style={styles.mealTabs}>
                {MEALS.map(meal => (
                    <TouchableOpacity key={meal} onPress={() => setSelectedMeal(meal)} style={[styles.mealTab, selectedMeal === meal && styles.mealTabActive]}>
                        <Text style={[styles.mealTabText, selectedMeal === meal && {color:'#000'}]}>{meal}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.inputWrapper}>
                <TextInput 
                    style={styles.textInput}
                    placeholder="Cosa hai mangiato?"
                    placeholderTextColor="#444"
                    value={inputText}
                    onChangeText={setInputText}
                />
                <TouchableOpacity style={[styles.sendBtn, loading && {opacity: 0.5}]} onPress={searchFood} disabled={loading}>
                    {loading ? <ActivityIndicator color="#000" size="small" /> : <Plus size={24} color="#000" />}
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.logSection}>
            {symptomsList.length > 0 && (
                <View style={styles.symptomsContainer}>
                    <Text style={[styles.sectionTitle, {color: '#ff7675'}]}>STATO BIO-FISICO</Text>
                    {symptomsList.map((item) => (
                        <View key={item.id} style={styles.symptomItem}>
                            <View style={styles.symptomIcon}><Activity size={18} color="#ff7675" /></View>
                            <View style={{flex: 1}}><Text style={styles.symptomName}>{item.food_name}</Text><Text style={styles.symptomLabel}>{item.label}</Text></View>
                            <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}><X size={16} color="#636e72" /></TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
            <Text style={styles.sectionTitle}>PASTI REGISTRATI ({Math.round(todayTotals.kcal)} kcal)</Text>
            {mealsList.length === 0 ? (
                <View style={styles.emptyContainer}><BrainCircuit size={30} color="#111" /><Text style={styles.emptyText}>Digiuno attivo. Nessun pasto.</Text></View>
            ) : (
                mealsList.map((item: any) => (
                    <View key={item.id} style={styles.logItem}>
                        <View style={styles.logIcon}>{IconMap[item.icon_type] || IconMap.default}</View>
                        <TouchableOpacity style={{flex: 1, marginRight: 10}} onPress={() => handleItemPress(item)} activeOpacity={0.6}>
                            <View style={styles.logHeaderRow}>
                              <Text style={styles.logFoodName}>{item.food_name}</Text>
                              <View style={{flexDirection:'row', alignItems:'center'}}>
                                <Text style={styles.logKcalText}>{item.kcal} kcal</Text>
                                {item.recipe_id && <BookOpen size={12} color="#00cec9" style={{marginLeft: 6}}/>}
                              </View>
                            </View>
                            <Text style={styles.logMeta}>{item.meal_type} • {item.label || '100g'} • P: {item.proteins}g</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}><Trash2 size={18} color="#333" /></TouchableOpacity>
                    </View>
                ))
            )}
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{editingId ? 'MODIFICA' : 'BIO-ANALISI'}</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#636e72" /></TouchableOpacity>
                </View>
                {tempFood && (
                    <>
                        <Text style={styles.foodName}>{tempFood.name.toUpperCase()}</Text>
                        <View style={styles.portionControl}>
                            <TouchableOpacity onPress={() => adjustAmount(-1)} style={styles.portionBtn}><Minus size={24} color="#fff" /></TouchableOpacity>
                            <View style={{alignItems:'center'}}>
                                <Text style={styles.portionValue}>{mode === 'GRAMS' ? currentWeight : currentMultiplier}<Text style={{fontSize: 16, color:'#636e72'}}>{mode === 'GRAMS' ? 'g' : 'x'}</Text></Text>
                            </View>
                            <TouchableOpacity onPress={() => adjustAmount(1)} style={styles.portionBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
                        </View>
                        
                        <View style={styles.presetRow}>
                             <TouchableOpacity onPress={() => setPreset(0.25)} style={styles.presetBtn}><Text style={styles.presetText}>¼</Text></TouchableOpacity>
                             <TouchableOpacity onPress={() => setPreset(0.5)} style={styles.presetBtn}><Text style={styles.presetText}>½</Text></TouchableOpacity>
                             <TouchableOpacity onPress={() => setPreset(1)} style={[styles.presetBtn, {backgroundColor: '#333'}]}><Text style={[styles.presetText, {color:'#fff'}]}>1x</Text></TouchableOpacity>
                             <TouchableOpacity onPress={() => setPreset(2)} style={styles.presetBtn}><Text style={styles.presetText}>2x</Text></TouchableOpacity>
                        </View>

                        <View style={styles.previewBox}>
                            <View style={styles.previewItem}><Text style={[styles.previewVal, {color:'#74b9ff'}]}>{finalVals.p}g</Text><Text style={styles.previewLabel}>PRO</Text></View>
                            <View style={styles.previewItem}><Text style={[styles.previewVal, {color:'#fdcb6e'}]}>{finalVals.c}g</Text><Text style={styles.previewLabel}>CARB</Text></View>
                            <View style={styles.previewItem}><Text style={[styles.previewVal, {color:'#ff7675'}]}>{finalVals.f}g</Text><Text style={styles.previewLabel}>FAT</Text></View>
                        </View>
                        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}><Text style={styles.confirmBtnText}>SALVA</Text></TouchableOpacity>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingTop: 20 },
  subtitle: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  refreshBtn: { padding: 10, backgroundColor: '#0a0a0a', borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  mixerContainer: { backgroundColor: '#111', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#222' },
  mixerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mixerTitle: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  mixerSubtitle: { color: '#636e72', fontSize: 9, fontWeight: '700' },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 },
  barGroup: { alignItems: 'center', width: 50 },
  barTrack: { width: 14, height: 100, backgroundColor: '#1a1a1a', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: 8, borderWidth:1, borderColor:'#2a2a2a' },
  barFill: { width: '100%', borderRadius: 7 },
  targetLine: { position: 'absolute', width: '200%', left: '-50%', height: 2, backgroundColor: '#fff', zIndex: 10, opacity: 0.5 },
  barLabel: { color: '#636e72', fontSize: 9, fontWeight: '800', marginBottom: 2 },
  barValue: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bonusRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#222' },
  bonusTag: { color: '#00cec9', fontSize: 10, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statItem: { flex: 1, backgroundColor: '#0a0a0a', padding: 12, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 5 },
  statLabel: { color: '#444', fontSize: 8, fontWeight: '900', marginTop: 2 },
  inputSection: { paddingHorizontal: 20, marginBottom: 25 },
  mealTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mealTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a' },
  mealTabActive: { backgroundColor: '#00cec9', borderColor: '#00cec9' },
  mealTabText: { color: '#636e72', fontSize: 10, fontWeight: '800' },
  inputWrapper: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
  textInput: { flex: 1, color: '#fff', padding: 12, fontSize: 14 },
  sendBtn: { width: 50, backgroundColor: '#00cec9', justifyContent: 'center', alignItems: 'center' },
  logSection: { paddingHorizontal: 20 },
  sectionTitle: { color: '#333', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15 },
  emptyContainer: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { color: '#1a1a1a', fontSize: 12, fontWeight: '700' },
  symptomsContainer: { marginBottom: 25 },
  symptomItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff767510', padding: 12, borderRadius: 18, marginBottom: 8, borderWidth: 1, borderColor: '#ff767530' },
  symptomIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#ff767520', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  symptomName: { color: '#ff7675', fontSize: 13, fontWeight: '800' },
  symptomLabel: { color: '#636e72', fontSize: 10, fontWeight: '600' },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 12, borderRadius: 18, marginBottom: 8, borderWidth: 1, borderColor: '#111' },
  logIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  logHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logFoodName: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
  logKcalText: { color: '#00cec9', fontSize: 12, fontWeight: '900' },
  logMeta: { color: '#444', fontSize: 10, fontWeight: '600', marginTop: 2 },
  deleteBtn: { padding: 8, marginLeft: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0a0a0a', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: '#1a1a1a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  foodName: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 15, textAlign:'center' },
  portionControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000', borderRadius: 20, padding: 15, marginBottom: 20 },
  portionBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  portionValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  presetRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 25 },
  presetBtn: { width: 50, height: 40, borderRadius: 10, backgroundColor: '#0a0a0a', borderWidth:1, borderColor:'#222', justifyContent: 'center', alignItems: 'center' },
  presetText: { color: '#636e72', fontWeight: '800', fontSize: 12 },
  previewBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, backgroundColor: '#000', padding: 15, borderRadius: 15 },
  previewItem: { alignItems: 'center' },
  previewVal: { fontSize: 16, fontWeight: '900' },
  previewLabel: { color: '#333', fontSize: 8, fontWeight: '900', marginTop: 4 },
  confirmBtn: { backgroundColor: '#00cec9', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },
});