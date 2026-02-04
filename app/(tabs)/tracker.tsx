import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Keyboard, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Flame, Utensils, ShieldCheck, BrainCircuit, X, Minus, Search } from 'lucide-react-native';

const MEALS = ['Colazione', 'Pranzo', 'Cena', 'Snack'];

const getMealByTime = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Colazione';
    if (hour >= 11 && hour < 15) return 'Pranzo';
    if (hour >= 15 && hour < 19) return 'Snack';
    return 'Cena';
};

export default function TrackerScreen() {
  const [inputText, setInputText] = useState('');
  const [selectedMeal, setSelectedMeal] = useState(getMealByTime());
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [targets, setTargets] = useState({ kcal: 2000, c: 30, p: 160, f: 140 });

  const [modalVisible, setModalVisible] = useState(false);
  const [tempFood, setTempFood] = useState<any>(null);
  const [mode, setMode] = useState('GRAMS'); 
  const [currentWeight, setCurrentWeight] = useState(100); 
  const [currentMultiplier, setCurrentMultiplier] = useState(1); 

  // --- CARICAMENTO DATI (VERSIONE SICURA - SENZA AUTO-CANCELLAZIONE) ---
  const loadData = async () => {
    try {
        // 1. Carica Profilo (Target Macro)
        const savedProfile = await AsyncStorage.getItem('@user_profile');
        if (savedProfile) {
            const p = JSON.parse(savedProfile);
            setTargets({
                kcal: parseInt(p.targetCalories) || 2000,
                c: parseInt(p.targetCarbs) || 30,
                p: parseInt(p.targetProteins) || 160,
                f: parseInt(p.targetFats) || 140,
            });
        }

        // 2. Carica Diario
        const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
        if (savedLogs) {
            let allLogs = JSON.parse(savedLogs);
            const today = new Date().toISOString().split('T')[0];

            // 🛑 HO RIMOSSO IL BLOCCO "AUTO-CLEAN" CHE CANCELLAVA I DATI
            // Ora il Tracker si limita a leggere tutto e filtrare solo visivamente quello di oggi.
            
            // Filtra solo quelli di oggi per visualizzarli
            const todayLogs = allLogs.filter((log: any) => log.date === today);
            
            // Ordina dal più recente (opzionale, ma utile)
            todayLogs.sort((a: any, b: any) => parseInt(b.id) - parseInt(a.id));

            setLogs(todayLogs);
            calculateTotals(todayLogs);
        } else {
            setLogs([]);
            setTodayTotals({ kcal: 0, c: 0, p: 0, f: 0 });
        }
    } catch (e) { console.error("Errore loadData:", e); }
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

  // --- 🔥 FUNZIONE RICERCA (SOLO AI - BYPASS DATABASE) ---
  async function searchFood() {
    if (!inputText.trim()) return;
    setLoading(true);
    Keyboard.dismiss();

    try {
        console.log("🚀 Cerco direttamente con l'AI: ", inputText);
        let foodData = null;

        // NOTA: Ho commentato la ricerca nel DB locale per forzare Gemini
        /*
        const { data: dbRecipe } = await supabase.from('recipes').select('*').ilike('title', `%${inputText}%`).maybeSingle();
        if (dbRecipe) { ... }
        */

        // CHIAMATA EDGE FUNCTION
        const { data, error } = await supabase.functions.invoke('analyze-meal', {
            body: { query: inputText }
        });

        if (error) {
            console.error("❌ Errore Edge Function:", error);
            throw new Error(error.message || "Errore Server");
        }

        console.log("🤖 Risposta AI:", data);
        
        // Assegno i dati
        foodData = data;
        setMode('GRAMS');
        setCurrentWeight(data.weight_g || 100);

        if (foodData) {
            setTempFood(foodData);
            setModalVisible(true);
        }

    } catch (error) {
        console.log(error);
        Alert.alert("Errore", "L'AI non risponde. Riprova.");
    } finally { setLoading(false); }
  }

  // --- RESTO IDENTICO ---
  const getFinalValues = () => {
      if (!tempFood) return { k: 0, c: 0, p: 0, f: 0, label: "" };
      if (mode === 'PORTIONS') {
          return {
              k: Math.round(tempFood.kcal * currentMultiplier),
              c: Math.round(tempFood.c * currentMultiplier),
              p: Math.round(tempFood.p * currentMultiplier),
              f: Math.round(tempFood.f * currentMultiplier),
              label: `${currentMultiplier}x`
          };
      } else {
          const ratio = currentWeight / (tempFood.weight_g || 100);
          return {
              k: Math.round(tempFood.kcal * ratio),
              c: Math.round(tempFood.c * ratio),
              p: Math.round(tempFood.p * ratio),
              f: Math.round(tempFood.f * ratio),
              label: `${currentWeight}g`
          };
      }
  };

  const adjustAmount = (delta: number) => {
      if (mode === 'PORTIONS') {
          setCurrentMultiplier(prev => Math.max(0.25, prev + delta));
      } else {
          setCurrentWeight(prev => Math.max(10, prev + (delta * 10))); 
      }
  };

  async function confirmAndSave() {
  if (!tempFood) return;
  const final = getFinalValues();
  const today = new Date().toISOString().split('T')[0];

  try {
      // 🚨 LEGGI SEMPRE PRIMA DI SCRIVERE
      const savedLogsJson = await AsyncStorage.getItem('@user_daily_logs');
      let currentLogs = savedLogsJson ? JSON.parse(savedLogsJson) : [];
      
      const newEntry = {
          id: Date.now().toString(),
          meal_type: selectedMeal,
          food_name: tempFood.name,
          kcal: final.k,
          carbs: final.c,
          proteins: final.p,
          fats: final.f,
          date: today,
          label: final.label
      };

      // Aggiungi il nuovo log a quelli che abbiamo appena letto
      const updatedLogs = [newEntry, ...currentLogs];
      
      // Salva la lista completa
      await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updatedLogs));

      setModalVisible(false);
      setTempFood(null);
      loadData(); // Ricarica la UI
  } catch (e) { Alert.alert("Errore", "Salvataggio fallito."); }
}

  async function deleteLog(id: string) {
    try {
        const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
        if (savedLogs) {
            const allLogs = JSON.parse(savedLogs);
            const filtered = allLogs.filter((log: any) => log.id !== id);
            await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(filtered));
            loadData();
        }
    } catch (e) { Alert.alert("Errore", "Impossibile eliminare."); }
  }

  const ProgressBar = ({ label, current, max, color }: any) => {
    const progress = Math.min(current / max, 1) * 100;
    return (
        <View style={styles.progressRow}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 4}}>
                <Text style={[styles.progressLabel, {color: color}]}>{label}</Text>
                <Text style={styles.progressValue}>{Math.round(current)} / {max}g</Text>
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
            <Text style={styles.subtitle}>OGGI</Text>
            <Text style={styles.title}>DIARIO LOCALE</Text>
        </View>
        <View style={styles.kcalCircle}>
             <Text style={styles.kcalNumber}>{Math.round(todayTotals.kcal)}</Text>
             <Text style={styles.kcalLabel}>/ {targets.kcal} KCAL</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00cec9" />}>
        <View style={styles.dashboard}>
            <ProgressBar label="CARBOIDRATI" current={todayTotals.c} max={targets.c} color="#fdcb6e" />
            <ProgressBar label="PROTEINE" current={todayTotals.p} max={targets.p} color="#74b9ff" />
            <ProgressBar label="GRASSI" current={todayTotals.f} max={targets.f} color="#ff7675" />
        </View>

        <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>AGGIUNGI CIBO</Text>
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
                    placeholder="Es. 'Big Mac', 'Pizza', 'Sgarro'..."
                    placeholderTextColor="#636e72"
                    value={inputText}
                    onChangeText={setInputText}
                />
                <TouchableOpacity style={[styles.sendBtn, loading && {opacity: 0.5}]} onPress={searchFood} disabled={loading}>
                    {loading ? <ActivityIndicator color="#000" /> : <Search size={28} color="#000" />}
                </TouchableOpacity>
            </View>
            <View style={styles.securityBadge}>
                <ShieldCheck size={12} color="#00cec9" />
                <Text style={styles.hint}>AI-Only Mode (DB Bypassed)</Text>
            </View>
        </View>

        <View style={styles.logSection}>
            <Text style={styles.sectionTitle}>STORICO DI OGGI ({logs.length})</Text>
            {logs.length === 0 ? (
                <View style={styles.emptyContainer}><BrainCircuit size={40} color="#333" /><Text style={styles.emptyText}>Nessun pasto loggato oggi.</Text></View>
            ) : (
                logs.map((item: any) => (
                    <View key={item.id} style={styles.logItem}>
                        <View style={styles.logIcon}><Utensils size={16} color="#00cec9" /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.logMealType}>{item.meal_type} • {item.label}</Text>
                            <Text style={styles.logFoodName}>{item.food_name}</Text>
                            <View style={styles.logMacros}>
                                <Text style={styles.logMacroText}><Flame size={10} color="#e17055"/> {item.kcal} kcal</Text>
                                <Text style={styles.logMacroText}>C: {Math.round(item.carbs)}g</Text>
                                <Text style={styles.logMacroText}>P: {Math.round(item.proteins)}g</Text>
                                <Text style={styles.logMacroText}>F: {Math.round(item.fats)}g</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => deleteLog(item.id)} style={styles.deleteBtn}>
                            <Trash2 size={18} color="#636e72" />
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>CONFERMA</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#636e72" /></TouchableOpacity>
                </View>

                {tempFood && (
                    <>
                        <Text style={styles.foodName}>{tempFood.name}</Text>
                        <View style={styles.portionControl}>
                            <TouchableOpacity onPress={() => adjustAmount(-1)} style={styles.portionBtn}><Minus size={24} color="#fff" /></TouchableOpacity>
                            <View style={{alignItems:'center'}}>
                                <Text style={styles.portionValue}>
                                    {mode === 'GRAMS' ? currentWeight : currentMultiplier}
                                    <Text style={{fontSize: 16, color:'#636e72'}}>{mode === 'GRAMS' ? 'g' : 'x'}</Text>
                                </Text>
                                <Text style={styles.portionLabel}>{mode === 'GRAMS' ? 'PESO' : 'PORZIONE'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => adjustAmount(1)} style={styles.portionBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
                        </View>

                        <View style={styles.previewBox}>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.k}</Text><Text style={styles.previewLabel}>KCAL</Text></View>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.c}g</Text><Text style={styles.previewLabel}>CARB</Text></View>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.p}g</Text><Text style={styles.previewLabel}>PRO</Text></View>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.f}g</Text><Text style={styles.previewLabel}>FAT</Text></View>
                        </View>

                        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}>
                            <Text style={styles.confirmBtnText}>SALVA DIARIO</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingTop: 50 },
  subtitle: { color: '#00cec9', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900' },
  kcalCircle: { alignItems: 'flex-end' },
  kcalNumber: { color: '#00cec9', fontSize: 28, fontWeight: '900' },
  kcalLabel: { color: '#636e72', fontSize: 10, fontWeight: '700' },
  dashboard: { backgroundColor: '#111', marginHorizontal: 20, padding: 20, borderRadius: 25, marginBottom: 30, borderWidth: 1, borderColor: '#222' },
  progressRow: { marginBottom: 15 },
  progressLabel: { fontSize: 10, fontWeight: '900' },
  progressValue: { color: '#fff', fontSize: 10, fontWeight: '700' },
  track: { height: 6, backgroundColor: '#222', borderRadius: 3, marginTop: 5 },
  fill: { height: '100%', borderRadius: 3 },
  inputSection: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { color: '#636e72', fontSize: 12, fontWeight: '900', marginBottom: 15 },
  mealTabs: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  mealTab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  mealTabActive: { backgroundColor: '#00cec9', borderColor: '#00cec9' },
  mealTabText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inputWrapper: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  textInput: { flex: 1, color: '#fff', padding: 15, fontSize: 16 },
  sendBtn: { width: 60, backgroundColor: '#00cec9', justifyContent: 'center', alignItems: 'center' },
  securityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  hint: { color: '#636e72', fontSize: 10, fontWeight: '600' },
  logSection: { paddingHorizontal: 20 },
  emptyContainer: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { color: '#636e72', fontSize: 14 },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  logIcon: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: 'rgba(0, 206, 201, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  logMealType: { color: '#00cec9', fontSize: 10, fontWeight: '900', marginBottom: 2 },
  logFoodName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logMacros: { flexDirection: 'row', gap: 10, marginTop: 5 },
  logMacroText: { color: '#636e72', fontSize: 11 },
  deleteBtn: { padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: 500 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  foodName: { color: '#00cec9', fontSize: 24, fontWeight: '900', marginBottom: 20, textAlign:'center' },
  portionControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000', borderRadius: 20, padding: 15, marginBottom: 30 },
  portionBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  portionValue: { color: '#fff', fontSize: 32, fontWeight: '900' },
  portionLabel: { color: '#636e72', fontSize: 10, fontWeight: '700' },
  previewBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 15 },
  previewItem: { alignItems: 'center' },
  previewVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  previewLabel: { color: '#636e72', fontSize: 10, fontWeight: '700' },
  confirmBtn: { backgroundColor: '#00cec9', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '900' },
});