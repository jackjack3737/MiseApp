import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, StatusBar, TextInput, ScrollView, Alert } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { User, Search, Zap, Beef, Fish, CookingPot, Leaf, Cookie, ChevronRight, Flame, Activity, AlertCircle, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics'; 

// IMPORTA I COMPONENTI E UTILS
import TutorialOverlay from '../../components/TutorialOverlay';
import MetabolicReactor from '../../components/MetabolicReactor';
import PaywallModal from '../../components/PaywallModal'; 
// Assicurati che il percorso sia corretto
import { getFoodFromAI } from '../../utils/gemini-cache';

const IconMap: any = {
  meat: <Beef size={22} color="#ff7675" />,
  fish: <Fish size={22} color="#74b9ff" />,
  eggs: <CookingPot size={22} color="#fdcb6e" />,
  veggies: <Leaf size={22} color="#55efc4" />,
  shake: <Zap size={22} color="#a29bfe" />,
  snack: <Cookie size={22} color="#fab1a0" />,
  default: <CookingPot size={22} color="#00cec9" />
};

const PROTOCOL_THEMES: any = {
  'Keto': { color: '#FFD700' },
  'Carnivore': { color: '#e17055' },
  'Paleo': { color: '#00b894' },
  'LowCarb': { color: '#0984e3' },
  'LiveBetter': { color: '#00cec9' },
};

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const rawProtocol = params.protocol || 'Keto';
  const [protocol, setProtocol] = useState<string>(Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol);
  const [userTargets, setUserTargets] = useState({ kcal: 2000, targetCarbs: 25 }); 
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  // --- STATO PREMIUM ---
  const [isPremium, setIsPremium] = useState(false); // Default chiuso
  const [showPaywall, setShowPaywall] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'checking' | 'ok' | 'pending' | 'error'>('checking');
  const [bioData, setBioData] = useState({ steps: 0 });
  const [showTutorial, setShowTutorial] = useState(false);
  const [filterLiveBetter, setFilterLiveBetter] = useState(false);
  const [mixer, setMixer] = useState({ maxP: 200, maxF: 200, maxC: 200 });

  const theme = PROTOCOL_THEMES[protocol] || PROTOCOL_THEMES['Keto'];

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        setUserTargets({ 
          kcal: parseFloat(p.targetCalories) || 2000,
          targetCarbs: parseFloat(p.targetCarbs) || 25
        });
        setProtocol(params.protocol || p.protocol || 'Keto');
      }
      
      // Controllo stato premium VERO
      const premium = await AsyncStorage.getItem('@is_premium');
      setIsPremium(premium === 'true');
      
      checkSyncStatus();
    } catch (e) { console.error(e); }
  };

  const handleAISearch = async () => {
    if (!searchText.trim()) return;
    
    // Protezione Paywall ATTIVA
    if (!isPremium) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowPaywall(true);
      return;
    }

    setAiLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // --- FIX: Chiamata senza API Key (usa quella interna gestita da Supabase) ---
      const data = await getFoodFromAI(searchText);
      
      const newLog = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          food_name: data.food_name,
          kcal: data.kcal,
          carbs: data.carbs,
          proteins: data.proteins,
          fats: data.fats,
          meal_type: 'PASTO_AI'
      };

      const logsRaw = await AsyncStorage.getItem('@user_daily_logs');
      const logs = logsRaw ? JSON.parse(logsRaw) : [];
      await AsyncStorage.setItem('@user_daily_logs', JSON.stringify([newLog, ...logs]));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Bio-Tracker", `${data.food_name} registrato correttamente.`);
      setSearchText('');

    } catch (err) {
      // Fallback: se AI fallisce ricarica ricette (opzionale)
      fetchRecipes(); 
    } finally {
      setAiLoading(false);
    }
  };

  const checkSyncStatus = async () => {
    setSyncStatus('checking');
    setTimeout(() => { setSyncStatus('pending'); }, 500);
  };

  useFocusEffect(useCallback(() => { 
    loadData(); 
  }, [params.protocol]));

  useEffect(() => {
    fetchRecipes();
  }, [protocol, userTargets.kcal, mixer, filterLiveBetter]);

  async function fetchRecipes() {
    setLoading(true);
    try {
      let query = supabase
        .from('recipes')
        .select('*')
        // --- 🔓 FILTRI RIMOSSI: VEDIAMO TUTTE LE RICETTE ---
        // .lte('kcal', userTargets.kcal) 
        // .lte('proteins', mixer.maxP)   
        // .lte('fats', mixer.maxF)       
        // .lte('carbs', mixer.maxC)      
        .order('created_at', { ascending: false });

      const tagsRequired = [protocol];
      if (filterLiveBetter) tagsRequired.push('LiveBetter');
      query = query.contains('tags', tagsRequired);

      const { data, error } = await query.limit(100); // Limite aumentato
      if (!error) setRecipes(data || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
            <Text style={[styles.headerSubtitle, { color: theme.color }]}>DASHBOARD ADVISOR</Text>
            <Text style={styles.headerTitle}>{protocol.toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
            <User size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
        
        <View style={{ paddingHorizontal: 25, marginBottom: 20 }}>
             <MetabolicReactor 
                  baseTarget={userTargets.targetCarbs} 
                  currentCarbs={0} 
                  stepsBonus={0} 
                  sportBonus={0} 
              />
        </View>

        <View style={{ backgroundColor: '#000', paddingBottom: 10 }}>
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    {aiLoading ? <ActivityIndicator size="small" color="#00cec9" /> : <Sparkles size={18} color={isPremium ? "#00cec9" : "#636e72"} />}
                    <TextInput 
                        placeholder={isPremium ? "Cosa hai mangiato? (AI Scan)" : "Cerca... (Richiede Pro)"} 
                        placeholderTextColor="#636e72"
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleAISearch}
                        returnKeyType="search"
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.lbFilterBtn, filterLiveBetter && styles.lbFilterBtnActive]}
                    onPress={() => setFilterLiveBetter(!filterLiveBetter)}
                >
                    <Zap size={14} color={filterLiveBetter ? "#000" : "#00cec9"} fill={filterLiveBetter ? "#000" : "transparent"} />
                    <Text style={[styles.lbFilterText, filterLiveBetter && {color: "#000"}]}>FILTRA SOLO LIVE BETTER</Text>
                </TouchableOpacity>

                <View style={styles.mixerConsole}>
                    {renderMixerLine("MAX PROT", [20, 30, 40, 50], "maxP", "#ff7675", mixer, setMixer)}
                    {renderMixerLine("MAX CARBS", [5, 10, 15, 20, 30], "maxC", "#00cec9", mixer, setMixer)}
                </View>
            </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
            {loading ? (
                <View style={[styles.center, {marginTop: 40}]}><ActivityIndicator size="large" color={theme.color} /></View>
            ) : (
                recipes.map(item => (
                  <TouchableOpacity key={item.id} style={styles.compactCard} onPress={() => router.push(`/recipe-detail?id=${item.id}`)}>
                    <View style={styles.iconBox}>{IconMap[item.category_icon] || IconMap.default}</View>
                    <View style={{flex:1}}>
                      <Text style={styles.recipeTitle}>{item.title}</Text>
                      <Text style={[styles.metaText, {color: theme.color}]}>{item.kcal} kcal • P:{item.proteins}g C:{item.carbs}g</Text>
                    </View>
                    <ChevronRight size={18} color="#333" />
                  </TouchableOpacity>
                ))
            )}
        </View>
      </ScrollView>

      {/* MODALE PAYWALL CON CALLBACK DI SBLOCCO */}
      <PaywallModal 
        visible={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        onUnlock={() => setIsPremium(true)} // <--- IMPORTANTE: Sblocca UI immediatamente
      />
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
    </SafeAreaView>
  );
}

