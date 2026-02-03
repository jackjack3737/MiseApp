import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Modal, TextInput, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, Trash2, Edit3, X, Check } from 'lucide-react-native';
import { format, addDays, subDays } from 'date-fns';
import { it } from 'date-fns/locale';

export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Carica i dati ogni volta che cambia la data selezionata
  useEffect(() => {
    fetchLocalLogs();
  }, [selectedDate]);

  async function fetchLocalLogs() {
    setLoading(true);
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
      
      if (savedLogs) {
        let allLogs = JSON.parse(savedLogs);
        
        // --- AUTO-CLEANING ANCHE QUI (30 GIORNI) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const limitDate = format(thirtyDaysAgo, 'yyyy-MM-dd');

        const cleanedLogs = allLogs.filter((log: any) => log.date >= limitDate);
        
        // Se abbiamo pulito dati vecchi, aggiorniamo lo storage
        if (cleanedLogs.length !== allLogs.length) {
          await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(cleanedLogs));
        }

        // Filtra per la data selezionata nel calendario
        const filtered = cleanedLogs.filter((log: any) => log.date === dateString);
        setLogs(filtered);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error("Errore lettura history locale:", e);
    } finally {
      setLoading(false);
    }
  }

  const deleteLog = async (id: string) => {
    Alert.alert("Elimina Pasto", "Rimuovere questo pasto dalla storia?", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => {
          try {
            const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
            if (savedLogs) {
              const allLogs = JSON.parse(savedLogs);
              const updated = allLogs.filter((l: any) => l.id !== id);
              await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updated));
              fetchLocalLogs(); // Refresh
            }
          } catch (e) {
            Alert.alert("Errore", "Impossibile eliminare il log.");
          }
      }}
    ]);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
      if (savedLogs) {
        const allLogs = JSON.parse(savedLogs);
        const updated = allLogs.map((l: any) => 
          l.id === editingItem.id ? {
            ...editingItem,
            kcal: parseInt(editingItem.kcal) || 0,
            proteins: parseInt(editingItem.proteins) || 0,
            carbs: parseInt(editingItem.carbs) || 0,
            fats: parseInt(editingItem.fats) || 0,
          } : l
        );
        
        await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updated));
        setEditModalVisible(false);
        fetchLocalLogs();
      }
    } catch (e) {
      Alert.alert("Errore", "Impossibile salvare le modifiche.");
    }
  };

  const totals = logs.reduce((acc, log) => ({
    kcal: acc.kcal + (log.kcal || 0),
    p: acc.p + (log.proteins || 0),
    c: acc.c + (log.carbs || 0),
    f: acc.f + (log.fats || 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => setSelectedDate(subDays(selectedDate, 1))} style={styles.navBtn}>
          <ChevronLeft color="#00cec9" size={28} />
        </TouchableOpacity>
        <View style={styles.dateDisplay}>
          <Text style={styles.dateMain}>{format(selectedDate, 'd MMMM', { locale: it })}</Text>
          <Text style={styles.dateSub}>{format(selectedDate, 'EEEE', { locale: it }).toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, 1))} style={styles.navBtn}>
          <ChevronRight color="#00cec9" size={28} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}><Text style={styles.summaryVal}>{Math.round(totals.kcal)}</Text><Text style={styles.summaryLabel}>KCAL</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.summaryVal, {color: '#fdcb6e'}]}>{Math.round(totals.c)}g</Text><Text style={styles.summaryLabel}>CARBS</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.summaryVal, {color: '#74b9ff'}]}>{Math.round(totals.p)}g</Text><Text style={styles.summaryLabel}>PRO</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.summaryVal, {color: '#ff7675'}]}>{Math.round(totals.f)}g</Text><Text style={styles.summaryLabel}>FATS</Text></View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#00cec9" /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle}>{item.food_name || "Pasto senza nome"}</Text>
                <Text style={styles.logMeta}>
                  {item.meal_type} • P: {Math.round(item.proteins)}g • F: {Math.round(item.fats)}g • C: {Math.round(item.carbs)}g
                </Text>
              </View>
              
              <View style={styles.rightActions}>
                <View style={styles.kcalBox}>
                  <Text style={styles.kcalText}>{Math.round(item.kcal)}</Text>
                </View>
                
                <TouchableOpacity 
                  onPress={() => { setEditingItem(item); setEditModalVisible(true); }} 
                  style={styles.actionBtn}
                >
                  <Edit3 size={18} color="#636e72" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => deleteLog(item.id)} 
                  style={styles.actionBtn}
                >
                  <Trash2 size={18} color="#ff7675" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
                <Text style={{color:'#444', marginTop: 40, textAlign: 'center'}}>Nessun pasto tracciato in questa data.</Text>
            </View>
          }
        />
      )}

      {/* MODALE DI MODIFICA LOCALE */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Pasto</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><X color="#fff" size={24} /></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>NOME ALIMENTO</Text>
              <TextInput 
                style={styles.input} 
                value={editingItem?.food_name} 
                onChangeText={(t) => setEditingItem({...editingItem, food_name: t})}
                placeholder="Nome..."
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
                <Text style={styles.saveBtnText}>CONFERMA MODIFICHE</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingTop: 20 },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  dateDisplay: { alignItems: 'center' },
  dateMain: { color: '#fff', fontSize: 22, fontWeight: '900' },
  dateSub: { color: '#00cec9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#111', margin: 20, padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#333' },
  summaryItem: { alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: '#636e72', fontSize: 9, fontWeight: '800' },
  logCard: { backgroundColor: '#111', borderRadius: 20, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  logTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  logMeta: { color: '#636e72', fontSize: 11, marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kcalBox: { backgroundColor: '#00cec920', padding: 8, borderRadius: 10 },
  kcalText: { color: '#00cec9', fontWeight: '900', fontSize: 12 },
  actionBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, borderWidth: 1, borderColor: '#333', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  inputLabel: { color: '#00cec9', fontSize: 10, fontWeight: '900', marginBottom: 8, marginTop: 15, letterSpacing: 1 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 15, padding: 15, color: '#fff', fontWeight: '700', fontSize: 16, borderWidth: 1, borderColor: '#333' },
  inputRow: { flexDirection: 'row', gap: 0 },
  saveBtn: { backgroundColor: '#00cec9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 20, marginTop: 30, gap: 10 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
});