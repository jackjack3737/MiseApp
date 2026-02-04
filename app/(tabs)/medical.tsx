import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrainCircuit, Search, Zap, Activity, ChevronRight, ShoppingCart, Plus, ShieldCheck, ArrowLeft, Check, ShieldAlert, X, CalendarPlus } from 'lucide-react-native';

const CART_KEY = '@user_shopping_list';
const LOGS_KEY = '@user_daily_logs';

export default function MedicalScreen() {
  const [search, setSearch] = useState('');
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>({});
  const [addedItems, setAddedItems] = useState<string[]>([]); 

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

  // PULISCE TUTTO: Ricerca, Lista e Dettaglio aperto
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

  // --- NUOVA FUNZIONE: REGISTRA SINTOMO ---
  const handleLogSymptom = async () => {
    if (!selectedProtocol) return;
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Creiamo un log "speciale" per il sintomo
        const newLog = {
            id: Date.now().toString(),
            date: today,
            food_name: selectedProtocol.symptom_name, // Usiamo il nome cibo per il titolo
            meal_type: 'SINTOMO', // Tipo speciale
            kcal: 0, carbs: 0, proteins: 0, fats: 0, // Zero macro
            label: 'Monitoraggio',
            icon_type: 'activity' // Icona specifica che gestiremo nel tracker
        };

        const existingLogsJson = await AsyncStorage.getItem(LOGS_KEY);
        const existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
        
        // Aggiungi in cima
        await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([newLog, ...existingLogs]));
        
        Alert.alert("Registrato", "Sintomo aggiunto al Diario Giornaliero e allo Storico.");
    } catch (e) {
        Alert.alert("Errore", "Impossibile salvare il sintomo.");
    }
  };

  const addToCart = async (productId: string) => {
    if (!productId || addedItems.includes(productId)) return;
    try {
      const currentCart = await AsyncStorage.getItem(CART_KEY);
      let cartItems = currentCart ? JSON.parse(currentCart) : [];
      const product = productDetails[productId];
      const name = product ? `${product.product_name} (${product.brand_name})` : "Integratore Bio-Hacking";

      if (!cartItems.find((i: any) => i.id === productId)) {
        cartItems.push({
          id: productId,
          name: name,
          is_bought: false,
          category: 'Integrazione',
          created_at: new Date().toISOString(),
          product_url: product?.shop_url || null,
          price: product?.price || null
        });
        await AsyncStorage.setItem(CART_KEY, JSON.stringify(cartItems));
      }
      setAddedItems(prev => [...prev, productId]); 
    } catch (e) { Alert.alert("Errore", "Salvataggio fallito."); }
  };

  const renderProtocolItem = ({ item }: any) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => setSelectedProtocol(item)}>
      <View style={styles.resultHeader}>
        <Activity size={20} color="#00cec9" style={{marginTop: 2}} />
        <Text style={styles.symptomTitle}>{item.symptom_name}</Text>
      </View>
      <ChevronRight size={20} color="#1a1a1a" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BrainCircuit size={32} color="#00cec9" />
        <Text style={styles.title}>BIO-ADVISOR</Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={20} color="#333" style={styles.searchIcon} />
        <TextInput
          placeholder="Cerca sintomo o disturbo..."
          placeholderTextColor="#333"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                <X size={18} color="#333" />
            </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color="#00cec9" style={{ marginTop: 20 }} />}

      {!selectedProtocol ? (
        <FlatList
          data={protocols}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProtocolItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.introBox}>
              <Text style={styles.introText}>Analisi clinica Huberman-style disponibile per 2000+ sintomi.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView style={styles.detailView} contentContainerStyle={{ paddingBottom: 100 }}>
          <TouchableOpacity onPress={() => setSelectedProtocol(null)} style={styles.backBtn}>
            <ArrowLeft size={16} color="#636e72" />
            <Text style={styles.backBtnText}>TORNA AI RISULTATI</Text>
          </TouchableOpacity>
          
          <Text style={styles.detailSymptom}>{selectedProtocol.symptom_name}</Text>
          
          {/* TASTO REGISTRA SINTOMO */}
          <TouchableOpacity style={styles.logSymptomBtn} onPress={handleLogSymptom}>
            <CalendarPlus size={18} color="#000" />
            <Text style={styles.logSymptomText}>REGISTRA NEL DIARIO</Text>
          </TouchableOpacity>

          <View style={styles.adviceCard}>
            <Text style={styles.adviceLabel}>MECCANISMO BIOCHIMICO</Text>
            <Text style={styles.adviceContent}>{selectedProtocol.ai_advice || "Analisi molecolare..."}</Text>
          </View>

          <View style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <Zap size={18} color="#fdcb6e" />
              <Text style={styles.actionLabel}>LIFESTYLE HACK</Text>
            </View>
            <Text style={styles.actionContent}>{selectedProtocol.actionable_step}</Text>
          </View>

          {/* CIBI DA EVITARE */}
          {selectedProtocol.forbidden_foods && selectedProtocol.forbidden_foods.length > 0 && (
            <View style={styles.forbiddenCard}>
              <View style={styles.forbiddenHeader}>
                <ShieldAlert size={18} color="#ff7675" />
                <Text style={styles.forbiddenLabel}>CIBI DA EVITARE (TRIGGER)</Text>
              </View>
              <View style={styles.forbiddenList}>
                {selectedProtocol.forbidden_foods.map((food: string, index: number) => (
                  <View key={index} style={styles.forbiddenBadge}>
                    <Text style={styles.forbiddenText}>{food}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {selectedProtocol.recommended_product_id?.length > 0 && (
            <View style={styles.synergySection}>
              <Text style={styles.synergyLabel}>SINERGIA INTEGRATIVA PARTNER</Text>
              {selectedProtocol.recommended_product_id.map((id: any, index: number) => {
                const info = productDetails[id];
                const isAdded = addedItems.includes(id);

                return (
                  <View key={`${id}-${index}`} style={[styles.productItem, isAdded && styles.productItemAdded]}>
                      <View style={styles.productContent}>
                        <View style={styles.productHeader}>
                            <ShieldCheck size={14} color="#00cec9" />
                            <Text style={styles.brandName}>{info?.brand_name?.toUpperCase() || "CARICAMENTO..."}</Text>
                        </View>
                        <Text style={styles.productNameText}>{info?.product_name || "Integratore mirato"}</Text>
                        
                        <View style={styles.rationaleBox}>
                            <Zap size={10} color="#fdcb6e" />
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
                        {isAdded ? <Check size={22} color="#000" /> : <Plus size={22} color="#000" />}
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 25, gap: 15 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', marginHorizontal: 20, borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#111' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 55, color: '#fff', fontSize: 16 },
  clearBtn: { padding: 5 },

  list: { padding: 20 },
  resultCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 20, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#111' },
  
  // Header flessibile per testi lunghi
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 15, flex: 1, marginRight: 10 },
  symptomTitle: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1, flexWrap: 'wrap', lineHeight: 22 },

  detailView: { paddingHorizontal: 25, paddingTop: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtnText: { color: '#636e72', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  
  detailSymptom: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 15, lineHeight: 32 },
  
  // TASTO REGISTRA
  logSymptomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00cec9', paddingVertical: 12, borderRadius: 12, marginBottom: 25, width: '100%' },
  logSymptomText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  adviceCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 25, marginBottom: 15, borderWidth: 1, borderColor: '#111' },
  adviceLabel: { color: '#00cec9', fontSize: 9, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
  adviceContent: { color: '#dfe6e9', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  
  actionCard: { backgroundColor: '#fdcb6e05', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#fdcb6e20', marginBottom: 25 },
  actionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  actionLabel: { color: '#fdcb6e', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  actionContent: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  
  forbiddenCard: { backgroundColor: '#ff767505', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#ff767520', marginBottom: 25 },
  forbiddenHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  forbiddenLabel: { color: '#ff7675', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  forbiddenList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  forbiddenBadge: { backgroundColor: '#ff767515', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#ff767530' },
  forbiddenText: { color: '#ff7675', fontSize: 11, fontWeight: '700' },

  synergySection: { marginTop: 10 },
  synergyLabel: { color: '#333', fontSize: 10, fontWeight: '900', marginBottom: 15, letterSpacing: 1.5 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 18, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  productItemAdded: { borderColor: '#00cec940', backgroundColor: '#050505' },
  productContent: { flex: 1, marginRight: 15 },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  brandName: { color: '#00cec9', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  productNameText: { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  rationaleBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(253, 203, 110, 0.05)', padding: 10, borderRadius: 10, borderLeftWidth: 2, borderLeftColor: '#fdcb6e' },
  rationaleText: { color: '#bdc3c7', fontSize: 11, lineHeight: 15, fontWeight: '500', flex: 1 },
  addBtnSmall: { backgroundColor: '#00cec9', width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  addBtnCheck: { backgroundColor: '#55efc4' },
  introBox: { marginTop: 60, alignItems: 'center', paddingHorizontal: 40 },
  introText: { color: '#222', fontSize: 13, textAlign: 'center', fontWeight: '600', lineHeight: 20 }
});