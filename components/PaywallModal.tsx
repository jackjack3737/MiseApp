import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Zap, ShieldCheck, Sparkles, Activity, Crown, KeyRound } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onUnlock?: () => void; // Funzione per aggiornare lo stato nel componente padre
}

export default function PaywallModal({ visible, onClose, onUnlock }: PaywallProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Piani abbonamento nascosti per review Store (solo sblocco con codice)
  // const handleSubscribe = (plan: 'monthly' | 'yearly') => { };

  // --- LOGICA DI SBLOCCO SUPABASE ---
  const verifyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);

    try {
      // 1. Verifica codice su Supabase
      const { data, error } = await supabase
        .from('unlock_codes')
        .select('*')
        .eq('code', code.trim().toUpperCase()) // Forziamo maiuscolo
        .eq('is_active', true)
        .single();

      if (error || !data) {
        Alert.alert("Errore", "Codice non valido o scaduto.");
        setLoading(false);
        return;
      }

      // 2. Salva stato Premium
      await AsyncStorage.setItem('@is_premium', 'true');
      
      Alert.alert("Complimenti!", "Funzionalità PRO sbloccate per sempre.");
      
      // 3. Pulisci e chiudi
      setCode('');
      if (onUnlock) onUnlock(); // Aggiorna la UI sotto
      onClose();

    } catch (err) {
      Alert.alert("Errore", "Impossibile verificare il codice. Controlla la connessione.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{flex: 1}}
        >
            <SafeAreaView style={styles.content}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X color="#666" size={24} />
              </TouchableOpacity>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                
                {/* HEADER */}
                <View style={styles.header}>
                  <View style={styles.crownBox}>
                    <Crown size={32} color="#00cec9" fill="#00cec9" />
                  </View>
                  <Text style={styles.mainTitle}>KETOLAB PRO</Text>
                  <Text style={styles.subTitle}>Sblocca il potere del tuo Bio-Metabolismo</Text>
                </View>

                {/* FEATURES LIST */}
                <View style={styles.features}>
                  <FeatureItem 
                    icon={<Sparkles size={20} color="#00cec9" />} 
                    title="AI Food Scanner Illimitato" 
                    desc="Usa Gemini per analizzare ogni cibo istantaneamente." 
                  />
                  <FeatureItem 
                    icon={<Activity size={20} color="#00cec9" />} 
                    title="Reattore Dinamico" 
                    desc="I tuoi macro cambiano in tempo reale in base allo sport." 
                  />
                  <FeatureItem 
                    icon={<ShieldCheck size={20} color="#00cec9" />} 
                    title="Privacy & Cloud Zero" 
                    desc="Tutti i dati restano criptati sul tuo dispositivo." 
                  />
                </View>

                {/* Piani abbonamento nascosti per review Store - solo sblocco con codice
                <TouchableOpacity style={[styles.planCard, styles.planCardActive]} onPress={() => {}}>
                  <View style={styles.bestValueTag}><Text style={styles.bestValueText}>PIÙ SCELTO</Text></View>
                  <View><Text style={styles.planTitle}>Annuale</Text><Text style={styles.planDesc}>Tutto incluso</Text></View>
                  <Text style={styles.planPrice}>€ 29,99 / anno</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.planCard} onPress={() => {}}>
                  <View><Text style={[styles.planTitle, {color: '#fff'}]}>Mensile</Text><Text style={styles.planDesc}>Flessibilità</Text></View>
                  <Text style={[styles.planPrice, {color: '#fff'}]}>€ 4,99 / mese</Text>
                </TouchableOpacity>
                */}

                {/* --- SEZIONE CODICE SBLOCCO --- */}
                <View style={styles.redeemSection}>
                    <Text style={styles.redeemLabel}>HAI UN CODICE SBLOCCO?</Text>
                    <View style={styles.redeemInputRow}>
                        <View style={styles.inputWrapper}>
                            <KeyRound size={16} color="#636e72" style={{marginLeft: 10}}/>
                            <TextInput 
                                style={styles.input}
                                placeholder="CODICE..."
                                placeholderTextColor="#444"
                                value={code}
                                onChangeText={setCode}
                                autoCapitalize="characters"
                            />
                        </View>
                        <TouchableOpacity 
                            style={[styles.redeemBtn, loading && {opacity: 0.5}]} 
                            onPress={verifyCode}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#000" size="small"/> : <Text style={styles.redeemBtnText}>USA</Text>}
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.disclaimer}>
                  Inserisci il codice ricevuto per sbloccare le funzionalità PRO.
                </Text>

                {/* CTA nascosto per review Store
                <TouchableOpacity style={styles.ctaBtn} onPress={() => {}}>
                  <Text style={styles.ctaText}>ATTIVA ORA</Text>
                </TouchableOpacity>
                */}
              </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const FeatureItem = ({ icon, title, desc }: any) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>{icon}</View>
    <View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, padding: 25 },
  closeBtn: { alignSelf: 'flex-end', padding: 10 },
  header: { alignItems: 'center', marginBottom: 30 },
  crownBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#00cec915', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  mainTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  subTitle: { color: '#636e72', fontSize: 14, textAlign: 'center', marginTop: 8 },
  
  features: { marginBottom: 30 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  featureIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  featureTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  featureDesc: { color: '#636e72', fontSize: 12, marginTop: 2 },

  planCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#222', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planCardActive: { borderColor: '#00cec9', backgroundColor: '#00cec905' },
  bestValueTag: { position: 'absolute', top: -10, left: 20, backgroundColor: '#00cec9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bestValueText: { color: '#000', fontSize: 8, fontWeight: '900' },
  planTitle: { color: '#00cec9', fontSize: 16, fontWeight: '900' },
  planDesc: { color: '#636e72', fontSize: 11, marginTop: 2 },
  planPrice: { color: '#00cec9', fontSize: 14, fontWeight: '900' },

  // STILI CODICE SBLOCCO
  redeemSection: { marginTop: 10, marginBottom: 10, padding: 15, backgroundColor: '#080808', borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  redeemLabel: { color: '#636e72', fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  redeemInputRow: { flexDirection: 'row', gap: 10 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  input: { flex: 1, color: '#fff', padding: 10, fontSize: 14, fontWeight: 'bold' },
  redeemBtn: { width: 60, backgroundColor: '#00cec9', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  redeemBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },

  disclaimer: { color: '#333', fontSize: 10, textAlign: 'center', marginVertical: 20, paddingHorizontal: 20 },
  ctaBtn: { backgroundColor: '#00cec9', padding: 18, borderRadius: 20, alignItems: 'center' },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});