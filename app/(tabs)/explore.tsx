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
      let query = supabase
        .from('recipes')
        .select('*')
        .not('image_url', 'is', null)
        .lte('kcal', maxKcal)
        .order('created_at', { ascending: false });

      if (protocol) query = query.contains('tags', [protocol]);
      if (searchText.length > 2) query = query.ilike('title', `%${searchText}%`);

      const { data, error } = await query.limit(50);
      if (!error) setRecipes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // --- BADGE ALLERGENI ---
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
      onPress={() => router.push(`/recipe-detail?id=${item.id}`)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
      <View style={styles.cardOverlay} />
      
      <View style={styles.cardContent}>
        
        {/* BADGES */}
        {renderBadges(item.tags)}

        {/* TITOLO */}
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        
        <View style={styles.cardMeta}>
            {/* TEMPO & KCAL (SINISTRA) */}
            <View style={styles.metaLeft}>
                <View style={styles.metaItem}>
                    <Clock size={14} color="#bdc3c7" />
                    <Text style={styles.metaText}>{item.total_time} min</Text>
                </View>
                <View style={styles.metaItem}>
                    <Flame size={14} color={theme.color} />
                    <Text style={[styles.metaText, {color: theme.color}]}>{item.kcal}</Text>
                </View>
            </View>

            {/* MACRO PILLS (DESTRA) - ORA SONO 3! */}
            <View style={styles.macroPills}>
                {/* GRASSI (Red) */}
                <View style={[styles.pill, {backgroundColor: 'rgba(255, 118, 117, 0.2)'}]}>
                    <Text style={[styles.pillText, {color:'#ff7675'}]}>F: {item.fats}</Text>
                </View>
                {/* PROTEINE (Blue) */}
                <View style={[styles.pill, {backgroundColor: 'rgba(116, 185, 255, 0.2)'}]}>
                    <Text style={[styles.pillText, {color:'#74b9ff'}]}>P: {item.proteins}</Text>
                </View>
                {/* CARBO (Yellow) - ECCOLI QUI! */}
                <View style={[styles.pill, {backgroundColor: 'rgba(253, 203, 110, 0.2)'}]}>
                    <Text style={[styles.pillText, {color:'#fdcb6e'}]}>C: {item.carbs}</Text>
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
        <View>
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
                placeholder={`Cerca ricette ${protocol}...`} 
                placeholderTextColor="#636e72"
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
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
                <Text style={{color:'#636e72'}}>Nessuna ricetta trovata.</Text>
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
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, gap: 15, justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  headerSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  infoBox: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, backgroundColor: '#111' },
  infoText: { fontWeight: '900', fontSize: 12 },

  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 15, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16, fontWeight: '600' },

  card: { height: 280, borderRadius: 25, overflow: 'hidden', backgroundColor: '#1e1e1e', elevation: 10, borderWidth: 1, borderColor: '#222' },
  image: { width: '100%', height: '100%' },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  
  cardContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 },
  
  badgesContainer: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  miniBadgeText: { fontSize: 9, fontWeight: '900' },
  
  cardTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10, lineHeight: 26 },
  
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  macroPills: { flexDirection: 'row', gap: 5 }, // Gap ridotto per farci stare tutto
  pill: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, minWidth: 40, alignItems: 'center' },
  pillText: { fontSize: 10, fontWeight: '900' }
});