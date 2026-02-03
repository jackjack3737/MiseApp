import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, RefreshControl } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { ShoppingCart, Trash2, CheckCircle2, Circle, RefreshCw } from 'lucide-react-native';

export default function ShoppingListScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCart();
  }, []);

  async function fetchCart() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .order('is_bought', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchCart();
  };

  async function toggleItem(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ is_bought: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      // Aggiornamento ottimistico della UI
      setItems(items.map(item => item.id === id ? { ...item, is_bought: !currentStatus } : item));
    } catch (e) {
      Alert.alert("Errore", "Impossibile aggiornare lo stato.");
    }
  }

  async function deleteItem(id: string) {
    try {
      const { error } = await supabase.from('shopping_list').delete().eq('id', id);
      if (error) throw error;
      setItems(items.filter(item => item.id !== id));
    } catch (e) {
      Alert.alert("Errore", "Impossibile eliminare l'articolo.");
    }
  }

  async function clearBoughtItems() {
    const boughtIds = items.filter(i => i.is_bought).map(i => i.id);
    if (boughtIds.length === 0) {
      Alert.alert("Info", "Non ci sono articoli completati da rimuovere.");
      return;
    }

    Alert.alert("Pulisci Lista", `Rimuovere ${boughtIds.length} articoli acquistati?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Rimuovi tutto", style: "destructive", onPress: async () => {
          const { error } = await supabase.from('shopping_list').delete().in('id', boughtIds);
          if (!error) fetchCart();
      }}
    ]);
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, item.is_bought && styles.cardBought]} 
      onPress={() => toggleItem(item.id, item.is_bought)}
      activeOpacity={0.7}
    >
      <View style={styles.leftInfo}>
        {item.is_bought ? (
          <CheckCircle2 size={22} color="#00cec9" />
        ) : (
          <Circle size={22} color="#333" />
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.itemName, item.is_bought && styles.textBought]}>
            {item.name}
          </Text>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>
      
      <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
        <Trash2 size={18} color={item.is_bought ? "#222" : "#ff7675"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CARRELLO</Text>
          <Text style={styles.headerSub}>{items.length} ARTICOLI IN LISTA</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
                <RefreshCw size={18} color="#00cec9" />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearBoughtItems} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>PULISCI</Text>
            </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#00cec9" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00cec9" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShoppingCart size={60} color="#111" />
              <Text style={styles.emptyText}>Lista vuota</Text>
              <Text style={styles.emptySub}>Aggiungi gli ingredienti dalle tue ricette preferite.</Text>
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
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    paddingHorizontal: 25, 
    paddingTop: 60, 
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111'
  },
  headerTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  headerSub: { color: '#00cec9', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  clearBtn: { paddingHorizontal: 15, height: 40, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  clearBtnText: { color: '#ff7675', fontSize: 10, fontWeight: '900' },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#111', 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  cardBought: { borderColor: '#00cec920', opacity: 0.5 },
  leftInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  textContainer: { flex: 1 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  textBought: { textDecorationLine: 'line-through', color: '#636e72' },
  categoryBadge: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#1a1a1a', 
    paddingHorizontal: 7, 
    paddingVertical: 2, 
    borderRadius: 5, 
    marginTop: 5,
    borderWidth: 0.5,
    borderColor: '#333'
  },
  categoryText: { color: '#636e72', fontSize: 8, fontWeight: '900' },
  deleteBtn: { padding: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 120 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 20 },
  emptySub: { color: '#636e72', fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 50 }
});