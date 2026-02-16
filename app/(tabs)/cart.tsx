import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Alert, RefreshControl, Platform, Linking, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { Trash2, CircleCheck, Circle, ShoppingBag, Zap, ExternalLink, BookOpen, ShoppingCart, Book, Download } from 'lucide-react-native';
import { BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT_BTN, RING_TRACK, RED_ALERT, SUCCESS } from '../../constants/theme';

const CART_KEY = '@user_shopping_list';
const RECIPE_CART_KEY = '@user_shopping_cart';

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
        // 1. Load Shopping List (lista strutturata)
        let list: any[] = [];
        const savedList = await AsyncStorage.getItem(CART_KEY);
        if (savedList) {
            const parsedList = JSON.parse(savedList);
            if (Array.isArray(parsedList)) list = parsedList;
        }

        // Rimuovi prodotti vecchi da recipe-detail (id che inizia con "recipe_")
        const beforeRecipe = list.length;
        list = list.filter((i: any) => !(i?.id && String(i.id).startsWith('recipe_')));
        if (list.length !== beforeRecipe) {
            await AsyncStorage.setItem(CART_KEY, JSON.stringify(list));
        }

        // Svuota il carrello ricette legacy (non usiamo più recipe-detail per il carrello)
        await AsyncStorage.removeItem(RECIPE_CART_KEY);

        if (list.length > 0) {
            const sortedList = list.sort((a: any, b: any) => {
                if (a.is_bought === b.is_bought) {
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return dateB - dateA;
                }
                return a.is_bought ? 1 : -1;
            });
            setItems(sortedList);
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
    return String(rawName).replace(/["'[\]]/g, '').trim();
  };

  const renderItemNameWithHighlight = (text: string) => {
    if (!text) return <Text style={styles.itemName}>Ingrediente</Text>;
    const parts = text.split(/(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|pz)?)/gi);
    return (
      <Text style={styles.itemName}>
        {parts.map((part, i) => {
          const isNumber = /^\d/.test(part.trim());
          return (
            <Text key={i} style={[styles.itemName, isNumber && { color: ACCENT_BTN }]}>
              {part}
            </Text>
          );
        })}
      </Text>
    );
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
  const renderShoppingItem = ({ item }: { item: any }) => {
    const displayName = item.name != null ? formatIngredientName(item.name) : formatIngredientName(item);

    return (
    <View style={[styles.card, item.is_bought && styles.cardBought]}>
      <TouchableOpacity 
        style={styles.leftInfo} 
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {item.is_bought ? <CircleCheck size={22} color={SUCCESS} strokeWidth={2.5} /> : <Circle size={22} color={RING_TRACK} strokeWidth={2} />}
        </View>
        <View style={styles.textContainer}>
          <View style={styles.nameRow}>
            {item.is_bought ? (
              <Text style={[styles.itemName, styles.textBought]}>{displayName}</Text>
            ) : (
              renderItemNameWithHighlight(displayName)
            )}
            {item.quantity != null && !item.is_bought && (
              <Text style={[styles.itemQuantity, { color: ACCENT_BTN }]}>{item.quantity}</Text>
            )}
            {item.price && !item.is_bought && <Text style={styles.itemPrice}>€{item.price}</Text>}
          </View>
          
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category || 'Generale'}</Text>
            </View>
            {item.product_url && !item.is_bought && (
              <TouchableOpacity onPress={() => Linking.openURL(item.product_url)} style={styles.shopBadge}>
                <Zap size={10} color={CARD_BG} />
                <Text style={styles.shopText}>Acquista</Text>
                <ExternalLink size={10} color={CARD_BG} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
        <Trash2 size={16} color={item.is_bought ? TEXT_SECONDARY : RED_ALERT} />
      </TouchableOpacity>
    </View>
  );
  };

  const renderEbookItem = ({ item }: any) => (
    <View style={styles.bookCard}>
        <Image source={{ uri: item.cover_url || 'https://via.placeholder.com/150' }} style={styles.bookCover} resizeMode="cover" />
        <View style={styles.bookInfo}>
            <Text style={styles.bookCategory}>{item.category || 'Guida'}</Text>
            <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.bookAuthor}>di {item.author}</Text>
            <Text style={styles.bookDesc} numberOfLines={3}>{item.description}</Text>
            
            <View style={styles.bookFooter}>
                <Text style={styles.bookPrice}>{Number(item.price) === 0 ? 'Gratis' : `€ ${item.price}`}</Text>
                <TouchableOpacity style={styles.buyBtn} onPress={() => item.shop_url && Linking.openURL(item.shop_url)}>
                    <Text style={styles.buyBtnText}>{Number(item.price) === 0 ? 'Scarica' : 'Acquista'}</Text>
                    {Number(item.price) === 0 ? <Download size={14} color={CARD_BG} /> : <ExternalLink size={14} color={CARD_BG} />}
                </TouchableOpacity>
            </View>
        </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <ShoppingCart size={26} color={ACCENT_BTN} />
          <View>
            <Text style={styles.headerSub}>Lista spesa e libreria</Text>
            <Text style={styles.headerTitle}>Carrello</Text>
          </View>
        </View>
        {activeTab === 'LIST' && items.some(i => i.is_bought) && (
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={clearBoughtItems} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Pulisci</Text>
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
              <ShoppingCart size={16} color={activeTab === 'LIST' ? CARD_BG : TEXT_SECONDARY} />
              <Text style={[styles.tabText, activeTab === 'LIST' && { color: CARD_BG }]}>Lista spesa</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'LIBRARY' && styles.activeTab]} 
            onPress={() => setActiveTab('LIBRARY')}
          >
              <BookOpen size={16} color={activeTab === 'LIBRARY' ? CARD_BG : TEXT_SECONDARY} />
              <Text style={[styles.tabText, activeTab === 'LIBRARY' && { color: CARD_BG }]}>Libreria</Text>
          </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={ACCENT_BTN} /></View>
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
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={ACCENT_BTN} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <ShoppingBag size={40} color={TEXT_SECONDARY} />
                            </View>
                            <Text style={styles.emptyText}>Lista vuota</Text>
                            <Text style={styles.emptySub}>Aggiungi ingredienti dalle ricette o dalla spesa.</Text>
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
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={ACCENT_BTN} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Book size={40} color={TEXT_SECONDARY} />
                            </View>
                            <Text style={styles.emptyText}>Libreria in arrivo</Text>
                            <Text style={styles.emptySub}>Presto disponibili guide e risorse.</Text>
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
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    paddingHorizontal: 24, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 20,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  headerSub: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  clearBtn: { paddingHorizontal: 16, height: 40, borderRadius: 12, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: RING_TRACK },
  clearBtnText: { color: RED_ALERT, fontSize: 13, fontWeight: '600' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: RING_TRACK, marginHorizontal: 20, borderRadius: 16, padding: 4, marginBottom: 14 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  activeTab: { backgroundColor: ACCENT_BTN },
  tabText: { color: TEXT_SECONDARY, fontWeight: '600', fontSize: 13 },

  listPadding: { padding: 20, paddingBottom: 120 },
  
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: CARD_BG, 
    padding: 18, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: RING_TRACK,
    ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }),
  },
  cardBought: { opacity: 0.5 },
  leftInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconContainer: { width: 28, alignItems: 'center' },
  textContainer: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 10 },
  itemName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600', flex: 1 },
  itemQuantity: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  itemPrice: { color: ACCENT_BTN, fontSize: 13, fontWeight: '600', marginLeft: 10 },
  textBought: { textDecorationLine: 'line-through', color: TEXT_SECONDARY },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  categoryBadge: { backgroundColor: BG, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },
  shopBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT_BTN, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  shopText: { color: CARD_BG, fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 8, marginLeft: 8 },

  bookCard: { flexDirection: 'row', backgroundColor: CARD_BG, borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: RING_TRACK, height: 180, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  bookCover: { width: 120, height: '100%', backgroundColor: RING_TRACK },
  bookInfo: { flex: 1, padding: 16, justifyContent: 'space-between' },
  bookCategory: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  bookTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 4 },
  bookAuthor: { color: ACCENT_BTN, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  bookDesc: { color: TEXT_SECONDARY, fontSize: 11, lineHeight: 16 },
  bookFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  bookPrice: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  buyBtn: { backgroundColor: ACCENT_BTN, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  buyBtnText: { color: CARD_BG, fontSize: 13, fontWeight: '600' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 18, fontWeight: '600' },
  emptySub: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 48, fontWeight: '500' },
});