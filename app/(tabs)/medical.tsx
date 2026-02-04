import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase'; 
import { BrainCircuit, Search, Zap, Activity, ChevronRight, Info, ShoppingCart, Plus } from 'lucide-react-native';

export default function MedicalScreen() {
  const [search, setSearch] = useState('');
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState(null);

  useEffect(() => {
    if (search.length > 2) {
      fetchProtocols();
    } else if (search.length === 0) {
      setProtocols([]);
    }
  }, [search]);

  async function fetchProtocols() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('biohack_protocols')
        .select('*')
        .ilike('symptom_name', `%${search}%`);
      
      if (!error) setProtocols(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const addToCart = async (productId: string, productName: string) => {
    try {
      // CHIAVE SINCRONIZZATA CON CART.TSX
      const CART_KEY = '@user_shopping_list';
      const currentCart = await AsyncStorage.getItem(CART_KEY);
      let cartItems = currentCart ? JSON.parse(currentCart) : [];

      const exists = cartItems.find((item: any) => item.name === productName);
      if (exists) {
        Alert.alert("Bio-Advisor", "Prodotto già presente nel carrello.");
        return;
      }

      const newItem = {
        id: productId || Date.now().toString(),
        name: productName,
        is_bought: false, // SINCRONIZZATO CON CART.TSX
        category: 'Bio-Hacking',
        created_at: new Date().toISOString(),
        product_url: productId === '87192aac-b29a-4a94-b661-9c0493e3c285' ? 'https://livebetter.com/normandy-salt' : null
      };

      cartItems.push(newItem);
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(cartItems));
      
      Alert.alert("Bio-Advisor", `${productName} aggiunto! 🛒`);
    } catch (e) {
      Alert.alert("Errore", "Impossibile aggiornare il carrello.");
    }
  };

  const renderProtocol = ({ item }) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => setSelectedProtocol(item)}>
      <View style={styles.resultHeader}>
        <Activity size={18} color="#00cec9" />
        <Text style={styles.symptomTitle}>{item.symptom_name}</Text>
      </View>
      <ChevronRight size={20} color="#333" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BrainCircuit size={32} color="#00cec9" />
        <Text style={styles.title}>GEMINI BIO-ADVISOR</Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={20} color="#636e72" style={styles.searchIcon} />
        <TextInput
          placeholder="Qual è il tuo sintomo?"
          placeholderTextColor="#636e72"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading && <ActivityIndicator color="#00cec9" style={{ marginTop: 20 }} />}

      {!selectedProtocol ? (
        <FlatList
          data={protocols}
          keyExtractor={(item) => item.id}
          renderItem={renderProtocol}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.introBox}>
              <Info size={40} color="#111" />
              <Text style={styles.introText}>Descrivi il sintomo per ricevere il protocollo AI.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView style={styles.detailView} contentContainerStyle={{ paddingBottom: 150 }}>
          <TouchableOpacity onPress={() => setSelectedProtocol(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← TORNA ALLA RICERCA</Text>
          </TouchableOpacity>
          <Text style={styles.detailSymptom}>{selectedProtocol.symptom_name}</Text>
          <View style={styles.adviceCard}>
            <Text style={styles.adviceLabel}>ANALISI AI (GEMINI)</Text>
            <Text style={styles.adviceContent}>{selectedProtocol.ai_advice}</Text>
          </View>
          <View style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <Zap size={20} color="#fdcb6e" />
              <Text style={styles.actionLabel}>AZIONE IMMEDIATA</Text>
            </View>
            <Text style={styles.actionContent}>{selectedProtocol.actionable_step}</Text>
          </View>

          {selectedProtocol.recommended_product_id && (
            <View style={styles.productCard}>
              <Text style={styles.productLabel}>SUPPORTO CONSIGLIATO</Text>
              <View style={styles.productInfo}>
                <View style={styles.productIconBox}><ShoppingCart size={20} color="#00cec9" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>
                    {selectedProtocol.recommended_product_id === '87192aac-b29a-4a94-b661-9c0493e3c285' ? 'Sale Integrale della Normandia' : 'Integratore Specifico'}
                  </Text>
                  <Text style={styles.productSub}>Essenziale per questo protocollo</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.buyBtn}
                onPress={() => addToCart(selectedProtocol.recommended_product_id, selectedProtocol.recommended_product_id === '87192aac-b29a-4a94-b661-9c0493e3c285' ? 'Sale Integrale della Normandia' : 'Integratore')}
              >
                <Text style={styles.buyBtnText}>AGGIUNGI ALLA SPESA</Text>
                <Plus size={18} color="#000" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 15 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', margin: 20, borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#222' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 55, color: '#fff', fontWeight: '600' },
  list: { padding: 20 },
  resultCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 18, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symptomTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  introBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  introText: { color: '#333', textAlign: 'center', marginTop: 20, fontSize: 14, lineHeight: 20 },
  detailView: { padding: 20 },
  backBtn: { marginBottom: 20 },
  backBtnText: { color: '#00cec9', fontWeight: 'bold', fontSize: 12 },
  detailSymptom: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 25 },
  adviceCard: { backgroundColor: '#111', padding: 20, borderRadius: 20, marginBottom: 15 },
  adviceLabel: { color: '#00cec9', fontSize: 10, fontWeight: '900', marginBottom: 10 },
  adviceContent: { color: '#bdc3c7', fontSize: 15, lineHeight: 22 },
  actionCard: { backgroundColor: '#fdcb6e10', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#fdcb6e30' },
  actionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  actionLabel: { color: '#fdcb6e', fontSize: 10, fontWeight: '900' },
  actionContent: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 24 },
  productCard: { marginTop: 25, backgroundColor: '#00cec910', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#00cec930' },
  productLabel: { color: '#00cec9', fontSize: 10, fontWeight: '900', marginBottom: 15 },
  productInfo: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  productIconBox: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  productName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  productSub: { color: '#636e72', fontSize: 12 },
  buyBtn: { backgroundColor: '#00cec9', height: 50, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  buyBtnText: { color: '#000', fontWeight: '900' },
});