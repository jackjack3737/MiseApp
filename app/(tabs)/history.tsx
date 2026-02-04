import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, StatusBar, Dimensions, FlatList, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, CheckCircle2, Trash2, Edit3, X, Check, Activity } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const COLUMNS = 7;
const CELL_WIDTH = (width - 40) / COLUMNS;

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [historyData, setHistoryData] = useState<any>({});
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [userTargets, setUserTargets] = useState({ kcal: 2000, carbs: 50 });
  const [loading, setLoading] = useState(true);

  // --- STATO MODIFICA ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // --- 1. CARICAMENTO DATI ---
  const loadData = async () => {
    setLoading(true);
    try {
      const profile = await AsyncStorage.getItem('@user_profile');
      if (profile) {
        const p = JSON.parse(profile);
        setUserTargets({
          kcal: Number(p.targetCalories) || 2000,
          carbs: Number(p.targetCarbs) || (p.protocol === 'Keto' ? 30 : 150)
        });
      }

      await refreshHistory();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const refreshHistory = async () => {
      const logsJson = await AsyncStorage.getItem('@user_daily_logs');
      if (logsJson) {
        const logs = JSON.parse(logsJson);
        processHistory(logs);
      } else {
        setHistoryData({});
        setDayDetails(null);
      }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // --- 2. ELABORAZIONE STORICO ---
  const processHistory = (logs: any[]) => {
    const processed: any = {};

    logs.forEach(log => {
      const date = log.date; 
      if (!processed[date]) {
        processed[date] = { 
          totalKcal: 0, totalCarbs: 0, totalProt: 0, totalFat: 0, 
          meals: [], status: 'neutral', hasSymptom: false 
        };
      }
      
      // Controllo se è un sintomo
      if (log.meal_type === 'SINTOMO') {
          processed[date].hasSymptom = true;
      } else {
          processed[date].totalKcal += (Number(log.kcal) || 0);
          processed[date].totalCarbs += (Number(log.carbs) || 0);
          processed[date].totalProt += (Number(log.proteins) || 0);
          processed[date].totalFat += (Number(log.fats) || 0);
      }
      processed[date].meals.push(log);
    });

    Object.keys(processed).forEach(date => {
      const day = processed[date];
      const isKcalOver = day.totalKcal > userTargets.kcal;
      const isCarbsOver = day.totalCarbs > userTargets.carbs;
      
      if (isKcalOver || isCarbsOver) day.status = 'bad';
      else if (day.totalKcal > 0) day.status = 'good'; // Solo se c'è cibo
      else day.status = 'neutral';
    });

    setHistoryData(processed);
    
    if (processed[selectedDate]) {
        setDayDetails(processed[selectedDate]);
    } else {
        setDayDetails(null);
    }
  };

  // --- 3. GESTIONE EDIT & DELETE ---
  const handleDelete = (id: string) => {
      Alert.alert("Elimina", "Sicuro di voler cancellare questo elemento?", [
          { text: "Annulla", style: "cancel" },
          { text: "Elimina", style: "destructive", onPress: async () => {
              const logsJson = await AsyncStorage.getItem('@user_daily_logs');
              if (logsJson) {
                  const logs = JSON.parse(logsJson);
                  const updatedLogs = logs.filter((l: any) => l.id !== id);
                  await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updatedLogs));
                  processHistory(updatedLogs); 
              }
          }}
      ]);
  };

  const handleEdit = (item: any) => {
      setEditingItem({...item});
      setEditModalVisible(true);
  };

  const saveEdit = async () => {
      if (!editingItem) return;
      try {
          const logsJson = await AsyncStorage.getItem('@user_daily_logs');
          if (logsJson) {
              const logs = JSON.parse(logsJson);
              const updatedLogs = logs.map((l: any) => l.id === editingItem.id ? editingItem : l);
              await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updatedLogs));
              processHistory(updatedLogs);
              setEditModalVisible(false);
          }
      } catch (e) { Alert.alert("Errore", "Salvataggio fallito"); }
  };

  // --- 4. LOGICA CALENDARIO ---
  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const handleDayPress = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    setSelectedDate(dateStr);
    setDayDetails(historyData[dateStr] || null);
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for (let i = 0; i < startDay; i++) grid.push({ day: null });
    for (let i = 1; i <= daysInMonth; i++) grid.push({ day: i });
    return grid;
  };

  const renderCalendarItem = ({ item }: any) => {
    if (!item.day) return <View style={[styles.dayCell, styles.emptyCell]} />;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${item.day.toString().padStart(2, '0')}`;
    
    const dayData = historyData[dateStr];
    const isSelected = dateStr === selectedDate;
    
    // Background dinamico se selezionato
    let bgStyle = isSelected ? styles.selectedDayCell : {};
    if (dayData && !isSelected) {
       if (dayData.hasSymptom && dayData.status === 'neutral') bgStyle = { backgroundColor: '#a29bfe15', borderColor: '#a29bfe30' }; // Solo Sintomo
       else if (dayData.status === 'good') bgStyle = { backgroundColor: '#00cec915', borderColor: 'transparent' };
       else if (dayData.status === 'bad') bgStyle = { backgroundColor: '#ff767515', borderColor: 'transparent' };
    }

    return (
      <TouchableOpacity 
        style={[styles.dayCell, bgStyle]} 
        onPress={() => handleDayPress(item.day)}
      >
        <Text style={[styles.dayText, isSelected && {color:'#fff'}]}>{item.day}</Text>
        
        {/* CONTAINER PALLINI */}
        <View style={styles.dotsContainer}>
            {/* Pallino Metabolico */}
            {dayData && dayData.status !== 'neutral' && (
                <View style={[styles.statusDot, { backgroundColor: dayData.status === 'good' ? '#00cec9' : '#ff7675' }]} />
            )}
            {/* Pallino Sintomo (Viola) */}
            {dayData && dayData.hasSymptom && (
                <View style={[styles.statusDot, { backgroundColor: '#a29bfe' }]} />
            )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
            <Calendar size={24} color="#00cec9" />
            <Text style={styles.headerTitle}>STORICO</Text>
        </View>
        <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowBtn}><ChevronLeft size={20} color="#fff" /></TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_NAMES[currentMonth.getMonth()].toUpperCase()} {currentMonth.getFullYear()}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowBtn}><ChevronRight size={20} color="#fff" /></TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarContainer}>
            <View style={styles.weekHeader}>
                {['L','M','M','G','V','S','D'].map((d, i) => <Text key={i} style={styles.weekDayText}>{d}</Text>)}
            </View>
            <FlatList
                data={generateCalendarDays()}
                renderItem={renderCalendarItem}
                keyExtractor={(item, index) => index.toString()}
                numColumns={7}
                scrollEnabled={false}
            />
        </View>

        <View style={styles.detailSection}>
            <Text style={styles.detailDateTitle}>
                {new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
            </Text>

            {dayDetails ? (
                <>
                    {/* AVVISO SINTOMI NEL DETTAGLIO */}
                    {dayDetails.hasSymptom && (
                        <View style={styles.symptomAlertCard}>
                            <Activity size={18} color="#a29bfe" />
                            <Text style={styles.symptomAlertText}>SINTOMI REGISTRATI IN QUESTA DATA</Text>
                        </View>
                    )}

                    <View style={styles.statsCard}>
                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>STATUS METABOLICO</Text>
                            <View style={[styles.statusBadge, { backgroundColor: dayDetails.status === 'good' ? '#00cec9' : (dayDetails.status === 'bad' ? '#ff7675' : '#333') }]}>
                                {dayDetails.status === 'good' ? <CheckCircle2 size={12} color="#000"/> : <AlertCircle size={12} color="#000"/>}
                                <Text style={styles.statusText}>{dayDetails.status === 'good' ? 'OPTIMAL' : (dayDetails.status === 'bad' ? 'SFORO' : 'NEUTRO')}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.divider} />

                        <View style={styles.macroGrid}>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, {color: '#fdcb6e'}]}>{Math.round(dayDetails.totalCarbs)}g</Text><Text style={styles.macroSub}>CARBS</Text></View>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, {color: '#74b9ff'}]}>{Math.round(dayDetails.totalProt)}g</Text><Text style={styles.macroSub}>PROT</Text></View>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, {color: '#ff7675'}]}>{Math.round(dayDetails.totalFat)}g</Text><Text style={styles.macroSub}>FATS</Text></View>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, {color: '#fff'}]}>{Math.round(dayDetails.totalKcal)}</Text><Text style={styles.macroSub}>KCAL</Text></View>
                        </View>
                    </View>

                    <Text style={styles.mealsTitle}>DIARIO ALIMENTARE</Text>
                    {dayDetails.meals.map((meal: any, index: number) => (
                        <View key={index} style={[styles.mealItem, meal.meal_type === 'SINTOMO' && styles.mealItemSymptom]}>
                            <View style={[styles.mealTimeLine, meal.meal_type === 'SINTOMO' && {backgroundColor:'#a29bfe'}]} />
                            <View style={styles.mealContent}>
                                <Text style={[styles.mealName, meal.meal_type === 'SINTOMO' && {color: '#a29bfe'}]}>{meal.food_name}</Text>
                                <Text style={styles.mealMeta}>
                                    {meal.meal_type} {meal.meal_type !== 'SINTOMO' && `• ${meal.kcal} kcal`}
                                </Text>
                            </View>
                            <View style={styles.actionsBox}>
                                {meal.meal_type !== 'SINTOMO' && (
                                    <TouchableOpacity onPress={() => handleEdit(meal)} style={styles.actionIcon}>
                                        <Edit3 size={16} color="#636e72" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => handleDelete(meal.id)} style={styles.actionIcon}>
                                    <Trash2 size={16} color="#ff7675" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </>
            ) : (
                <View style={styles.emptyState}>
                    <Activity size={40} color="#333" />
                    <Text style={styles.emptyText}>NESSUN DATO REGISTRATO</Text>
                    <Text style={styles.emptySub}>Non hai tracciato nulla in questa data.</Text>
                </View>
            )}
        </View>
      </ScrollView>

      {/* MODALE DI MODIFICA */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>MODIFICA PASTO</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><X color="#fff" size={24} /></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>NOME ALIMENTO</Text>
              <TextInput 
                style={styles.input} 
                value={editingItem?.food_name} 
                onChangeText={(t) => setEditingItem({...editingItem, food_name: t})}
                placeholderTextColor="#444"
              />

              <View style={styles.inputRow}>
                <View style={{flex:1}}>
                  <Text style={styles.inputLabel}>KCAL</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.kcal?.toString()} onChangeText={(t) => setEditingItem({...editingItem, kcal: t})}/>
                </View>
                <View style={{flex:1, marginLeft: 10}}>
                  <Text style={[styles.inputLabel, {color:'#74b9ff'}]}>PRO (g)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.proteins?.toString()} onChangeText={(t) => setEditingItem({...editingItem, proteins: t})}/>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={{flex:1}}>
                  <Text style={[styles.inputLabel, {color:'#fdcb6e'}]}>CARBI (g)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.carbs?.toString()} onChangeText={(t) => setEditingItem({...editingItem, carbs: t})}/>
                </View>
                <View style={{flex:1, marginLeft: 10}}>
                  <Text style={[styles.inputLabel, {color:'#ff7675'}]}>GRASSI (g)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.fats?.toString()} onChangeText={(t) => setEditingItem({...editingItem, fats: t})}/>
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                <Check color="#000" size={20} />
                <Text style={styles.saveBtnText}>SALVA MODIFICHE</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 25, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  monthLabel: { color: '#fff', fontSize: 12, fontWeight: '800', width: 110, textAlign: 'center' },
  arrowBtn: { padding: 5 },
  
  calendarContainer: { paddingHorizontal: 20 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekDayText: { color: '#636e72', width: CELL_WIDTH, textAlign: 'center', fontSize: 10, fontWeight: '900' },
  
  dayCell: { width: CELL_WIDTH, height: 55, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 14, borderWidth: 1, borderColor: '#111', backgroundColor: '#0a0a0a' },
  selectedDayCell: { borderColor: '#fff', backgroundColor: '#222' },
  emptyCell: { backgroundColor: 'transparent', borderWidth: 0 },
  dayText: { fontSize: 14, fontWeight: '700', color: '#636e72' },
  
  // CONTAINER PALLINI
  dotsContainer: { position: 'absolute', bottom: 6, flexDirection: 'row', gap: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },

  detailSection: { padding: 25, marginTop: 10 },
  detailDateTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 20, letterSpacing: 1 },
  
  // ALERT SINTOMI
  symptomAlertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#a29bfe15', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#a29bfe30' },
  symptomAlertText: { color: '#a29bfe', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  statsCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 30 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  statLabel: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#000', fontSize: 10, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#222', marginBottom: 15 },
  
  macroGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  macroBox: { alignItems: 'center' },
  macroVal: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  macroSub: { color: '#444', fontSize: 9, fontWeight: '800' },

  mealsTitle: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  
  mealItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  mealItemSymptom: { opacity: 0.8 },
  mealTimeLine: { width: 2, height: '100%', backgroundColor: '#222', marginRight: 15, borderRadius: 1 },
  mealContent: { flex: 1 },
  mealName: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  mealMeta: { color: '#636e72', fontSize: 11 },
  
  actionsBox: { flexDirection: 'row', gap: 15, paddingLeft: 10 },
  actionIcon: { padding: 5 },

  emptyState: { alignItems: 'center', padding: 40, opacity: 0.5 },
  emptyText: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 15, marginBottom: 5 },
  emptySub: { color: '#636e72', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  inputLabel: { color: '#00cec9', fontSize: 10, fontWeight: '900', marginBottom: 8, marginTop: 15, letterSpacing: 1 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 15, padding: 15, color: '#fff', fontWeight: '700', fontSize: 16, borderWidth: 1, borderColor: '#333' },
  inputRow: { flexDirection: 'row', gap: 0 },
  saveBtn: { backgroundColor: '#00cec9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 20, marginTop: 30, gap: 10 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});