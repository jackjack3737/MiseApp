import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Utensils, Flame, Trash2, Edit3, X, Check } from 'lucide-react-native';
import { format, addDays, subDays } from 'date-fns';
import { it } from 'date-fns/locale';

export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [selectedDate]);

  async function fetchLogs() {
    setLoading(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('date', dateString)
      .order('created_at', { ascending: false });

    if (!error) setLogs(data || []);
    setLoading(false);
  }

  const deleteLog = async (id: string) => {
    Alert.alert("Elimina Pasto", "Rimuovere questo pasto?", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => {
          const { error } = await supabase.from('daily_logs').delete().eq('id', id);
          if (!error) fetchLogs();
      }}
    ]);
  };

  const saveEdit = async () => {
    if (!editingItem) return;

    // Usiamo food_name per il salvataggio perché è la colonna reale del tuo DB
    const { error } = await supabase
      .from('daily_logs')
      .update({
        food_name: editingItem.food_name || editingItem.title, 
        kcal: parseInt(editingItem.kcal) || 0,
        proteins: parseInt(editingItem.proteins) || 0,
        carbs: parseInt(editingItem.carbs) || 0,
        fats: parseInt(editingItem.fats) || 0,
      })
      .eq('id', editingItem.id);

    if (!error) {
      setEditModalVisible(false);
      fetchLogs();
    } else {
      Alert.alert("Errore", "Impossibile aggiornare i dati nel database.");
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
        <View style={styles.summaryItem}><Text style={styles.summaryVal}>{totals.kcal}</Text><Text style={styles.summaryLabel}>KCAL</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.summaryVal, {color: '#fdcb6e'}]}>{totals.c}g</Text><Text style={styles.summaryLabel}>CARBS</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.summaryVal, {color: '#74b9ff'}]}>{totals.p}g</Text><Text style={styles.summaryLabel}>PRO</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.summaryVal, {color: '#ff7675'}]}>{totals.f}g</Text><Text style={styles.summaryLabel}>FATS</Text></View>
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
                {/* LOGICA FIX: Mostra food_name se esiste, altrimenti title */}
                <Text style={styles.logTitle}>{item.food_name || item.title || "Pasto senza nome"}</Text>
                
                <Text style={styles.logMeta}>
                  P: {item.proteins}g • F: {item.fats}g • C: {item.carbs}g
                </Text>
              </View>
              
              <View style={styles.rightActions}>
                <View style={styles.kcalBox}>
                  <Text style={styles.kcalText}>{item.kcal}</Text>
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
                <Text style={{color:'#444', marginTop: 40}}>Nessun pasto tracciato per questo giorno.</Text>
            </View>
          }
        />
      )}

      {/* MODALE DI MODIFICA */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dettagli Pasto</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><X color="#fff" size={24} /></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>NOME ALIMENTO</Text>
              <TextInput 
                style={styles.input} 
                value={editingItem?.food_name || editingItem?.title} 
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingTop: 20 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  dateDisplay: { alignItems: 'center' },
  dateMain: { color: '#fff', fontSize: 20, fontWeight: '900' },
  dateSub: { color: '#00cec9', fontSize: 10, fontWeight: '900' },
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
  actionBtn: { padding: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: '#333', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  inputLabel: { color: '#00cec9', fontSize: 10, fontWeight: '900', marginBottom: 8, marginTop: 15, letterSpacing: 1 },
  input: { backgroundColor: '#222', borderRadius: 15, padding: 15, color: '#fff', fontWeight: '700', fontSize: 16 },
  inputRow: { flexDirection: 'row', gap: 0 },
  saveBtn: { backgroundColor: '#00cec9', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 20, marginTop: 30, gap: 10 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14 }
});