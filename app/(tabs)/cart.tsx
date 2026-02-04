import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, RefreshControl, Platform, Linking, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Trash2, CheckCircle2, Circle, ShoppingBag, Zap, ExternalLink, BookOpen, ShoppingCart, Book, Download, Check } from 'lucide-react-native';

const CART_KEY = '@user_shopping_list';

export default function ShoppingListScreen() {
  const [activeTab, setActiveTab] = useState<'LIST' | 'LIBRARY'>('LIST');
  const [items, setItems] = useState<any[]>([]);
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- DATA LOADING ---
  const loadData = async () => {
    if (!refreshing) setLoading(true);
    try {
        // 1. Load Shopping List
        const savedList = await AsyncStorage.getItem(CART_KEY);
        if (savedList) {
            const parsedList = JSON.parse(savedList);
            if (Array.isArray(parsedList)) {
                // Sort: Not bought first, then by date
                const sortedList = parsedList.sort((a: any, b: any) => {
                    if (a.is_bought === b.is_bought) {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                    }
                    return a.is_bought ? 1 : -1;
                });
                setItems(sortedList);
            }
        } else {
            setItems([]);
        }

        // 2. Load eBooks (only if tab is LIBRARY, or pre-fetch)
        const { data: ebookData, error } = await supabase
            .from('partner_ebooks')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true }); // Free ones first
        
        if (!error && ebookData) setEbooks(ebookData);

    } catch (e) {
        console.error("Error loading data:", e);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // --- SHOPPING LIST LOGIC ---
  const formatIngredientName = (rawName: any) => {
    if (!rawName) return "Ingrediente";
    if (typeof rawName === 'object') return rawName.name || "Elemento";
    return String(rawName).replace(/["'[\]]/g, '').trim().replace(/^\w/, (c) => c.toUpperCase());
  };

  async function toggleItem(id: string) {
    const updated = items.map(item => item.id === id ? { ...item, is_bought: !item.is_bought } : item);
    setItems(updated);
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(updated));
  }

  async function deleteItem(id: string) {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(updated));
  }

  async function clearBoughtItems() {
    const boughtCount = items.filter(i => i.is_bought).length;
    if (boughtCount === 0) return;
    Alert.alert("Pulisci Lista", `Rimuovere ${boughtCount} articoli completati?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Rimuovi", style: "destructive", onPress: async () => {
          const updated = items.filter(i => !i.is_bought);
          setItems(updated);
          await AsyncStorage.setItem(CART_KEY, JSON.stringify(updated));
      }}
    ]);
  }

  // --- RENDERERS ---
  const renderShoppingItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.is_bought && styles.cardBought]}>
      <TouchableOpacity 
        style={styles.leftInfo} 
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {item.is_bought ? <CheckCircle2 size={22} color="#00cec9" strokeWidth={2.5} /> : <Circle size={22} color="#333" strokeWidth={2} />}
        </View>
        <View style={styles.textContainer}>
          <View style={styles.nameRow}>
            <Text style={[styles.itemName, item.is_bought && styles.textBought]}>
              {formatIngredientName(item.name)}
            </Text>
            {item.price && !item.is_bought && <Text style={styles.itemPrice}>€{item.price}</Text>}
          </View>
          
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{(item.category || 'Generale').toUpperCase()}</Text>
            </View>
            {item.product_url && !item.is_bought && (
              <TouchableOpacity onPress={() => Linking.openURL(item.product_url)} style={styles.shopBadge}>
                <Zap size={10} color="#000" />
                <Text style={styles.shopText}>ACQUISTA</Text>
                <ExternalLink size={10} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
        <Trash2 size={16} color={item.is_bought ? "#222" : "#ff7675"} />
      </TouchableOpacity>
    </View>
  );

  const renderEbookItem = ({ item }: any) => (
    <View style={styles.bookCard}>
        <Image source={{ uri: item.cover_url || 'https://via.placeholder.com/150' }} style={styles.bookCover} resizeMode="cover" />
        <View style={styles.bookInfo}>
            <Text style={styles.bookCategory}>{item.category?.toUpperCase() || "GUIDA"}</Text>
            <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.bookAuthor}>di {item.author}</Text>
            <Text style={styles.bookDesc} numberOfLines={3}>{item.description}</Text>
            
            <View style={styles.bookFooter}>
                <Text style={styles.bookPrice}>{Number(item.price) === 0 ? 'GRATIS' : `€ ${item.price}`}</Text>
                <TouchableOpacity style={styles.buyBtn} onPress={() => item.shop_url && Linking.openURL(item.shop_url)}>
                    <Text style={styles.buyBtnText}>{Number(item.price) === 0 ? 'SCARICA' : 'ACQUISTA'}</Text>
                    {Number(item.price) === 0 ? <Download size={14} color="#000"/> : <ExternalLink size={14} color="#000"/>}
                </TouchableOpacity>
            </View>
        </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>BIO-MARKETPLACE</Text>
          <Text style={styles.headerTitle}>CARRELLO</Text>
        </View>
        {activeTab === 'LIST' && items.some(i => i.is_bought) && (
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={clearBoughtItems} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>PULISCI</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>

      {/* --- TAB SWITCHER --- */}
      <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'LIST' && styles.activeTab]} 
            onPress={() => setActiveTab('LIST')}
          >
              <ShoppingCart size={16} color={activeTab === 'LIST' ? '#000' : '#636e72'} />
              <Text style={[styles.tabText, activeTab === 'LIST' && {color:'#000'}]}>LISTA SPESA</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'LIBRARY' && styles.activeTab]} 
            onPress={() => setActiveTab('LIBRARY')}
          >
              <BookOpen size={16} color={activeTab === 'LIBRARY' ? '#000' : '#636e72'} />
              <Text style={[styles.tabText, activeTab === 'LIBRARY' && {color:'#000'}]}>LIBRERIA BIO</Text>
          </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#00cec9" /></View>
      ) : (
        <>
            {activeTab === 'LIST' ? (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderShoppingItem}
                    contentContainerStyle={styles.listPadding}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#00cec9" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <ShoppingBag size={40} color="#111" />
                            </View>
                            <Text style={styles.emptyText}>ARSENALE VUOTO</Text>
                            <Text style={styles.emptySub}>Aggiungi ingredienti dalle ricette o integratori per iniziare.</Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={ebooks}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderEbookItem}
                    contentContainerStyle={styles.listPadding}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#00cec9" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Book size={40} color="#111" />
                            </View>
                            <Text style={styles.emptyText}>LIBRERIA IN ARRIVO</Text>
                            <Text style={styles.emptySub}>Presto disponibili le guide definitive al Bio-Hacking.</Text>
                        </View>
                    }
                />
            )}
        </>
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
    paddingBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  headerSub: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  clearBtn: { paddingHorizontal: 15, height: 38, borderRadius: 10, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  clearBtnText: { color: '#ff7675', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  // TABS
  tabContainer: { flexDirection: 'row', backgroundColor: '#111', marginHorizontal: 20, borderRadius: 15, padding: 4, marginBottom: 10 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
  activeTab: { backgroundColor: '#00cec9' },
  tabText: { color: '#636e72', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },

  listPadding: { padding: 20, paddingBottom: 120 },
  
  // SHOPPING LIST CARD
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#080808', 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#111',
  },
  cardBought: { opacity: 0.4, borderColor: 'transparent' },
  leftInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconContainer: { width: 24, alignItems: 'center' },
  textContainer: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 10 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  itemPrice: { color: '#00cec9', fontSize: 13, fontWeight: '900', marginLeft: 10 },
  textBought: { textDecorationLine: 'line-through', color: '#333' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
  categoryBadge: { 
    backgroundColor: '#000', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6, 
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  categoryText: { color: '#444', fontSize: 8, fontWeight: '900' },
  shopBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00cec9', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6, 
  },
  shopText: { color: '#000', fontSize: 8, fontWeight: '900' },
  deleteBtn: { padding: 8, marginLeft: 10 },

  // EBOOK CARD
  bookCard: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#1a1a1a', height: 180 },
  bookCover: { width: 120, height: '100%', backgroundColor: '#222' },
  bookInfo: { flex: 1, padding: 15, justifyContent: 'space-between' },
  bookCategory: { color: '#636e72', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  bookTitle: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 20, marginBottom: 4 },
  bookAuthor: { color: '#00cec9', fontSize: 11, fontWeight: '600', marginBottom: 8 },
  bookDesc: { color: '#bdc3c7', fontSize: 10, lineHeight: 14 },
  bookFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  bookPrice: { color: '#fff', fontSize: 16, fontWeight: '900' },
  buyBtn: { backgroundColor: '#00cec9', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  buyBtnText: { color: '#000', fontSize: 10, fontWeight: '900' },

  // EMPTY STATE
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIconCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#080808', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#111'
  },
  emptyText: { color: '#1a1a1a', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  emptySub: { color: '#222', fontSize: 12, textAlign: 'center', marginTop: 8, paddingHorizontal: 60, fontWeight: '700' }
});