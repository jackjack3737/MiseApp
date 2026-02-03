import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions, StatusBar, TextInput } from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Clock, Flame, ArrowLeft, Search, Filter, WheatOff, MilkOff, Leaf, Activity } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const PROTOCOL_THEMES = {
  'Keto': { color: '#FFD700' },
  'Carnivore': { color: '#e17055' },
  'Paleo': { color: '#00b894' },
  'LowCarb': { color: '#0984e3' },
};

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const protocol = params.protocol || 'Keto';
  const maxKcal = params.kcal ? parseInt(params.kcal) : 3500;
  
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const theme = PROTOCOL_THEMES[protocol] || PROTOCOL_THEMES['Keto'];

  useEffect(() => {
    fetchRecipes();
  }, [protocol, searchText]);

  async function fetchRecipes() {
    setLoading(true);
    try {
      // Selezioniamo esplicitamente i campi per evitare errori di mapping
      let query = supabase
        .from('recipes')
        .select('id, title, image_url, kcal, proteins, carbs, fats, total_time, tags')
        .lte('kcal', maxKcal)
        .order('created_at', { ascending: false });

      // LOGICA DI FILTRO BIO-HACKER
      if (searchText.length <= 2) {
        // Se non cerca, mostriamo i piatti "vetrina" del protocollo scelto
        if (protocol) query = query.contains('tags', [protocol]);
        query = query.not('image_url', 'is', null); 
      } 
      else {
        // Ricerca libera in tutto il database
        query = query.ilike('title', `%${searchText}%`);
      }

      const { data, error } = await query.limit(50);
      if (!error) setRecipes(data || []);
      else console.error("Errore query:", error.message);
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
        {(tags.includes('Vegetarian') || tags.includes('Veg')) && (
            <View style={[styles.miniBadge, { borderColor: '#55efc4' }]}>
                <Leaf size={10} color="#55efc4" />
                <Text style={[styles.miniBadgeText, { color: '#55efc4' }]}>VEG</Text>
            </View>
        )}
      </View>
    );
  };

  const renderRecipeItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push({
        pathname: "/recipe-detail",
        params: { id: item.id }
      })}
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
                    <Text style={styles.metaText}>{item.total_time} min</Text>
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{flex: 1, marginLeft: 15}}>
            <Text style={[styles.headerSubtitle, { color: theme.color }]}>PIANO NUTRIZIONALE</Text>
            <Text style={styles.headerTitle}>{protocol.toUpperCase()}</Text>
        </View>
        <View style={[styles.infoBox, { borderColor: theme.color }]}>
            <Text style={[styles.infoText, { color: theme.color }]}>{maxKcal} kcal</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
            <Search size={20} color="#636e72" />
            <TextInput 
                placeholder={`Cerca in ${protocol}...`} 
                placeholderTextColor="#636e72"
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
            />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.color} /></View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRecipeItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{height: 25}} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
                <Text style={{color:'#636e72', marginTop: 50}}>Nessuna ricetta trovata.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  headerSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  infoBox: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: '#111' },
  infoText: { fontWeight: '900', fontSize: 12 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 18, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16, fontWeight: '600' },
  card: { height: 280, borderRadius: 30, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  image: { width: '100%', height: '100%' },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  cardContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  badgesContainer: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  miniBadgeText: { fontSize: 9, fontWeight: '900' },
  cardTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 12, lineHeight: 28 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  macroPills: { flexDirection: 'row', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, minWidth: 45, alignItems: 'center' },
  pillText: { fontSize: 10, fontWeight: '900' }
});