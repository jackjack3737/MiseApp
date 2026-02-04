import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Keyboard, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Trash2, Flame, Utensils, ShieldCheck, BrainCircuit, X, Minus, Search, Beef, Fish, CookingPot, Leaf, Zap, Cookie, ArrowRight, ExternalLink, BookOpen, Activity, AlertCircle } from 'lucide-react-native';

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

export default function TrackerScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [selectedMeal, setSelectedMeal] = useState(getMealByTime());
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [targets, setTargets] = useState({ kcal: 2000, c: 30, p: 160, f: 140 });

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [tempFood, setTempFood] = useState<any>(null);
  const [mode, setMode] = useState('GRAMS'); 
  const [currentWeight, setCurrentWeight] = useState(100); 
  const [currentMultiplier, setCurrentMultiplier] = useState(1); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [foundRecipeId, setFoundRecipeId] = useState<string | null>(null);

  const loadData = async () => {
    try {
        const savedProfile = await AsyncStorage.getItem('@user_profile');
        if (savedProfile) {
            const p = JSON.parse(savedProfile);
            setTargets({
                kcal: parseInt(p.targetCalories) || 2000,
                c: parseInt(p.carbs) || 30,
                p: parseInt(p.protein) || 160,
                f: parseInt(p.fat) || 140,
            });
        }

        const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
        if (savedLogs) {
            let allLogs = JSON.parse(savedLogs);
            const today = new Date().toISOString().split('T')[0];
            const todayLogs = allLogs.filter((log: any) => log.date === today);
            // Ordina per ID (più recente in alto)
            todayLogs.sort((a: any, b: any) => Number(b.id) - Number(a.id));
            setLogs(todayLogs);
            calculateTotals(todayLogs);
        } else {
            setLogs([]);
            setTodayTotals({ kcal: 0, c: 0, p: 0, f: 0 });
        }
    } catch (e) { console.error(e); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const calculateTotals = (data: any[]) => {
    const totals = data.reduce((acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        c: acc.c + (item.carbs || 0),
        p: acc.p + (item.proteins || 0),
        f: acc.f + (item.fats || 0),
    }), { kcal: 0, c: 0, p: 0, f: 0 });
    setTodayTotals(totals);
  };

  // --- FILTRO LISTE ---
  const symptomsList = logs.filter(l => l.meal_type === 'SINTOMO');
  const mealsList = logs.filter(l => l.meal_type !== 'SINTOMO');

  // --- FUNZIONI ---
  const checkForRecipe = async (foodName: string) => {
    setFoundRecipeId(null);
    if (!foodName) return;
    try {
        const { data } = await supabase.from('recipes').select('id').ilike('title', foodName).maybeSingle(); 
        if (data) setFoundRecipeId(data.id);
    } catch (e) {}
  };

  const handleItemPress = (item: any) => {
    if (item.meal_type === 'SINTOMO') return; // I sintomi non si editano (per ora), si cancellano solo

    const safeLabel = item.label || '100g'; 
    const isPortion = safeLabel.includes('x');

    setEditingId(item.id);
    setMode(isPortion ? 'PORTIONS' : 'GRAMS');
    
    if (item.recipe_id) setFoundRecipeId(item.recipe_id);
    else checkForRecipe(item.food_name);
    
    const numericValue = parseInt(safeLabel) || 100;
    if (isPortion) setCurrentMultiplier(numericValue);
    else setCurrentWeight(numericValue);

    const factor = isPortion ? numericValue : (numericValue / 100);
    const safeFactor = factor === 0 ? 1 : factor;

    setTempFood({
        name: item.food_name || "Alimento",
        kcal: (item.kcal || 0) / safeFactor,
        c: (item.carbs || 0) / safeFactor,
        p: (item.proteins || 0) / safeFactor,
        f: (item.fats || 0) / safeFactor,
        weight_g: 100, 
        category_icon: item.icon_type || 'default',
        recipe_id: item.recipe_id 
    });
    
    setModalVisible(true);
  };

  const navigateToRecipe = () => {
      if (foundRecipeId) {
          setModalVisible(false);
          router.push(`/recipe-detail?id=${foundRecipeId}`);
      }
  };

  async function searchFood() {
    if (!inputText.trim()) return;
    setLoading(true);
    Keyboard.dismiss();
    try {
        const { data, error } = await supabase.functions.invoke('analyze-meal', { body: { query: inputText } });
        if (error) throw error;
        
        setEditingId(null);
        setMode('GRAMS');
        setCurrentWeight(data.weight_g || 100);
        setTempFood(data);
        setFoundRecipeId(null);
        checkForRecipe(data.name);
        setModalVisible(true);
    } catch (error) { Alert.alert("Errore AI", "Impossibile analizzare il pasto."); } 
    finally { setLoading(false); }
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
      if (mode === 'PORTIONS') setCurrentMultiplier(prev => Math.max(0.25, prev + delta));
      else setCurrentWeight(prev => Math.max(10, prev + (delta * 10))); 
  };

  async function confirmAndSave() {
    if (!tempFood) return;
    const final = getFinalValues();
    const today = new Date().toISOString().split('T')[0];
    try {
        const savedLogsJson = await AsyncStorage.getItem('@user_daily_logs');
        let currentLogs = savedLogsJson ? JSON.parse(savedLogsJson) : [];
        const finalRecipeId = tempFood.recipe_id || foundRecipeId || null;

        if (editingId) {
            currentLogs = currentLogs.map((log: any) => {
                if (log.id === editingId) {
                    return {
                        ...log,
                        kcal: final.k, carbs: final.c, proteins: final.p, fats: final.f,
                        label: final.label, recipe_id: finalRecipeId
                    };
                }
                return log;
            });
        } else {
            const newEntry = {
                id: Date.now().toString(),
                meal_type: selectedMeal,
                food_name: tempFood.name,
                kcal: final.k, carbs: final.c, proteins: final.p, fats: final.f,
                date: today, label: final.label,
                icon_type: tempFood.category_icon || 'default',
                recipe_id: finalRecipeId
            };
            currentLogs = [newEntry, ...currentLogs];
        }
        await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(currentLogs));
        setModalVisible(false);
        setTempFood(null);
        setEditingId(null);
        setFoundRecipeId(null);
        setInputText('');
        loadData();
    } catch (e) { Alert.alert("Errore", "Salvataggio fallito."); }
  }

  async function deleteLog(id: string) {
    const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
    if (savedLogs) {
        const filtered = JSON.parse(savedLogs).filter((log: any) => log.id !== id);
        await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(filtered));
        loadData();
    }
  }

  const ProgressBar = ({ label, current, max, color }: any) => {
    const progress = Math.min(current / max, 1) * 100;
    return (
        <View style={styles.progressRow}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 4}}>
                <Text style={[styles.progressLabel, {color: color}]}>{label}</Text>
                <Text style={styles.progressValue}>{Math.round(current)}/{max}g</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${progress}%`, backgroundColor: color }]} /></View>
        </View>
    );
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
        <View style={styles.kcalCircle}>
             <Text style={styles.kcalNumber}>{Math.round(todayTotals.kcal)}</Text>
             <Text style={styles.kcalLabel}>KCAL TOTALI</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00cec9" />}>
        <View style={styles.dashboard}>
            <ProgressBar label="CARBS" current={todayTotals.c} max={targets.c} color="#fdcb6e" />
            <ProgressBar label="PROTEIN" current={todayTotals.p} max={targets.p} color="#74b9ff" />
            <ProgressBar label="FATS" current={todayTotals.f} max={targets.f} color="#ff7675" />
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
            
            {/* --- SEZIONE SINTOMI (SE PRESENTI) --- */}
            {symptomsList.length > 0 && (
                <View style={styles.symptomsContainer}>
                    <Text style={[styles.sectionTitle, {color: '#ff7675'}]}>STATO BIO-FISICO ATTUALE</Text>
                    {symptomsList.map((item) => (
                        <View key={item.id} style={styles.symptomItem}>
                            <View style={styles.symptomIcon}>
                                <Activity size={18} color="#ff7675" />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={styles.symptomName}>{item.food_name}</Text>
                                <Text style={styles.symptomLabel}>{item.label}</Text>
                            </View>
                            <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}>
                                <X size={16} color="#636e72" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* --- SEZIONE PASTI --- */}
            <Text style={styles.sectionTitle}>PASTI REGISTRATI</Text>
            {mealsList.length === 0 ? (
                <View style={styles.emptyContainer}><BrainCircuit size={30} color="#111" /><Text style={styles.emptyText}>Nessun pasto registrato oggi.</Text></View>
            ) : (
                mealsList.map((item: any) => (
                    <View key={item.id} style={styles.logItem}>
                        <View style={styles.logIcon}>
                          {IconMap[item.icon_type] || IconMap.default}
                        </View>
                        
                        <TouchableOpacity 
                            style={{flex: 1, marginRight: 10}} 
                            onPress={() => handleItemPress(item)}
                            activeOpacity={0.6}
                        >
                            <View style={styles.logHeaderRow}>
                              <Text style={styles.logFoodName}>{item.food_name}</Text>
                              <View style={{flexDirection:'row', alignItems:'center'}}>
                                <Text style={styles.logKcalText}>{item.kcal} kcal</Text>
                                {item.recipe_id && <BookOpen size={12} color="#00cec9" style={{marginLeft: 6}}/>}
                              </View>
                            </View>
                            <Text style={styles.logMeta}>{item.meal_type} • {item.label || '100g'} • P: {item.proteins}g</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}>
                            <Trash2 size={18} color="#333" />
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
      </ScrollView>

      {/* MODAL */}
      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{editingId ? 'MODIFICA PASTO' : 'BIO-ANALISI'}</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#636e72" /></TouchableOpacity>
                </View>
                {tempFood && (
                    <>
                        <Text style={styles.foodName}>{tempFood.name.toUpperCase()}</Text>
                        {foundRecipeId && (
                            <TouchableOpacity style={styles.modalRecipeLink} onPress={navigateToRecipe}>
                                <BookOpen size={16} color="#000" />
                                <Text style={styles.modalRecipeText}>LEGGI LA RICETTA</Text>
                                <ExternalLink size={12} color="#000" />
                            </TouchableOpacity>
                        )}
                        <View style={styles.portionControl}>
                            <TouchableOpacity onPress={() => adjustAmount(-1)} style={styles.portionBtn}><Minus size={24} color="#fff" /></TouchableOpacity>
                            <View style={{alignItems:'center'}}>
                                <Text style={styles.portionValue}>
                                    {mode === 'GRAMS' ? currentWeight : currentMultiplier}
                                    <Text style={{fontSize: 16, color:'#636e72'}}>{mode === 'GRAMS' ? 'g' : 'x'}</Text>
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => adjustAmount(1)} style={styles.portionBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
                        </View>
                        <View style={styles.previewBox}>
                            <View style={styles.previewItem}><Text style={[styles.previewVal, {color:'#74b9ff'}]}>{finalVals.p}g</Text><Text style={styles.previewLabel}>PRO</Text></View>
                            <View style={styles.previewItem}><Text style={[styles.previewVal, {color:'#fdcb6e'}]}>{finalVals.c}g</Text><Text style={styles.previewLabel}>CARB</Text></View>
                            <View style={styles.previewItem}><Text style={[styles.previewVal, {color:'#ff7675'}]}>{finalVals.f}g</Text><Text style={styles.previewLabel}>FAT</Text></View>
                        </View>
                        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}>
                            <Text style={styles.confirmBtnText}>{editingId ? 'SALVA MODIFICHE' : 'REGISTRA PASTO'}</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingTop: 20 },
  subtitle: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  kcalCircle: { alignItems: 'flex-end' },
  kcalNumber: { color: '#00cec9', fontSize: 24, fontWeight: '900' },
  kcalLabel: { color: '#333', fontSize: 8, fontWeight: '900' },
  dashboard: { backgroundColor: '#0a0a0a', marginHorizontal: 20, padding: 20, borderRadius: 25, marginBottom: 25, borderWidth: 1, borderColor: '#111' },
  progressRow: { marginBottom: 15 },
  progressLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  progressValue: { color: '#fff', fontSize: 9, fontWeight: '700' },
  track: { height: 4, backgroundColor: '#1a1a1a', borderRadius: 2, marginTop: 6 },
  fill: { height: '100%', borderRadius: 2 },
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
  
  // SINTOMI STYLES
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
  
  modalRecipeLink: { backgroundColor: '#00cec9', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginBottom: 25, width: '100%', justifyContent: 'center' },
  modalRecipeText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  portionControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000', borderRadius: 20, padding: 15, marginBottom: 25 },
  portionBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  portionValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  previewBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, backgroundColor: '#000', padding: 15, borderRadius: 15 },
  previewItem: { alignItems: 'center' },
  previewVal: { fontSize: 16, fontWeight: '900' },
  previewLabel: { color: '#333', fontSize: 8, fontWeight: '900', marginTop: 4 },
  confirmBtn: { backgroundColor: '#00cec9', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },
});