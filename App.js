import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, SafeAreaView } from 'react-native';
import { supabase } from './src/lib/supabase';
import { ChefHat, Flame, Clock } from 'lucide-react-native'; // Le nostre icone!

export default function App() {
  const [ricette, setRicette] = useState([]);
  const [loading, setLoading] = useState(true);

  // Funzione che scarica le ricette dal database
  async function fetchRecipes() {
    try {
      setLoading(true);
      // Chiediamo: ID, Titolo, Tempo, Kcal e Tags
      // Limitiamo a 10 per ora
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, total_time, kcal, tags')
        .limit(10);

      if (error) console.error('Errore Supabase:', error);
      else setRicette(data || []);
      
    } catch (err) {
      console.error('Errore fetch:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecipes();
  }, []);

  // Come disegniamo ogni singola ricetta nella lista
  const renderRicetta = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <ChefHat color="#333" size={24} />
        <Text style={styles.title}>{item.title}</Text>
      </View>
      
      {/* Zona Info Nutrizionali */}
      <View style={styles.infoRow}>
        <View style={styles.badge}>
          <Clock size={14} color="#666" />
          <Text style={styles.badgeText}>{item.total_time || '--'} min</Text>
        </View>
        <View style={styles.badge}>
          <Flame size={14} color="#e25822" />
          <Text style={styles.badgeText}>{item.kcal || '--'} kcal</Text>
        </View>
      </View>

      {/* Zona Tags (Keto, Paleo, ecc) */}
      <View style={styles.tagContainer}>
        {item.tags && item.tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.mainTitle}>Mise App 2.0</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <FlatList
          data={ricette}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRicetta}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2d3436',
  },
  list: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    color: '#2d3436',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f2f6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636e72',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#dff9fb',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7ecee',
  },
  tagText: {
    fontSize: 10,
    color: '#22a6b3',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});