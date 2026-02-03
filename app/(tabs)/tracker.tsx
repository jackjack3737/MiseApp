import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Keyboard, Alert, RefreshControl, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabase'; 
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, Flame, Utensils, ShieldCheck, BrainCircuit, X, Minus, Scale } from 'lucide-react-native';

const TARGETS = { kcal: 2000, c: 30, p: 160, f: 140 };
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
  const [logs, setLogs] = useState([]);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [refreshing, setRefreshing] = useState(false);

  // --- STATI MODALE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [tempFood, setTempFood] = useState(null);
  
  // Gestione Ibrida: Grammi (AI) vs Porzioni (Ricette DB)
  const [mode, setMode] = useState('GRAMS'); // 'GRAMS' o 'PORTIONS'
  const [currentWeight, setCurrentWeight] = useState(100); // Peso attuale in grammi
  const [currentMultiplier, setCurrentMultiplier] = useState(1); // Moltiplicatore porzioni

  useFocusEffect(useCallback(() => { fetchTodayLogs(); }, []));

  async function fetchTodayLogs() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase.from('daily_logs').select('*').eq('date', today).order('id', { ascending: false });
        if (error) throw error;
        setLogs(data || []);
        calculateTotals(data || []);
    } catch (error) { console.error(error); }
  }

  const onRefresh = async () => { setRefreshing(true); await fetchTodayLogs(); setRefreshing(false); };

  const calculateTotals = (data) => {
    const totals = data.reduce((acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        c: acc.c + (item.carbs || 0),
        p: acc.p + (item.proteins || 0),
        f: acc.f + (item.fats || 0),
    }), { kcal: 0, c: 0, p: 0, f: 0 });
    setTodayTotals(totals);
  };

  // --- RICERCA CIBO ---
  async function searchFood() {
    if (!inputText.trim()) return;
    setLoading(true);
    Keyboard.dismiss();

    try {
        let foodData = null;
        let foundInDB = false;

        // 1. DATABASE (Ricette)
        const { data: dbRecipe } = await supabase.from('recipes').select('*').ilike('title', `%${inputText}%`).limit(1).maybeSingle();

        if (dbRecipe) {
            foodData = {
                name: dbRecipe.title,
                kcal: dbRecipe.kcal,
                c: dbRecipe.carbs,
                p: dbRecipe.proteins,
                f: dbRecipe.fats,
                weight_g: null // Le ricette DB vanno a porzioni
            };
            foundInDB = true;
        } else {
            // 2. AI (Ingredienti sfusi / Cibi generici)
            const { data, error } = await supabase.functions.invoke('analyze-meal', { body: { query: inputText } });
            if (error) throw new Error("AI Error");
            foodData = data;
            foundInDB = false;
        }

        if (foodData) {
            setTempFood(foodData);
            
            if (foundInDB || !foodData.weight_g) {
                // Modalità Porzioni (Ricette o dati AI vecchi senza peso)
                setMode('PORTIONS');
                setCurrentMultiplier(1);
            } else {
                // Modalità Grammi (AI con stima peso)
                setMode('GRAMS');
                setCurrentWeight(foodData.weight_g); 
            }
            setModalVisible(true);
        }

    } catch (error) {
        Alert.alert("Errore", "Impossibile trovare il cibo.");
    } finally {
        setLoading(false);
    }
  }

  // --- MATEMATICA RICALCOLO ---
  const getFinalValues = () => {
      if (!tempFood) return { k: 0, c: 0, p: 0, f: 0 };

      if (mode === 'PORTIONS') {
          return {
              k: Math.round(tempFood.kcal * currentMultiplier),
              c: Math.round(tempFood.c * currentMultiplier),
              p: Math.round(tempFood.p * currentMultiplier),
              f: Math.round(tempFood.f * currentMultiplier),
              label: `${currentMultiplier}x`
          };
      } else {
          // Proporzione: (ValoreBase / PesoBase) * PesoNuovo
          const ratio = currentWeight / tempFood.weight_g;
          return {
              k: Math.round(tempFood.kcal * ratio),
              c: Math.round(tempFood.c * ratio),
              p: Math.round(tempFood.p * ratio),
              f: Math.round(tempFood.f * ratio),
              label: `${currentWeight}g`
          };
      }
  };

  const adjustAmount = (delta) => {
      if (mode === 'PORTIONS') {
          setCurrentMultiplier(prev => Math.max(0.25, prev + delta));
      } else {
          // Se siamo in grammi, delta è +/- 10g
          setCurrentWeight(prev => Math.max(10, prev + (delta * 40))); // Delta 0.25 diventa 10g
      }
  };

  async function confirmAndSave() {
    if (!tempFood) return;
    const final = getFinalValues();

    try {
        const { error } = await supabase.from('daily_logs').insert({
            meal_type: selectedMeal,
            food_name: `${tempFood.name} (${final.label})`,
            kcal: final.k,
            carbs: final.c,
            proteins: final.p,
            fats: final.f,
            date: new Date().toISOString().split('T')[0]
        });

        if (error) throw error;
        setModalVisible(false);
        setTempFood(null);
        setInputText('');
        fetchTodayLogs();
    } catch (e) { Alert.alert("Errore", "Salvataggio fallito."); }
  }

  // UI Components
  const ProgressBar = ({ label, current, max, color }) => {
    const progress = Math.min(current / max, 1) * 100;
    return (
        <View style={styles.progressRow}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 4}}>
                <Text style={[styles.progressLabel, {color: color}]}>{label}</Text>
                <Text style={styles.progressValue}>{current} / {max}g</Text>
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
            <Text style={styles.title}>DIARIO PASTI</Text>
        </View>
        <View style={styles.kcalCircle}>
             <Text style={styles.kcalNumber}>{todayTotals.kcal}</Text>
             <Text style={styles.kcalLabel}>/ {TARGETS.kcal} KCAL</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00cec9" />}>
        <View style={styles.dashboard}>
            <ProgressBar label="CARBOIDRATI" current={todayTotals.c} max={TARGETS.c} color="#fdcb6e" />
            <ProgressBar label="PROTEINE" current={todayTotals.p} max={TARGETS.p} color="#74b9ff" />
            <ProgressBar label="GRASSI" current={todayTotals.f} max={TARGETS.f} color="#ff7675" />
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
                    placeholder="Es. 'Panino cotto e fontina'..."
                    placeholderTextColor="#636e72"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                />
                <TouchableOpacity style={[styles.sendBtn, loading && {opacity: 0.5}]} onPress={searchFood} disabled={loading}>
                    {loading ? <ActivityIndicator color="#000" /> : <Plus size={28} color="#000" />}
                </TouchableOpacity>
            </View>
            <View style={styles.securityBadge}>
                <ShieldCheck size={12} color="#00cec9" />
                <Text style={styles.hint}>AI con stima Grammature (Gemini 2.5)</Text>
            </View>
        </View>

        <View style={styles.logSection}>
            <Text style={styles.sectionTitle}>STORICO ({logs.length})</Text>
            {logs.length === 0 ? (
                <View style={styles.emptyContainer}><BrainCircuit size={40} color="#333" /><Text style={styles.emptyText}>Il diario è vuoto.</Text></View>
            ) : (
                logs.map((item) => (
                    <View key={item.id} style={styles.logItem}>
                        <View style={styles.logIcon}><Utensils size={16} color="#00cec9" /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.logMealType}>{item.meal_type}</Text>
                            <Text style={styles.logFoodName}>{item.food_name}</Text>
                            <View style={styles.logMacros}>
                                <Text style={styles.logMacroText}><Flame size={10} color="#e17055"/> {item.kcal}</Text>
                                <Text style={styles.logMacroText}>C: {item.carbs}</Text>
                                <Text style={styles.logMacroText}>P: {item.proteins}</Text>
                                <Text style={styles.logMacroText}>F: {item.fats}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => supabase.from('daily_logs').delete().eq('id', item.id).then(fetchTodayLogs)} style={styles.deleteBtn}>
                            <Trash2 size={18} color="#636e72" />
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
      </ScrollView>

      {/* --- MODALE UNIFICATA --- */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>PESA IL CIBO</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#636e72" /></TouchableOpacity>
                </View>

                {tempFood && (
                    <>
                        <Text style={styles.foodName}>{tempFood.name}</Text>
                        
                        {/* SELETTORE PESO/PORZIONI */}
                        <View style={styles.portionControl}>
                            <TouchableOpacity onPress={() => adjustAmount(-0.25)} style={styles.portionBtn}><Minus size={24} color="#fff" /></TouchableOpacity>
                            
                            <View style={{alignItems:'center'}}>
                                {/* Mostra Grammi O Porzioni */}
                                <Text style={styles.portionValue}>
                                    {mode === 'GRAMS' ? currentWeight : currentMultiplier}
                                    <Text style={{fontSize: 16, color:'#636e72'}}>{mode === 'GRAMS' ? 'g' : 'x'}</Text>
                                </Text>
                                <Text style={styles.portionLabel}>
                                    {mode === 'GRAMS' ? 'PESO NETTO' : 'PORZIONI'}
                                </Text>
                            </View>

                            <TouchableOpacity onPress={() => adjustAmount(0.25)} style={styles.portionBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
                        </View>

                        {/* ANTEPRIMA VALORI CALCOLATI */}
                        <View style={styles.previewBox}>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.k}</Text><Text style={styles.previewLabel}>KCAL</Text></View>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.c}g</Text><Text style={styles.previewLabel}>CARB</Text></View>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.p}g</Text><Text style={styles.previewLabel}>PRO</Text></View>
                            <View style={styles.previewItem}><Text style={styles.previewVal}>{finalVals.f}g</Text><Text style={styles.previewLabel}>FAT</Text></View>
                        </View>

                        <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}>
                            <Text style={styles.confirmBtnText}>SALVA {finalVals.label}</Text>
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
  dashboard: { backgroundColor: '#1e1e1e', marginHorizontal: 20, padding: 20, borderRadius: 20, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  progressRow: { marginBottom: 15 },
  progressLabel: { fontSize: 12, fontWeight: '900' },
  progressValue: { color: '#fff', fontSize: 12, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#2d3436', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  inputSection: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { color: '#636e72', fontSize: 12, fontWeight: '900', marginBottom: 15, letterSpacing: 1.5 },
  mealTabs: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  mealTab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: '#111' },
  mealTabActive: { backgroundColor: '#00cec9', borderColor: '#00cec9' },
  mealTabText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inputWrapper: { flexDirection: 'row', backgroundColor: '#1e1e1e', borderRadius: 15, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  textInput: { flex: 1, color: '#fff', padding: 15, fontSize: 16, minHeight: 60, textAlignVertical: 'center' },
  sendBtn: { width: 60, backgroundColor: '#00cec9', justifyContent: 'center', alignItems: 'center' },
  securityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  hint: { color: '#636e72', fontSize: 10, fontWeight: '600' },
  logSection: { paddingHorizontal: 20 },
  emptyContainer: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { color: '#636e72', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  logIcon: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: 'rgba(0, 206, 201, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  logMealType: { color: '#00cec9', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 },
  logFoodName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 5 },
  logMacros: { flexDirection: 'row', gap: 10 },
  logMacroText: { color: '#b2bec3', fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1e1e', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: 500 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  foodName: { color: '#00cec9', fontSize: 24, fontWeight: '900', marginBottom: 20, textAlign:'center' },
  portionControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: 20, padding: 15, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  portionBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#2d3436', justifyContent: 'center', alignItems: 'center' },
  portionValue: { color: '#fff', fontSize: 32, fontWeight: '900' },
  portionLabel: { color: '#636e72', fontSize: 10, fontWeight: '700' },
  previewBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 15 },
  previewItem: { alignItems: 'center' },
  previewVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  previewLabel: { color: '#636e72', fontSize: 10, fontWeight: '700', marginTop: 2 },
  confirmBtn: { backgroundColor: '#00cec9', height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});