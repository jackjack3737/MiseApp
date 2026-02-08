import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, StatusBar, TextInput, ScrollView, Alert, Platform, Modal, FlatList } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { User, Search, Zap, Beef, Fish, CookingPot, Leaf, ChevronRight, Sparkles, Cpu, Filter, ChefHat, X, Minus, Plus, Scale, ArrowLeft, Layers, Activity, Flame, Droplet } from 'lucide-react-native';
import * as Haptics from 'expo-haptics'; 

import { getFoodFromAI } from '../../utils/gemini-cache';

const TECH_GREEN = '#39FF14'; 
const DARK_TECH_GREEN = '#1b3517';
const BORDER_COLOR = '#1A1A1A';

const IconMap: any = {
  'Carnivore': <Beef size={20} color={TECH_GREEN} />,
  'Keto': <CookingPot size={20} color={TECH_GREEN} />,
  'Paleo': <Leaf size={20} color={TECH_GREEN} />,
  'Low Carb': <Zap size={20} color={TECH_GREEN} />,
  default: <Cpu size={20} color={TECH_GREEN} />
};

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const [protocol, setProtocol] = useState<string>('Keto');
  
  // DATI UTENTE E TOTALI DI OGGI
  const [userTargets, setUserTargets] = useState({ kcal: 2000, p: 150, c: 30, f: 120 }); 
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, p: 0, c: 0, f: 0 });

  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // STATI RICERCA (DATABASE)
  const [searchText, setSearchText] = useState('');

  // STATI CHEF AI
  const [chefIngredients, setChefIngredients] = useState('');
  const [chefLoading, setChefLoading] = useState(false);
  
  // -- STATI GESTIONE RICETTA DINAMICA --
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null); 
  const [recipeWeight, setRecipeWeight] = useState(100);

  const [mixer, setMixer] = useState({ maxP: 100, maxC: 50 });

  const loadData = async () => {
    try {
      // 1. CARICA PROFILO (TARGET)
      const savedProfile = await AsyncStorage.getItem('@user_profile');
      if (savedProfile) {
        const p = JSON.parse(savedProfile);
        setUserTargets({ 
          kcal: parseFloat(p.targetCalories) || 2000,
          p: parseFloat(p.protein) || 150,
          c: parseFloat(p.carbs) || 30,
          f: parseFloat(p.fat) || 120
        });
        setProtocol(params.protocol || p.protocol || 'Keto');
      }

      // 2. CARICA LOG DI OGGI (TOTALI)
      const today = new Date().toISOString().split('T')[0];
      const logsRaw = await AsyncStorage.getItem('@user_daily_logs');
      if (logsRaw) {
          const logs = JSON.parse(logsRaw);
          const todaysLogs = logs.filter((l: any) => l.date === today);
          
          const totals = todaysLogs.reduce((acc: any, curr: any) => ({
              kcal: acc.kcal + (curr.kcal || 0),
              p: acc.p + (curr.proteins || 0),
              c: acc.c + (curr.carbs || 0),
              f: acc.f + (curr.fats || 0)
          }), { kcal: 0, p: 0, c: 0, f: 0 });

          setTodayTotals(totals);
      }

    } catch (e) { console.error(e); }
  };

  // --- FUNZIONE: CARICAMENTO E RICERCA DATABASE ---
  async function fetchRecipes() {
    setLoading(true);
    try {
      let query = supabase
        .from('recipes')
        .select('*')
        .eq('category', protocol)
        .lte('protein_100g', mixer.maxP)
        .lte('carbs_100g', mixer.maxC);

      if (searchText.trim().length > 0) {
        query = query.ilike('title', `%${searchText}%`);
      }

      query = query.order('title', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      setRecipes(data || []);
    } catch (err) { 
        setRecipes([]); 
    } 
    finally { setLoading(false); }
  }

  const handleDbSearch = () => {
      Haptics.selectionAsync();
      fetchRecipes();
  };

  // --- FUNZIONE 2: GENERATORE CHEF AI ---
  const handleChefGen = async () => {
    if (!chefIngredients.trim()) return;

    setChefLoading(true);
    setRecipeWeight(100); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
        const prompt = `BIO_HACK_INSTRUCTION: Sei uno Chef Algoritmico.
        Crea una ricetta ${protocol.toUpperCase()} con: ${chefIngredients}.
        
        RISPONDI SOLO ED ESCLUSIVAMENTE CON QUESTO JSON VALIDATO (Niente markdown):
        {
          "title": "Nome Ricetta",
          "macros_100g": {"kcal": 0, "p": 0, "c": 0, "f": 0},
          "ingredients": [
            {"item": "Nome ingrediente", "qty_100g": 0, "unit": "g/ml/pz"}
          ],
          "instructions": ["Passo 1", "Passo 2", "Passo 3"]
        }
        
        NOTA: Calcola le quantità "qty_100g" necessarie per ottenere 100g di prodotto finito.`;

        const response = await getFoodFromAI(prompt);
        
        let rawText = response.ai_advice || (typeof response === 'string' ? response : JSON.stringify(response));
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawText = rawText.substring(firstBrace, lastBrace + 1);
        }

        const parsedData = JSON.parse(rawText);
        setGeneratedRecipe(parsedData);

    } catch (e) {
        Alert.alert("ERRORE DI PARSING", "L'IA non ha rispettato il protocollo dati. Riprova con ingredienti più semplici.");
    } finally {
        setChefLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [params.protocol]));
  useEffect(() => { 
      if(searchText === '') fetchRecipes(); 
  }, [protocol, mixer]);

  // --- COMPONENTE HUD STATUS (Nuovo) ---
  const StatusHUD = () => {
      const getProgress = (current: number, target: number) => {
          if(!target) return 0;
          return Math.min((current / target) * 100, 100) + '%';
      };

      return (
          <View style={styles.hudContainer}>
              <View style={styles.hudHeader}>
                  <Activity size={14} color={TECH_GREEN} />
                  <Text style={styles.hudTitle}>STATO METABOLICO ODIERNO</Text>
              </View>
              
              <View style={styles.hudGrid}>
                  {/* KCAL */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>KCAL</Text>
                      <Text style={styles.hudValue}>{Math.round(todayTotals.kcal)}</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.kcal, userTargets.kcal), backgroundColor: TECH_GREEN}]} />
                      </View>
                  </View>

                  {/* PRO */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>PRO</Text>
                      <Text style={styles.hudValue}>{Math.round(todayTotals.p)}g</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.p, userTargets.p), backgroundColor: '#FFF'}]} />
                      </View>
                  </View>

                  {/* CARB */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>CARB</Text>
                      <Text style={[styles.hudValue, {color: TECH_GREEN}]}>{Math.round(todayTotals.c)}g</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.c, userTargets.c), backgroundColor: TECH_GREEN}]} />
                      </View>
                  </View>

                  {/* FAT */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>FAT</Text>
                      <Text style={styles.hudValue}>{Math.round(todayTotals.f)}g</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.f, userTargets.f), backgroundColor: '#FFF'}]} />
                      </View>
                  </View>
              </View>
          </View>
      );
  };

  // --- VISTA SCHEDA RICETTA DINAMICA ---
  if (generatedRecipe) {
      const macros = generatedRecipe.macros_100g || { kcal: 0, p: 0, c: 0, f: 0 };
      const safeIngredients = generatedRecipe.ingredients || [];
      const safeInstructions = generatedRecipe.instructions || [];
      const safeTitle = generatedRecipe.title || "RICETTA SCONOSCIUTA";

      const ratio = recipeWeight / 100;
      const rKcal = Math.round((macros.kcal || 0) * ratio);
      const rP = Math.round((macros.p || 0) * ratio);
      const rC = Math.round((macros.c || 0) * ratio);
      const rF = Math.round((macros.f || 0) * ratio);

      return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setGeneratedRecipe(null)} style={{flexDirection:'row', alignItems:'center'}}>
                    <ArrowLeft size={24} color={TECH_GREEN} />
                    <Text style={[styles.headerSubtitle, {marginLeft: 10}]}>CHIUDI LABORATORIO</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 100}}>
                <View style={styles.aiResultCard}>
                    <View style={{flexDirection:'row', gap:10, alignItems:'center', marginBottom:20, justifyContent:'center'}}>
                        <ChefHat size={24} color={TECH_GREEN} />
                        <Text style={styles.aiTitle}>{safeTitle.toUpperCase()}</Text>
                    </View>
                    
                    <View style={styles.weightControl}>
                        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setRecipeWeight(w => Math.max(50, w - 50)); }} style={styles.weightBtn}>
                            <Minus size={20} color={TECH_GREEN} />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.weightValue}>{recipeWeight}g</Text>
                            <Text style={styles.weightLabel}>QUANTITÀ FINALE</Text>
                        </View>
                        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setRecipeWeight(w => w + 50); }} style={styles.weightBtn}>
                            <Plus size={20} color={TECH_GREEN} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.macroStrip}>
                        <View style={styles.macroItem}><Text style={styles.macroVal}>{rKcal}</Text><Text style={styles.macroTag}>KCAL</Text></View>
                        <View style={styles.macroItem}><Text style={styles.macroVal}>{rP}g</Text><Text style={styles.macroTag}>PRO</Text></View>
                        <View style={styles.macroItem}><Text style={styles.macroVal}>{rC}g</Text><Text style={styles.macroTag}>CARB</Text></View>
                        <View style={styles.macroItem}><Text style={styles.macroVal}>{rF}g</Text><Text style={styles.macroTag}>FAT</Text></View>
                    </View>

                    <View style={styles.sectionDivider}>
                        <Scale size={14} color={TECH_GREEN} />
                        <Text style={styles.sectionDividerText}>DOSAGGI CALCOLATI</Text>
                    </View>
                    
                    <View style={styles.ingredientsBox}>
                        {safeIngredients.map((ing: any, index: number) => {
                            let amount = ((ing.qty_100g || 0) * ratio);
                            let displayAmount = amount > 10 ? Math.round(amount) : amount.toFixed(1);
                            return (
                                <View key={index} style={styles.ingredientRow}>
                                    <Text style={styles.ingQty}>{displayAmount} {ing.unit || 'g'}</Text>
                                    <Text style={styles.ingName}>{ing.item || 'Ingrediente'}</Text>
                                </View>
                            )
                        })}
                    </View>

                    <View style={styles.sectionDivider}>
                        <Layers size={14} color={TECH_GREEN} />
                        <Text style={styles.sectionDividerText}>PROCEDURA OPERATIVA</Text>
                    </View>

                    <View style={styles.stepsBox}>
                        {safeInstructions.map((step: string, index: number) => (
                            <View key={index} style={styles.stepRow}>
                                <Text style={styles.stepNum}>{index + 1}.</Text>
                                <Text style={styles.stepText}>{step}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
            <Text style={styles.headerSubtitle}>DATABASE_NUTRIZIONALE</Text>
            <Text style={styles.headerTitle}>{protocol.toUpperCase()}_LOG</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
            <User size={20} color={TECH_GREEN} />
        </TouchableOpacity>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
        
        {/* NUOVO HUD STATO ODIERNO */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
             <StatusHUD />
        </View>

        <View style={{ backgroundColor: '#000', paddingBottom: 5 }}>
            <View style={styles.searchContainer}>
                
                {/* RICERCA DATABASE */}
                <View style={styles.searchBar}>
                    <TouchableOpacity onPress={handleDbSearch}>
                        <Search size={18} color={TECH_GREEN} />
                    </TouchableOpacity>
                    <TextInput 
                        placeholder="CERCA RICETTA NEL DB..."
                        placeholderTextColor={DARK_TECH_GREEN}
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleDbSearch}
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchText(''); fetchRecipes(); }}>
                            <X size={16} color={DARK_TECH_GREEN} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* CHEF CONSOLE */}
                <View style={styles.chefConsole}>
                    <View style={styles.chefHeader}>
                        <ChefHat size={16} color="#000" />
                        <Text style={styles.chefHeaderText}>DAMMI GLI INGREDIENTI E TI TROVO UNA RICETTA ({protocol.toUpperCase()})</Text>
                    </View>
                    <View style={styles.chefInputRow}>
                        <TextInput 
                            placeholder="Es: uova, avocado, tonno..." 
                            placeholderTextColor="#444"
                            style={styles.chefInput}
                            value={chefIngredients}
                            onChangeText={setChefIngredients}
                        />
                        <TouchableOpacity style={styles.chefGenBtn} onPress={handleChefGen} disabled={chefLoading}>
                            {chefLoading ? <ActivityIndicator color={TECH_GREEN} size="small" /> : <ChevronRight size={20} color={TECH_GREEN} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* FILTRI */}
                <View style={styles.mixerConsole}>
                    <View style={styles.mixerHeader}>
                        <Filter size={12} color={TECH_GREEN} />
                        <Text style={styles.mixerHeaderText}>FILTRI_BIOCHIMICI_G_100G</Text>
                    </View>
                    {renderMixerLine("PROTEINE", [20, 30, 40, 100], "maxP", mixer, setMixer)}
                    {renderMixerLine("CARBO", [5, 10, 15, 50], "maxC", mixer, setMixer)}
                </View>
            </View>
        </View>

        {/* LISTA RICETTE */}
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
            <Text style={styles.sectionHeader}>{'>'} RISULTATI DATABASE</Text>
            {loading ? (
                <View style={[styles.center, {marginTop: 40}]}><ActivityIndicator size="large" color={TECH_GREEN} /></View>
            ) : recipes.length === 0 ? (
                <Text style={styles.noDataText}>NESSUNA RICETTA TROVATA PER {protocol.toUpperCase()}</Text>
            ) : (
                recipes.map(item => (
                  <TouchableOpacity key={item.id} style={styles.compactCard} onPress={() => router.push(`/recipe-detail?id=${item.id}`)}>
                    <View style={styles.iconBox}>{IconMap[item.category] || IconMap.default}</View>
                    <View style={{flex:1}}>
                      <Text style={styles.recipeTitle}>{item.title.toUpperCase()}</Text>
                      <Text style={styles.metaText}>{item.kcal_100g} KCAL/100G • P:{item.protein_100g}G • C:{item.carbs_100g}G</Text>
                    </View>
                    <ChevronRight size={18} color={DARK_TECH_GREEN} />
                  </TouchableOpacity>
                ))
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const renderMixerLine = (title: string, options: number[], field: string, mixer: any, setMixer: any) => (
  <View style={styles.mixerLine}>
      <Text style={styles.mixerLineTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {options.map(val => (
              <TouchableOpacity key={val} onPress={() => setMixer((prev: any) => ({ ...prev, [field]: val }))} style={[styles.mixerOption, mixer[field] === val && styles.mixerOptionActive]}>
                  <Text style={[styles.mixerOptionText, mixer[field] === val && { color: '#000' }]}>{val === 100 || val === 50 ? 'ALL' : val + 'G'}</Text>
              </TouchableOpacity>
          ))}
      </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  headerTitleGroup: { flex: 1 },
  headerSubtitle: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: 'monospace', opacity: 0.7 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  profileBtn: { width: 40, height: 40, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DARK_TECH_GREEN },
  searchContainer: { paddingHorizontal: 20, marginTop: 10 },
  
  // STILI HUD (NUOVI)
  hudContainer: { backgroundColor: '#080808', padding: 15, borderTopWidth: 1, borderTopColor: TECH_GREEN, borderWidth: 1, borderColor: '#111', marginBottom: 5 },
  hudHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  hudTitle: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  hudGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  hudItem: { flex: 1, alignItems: 'center' },
  hudLabel: { color: '#666', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 4 },
  hudValue: { color: '#FFF', fontSize: 14, fontWeight: '900', fontFamily: 'monospace', marginBottom: 6 },
  hudBarBg: { width: '80%', height: 3, backgroundColor: '#222', borderRadius: 2 },
  hudBarFill: { height: '100%', borderRadius: 2 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 2, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: DARK_TECH_GREEN, marginBottom: 15 },
  searchInput: { flex: 1, color: TECH_GREEN, marginLeft: 10, fontSize: 13, fontFamily: 'monospace' },
  
  chefConsole: { backgroundColor: TECH_GREEN, borderRadius: 2, padding: 2, marginBottom: 15 },
  chefHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5 },
  chefHeaderText: { color: '#000', fontSize: 9, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 0.5 },
  chefInputRow: { flexDirection: 'row', backgroundColor: '#000', margin: 1 },
  chefInput: { flex: 1, color: '#FFF', paddingHorizontal: 15, fontFamily: 'monospace', fontSize: 12, height: 45 },
  chefGenBtn: { width: 50, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: DARK_TECH_GREEN },

  mixerConsole: { backgroundColor: '#050505', padding: 15, borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginBottom: 10 },
  mixerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 },
  mixerHeaderText: { color: TECH_GREEN, fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', opacity: 0.6 },
  mixerLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mixerLineTitle: { width: 75, fontSize: 8, fontWeight: '900', color: TECH_GREEN, fontFamily: 'monospace' },
  mixerOption: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: DARK_TECH_GREEN, marginRight: 8, backgroundColor: '#000' },
  mixerOptionActive: { backgroundColor: TECH_GREEN, borderColor: TECH_GREEN },
  mixerOptionText: { color: DARK_TECH_GREEN, fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }, 
  
  sectionHeader: { color: TECH_GREEN, fontSize: 11, fontWeight: '900', marginBottom: 15, opacity: 0.8, fontFamily: 'monospace' },
  compactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 15, borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginBottom: 10 },
  iconBox: { width: 40, height: 40, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: DARK_TECH_GREEN },
  recipeTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 4, fontFamily: 'monospace' },
  metaText: { fontSize: 10, fontWeight: 'bold', color: TECH_GREEN, fontFamily: 'monospace', opacity: 0.8 },
  noDataText: { color: DARK_TECH_GREEN, fontSize: 10, textAlign: 'center', marginTop: 30, fontFamily: 'monospace' },

  aiResultCard: { backgroundColor: '#080808', padding: 20, borderWidth: 1, borderColor: TECH_GREEN, borderRadius: 2 },
  aiTitle: { color: '#fff', fontSize: 18, fontWeight: '900', fontFamily: 'monospace', textAlign: 'center' },
  aiLabel: { color: TECH_GREEN, textAlign: 'center', fontSize: 12, fontWeight: '900', fontFamily: 'monospace', marginBottom: 20 },
  weightControl: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 25 },
  weightBtn: { width: 50, height: 50, backgroundColor: '#000', borderWidth: 1, borderColor: DARK_TECH_GREEN, justifyContent: 'center', alignItems: 'center' },
  weightValue: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', fontFamily: 'monospace' },
  weightLabel: { color: '#666', fontSize: 9, textAlign: 'center', fontFamily: 'monospace' },
  macroStrip: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#000', padding: 15, borderWidth: 1, borderColor: DARK_TECH_GREEN, marginBottom: 20 },
  macroItem: { alignItems: 'center' },
  macroVal: { color: '#fff', fontSize: 16, fontWeight: '900', fontFamily: 'monospace' },
  macroTag: { color: TECH_GREEN, fontSize: 8, fontWeight: 'bold', marginTop: 2 },
  
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 15, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#222' },
  sectionDividerText: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  ingredientsBox: { marginBottom: 25 },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#111', paddingBottom: 4 },
  ingQty: { color: TECH_GREEN, fontWeight: 'bold', fontFamily: 'monospace', fontSize: 12 },
  ingName: { color: '#CCC', fontFamily: 'monospace', fontSize: 12, flex: 1, textAlign: 'right' },
  
  stepsBox: { marginBottom: 20 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  stepNum: { color: TECH_GREEN, fontWeight: '900', fontFamily: 'monospace' },
  stepText: { color: '#CCC', fontFamily: 'monospace', fontSize: 13, lineHeight: 20, flex: 1 }
});