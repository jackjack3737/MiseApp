import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ChefHat, Flame, Leaf, Fish, Beef, Zap, Check, ChevronRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CUISINES = [
  { id: 'italian', name: 'Italiana', icon: <ChefHat size={24} color="#fff" /> },
  { id: 'keto', name: 'Keto', icon: <Beef size={24} color="#fff" /> },
  { id: 'veggie', name: 'Veggie', icon: <Leaf size={24} color="#fff" /> },
  { id: 'fish', name: 'Pesce', icon: <Fish size={24} color="#fff" /> },
  { id: 'fast', name: 'Veloce', icon: <Zap size={24} color="#fff" /> },
];

export default function SetupScreen() {
  const router = useRouter();
  
  // STATI
  const [selectedCuisine, setSelectedCuisine] = useState('italian');
  const [kcal, setKcal] = useState(600);
  
  // Macros (Low, Mid, High)
  const [carbs, setCarbs] = useState('mid');
  const [protein, setProtein] = useState('high');
  const [fats, setFats] = useState('mid');

  // Funzione per renderizzare il selettore Macro (Low/Mid/High)
  const renderMacroSelector = (label, value, setValue, color) => (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroControl}>
        {['low', 'mid', 'high'].map((level) => {
          const isActive = value === level;
          return (
            <TouchableOpacity 
              key={level} 
              onPress={() => setValue(level)}
              style={[
                styles.macroBtn, 
                isActive && { backgroundColor: color, borderColor: color }
              ]}
            >
              <Text style={[styles.macroBtnText, isActive && { color: '#000', fontWeight:'bold' }]}>
                {level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Il Tuo Obiettivo 🎯</Text>
          <Text style={styles.subtitle}>Configura il motore metabolico</Text>
        </View>

        {/* 1. SELETTORE CUCINA */}
        <Text style={styles.sectionTitle}>CHE VOGLIA HAI?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuisineList}>
          {CUISINES.map((c) => (
            <TouchableOpacity 
              key={c.id} 
              style={[styles.cuisineCard, selectedCuisine === c.id && styles.cuisineCardActive]}
              onPress={() => setSelectedCuisine(c.id)}
            >
              <View style={[styles.iconCircle, selectedCuisine === c.id && { backgroundColor: '#2d3436' }]}>
                {c.icon}
              </View>
              <Text style={[styles.cuisineText, selectedCuisine === c.id && { color: '#000' }]}>{c.name}</Text>
              {selectedCuisine === c.id && (
                <View style={styles.checkBadge}><Check size={12} color="#fff" /></View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 2. CALORIE SLIDER (Simulato Custom) */}
        <View style={styles.sectionContainer}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={styles.sectionTitle}>TARGET CALORICO</Text>
                <View style={styles.kcalBadge}>
                    <Flame size={16} color="#e17055" fill="#e17055" />
                    <Text style={styles.kcalValue}>{kcal} kcal</Text>
                </View>
            </View>
            
            <View style={styles.sliderContainer}>
                <TouchableOpacity onPress={() => setKcal(Math.max(300, kcal - 50))} style={styles.sliderBtn}><Text style={styles.sliderBtnText}>-</Text></TouchableOpacity>
                
                {/* Visual Bar */}
                <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(kcal / 1200) * 100}%` }]} />
                </View>

                <TouchableOpacity onPress={() => setKcal(Math.min(1200, kcal + 50))} style={styles.sliderBtn}><Text style={styles.sliderBtnText}>+</Text></TouchableOpacity>
            </View>
        </View>

        {/* 3. MACROS EQUALIZER */}
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>MACROS TUNING</Text>
            <View style={styles.equalizerBox}>
                {renderMacroSelector("PROTEINE", protein, setProtein, "#00cec9")}
                {renderMacroSelector("CARBO", carbs, setCarbs, "#fdcb6e")}
                {renderMacroSelector("GRASSI", fats, setFats, "#e17055")}
            </View>
        </View>

      </ScrollView>

      {/* FOOTER BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity 
            style={styles.mainButton}
            onPress={() => {
                // Qui passeremo i parametri alla Home!
                // Per ora torniamo alla home standard
                router.replace('/(tabs)');
            }}
        >
            <Text style={styles.mainButtonText}>CREA IL MENU</Text>
            <ChevronRight size={24} color="#000" />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e272e' },
  header: { padding: 25, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#b2bec3' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#636e72', marginLeft: 25, marginBottom: 15, letterSpacing: 1 },
  
  // Cuisines
  cuisineList: { paddingHorizontal: 25, gap: 15, paddingBottom: 30 },
  cuisineCard: { width: 100, height: 120, backgroundColor: '#2d3436', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4b4b4b' },
  cuisineCardActive: { backgroundColor: '#fff', borderColor: '#fff' },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cuisineText: { color: '#fff', fontWeight: 'bold' },
  checkBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#00cec9', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Section Generic
  sectionContainer: { marginHorizontal: 25, marginBottom: 30 },
  
  // Kcal
  kcalBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(225, 112, 85, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  kcalValue: { color: '#e17055', fontWeight: 'bold', fontSize: 16 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 10 },
  sliderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2d3436', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#4b4b4b' },
  sliderBtnText: { color: '#fff', fontSize: 24, fontWeight: '300', lineHeight: 26 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#2d3436', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#e17055', borderRadius: 4 },

  // Macros
  equalizerBox: { backgroundColor: '#2d3436', borderRadius: 20, padding: 20 },
  macroRow: { marginBottom: 20 },
  macroLabel: { color: '#b2bec3', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  macroControl: { flexDirection: 'row', backgroundColor: '#1e272e', borderRadius: 12, padding: 4 },
  macroBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  macroBtnText: { color: '#636e72', fontSize: 12, fontWeight: '700' },

  // Footer
  footer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  mainButton: { backgroundColor: '#00cec9', height: 60, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 10, shadowColor: '#00cec9', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: {width:0, height:5} },
  mainButtonText: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: 1 },
});