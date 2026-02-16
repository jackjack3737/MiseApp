import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, ChevronRight, CookingPot, Cpu, Filter, Leaf, Search, Target, User, X, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, type DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DS } from '../../constants/designSystem';
import { supabase } from '../../src/lib/supabase';

const ACCENT = DS.accent;
const BORDER_COLOR = DS.border;
const DARK_ACCENT = DS.textMuted;

const IconMap: any = {
  'Keto': <CookingPot size={20} color={ACCENT} />,
  'Low Carb': <Zap size={20} color={ACCENT} />,
  'Bilanciata': <Leaf size={20} color={ACCENT} />,
  'Personalizza': <Target size={20} color={ACCENT} />,
  default: <Cpu size={20} color={ACCENT} />
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

  useFocusEffect(useCallback(() => { loadData(); }, [params.protocol]));
  useEffect(() => { 
      if(searchText === '') fetchRecipes(); 
  }, [protocol, mixer]);

  // --- COMPONENTE HUD STATUS (Nuovo) ---
  const StatusHUD = () => {
      const getProgress = (current: number, target: number): DimensionValue => {
          if(!target) return 0;
          return `${Math.min((current / target) * 100, 100)}%`;
      };

      return (
          <View style={styles.hudContainer}>
              <View style={styles.hudHeader}>
                  <Activity size={14} color={ACCENT} />
                  <Text style={styles.hudTitle}>STATO METABOLICO ODIERNO</Text>
              </View>
              
              <View style={styles.hudGrid}>
                  {/* KCAL */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>KCAL</Text>
                      <Text style={styles.hudValue}>{Math.round(todayTotals.kcal)}</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.kcal, userTargets.kcal), backgroundColor: ACCENT}]} />
                      </View>
                  </View>

                  {/* PRO */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>PRO</Text>
                      <Text style={styles.hudValue}>{Math.round(todayTotals.p)}g</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.p, userTargets.p), backgroundColor: DS.text}]} />
                      </View>
                  </View>

                  {/* CARB */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>CARB</Text>
                      <Text style={[styles.hudValue, {color: ACCENT}]}>{Math.round(todayTotals.c)}g</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.c, userTargets.c), backgroundColor: ACCENT}]} />
                      </View>
                  </View>

                  {/* FAT */}
                  <View style={styles.hudItem}>
                      <Text style={styles.hudLabel}>FAT</Text>
                      <Text style={styles.hudValue}>{Math.round(todayTotals.f)}g</Text>
                      <View style={styles.hudBarBg}>
                          <View style={[styles.hudBarFill, {width: getProgress(todayTotals.f, userTargets.f), backgroundColor: DS.text}]} />
                      </View>
                  </View>
              </View>
          </View>
      );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={DS.bg} />
      
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
            <Text style={styles.headerSubtitle}>Database nutrizionale</Text>
            <Text style={styles.headerTitle}>Ricette</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
            <User size={20} color={ACCENT} />
        </TouchableOpacity>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
        
        {/* NUOVO HUD STATO ODIERNO */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
             <StatusHUD />
        </View>

        <View style={{ backgroundColor: DS.bg, paddingBottom: 5 }}>
            <View style={styles.searchContainer}>
                
                {/* RICERCA DATABASE */}
                <View style={styles.searchBar}>
                    <TouchableOpacity onPress={handleDbSearch}>
                        <Search size={18} color={ACCENT} />
                    </TouchableOpacity>
                    <TextInput 
                        placeholder="CERCA RICETTA NEL DB..."
                        placeholderTextColor={DARK_ACCENT}
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleDbSearch}
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchText(''); fetchRecipes(); }}>
                            <X size={16} color={DARK_ACCENT} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* FILTRI */}
                <View style={styles.mixerConsole}>
                    <View style={styles.mixerHeader}>
                        <Filter size={12} color={ACCENT} />
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
                <View style={[styles.center, {marginTop: 40}]}><ActivityIndicator size="large" color={ACCENT} /></View>
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
                    <ChevronRight size={18} color={DARK_ACCENT} />
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
  container: { flex: 1, backgroundColor: DS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  headerTitleGroup: { flex: 1 },
  headerSubtitle: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: 'monospace', opacity: 0.7 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  profileBtn: { width: 40, height: 40, backgroundColor: DS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DARK_ACCENT },
  searchContainer: { paddingHorizontal: 20, marginTop: 10 },
  
  // STILI HUD (NUOVI)
  hudContainer: { backgroundColor: DS.surface, padding: 15, borderTopWidth: 1, borderTopColor: ACCENT, borderWidth: 1, borderColor: DS.border, marginBottom: 5 },
  hudHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  hudTitle: { color: ACCENT, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  hudGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  hudItem: { flex: 1, alignItems: 'center' },
  hudLabel: { color: '#666', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 4 },
  hudValue: { color: DS.text, fontSize: 14, fontWeight: '900', fontFamily: 'monospace', marginBottom: 6 },
  hudBarBg: { width: '80%', height: 3, backgroundColor: DS.border, borderRadius: 2 },
  hudBarFill: { height: '100%', borderRadius: 2 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bg, borderRadius: 2, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: DARK_ACCENT, marginBottom: 15 },
  searchInput: { flex: 1, color: ACCENT, marginLeft: 10, fontSize: 13, fontFamily: 'monospace' },

  mixerConsole: { backgroundColor: DS.surface, padding: 15, borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginBottom: 10 },
  mixerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 },
  mixerHeaderText: { color: ACCENT, fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', opacity: 0.6 },
  mixerLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mixerLineTitle: { width: 75, fontSize: 8, fontWeight: '900', color: ACCENT, fontFamily: 'monospace' },
  mixerOption: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: DARK_ACCENT, marginRight: 8, backgroundColor: DS.bg },
  mixerOptionActive: { backgroundColor: DS.accent, borderColor: DS.accent },
  mixerOptionText: { color: DARK_ACCENT, fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }, 
  
  sectionHeader: { color: ACCENT, fontSize: 11, fontWeight: '900', marginBottom: 15, opacity: 0.8, fontFamily: 'monospace' },
  compactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.surface, padding: 15, borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginBottom: 10 },
  iconBox: { width: 40, height: 40, backgroundColor: DS.bg, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: DARK_ACCENT },
  recipeTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 4, fontFamily: 'monospace' },
  metaText: { fontSize: 10, fontWeight: 'bold', color: ACCENT, fontFamily: 'monospace', opacity: 0.8 },
  noDataText: { color: DARK_ACCENT, fontSize: 10, textAlign: 'center', marginTop: 30, fontFamily: 'monospace' },
});