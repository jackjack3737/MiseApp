import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Dimensions, StatusBar, TextInput, ScrollView } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { User, Search, Zap, Beef, Fish, CookingPot, Leaf, Cookie, ChevronRight, Flame } from 'lucide-react-native';

// IMPORTA IL TUTORIAL
import TutorialOverlay from '../../components/TutorialOverlay';

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
  const navigation = useNavigation();
  const params = useLocalSearchParams(); 
  
  const [protocol, setProtocol] = useState(params.protocol || 'Keto');
  const [userTargets, setUserTargets] = useState({ kcal: 2000 }); 
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  
  // --- STATO TUTORIAL ---
  const [showTutorial, setShowTutorial] = useState(false);

  // --- STATO FILTRO LIVE BETTER ---
  const [filterLiveBetter, setFilterLiveBetter] = useState(false);

  // --- BIO-MIXER (Filtri di Ricerca) ---
  const [mixer, setMixer] = useState({ 
    maxP: 200, 
    maxF: 200, 
    maxC: 200 
  });

  const theme = PROTOCOL_THEMES[protocol] || PROTOCOL_THEMES['Keto'];

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        setUserTargets({ kcal: parseFloat(p.targetCalories) || 2000 });
        setProtocol(params.protocol || p.protocol || 'Keto');
      }
    } catch (e) { console.error(e); }
  };

  // --- CONTROLLO TUTORIAL ---
  const checkTutorial = async () => {
    try {
      const shouldShow = await AsyncStorage.getItem('@show_tutorial');
      if (shouldShow === 'true') {
        setShowTutorial(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleCloseTutorial = async () => {
    setShowTutorial(false);
    await AsyncStorage.removeItem('@show_tutorial'); // Non mostrarlo più
  };

  useFocusEffect(useCallback(() => { 
    loadData(); 
    checkTutorial(); // <-- CONTROLLA AD OGNI ACCESSO SE DEVE MOSTRARE IL TUTORIAL
  }, [params.protocol]));

  useEffect(() => {
    fetchRecipes();
  }, [protocol, searchText, userTargets.kcal, mixer, filterLiveBetter]);

  async function fetchRecipes() {
    setLoading(true);
    try {
      let query = supabase
        .from('recipes')
        .select('*')
        .lte('kcal', userTargets.kcal)
        .lte('proteins', mixer.maxP)   
        .lte('fats', mixer.maxF)       
        .lte('carbs', mixer.maxC)      
        .order('created_at', { ascending: false });

      if (searchText.length > 2) {
        query = query.ilike('title', `%${searchText}%`);
      } else {
        const tagsRequired = [protocol];
        if (filterLiveBetter) {
            tagsRequired.push('LiveBetter');
        }
        query = query.contains('tags', tagsRequired);
      }

      const { data, error } = await query.limit(50);
      
      if (!error) {
          setRecipes(data || []);
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }

  const renderRecipeItem = ({ item }: any) => {
    const isLiveBetter = item.tags?.includes('LiveBetter') || 
                         (item.ingredients_list && JSON.stringify(item.ingredients_list).toLowerCase().includes('live better'));

    return (
      <TouchableOpacity 
        style={[styles.compactCard, isLiveBetter && styles.cardLiveBetter]} 
        onPress={() => router.push(`/recipe-detail?id=${item.id}`)}
      >
        <View style={styles.iconBox}>{IconMap[item.category_icon] || IconMap.default}</View>
        <View style={styles.contentBox}>
          <View style={styles.titleContainer}>
              <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>
              
              {isLiveBetter && (
                <View style={styles.liveBetterBadge}>
                    <Zap size={8} color="#000" fill="#000" />
                    <Text style={styles.liveBetterText}>LIVE BETTER</Text>
                </View>
              )}
          </View>
          
          <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                  <Flame size={12} color={theme.color} />
                  <Text style={[styles.metaText, {color: theme.color}]}>{item.kcal} kcal</Text>
              </View>
              <View style={styles.macroRow}>
                  <Text style={styles.macroLabel}>P: {item.proteins}g</Text>
                  <Text style={styles.macroLabel}>F: {item.fats}g</Text>
                  <Text style={styles.macroLabel}>C: {item.carbs}g</Text>
              </View>
          </View>
        </View>
        
        <View style={styles.arrowBox}>
            <ChevronRight size={18} color="#333" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderMixerLine = (title: string, options: number[], field: string, color: string) => (
    <View style={styles.mixerLine}>
        <Text style={[styles.mixerLineTitle, { color }]}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {options.map(val => (
                <TouchableOpacity 
                    key={val}
                    onPress={() => setMixer(prev => ({ 
                      ...prev, 
                      [field]: prev[field as keyof typeof mixer] === val ? 200 : val 
                    }))}
                    style={[styles.mixerOption, mixer[field as keyof typeof mixer] === val && { borderColor: color, backgroundColor: color + '15' }]}
                >
                    <Text style={[styles.mixerOptionText, mixer[field as keyof typeof mixer] === val && { color }]}>{val}g</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
            <Text style={[styles.headerSubtitle, { color: theme.color }]}>TARGET GIORNALIERO</Text>
            <Text style={styles.headerTitle}>{protocol.toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
            <User size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
            <Search size={20} color="#b2bec3" />
            <TextInput 
                placeholder={`Cerca ricette ${protocol}...`} 
                placeholderTextColor="#636e72"
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
            />
        </View>

        <TouchableOpacity 
            style={[styles.lbFilterBtn, filterLiveBetter && styles.lbFilterBtnActive]}
            onPress={() => setFilterLiveBetter(!filterLiveBetter)}
            activeOpacity={0.8}
        >
            <Zap size={14} color={filterLiveBetter ? "#000" : "#00cec9"} fill={filterLiveBetter ? "#000" : "transparent"} />
            <Text style={[styles.lbFilterText, filterLiveBetter && {color: "#000"}]}>
                FILTRA SOLO LIVE BETTER
            </Text>
            {filterLiveBetter && <View style={styles.dot} />}
        </TouchableOpacity>

        <View style={styles.mixerConsole}>
            {renderMixerLine("MAX PROT", [20, 30, 40, 50], "maxP", "#ff7675")}
            {renderMixerLine("MAX FATS", [10, 20, 30, 40, 50], "maxF", "#fdcb6e")}
            {renderMixerLine("MAX CARBS", [5, 10, 15, 20, 30], "maxC", "#00cec9")}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.color} /></View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRecipeItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
          ListEmptyComponent={
            <View style={styles.center}>
                <Text style={styles.emptyText}>NESSUNA RICETTA TROVATA</Text>
                <Text style={styles.emptySubText}>
                    {filterLiveBetter ? "Nessuna ricetta Live Better per questo protocollo." : "Prova a cambiare i filtri del mixer."}
                </Text>
            </View>
          }
        />
      )}

      {/* RENDERIZZA IL TUTORIAL SOPRA TUTTO SE ATTIVO */}
      {showTutorial && <TutorialOverlay onClose={handleCloseTutorial} />}
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 15 },
  headerTitleGroup: { flex: 1 },
  headerSubtitle: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  profileBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  
  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#111', marginBottom: 12 },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 14 },
  
  lbFilterBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#00cec910', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#00cec9', marginBottom: 12, gap: 8 },
  lbFilterBtnActive: { backgroundColor: '#00cec9', borderColor: '#00cec9' },
  lbFilterText: { color: '#00cec9', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#000' },

  mixerConsole: { backgroundColor: '#050505', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#111', marginBottom: 5 },
  mixerLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  mixerLineTitle: { width: 70, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  mixerOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#1a1a1a', marginRight: 8 },
  mixerOptionText: { color: '#b2bec3', fontSize: 10, fontWeight: '700' }, 

  compactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
  cardLiveBetter: { borderColor: '#00cec930', backgroundColor: '#050a0a' },
  
  iconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  contentBox: { flex: 1, justifyContent: 'center' },
  
  titleContainer: { marginBottom: 6, alignItems: 'flex-start' },
  recipeTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4, lineHeight: 22 },
  
  liveBetterBadge: { backgroundColor: '#00cec9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, alignSelf: 'flex-start' },
  liveBetterText: { color: '#000', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontWeight: '900' },
  
  macroRow: { flexDirection: 'row', gap: 12 },
  macroLabel: { color: '#b2bec3', fontSize: 11, fontWeight: '700' },
  
  arrowBox: { marginLeft: 10 },
  emptyText: { color: '#b2bec3', fontWeight: '800', marginTop: 40 },
  emptySubText: { color: '#636e72', fontSize: 12, marginTop: 10, textAlign:'center' }
});