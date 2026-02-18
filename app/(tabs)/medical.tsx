import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, AlertTriangle, ArrowLeft, Check, ChevronRight, Cpu, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, ShoppingCart, Stethoscope, X, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SmartHint from '../../components/SmartHint';
import { DS } from '../../constants/designSystem';
import { CARD_BG, RED_ALERT, TEXT_SECONDARY } from '../../constants/theme';
import { supabase } from '../../src/lib/supabase';

const DARK_BG = DS.bg;
const DARK_CARD = DS.surface;
const DARK_BORDER = DS.border;
const DARK_TEXT = DS.text;
const HEADER_ACCENT = DS.accent;

const CART_KEY = '@user_shopping_list';
const LOGS_KEY = '@user_daily_logs';
const SYMPTOM_KEY = '@user_daily_symptom_factor';

function getTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MedicalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ symptom?: string }>();
  const [search, setSearch] = useState('');
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>({});
  const [addedItems, setAddedItems] = useState<string[]>([]); 
  
  // STATO ATTUALE DEL SISTEMA
  const [activeSymptom, setActiveSymptom] = useState<any>(null);
  // Pasti recenti con ingredienti (per correlazione sintomo → possibili cause)
  const [recentMealsWithIngredients, setRecentMealsWithIngredients] = useState<{ date: string; food_name: string; ingredients?: string[] }[]>([]);

  // Ricarica lo stato ogni volta che entri nella pagina
  useFocusEffect(useCallback(() => {
      checkSystemStatus();
  }, []));

  // Apertura da Home con sintomo (es. "Mal di testa"): precompila ricerca e carica risultati
  useEffect(() => {
    const symptomParam = params.symptom;
    if (symptomParam && typeof symptomParam === 'string' && symptomParam.trim()) {
      setSearch(symptomParam.trim());
    }
  }, [params.symptom]);

  const checkSystemStatus = async () => {
      try {
          const data = await AsyncStorage.getItem(SYMPTOM_KEY);
          const today = getTodayLocal();
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.date === today && parsed.factor != null) {
              setActiveSymptom(parsed);
            } else {
              await AsyncStorage.removeItem(SYMPTOM_KEY);
              setActiveSymptom(null);
            }
          } else setActiveSymptom(null);
      } catch(e) {
        setActiveSymptom(null);
      }
  };

  // RESET DEL PROTOCOLLO (Rimuove il sintomo)
  const handleResetProtocol = async () => {
      try {
          await AsyncStorage.removeItem(SYMPTOM_KEY);
          setActiveSymptom(null);
          Alert.alert("Fatto!", "Parametri ripristinati. Il malus è stato rimosso.");
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

  // Carica pasti degli ultimi 3 giorni (con ingredienti) per suggerire possibili cause del sintomo
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      if (!selectedProtocol) return;
      try {
        const raw = await AsyncStorage.getItem(LOGS_KEY);
        const allLogs: any[] = raw ? JSON.parse(raw) : [];
        const today = new Date().toISOString().split('T')[0];
        const dates = [today];
        for (let i = 1; i <= 2; i++) {
          const d = new Date(Date.now() - i * 86400000);
          dates.push(d.toISOString().split('T')[0]);
        }
        const recent = allLogs.filter((l: any) => {
          const date = l.date || today;
          if (!dates.includes(date)) return false;
          if (l.meal_type === 'SINTOMO' || (l.food_name && String(l.food_name).startsWith('SINTOMO:'))) return false;
          return true;
        });
        const withIngredients = recent.map((l: any) => ({
          date: l.date || today,
          food_name: l.food_name || 'Pasto',
          ingredients: Array.isArray(l.ingredients) ? l.ingredients : undefined,
        }));
        if (!cancelled) setRecentMealsWithIngredients(withIngredients.slice(0, 20));
      } catch {
        if (!cancelled) setRecentMealsWithIngredients([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProtocol]));

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
        const today = getTodayLocal();
        
        // 2. IMPOSIZIONE MALUS (calcolato prima per includerlo nel log)
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

        // 1. LOG DIARIO (con metadati per HistoryScreen)
        const newLog = {
            id: Date.now().toString(),
            date: today,
            food_name: `SINTOMO: ${selectedProtocol.symptom_name.toUpperCase()}`,
            meal_type: 'SINTOMO',
            kcal: 0, carbs: 0, proteins: 0, fats: 0,
            label: 'MONITORAGGIO',
            icon_type: 'activity',
            symptom_message: warningMsg,
            severity_factor: severityFactor,
        };

        const existingLogsJson = await AsyncStorage.getItem(LOGS_KEY);
        const existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
        await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([newLog, ...existingLogs]));

        const symptomData = {
            factor: severityFactor,
            name: selectedProtocol.symptom_name,
            message: warningMsg,
            date: today
        };

        await AsyncStorage.setItem(SYMPTOM_KEY, JSON.stringify(symptomData));
        try {
          const { logSintomo } = require('../../database/db');
          const intensity = severityFactor <= 0.5 ? 8 : severityFactor <= 0.7 ? 6 : 5;
          await logSintomo(selectedProtocol.symptom_name, intensity);
        } catch (_) { /* SQLite non disponibile (es. Expo Go) */ }
        await checkSystemStatus(); // Aggiorna la UI locale subito

        Alert.alert("BIO-FEEDBACK REGISTRATO", `Protocollo aggiornato:\n${warningMsg}`, [
          { text: "OK", onPress: () => router.replace("/tracker") },
        ]);

    } catch (e) {
        Alert.alert("Ops!", "C'è stato un problema nel salvataggio. Riprova.");
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
    } catch (e) { Alert.alert("Ops!", "C'è stato un problema nel salvataggio. Riprova."); }
  };

  const renderProtocolItem = ({ item }: any) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => setSelectedProtocol(item)}>
      <View style={styles.resultHeader}>
        <Activity size={18} color={HEADER_ACCENT} />
        <Text style={styles.symptomTitle}>{item.symptom_name}</Text>
      </View>
      <ChevronRight size={20} color={TEXT_SECONDARY} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Stethoscope size={26} color={HEADER_ACCENT} />
          <View>
            <Text style={styles.title}>Advisor</Text>
            <Text style={styles.headerSubtitle}>Sintomi e protocolli</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/cart')}
          style={styles.headerCartBtn}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <ShoppingCart size={24} color={HEADER_ACCENT} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statusPanel, activeSymptom ? styles.statusPanelAlert : styles.statusPanelOk]}>
          <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, activeSymptom && { color: RED_ALERT }]}>
                  {activeSymptom ? 'Sistema compromesso' : 'Sistema ottimale'}
              </Text>
              <Text style={styles.statusDesc}>
                  {activeSymptom ? `${activeSymptom.name}` : 'Nessun sintomo registrato'}
              </Text>
          </View>
          {activeSymptom && (
              <TouchableOpacity onPress={handleResetProtocol} style={styles.resetBtn}>
                  <RefreshCw size={14} color="#FFFFFF" />
                  <Text style={styles.resetBtnText}>Risolvi</Text>
              </TouchableOpacity>
          )}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
            <Search size={18} color={TEXT_SECONDARY} style={styles.searchIcon} />
            <TextInput
            placeholder="Cerca sintomo..."
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            />
            {search.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                    <X size={18} color={HEADER_ACCENT} />
                </TouchableOpacity>
            )}
        </View>
        <SmartHint
          visible={search.length === 0}
          text="Prova a cercare sintomi come 'Gonfiore', 'Insonnia' o 'Brain Fog' per vedere i protocolli."
        />
      </View>

      {loading && <ActivityIndicator color={HEADER_ACCENT} style={{ marginTop: 20 }} />}

      {!selectedProtocol ? (
        <FlatList
          data={protocols}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProtocolItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.introBox}>
              <Cpu size={40} color={TEXT_SECONDARY} style={{ marginBottom: 15 }} />
              <Text style={styles.introText}>Cerca un sintomo per vedere protocolli e consigli.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView style={styles.detailView} contentContainerStyle={{ paddingBottom: 100 }}>
          <TouchableOpacity onPress={() => setSelectedProtocol(null)} style={styles.backBtn}>
            <ArrowLeft size={16} color={HEADER_ACCENT} />
            <Text style={styles.backBtnText}>Torna ai risultati</Text>
          </TouchableOpacity>
          
          <Text style={styles.detailSymptom}>{selectedProtocol.symptom_name}</Text>
          
          <TouchableOpacity style={styles.logSymptomBtn} onPress={handleLogSymptom}>
            <AlertTriangle size={18} color={CARD_BG} />
            <Text style={styles.logSymptomText}>Registra e adatta dieta</Text>
          </TouchableOpacity>

          {recentMealsWithIngredients.length > 0 && (
            <View style={[styles.techCard, { borderLeftColor: HEADER_ACCENT, borderLeftWidth: 4 }]}>
              <View style={styles.cardHeaderRow}>
                <Activity size={16} color={HEADER_ACCENT} />
                <Text style={[styles.cardLabel, { color: HEADER_ACCENT }]}>Pasti recenti (possibili cause)</Text>
              </View>
              <Text style={styles.recentMealsIntro}>
                Nei giorni scorsi hai mangiato questi piatti. Se il sintomo può dipendere da un alimento, controlla gli ingredienti: potrebbe essere uno di questi.
              </Text>
              {recentMealsWithIngredients.map((meal, idx) => (
                <View key={`${meal.date}-${meal.food_name}-${idx}`} style={styles.recentMealRow}>
                  <Text style={styles.recentMealName}>{meal.food_name}</Text>
                  {meal.ingredients && meal.ingredients.length > 0 ? (
                    <Text style={styles.recentMealIngredients}>Ingredienti: {meal.ingredients.join(', ')}</Text>
                  ) : (
                    <Text style={styles.recentMealNoIngredients}>Nessun dettaglio ingredienti per questo pasto.</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.techCard}>
            <Text style={styles.cardLabel}>Meccanismo</Text>
            <Text style={styles.adviceContent}>{selectedProtocol.ai_advice || "Analisi in corso..."}</Text>
          </View>

          <View style={[styles.techCard, { borderLeftWidth: 4, borderLeftColor: HEADER_ACCENT }]}>
            <View style={styles.cardHeaderRow}>
              <Zap size={16} color={HEADER_ACCENT} />
              <Text style={[styles.cardLabel, { color: HEADER_ACCENT }]}>Lifestyle</Text>
            </View>
            <Text style={styles.actionContent}>{selectedProtocol.actionable_step}</Text>
          </View>

          {selectedProtocol.forbidden_foods && selectedProtocol.forbidden_foods.length > 0 && (
            <View style={[styles.techCard, { borderLeftColor: RED_ALERT, borderLeftWidth: 4 }]}>
              <View style={styles.cardHeaderRow}>
                <ShieldAlert size={16} color={RED_ALERT} />
                <Text style={[styles.cardLabel, { color: RED_ALERT }]}>Cibi da evitare</Text>
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
              <Text style={styles.sectionHeader}>Integratori consigliati</Text>
              {selectedProtocol.recommended_product_id.map((id: any, index: number) => {
                const info = productDetails[id];
                const isAdded = addedItems.includes(id);

                return (
                  <View key={`${id}-${index}`} style={[styles.productItem, isAdded && styles.productItemAdded]}>
                      <View style={styles.productContent}>
                        <View style={styles.productHeader}>
                            <ShieldCheck size={14} color={HEADER_ACCENT} />
                            <Text style={styles.brandName}>{info?.brand_name || "..."}</Text>
                        </View>
                        <Text style={styles.productNameText}>{info?.product_name || "Integratore mirato"}</Text>
                        
                        <View style={styles.rationaleBox}>
                            <Text style={styles.rationaleText}>
                                {info?.description || "Ottimizzazione mirata."}
                            </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.addBtnSmall, isAdded && styles.addBtnCheck]} 
                        onPress={() => addToCart(id)}
                        disabled={isAdded}
                      >
                        {isAdded ? <Check size={20} color={CARD_BG} /> : <Plus size={20} color={CARD_BG} />}
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
  container: { flex: 1, backgroundColor: DARK_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DARK_BORDER,
    backgroundColor: DARK_BG,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerCartBtn: { padding: 8 },
  title: { color: DARK_TEXT, fontSize: 22, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600', marginTop: 2 },
  
  statusPanel: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 20, marginTop: 12, borderRadius: 16, borderWidth: 1, justifyContent: 'space-between', ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  statusPanelOk: { backgroundColor: DARK_CARD, borderColor: '#22C55E' },
  statusPanelAlert: { backgroundColor: DARK_CARD, borderColor: RED_ALERT },
  statusLabel: { color: DARK_TEXT, fontSize: 13, fontWeight: '600' },
  statusDesc: { color: '#9CA3AF', fontSize: 13, fontWeight: '500', marginTop: 2 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RED_ALERT, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  resetBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  searchContainer: { padding: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK_CARD, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: DARK_BORDER },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, height: 50, color: DARK_TEXT, fontSize: 15, fontWeight: '500' },
  clearBtn: { padding: 6 },

  list: { padding: 20 },
  resultCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: DARK_CARD, padding: 18, borderLeftWidth: 4, borderLeftColor: HEADER_ACCENT, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: DARK_BORDER, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  symptomTitle: { color: DARK_TEXT, fontSize: 15, fontWeight: '600' },

  detailView: { paddingHorizontal: 20, paddingTop: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtnText: { color: HEADER_ACCENT, fontWeight: '600', fontSize: 14 },
  
  detailSymptom: { color: DARK_TEXT, fontSize: 24, fontWeight: '700', marginBottom: 18 },
  
  logSymptomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: HEADER_ACCENT, paddingVertical: 14, borderRadius: 14, marginBottom: 24 },
  logSymptomText: { color: DARK_BG, fontSize: 15, fontWeight: '600' },

  techCard: { backgroundColor: DARK_CARD, padding: 18, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: DARK_BORDER, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  cardLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  
  adviceContent: { color: DARK_TEXT, fontSize: 14, lineHeight: 22 },
  actionContent: { color: DARK_TEXT, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  
  forbiddenBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: RED_ALERT, marginTop: 6 },
  forbiddenText: { color: RED_ALERT, fontSize: 12, fontWeight: '600' },
  forbiddenList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  sectionHeader: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', marginBottom: 14 },
  synergySection: { marginTop: 24 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: DARK_CARD, padding: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: DARK_BORDER, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  productItemAdded: { borderColor: HEADER_ACCENT },
  productContent: { flex: 1, marginRight: 16 },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  brandName: { color: HEADER_ACCENT, fontSize: 11, fontWeight: '600' },
  productNameText: { color: DARK_TEXT, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  rationaleBox: { backgroundColor: DARK_BG, padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: HEADER_ACCENT },
  rationaleText: { color: '#9CA3AF', fontSize: 12, lineHeight: 18 },
  
  addBtnSmall: { backgroundColor: HEADER_ACCENT, width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addBtnCheck: { backgroundColor: HEADER_ACCENT },
  
  introBox: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  introText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', fontWeight: '500' },

  recentMealsIntro: { color: DARK_TEXT, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  recentMealRow: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: DARK_BORDER },
  recentMealName: { color: DARK_TEXT, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  recentMealIngredients: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },
  recentMealNoIngredients: { color: '#6B7280', fontSize: 12, fontStyle: 'italic' },
});