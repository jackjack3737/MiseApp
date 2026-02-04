import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions, StatusBar, TextInput } from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Sostituito SafeAreaView vecchio con quello nuovo per eliminare il warning
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Clock, Flame, User, Search, WheatOff, MilkOff, Zap } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const PROTOCOL_THEMES = {
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
  const [maxKcal, setMaxKcal] = useState(2000); 
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const theme = PROTOCOL_THEMES[protocol] || PROTOCOL_THEMES['Keto'];

  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem('@user_profile');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.targetCalories) setMaxKcal(parseInt(p.targetCalories));
          if (params.protocol) {
            setProtocol(params.protocol);
          } else if (p.protocol) {
            setProtocol(p.protocol);
          }
        }
      } catch (e) {
        console.error("Errore caricamento target in Explore", e);
      }
    };

    const unsubscribe = navigation.addListener('focus', loadUserSettings);
    loadUserSettings();
    return unsubscribe;
  }, [navigation, params.protocol]);

  useEffect(() => {
    fetchRecipes();
  }, [protocol, searchText, maxKcal]);

  async function fetchRecipes() {
    setLoading(true);
    try {
      let query = supabase
        .from('recipes')
        .select('*')
        .lte('kcal', maxKcal)
        .order('created_at', { ascending: false });

      if (searchText.length > 2) {
        query = query.ilike('title', `%${searchText}%`);
      } else {
        if (protocol === 'LiveBetter') {
          query = query.contains('tags', ['LiveBetter']);
        } else if (protocol) {
          query = query.contains('tags', [protocol]);
        }
        query = query.not('image_url', 'is', null);
      }

      const { data, error } = await query.limit(50);
      if (!error) setRecipes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const renderBadges = (tags) => {
    if (!tags) return null;
    return (
      <View style={styles.badgesContainer}>
        {tags.includes('LiveBetter') && (
          <View style={[styles.miniBadge, { borderColor: '#00cec9' }]}>
            <Zap size={10} color="#00cec9" />
            <Text style={[styles.miniBadgeText, { color: '#00cec9' }]}>LIVE BETTER</Text>
          </View>
        )}
        {tags.includes('GlutenFree') && (
          <View style={[styles.miniBadge, { borderColor: '#fab1a0' }]}>
            <WheatOff size={10} color="#fab1a0" />
            <Text style={[styles.miniBadgeText, { color: '#fab1a0' }]}>NO GLUTINE</Text>
          </View>
        )}
        {tags.includes('DairyFree') && (
          <View style={[styles.miniBadge, { borderColor: '#74b9ff' }]}>
            <MilkOff size={10} color="#74b9ff" />
            <Text style={[styles.miniBadgeText, { color: '#74b9ff' }]}>NO LATTOSIO</Text>
          </View>
        )}
      </View>
    );
  };

  const renderRecipeItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/recipe-detail?id=${item.id}`)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
      <View style={styles.cardOverlay} />
      
      <View style={styles.cardContent}>
        {renderBadges(item.tags)}
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        
        <View style={styles.cardMeta}>
            <View style={styles.metaLeft}>
                <View style={styles.metaItem}>
                    <Clock size={14} color="#bdc3c7" />
                    <Text style={styles.metaText}>{item.total_time || 20} min</Text>
                </View>
                <View style={styles.metaItem}>
                    <Flame size={14} color={theme.color} />
                    <Text style={[styles.metaText, {color: theme.color}]}>{item.kcal} kcal</Text>
                </View>
            </View>

            <View style={styles.macroPills}>
                <View style={[styles.pill, {backgroundColor: 'rgba(255, 118, 117, 0.2)'}]}>
                    <Text style={[styles.pillText, {color:'#ff7675'}]}>F: {item.fats}g</Text>
                </View>
                <View style={[styles.pill, {backgroundColor: 'rgba(116, 185, 255, 0.2)'}]}>
                    <Text style={[styles.pillText, {color:'#74b9ff'}]}>P: {item.proteins}g</Text>
                </View>
                <View style={[styles.pill, {backgroundColor: 'rgba(253, 203, 110, 0.2)'}]}>
                    <Text style={[styles.pillText, {color:'#fdcb6e'}]}>C: {item.carbs}g</Text>
                </View>
            </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
            <Text style={[styles.headerSubtitle, { color: theme.color }]}>TARGET GIORNALIERO</Text>
            <Text style={styles.headerTitle}>{protocol.toUpperCase()}</Text>
        </View>

        <View style={styles.headerActions}>
            <View style={[styles.infoBox, { borderColor: theme.color }]}>
                <Text style={[styles.infoText, { color: theme.color }]}>{maxKcal} kcal</Text>
            </View>
            
            {/* TASTO PROFILO AGGIUNTO */}
            <TouchableOpacity 
              onPress={() => router.push('/profile')} 
              style={styles.profileBtn}
            >
              <User size={22} color="#fff" />
            </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
            <View style={[styles.searchBar, protocol === 'LiveBetter' && styles.searchBarLive]}>
                <Search size={20} color="#636e72" />
                <TextInput 
                    placeholder={`Cerca in ${protocol}...`} 
                    placeholderTextColor="#636e72"
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            <TouchableOpacity 
              style={[styles.liveBetterBtn, protocol === 'LiveBetter' && styles.liveBetterBtnActive]}
              onPress={() => setProtocol(protocol === 'LiveBetter' ? 'Keto' : 'LiveBetter')}
            >
              <Zap size={16} color={protocol === 'LiveBetter' ? '#000' : '#00cec9'} />
              <Text style={[styles.liveBetterBtnText, protocol === 'LiveBetter' && { color: '#000' }]}>
                LIVE BETTER
              </Text>
            </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.color} /></View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRecipeItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{height: 25}} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
                <Text style={{color:'#636e72'}}>Nessuna ricetta trovata.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 10, 
    paddingBottom: 20, 
    justifyContent: 'space-between' 
  },
  headerTitleGroup: { flex: 1 },
  headerSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: '#111', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  infoBox: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: '#000' },
  infoText: { fontWeight: '900', fontSize: 13 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 15 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 15, height: 60, borderWidth: 1, borderColor: '#222' },
  searchBarLive: { borderColor: '#00cec9' },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16, fontWeight: '600' },
  liveBetterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, height: 60, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#00cec9' },
  liveBetterBtnActive: { backgroundColor: '#00cec9' },
  liveBetterBtnText: { color: '#00cec9', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  card: { height: 300, borderRadius: 30, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  image: { width: '100%', height: '100%' },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  cardContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 25 },
  badgesContainer: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  miniBadgeText: { fontSize: 9, fontWeight: '900' },
  cardTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 15 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  macroPills: { flexDirection: 'row', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, minWidth: 45, alignItems: 'center' },
  pillText: { fontSize: 11, fontWeight: '900' }
});