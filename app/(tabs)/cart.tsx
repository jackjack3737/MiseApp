import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, RefreshControl, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from 'expo-router';
import { Trash2, CheckCircle2, Circle, RefreshCw, ShoppingBag, Zap, ExternalLink } from 'lucide-react-native';

export default function ShoppingListScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Carica i dati all'avvio e ogni volta che l'utente torna sulla pagina
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchLocalCart();
    });
    fetchLocalCart();
    return unsubscribe;
  }, [navigation]);

async function fetchLocalCart() {
    // Non resettare lo stato a [] all'inizio, così se il caricamento fallisce
    // l'utente vede comunque i dati vecchi invece di una schermata vuota.
    if (!refreshing) setLoading(true);
    
    try {
      const savedList = await AsyncStorage.getItem('@user_shopping_list');
      
      // Se non c'è nulla sul disco, usciamo senza resettare nulla inutilmente
      if (!savedList) {
        setItems([]);
        return;
      }

      const parsedList = JSON.parse(savedList);

      if (Array.isArray(parsedList)) {
        // Ordiniamo i dati
        const sortedList = parsedList.sort((a: any, b: any) => {
          // Gestione date per evitare crash se created_at manca
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;

          if (a.is_bought === b.is_bought) {
            return dateB - dateA;
          }
          return a.is_bought ? 1 : -1;
        });

        setItems(sortedList);
      }
    } catch (e) {
      // In caso di errore (es. JSON corrotto), non cancelliamo nulla!
      // Logghiamo solo l'errore per il debug.
      console.error("❌ Errore durante il recupero del carrello:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchLocalCart();
  };

  const formatIngredientName = (rawName: any) => {
    try {
      if (!rawName) return "Ingrediente";
      
      // Se per caso è rimasto salvato un oggetto intero {name: "...", quantity: ...}
      if (typeof rawName === 'object') {
          return rawName.name || JSON.stringify(rawName);
      }

      // Se è una stringa, pulisci parentesi quadre, virgolette e spazi
      if (typeof rawName === 'string') {
        return rawName.replace(/["'[\]]/g, '').trim().replace(/^\w/, (c) => c.toUpperCase());
      }
      
      return String(rawName);
    } catch (e) {
      return "Ingrediente sconosciuto";
    }
  };

  async function toggleItem(id: string) {
    try {
      const updated = items.map(item => 
        item.id === id ? { ...item, is_bought: !item.is_bought } : item
      );
      setItems(updated);
      await AsyncStorage.setItem('@user_shopping_list', JSON.stringify(updated));
    } catch (e) {
      Alert.alert("Errore", "Impossibile aggiornare lo stato locale.");
    }
  }

  async function deleteItem(id: string) {
    try {
      const updated = items.filter(item => item.id !== id);
      setItems(updated);
      await AsyncStorage.setItem('@user_shopping_list', JSON.stringify(updated));
    } catch (e) {
      Alert.alert("Errore", "Impossibile eliminare l'articolo.");
    }
  }

  async function clearBoughtItems() {
    const boughtCount = items.filter(i => i.is_bought).length;
    if (boughtCount === 0) return;

    Alert.alert("Pulisci Lista", `Rimuovere ${boughtCount} articoli completati?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Rimuovi", style: "destructive", onPress: async () => {
          const updated = items.filter(i => !i.is_bought);
          setItems(updated);
          await AsyncStorage.setItem('@user_shopping_list', JSON.stringify(updated));
      }}
    ]);
  }

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.is_bought && styles.cardBought]}>
      <TouchableOpacity 
        style={styles.leftInfo} 
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {item.is_bought ? (
            <CheckCircle2 size={24} color="#00cec9" strokeWidth={2.5} />
          ) : (
            <Circle size={24} color="#333" strokeWidth={2} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.itemName, item.is_bought && styles.textBought]}>
            {formatIngredientName(item.name)}
          </Text>
          <View style={styles.badgeRow}>
            {item.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
              </View>
            ) : null}
            
            {item.product_url ? (
              <TouchableOpacity 
                onPress={() => Linking.openURL(item.product_url)}
                style={styles.shopBadge}
              >
                <Zap size={10} color="#000" />
                <Text style={styles.shopText}>LIVE BETTER SHOP</Text>
                <ExternalLink size={10} color="#000" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
        <Trash2 size={18} color={item.is_bought ? "#222" : "#ff7675"} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>INVENTARIO LOCALE</Text>
          <Text style={styles.headerTitle}>CARRELLO</Text>
        </View>
        <View style={styles.headerActions}>
            <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
                <RefreshCw size={20} color="#00cec9" />
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
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00cec9" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <ShoppingBag size={40} color="#333" />
              </View>
              <Text style={styles.emptyText}>CARRELLO VUOTO</Text>
              <Text style={styles.emptySub}>Gli ingredienti aggiunti dalle ricette appariranno qui localmente.</Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 25,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#111'
  },
  headerTitle: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  headerSub: { color: '#00cec9', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  clearBtn: { paddingHorizontal: 15, height: 44, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  clearBtnText: { color: '#ff7675', fontSize: 11, fontWeight: '900' },
  listPadding: { 
    padding: 20, 
    paddingBottom: Platform.OS === 'ios' ? 140 : 120 
  },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#111', 
    padding: 18, 
    borderRadius: 24, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#222',
  },
  cardBought: { borderColor: '#00cec930', opacity: 0.4 },
  leftInfo: { flexDirection: 'row', alignItems: 'center', gap: 15, flex: 1 },
  iconContainer: { width: 30, alignItems: 'center' },
  textContainer: { flex: 1 },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  textBought: { textDecorationLine: 'line-through', color: '#636e72' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  categoryBadge: { 
    backgroundColor: '#1a1a1a', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6, 
    borderWidth: 1,
    borderColor: '#262626'
  },
  categoryText: { color: '#636e72', fontSize: 9, fontWeight: '900' },
  shopBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00cec9', 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 6, 
  },
  shopText: { color: '#000', fontSize: 9, fontWeight: '900' },
  deleteBtn: { padding: 10, backgroundColor: '#1a1a1a', borderRadius: 12, marginLeft: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyIconCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#111', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#222'
  },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  emptySub: { color: '#636e72', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 60 }
});