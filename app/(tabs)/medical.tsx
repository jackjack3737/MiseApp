import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, FlatList, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router'; // Importante per ricaricare lo stato
import { BrainCircuit, Search, Zap, Activity, ChevronRight, ShoppingCart, Plus, ShieldCheck, ArrowLeft, Check, ShieldAlert, X, CalendarPlus, Cpu, AlertTriangle, RefreshCw } from 'lucide-react-native';

const CART_KEY = '@user_shopping_list';
const LOGS_KEY = '@user_daily_logs';
const SYMPTOM_KEY = '@user_daily_symptom_factor';

const TECH_GREEN = '#39FF14'; 
const RED_ALERT = '#FF3333';
const DARK_TECH_GREEN = '#1b3517';
const BORDER_COLOR = '#1A1A1A';

export default function MedicalScreen() {
  const [search, setSearch] = useState('');
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>({});
  const [addedItems, setAddedItems] = useState<string[]>([]); 
  
  // STATO ATTUALE DEL SISTEMA
  const [activeSymptom, setActiveSymptom] = useState<any>(null);

  // Ricarica lo stato ogni volta che entri nella pagina
  useFocusEffect(useCallback(() => {
      checkSystemStatus();
  }, []));

  const checkSystemStatus = async () => {
      try {
          const data = await AsyncStorage.getItem(SYMPTOM_KEY);
          if (data) setActiveSymptom(JSON.parse(data));
          else setActiveSymptom(null);
      } catch(e) {}
  };

  // RESET DEL PROTOCOLLO (Rimuove il sintomo)
  const handleResetProtocol = async () => {
      try {
          await AsyncStorage.removeItem(SYMPTOM_KEY);
          setActiveSymptom(null);
          Alert.alert("SISTEMA RIPRISTINATO", "Parametri metabolici normalizzati. Malus rimosso.");
      } catch(e) {}
  };

  useEffect(() => {
    if (search.length > 2) fetchProtocols();
    else if (search.length === 0) {
        setProtocols([]);
        setSelectedProtocol(null);
    }
  }, [search]);

  useEffect(() => {
    if (selectedProtocol?.recommended_product_id?.length > 0) {
      fetchProductsInfo(selectedProtocol.recommended_product_id);
    }
    setAddedItems([]); 
  }, [selectedProtocol]);

  const clearSearch = () => {
    setSearch('');
    setProtocols([]);
    setSelectedProtocol(null);
  };

  async function fetchProtocols() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('biohack_protocols')
        .select('*')
        .ilike('symptom_name', `%${search}%`)
        .limit(20);
      if (!error) setProtocols(data || []);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  }

  async function fetchProductsInfo(ids: string[]) {
    try {
      const { data } = await supabase
        .from('partner_products')
        .select('id, product_name, brand_name, description, shop_url, price') 
        .in('id', ids);
      if (data) {
        const mapping = data.reduce((acc: any, curr: any) => {
          acc[curr.id] = curr;
          return acc;
        }, {});
        setProductDetails(mapping);
      }
    } catch (e) { console.error(e); }
  }

  const handleLogSymptom = async () => {
    if (!selectedProtocol) return;
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // 1. LOG DIARIO
        const newLog = {
            id: Date.now().toString(),
            date: today,
            food_name: `SINTOMO: ${selectedProtocol.symptom_name.toUpperCase()}`, 
            meal_type: 'SINTOMO', 
            kcal: 0, carbs: 0, proteins: 0, fats: 0, 
            label: 'MONITORAGGIO',
            icon_type: 'activity'
        };

        const existingLogsJson = await AsyncStorage.getItem(LOGS_KEY);
        const existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
        await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([newLog, ...existingLogs]));
        
        // 2. IMPOSIZIONE MALUS
        let severityFactor = 0.8; 
        let warningMsg = "ADATTAMENTO LIEVE";
        const name = selectedProtocol.symptom_name.toLowerCase();
        
        if (name.includes('gonfiore') || name.includes('stomaco') || name.includes('reflusso')) {
            severityFactor = 0.5; 
            warningMsg = "GUT REST MODE: CARBO -50%";
        } else if (name.includes('stanchezza') || name.includes('brain fog')) {
            severityFactor = 0.7; 
            warningMsg = "FOCUS MODE: CARBO -30%";
        }

        const symptomData = {
            factor: severityFactor,
            name: selectedProtocol.symptom_name,
            message: warningMsg,
            date: today
        };

        await AsyncStorage.setItem(SYMPTOM_KEY, JSON.stringify(symptomData));
        await checkSystemStatus(); // Aggiorna la UI locale subito

        Alert.alert("BIO-FEEDBACK REGISTRATO", `Protocollo aggiornato:\n${warningMsg}`);

    } catch (e) {
        Alert.alert("ERRORE", "FALLIMENTO SCRITTURA DATI");
    }
  };

  const addToCart = async (productId: string) => {
    if (!productId || addedItems.includes(productId)) return;
    try {
      const currentCart = await AsyncStorage.getItem(CART_KEY);
      let cartItems = currentCart ? JSON.parse(currentCart) : [];
      const product = productDetails[productId];
      const name = product ? `${product.product_name} (${product.brand_name})` : "INTEGRATORE_BIOHACK";

      if (!cartItems.find((i: any) => i.id === productId)) {
        cartItems.push({
          id: productId,
          name: name,
          is_bought: false,
          category: 'INTEGRAZIONE',
          created_at: new Date().toISOString(),
          product_url: product?.shop_url || null,
          price: product?.price || null
        });
        await AsyncStorage.setItem(CART_KEY, JSON.stringify(cartItems));
      }
      setAddedItems(prev => [...prev, productId]); 
    } catch (e) { Alert.alert("ERRORE", "SYNC_CART_FAILED"); }
  };

  const renderProtocolItem = ({ item }: any) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => setSelectedProtocol(item)}>
      <View style={styles.resultHeader}>
        <Activity size={18} color={TECH_GREEN} />
        <Text style={styles.symptomTitle}>{item.symptom_name.toUpperCase()}</Text>
      </View>
      <ChevronRight size={20} color={TECH_GREEN} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BrainCircuit size={28} color={TECH_GREEN} />
        <Text style={styles.title}>BIO-ADVISOR</Text>
      </View>

      {/* --- PANNELLO STATO SISTEMA (NUOVO) --- */}
      <View style={[styles.statusPanel, activeSymptom ? styles.statusPanelAlert : styles.statusPanelOk]}>
          <View style={{flex: 1}}>
              <Text style={[styles.statusLabel, activeSymptom && {color: RED_ALERT}]}>
                  {activeSymptom ? "SISTEMA COMPROMESSO" : "SISTEMA OTTIMALE"}
              </Text>
              <Text style={styles.statusDesc}>
                  {activeSymptom ? `${activeSymptom.name.toUpperCase()} RILEVATO` : "NESSUN SINTOMO REGISTRATO"}
              </Text>
          </View>
          {activeSymptom && (
              <TouchableOpacity onPress={handleResetProtocol} style={styles.resetBtn}>
                  <RefreshCw size={14} color="#FFF" />
                  <Text style={styles.resetBtnText}>RISOLVI</Text>
              </TouchableOpacity>
          )}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
            <Search size={18} color={TECH_GREEN} style={styles.searchIcon} />
            <TextInput
            placeholder="CERCA SINTOMO..."
            placeholderTextColor={DARK_TECH_GREEN}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            />
            {search.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                    <X size={18} color={TECH_GREEN} />
                </TouchableOpacity>
            )}
        </View>
      </View>

      {loading && <ActivityIndicator color={TECH_GREEN} style={{ marginTop: 20 }} />}

      {!selectedProtocol ? (
        <FlatList
          data={protocols}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProtocolItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.introBox}>
              <Cpu size={40} color={DARK_TECH_GREEN} style={{marginBottom: 15}} />
              <Text style={styles.introText}>ANALISI CLINICA DISPONIBILE PER 2000+ SINTOMI REGISTRATI NEL DATABASE.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView style={styles.detailView} contentContainerStyle={{ paddingBottom: 100 }}>
          <TouchableOpacity onPress={() => setSelectedProtocol(null)} style={styles.backBtn}>
            <ArrowLeft size={16} color={TECH_GREEN} />
            <Text style={styles.backBtnText}>TORNA AI RISULTATI</Text>
          </TouchableOpacity>
          
          <Text style={styles.detailSymptom}>{selectedProtocol.symptom_name.toUpperCase()}</Text>
          
          <TouchableOpacity style={styles.logSymptomBtn} onPress={handleLogSymptom}>
            <AlertTriangle size={18} color="#000" />
            <Text style={styles.logSymptomText}>REGISTRA E ADATTA DIETA</Text>
          </TouchableOpacity>

          <View style={styles.techCard}>
            <Text style={styles.cardLabel}>MECCANISMO BIOCHIMICO</Text>
            <Text style={styles.adviceContent}>{selectedProtocol.ai_advice || "Analisi molecolare in corso..."}</Text>
          </View>

          <View style={[styles.techCard, { borderColor: TECH_GREEN }]}>
            <View style={styles.cardHeaderRow}>
              <Zap size={16} color={TECH_GREEN} />
              <Text style={[styles.cardLabel, { color: TECH_GREEN }]}>LIFESTYLE_HACK</Text>
            </View>
            <Text style={styles.actionContent}>{selectedProtocol.actionable_step}</Text>
          </View>

          {selectedProtocol.forbidden_foods && selectedProtocol.forbidden_foods.length > 0 && (
            <View style={[styles.techCard, { borderLeftColor: '#ff4d4d', borderLeftWidth: 3 }]}>
              <View style={styles.cardHeaderRow}>
                <ShieldAlert size={16} color="#ff4d4d" />
                <Text style={[styles.cardLabel, { color: '#ff4d4d' }]}>CIBI DA EVITARE (TRIGGER)</Text>
              </View>
              <View style={styles.forbiddenList}>
                {selectedProtocol.forbidden_foods.map((food: string, index: number) => (
                  <View key={index} style={styles.forbiddenBadge}>
                    <Text style={styles.forbiddenText}>{food.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {selectedProtocol.recommended_product_id?.length > 0 && (
            <View style={styles.synergySection}>
              <Text style={styles.sectionHeader}>{'>'} SINERGIA_INTEGRATIVA</Text>
              {selectedProtocol.recommended_product_id.map((id: any, index: number) => {
                const info = productDetails[id];
                const isAdded = addedItems.includes(id);

                return (
                  <View key={`${id}-${index}`} style={[styles.productItem, isAdded && styles.productItemAdded]}>
                      <View style={styles.productContent}>
                        <View style={styles.productHeader}>
                            <ShieldCheck size={14} color={TECH_GREEN} />
                            <Text style={styles.brandName}>{info?.brand_name?.toUpperCase() || "CARICAMENTO..."}</Text>
                        </View>
                        <Text style={styles.productNameText}>{info?.product_name?.toUpperCase() || "INTEGRATORE MIRATO"}</Text>
                        
                        <View style={styles.rationaleBox}>
                            <Text style={styles.rationaleText}>
                                {info?.description || "Ottimizzazione biochimica mirata."}
                            </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.addBtnSmall, isAdded && styles.addBtnCheck]} 
                        onPress={() => addToCart(id)}
                        disabled={isAdded}
                      >
                        {isAdded ? <Check size={20} color="#000" /> : <Plus size={20} color="#000" />}
                      </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 25, gap: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  title: { color: TECH_GREEN, fontSize: 18, fontWeight: '900', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  // NUOVO PANNELLO STATO
  statusPanel: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, justifyContent: 'space-between' },
  statusPanelOk: { backgroundColor: '#051005', borderBottomColor: TECH_GREEN },
  statusPanelAlert: { backgroundColor: '#1a0000', borderBottomColor: RED_ALERT },
  statusLabel: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  statusDesc: { color: '#FFF', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RED_ALERT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  resetBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  searchContainer: { padding: 20, backgroundColor: '#050505' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 2, paddingHorizontal: 15, borderWidth: 1, borderColor: DARK_TECH_GREEN },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 50, color: TECH_GREEN, fontSize: 13, fontFamily: 'monospace' },
  clearBtn: { padding: 5 },

  list: { padding: 20 },
  resultCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#080808', padding: 18, borderLeftWidth: 2, borderLeftColor: DARK_TECH_GREEN, marginBottom: 10, borderWidth: 1, borderColor: BORDER_COLOR },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 },
  symptomTitle: { color: '#fff', fontSize: 12, fontWeight: '900', fontFamily: 'monospace' },

  detailView: { paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtnText: { color: TECH_GREEN, fontWeight: '900', fontSize: 9, fontFamily: 'monospace', opacity: 0.6 },
  
  detailSymptom: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 15, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  logSymptomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TECH_GREEN, paddingVertical: 12, borderRadius: 2, marginBottom: 25 },
  logSymptomText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  techCard: { backgroundColor: '#080808', padding: 18, borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginBottom: 15 },
  cardLabel: { color: TECH_GREEN, fontSize: 9, fontWeight: '900', marginBottom: 10, fontFamily: 'monospace', opacity: 0.7 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  
  adviceContent: { color: '#ccc', fontSize: 14, lineHeight: 20, fontFamily: 'monospace' },
  actionContent: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 21, fontFamily: 'monospace' },
  
  forbiddenBadge: { backgroundColor: '#1a0000', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2, borderWidth: 1, borderColor: '#330000', marginTop: 5 },
  forbiddenText: { color: '#ff4d4d', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  forbiddenList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  sectionHeader: { color: TECH_GREEN, fontSize: 11, fontWeight: '900', marginBottom: 15, opacity: 0.8 },
  synergySection: { marginTop: 20 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#050505', padding: 15, marginBottom: 12, borderWidth: 1, borderColor: BORDER_COLOR },
  productItemAdded: { borderColor: TECH_GREEN, backgroundColor: '#0a120a' },
  productContent: { flex: 1, marginRight: 15 },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  brandName: { color: TECH_GREEN, fontSize: 8, fontWeight: '900', fontFamily: 'monospace' },
  productNameText: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 8, fontFamily: 'monospace' },
  rationaleBox: { backgroundColor: '#000', padding: 10, borderLeftWidth: 1, borderLeftColor: DARK_TECH_GREEN },
  rationaleText: { color: '#888', fontSize: 11, lineHeight: 15, fontFamily: 'monospace' },
  
  addBtnSmall: { backgroundColor: TECH_GREEN, width: 40, height: 40, borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  addBtnCheck: { backgroundColor: TECH_GREEN },
  
  introBox: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  introText: { color: DARK_TECH_GREEN, fontSize: 10, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 0.5 }
});