const renderMixerLine = (title: string, options: number[], field: string, color: string, mixer: any, setMixer: any) => (
  <View style={styles.mixerLine}>
      <Text style={[styles.mixerLineTitle, { color }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {options.map(val => (
              <TouchableOpacity 
                  key={val}
                  onPress={() => setMixer((prev: any) => ({ ...prev, [field]: val }))}
                  style={[styles.mixerOption, mixer[field] === val && { borderColor: color, backgroundColor: color + '15' }]}
              >
                  <Text style={[styles.mixerOptionText, mixer[field] === val && { color }]}>{val}g</Text>
              </TouchableOpacity>
          ))}
      </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 15 },
  headerTitleGroup: { flex: 1 },
  headerSubtitle: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  profileBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#111', marginBottom: 12 },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 14 },
  lbFilterBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#00cec910', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#00cec9', marginBottom: 12, gap: 8 },
  lbFilterBtnActive: { backgroundColor: '#00cec9', borderColor: '#00cec9' },
  lbFilterText: { color: '#00cec9', fontSize: 10, fontWeight: '900' },
  mixerConsole: { backgroundColor: '#050505', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#111' },
  mixerLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  mixerLineTitle: { width: 70, fontSize: 9, fontWeight: '900' },
  mixerOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#1a1a1a', marginRight: 8 },
  mixerOptionText: { color: '#b2bec3', fontSize: 10, fontWeight: '700' }, 
  compactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
  iconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  recipeTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  metaText: { fontSize: 11, fontWeight: '900' },
  emptyText: { color: '#333', fontWeight: '800', marginTop: 40 },
});