import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Vibration, Alert, Platform, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Check, Plus, Minus, Zap, Beef, CookingPot, Leaf, Sparkles, Cpu, RotateCcw, Scale } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFoodFromAI } from '../utils/gemini-cache';

const TECH_GREEN = '#39FF14'; 
const DARK_TECH_GREEN = '#1b3517';
const BORDER_COLOR = '#1A1A1A';

const IconMap: any = {
  'Carnivore': <Beef size={40} color={TECH_GREEN} />,
  'Keto': <CookingPot size={40} color={TECH_GREEN} />,
  'Paleo': <Leaf size={40} color={TECH_GREEN} />,
  'Low Carb': <Zap size={40} color={TECH_GREEN} />,
  default: <Cpu size={40} color={TECH_GREEN} />
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiProtocol, setAiProtocol] = useState<string | null>(null);
  const [targetGrams, setTargetGrams] = useState(100);
  const [logging, setLogging] = useState(false);

  useEffect(() => { 
    fetchRecipeDetails(); 
  }, [id]);

  async function fetchRecipeDetails() {
    try {
      const { data, error } = await supabase.from('recipes').select('*').eq('id', id).single();
      if (error) throw error;
      setRecipe(data);
    } catch (e) { 
      Alert.alert("SISTEMA", "FALLIMENTO_RECUPERO_DATI");
    } finally { setLoading(false); }
  }

  const generateAIProtocol = async () => {
    setGenerating(true);
    Vibration.vibrate(50);
    try {
      const cleanTitle = recipe.title.replace(/["']/g, "");
      const cleanIngredients = recipe.ingredients.replace(/["']/g, "");

      // Aggiungiamo un timestamp per bypassare la cache locale ed evitare vecchi errori salvati
      const cacheBypass = Date.now();
      const prompt = `BIO_HACK_INSTRUCTION: Genera protocollo tecnico per ${targetGrams}g di ${cleanTitle}. Ingredienti: ${cleanIngredients}. Ref:${cacheBypass}`;
      
      console.log("🧠 Interrogazione tramite Supabase Bridge...");
      const response = await getFoodFromAI(prompt);
      
      let safeContent = "";
      
      // Estrazione del contenuto testuale (isText arriva dalla Edge Function aggiornata)
      if (response && response.isText) {
        safeContent = response.ai_advice;
      } else if (typeof response === 'object' && response !== null) {
        safeContent = response.ai_advice || response.food_name || JSON.stringify(response);
      } else {
        safeContent = response;
      }

      // Validazione del contenuto per intercettare rifiuti o errori di sicurezza
      if (!safeContent || safeContent.includes("ERRORE_SICUREZZA") || safeContent.includes("ERRORE_PARSING_AI")) {
          setAiProtocol("⚠️ RIFIUTO_SISTEMA: Protocollo protetto o non generabile. Prova a variare la grammatura target.");
      } else {
          setAiProtocol(safeContent);
      }

    } catch (e: any) {
      console.error(e);
      Alert.alert("SYS_ERROR", "ERRORE_COMUNICAZIONE_IA");
    } finally {
      setGenerating(false);
    }
  };

  async function handleTrackMeal() {
    setLogging(true);
    try {
        const multiplier = targetGrams / 100;
        const newLog = {
            id: Date.now().toString(),
            food_name: recipe.title.toUpperCase(), 
            kcal: Math.round(parseFloat(recipe.kcal_100g) * multiplier),
            carbs: Math.round(parseFloat(recipe.carbs_100g) * multiplier),
            proteins: Math.round(parseFloat(recipe.protein_100g) * multiplier),
            fats: Math.round(parseFloat(recipe.fat_100g) * multiplier),
            date: new Date().toISOString().split('T')[0],
            meal_type: 'BIO_RECIPE_LOG',
            weight_g: targetGrams
        };

        const logsRaw = await AsyncStorage.getItem('@user_daily_logs');
        const logs = logsRaw ? JSON.parse(logsRaw) : [];
        await AsyncStorage.setItem('@user_daily_logs', JSON.stringify([newLog, ...logs]));

        Vibration.vibrate(100);
        router.push('/(tabs)/tracker');
    } catch (error) {
        Alert.alert("ERRORE", "SCRITTURA_DATABASE_FALLITA");
    } finally { setLogging(false); }
  }

  if (loading || !recipe) return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator size="large" color={TECH_GREEN} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={TECH_GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ANALISI_PROTOCOLLO_OPERATIVO</Text>
        <View style={{width: 24}} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.heroSection}>
            <View style={styles.iconCircle}>
                {IconMap[recipe.category] || IconMap.default}
            </View>
            <Text style={styles.title}>{recipe.title.toUpperCase()}</Text>
        </View>

        <View style={styles.weightSelectorCard}>
            <View style={styles.weightHeader}>
                <Scale size={14} color={TECH_GREEN} />
                <Text style={styles.weightLabel}>TARATURA_TARGET_MASSA (G)</Text>
            </View>
            <View style={styles.weightInputRow}>
                <TouchableOpacity onPress={() => setTargetGrams(Math.max(50, targetGrams - 50))} style={styles.weightBtn}><Minus size={20} color={TECH_GREEN} /></TouchableOpacity>
                <TextInput 
                    style={styles.weightInput} 
                    keyboardType="numeric" 
                    value={targetGrams.toString()} 
                    onChangeText={(t) => setTargetGrams(Number(t) || 0)}
                />
                <TouchableOpacity onPress={() => setTargetGrams(targetGrams + 50)} style={styles.weightBtn}><Plus size={20} color={TECH_GREEN} /></TouchableOpacity>
            </View>
        </View>

        <View style={styles.macroStrip}>
            <View style={styles.macroBox}>
                <Text style={styles.macroVal}>{Math.round(parseFloat(recipe.kcal_100g) * (targetGrams / 100))}</Text>
                <Text style={styles.macroLabel}>KCAL</Text>
            </View>
            <View style={styles.macroBox}>
                <Text style={[styles.macroVal, {color: TECH_GREEN}]}>{Math.round(parseFloat(recipe.carbs_100g) * (targetGrams / 100))}G</Text>
                <Text style={styles.macroLabel}>CARBO</Text>
            </View>
            <View style={styles.macroBox}>
                <Text style={[styles.macroVal, {color: TECH_GREEN}]}>{Math.round(parseFloat(recipe.protein_100g) * (targetGrams / 100))}G</Text>
                <Text style={styles.macroLabel}>PROT</Text>
            </View>
            <View style={styles.macroBox}>
                <Text style={[styles.macroVal, {color: TECH_GREEN}]}>{Math.round(parseFloat(recipe.fat_100g) * (targetGrams / 100))}G</Text>
                <Text style={styles.macroLabel}>GRASS</Text>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionHeader}>{'>'} ELABORAZIONE_CORE_AI</Text>
            
            {!aiProtocol ? (
                <TouchableOpacity 
                    style={styles.generateBtn} 
                    onPress={generateAIProtocol}
                    disabled={generating}
                >
                    {generating ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <>
                            <Sparkles size={18} color="#000" />
                            <Text style={styles.generateBtnText}>GENERA_PROTOCOLLO_TECNICO_{targetGrams}G</Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={styles.aiResultCard}>
                    <View style={styles.aiHeader}>
                        <Cpu size={14} color={TECH_GREEN} />
                        <Text style={styles.aiLabel}>PROTOCOLLO_CALIBRATO_SUCCESS</Text>
                    </View>
                    <Text style={styles.aiContent}>{aiProtocol}</Text>
                    <TouchableOpacity style={styles.resetAiBtn} onPress={() => setAiProtocol(null)}>
                        <RotateCcw size={14} color={DARK_TECH_GREEN} />
                        <Text style={styles.resetAiText}>RE_INITIALIZE_CORE</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>

      </ScrollView>

      <View style={styles.fabContainer}>
          <TouchableOpacity 
            style={styles.fabButton} 
            onPress={handleTrackMeal} 
            disabled={logging}
          >
              <View>
                <Text style={styles.fabTitle}>REGISTRA_DIARIO_LOG</Text>
                <Text style={styles.fabSub}>VALORE_OPERATIVO: {targetGrams}G</Text>
              </View>
              <Check size={24} color="#000" />
          </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  headerTitle: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  heroSection: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DARK_TECH_GREEN, marginBottom: 20 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center', paddingHorizontal: 30, fontFamily: 'monospace' },
  weightSelectorCard: { backgroundColor: '#080808', marginHorizontal: 20, padding: 20, borderTopWidth: 1, borderTopColor: DARK_TECH_GREEN, marginBottom: 20 },
  weightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  weightLabel: { color: TECH_GREEN, fontSize: 9, fontWeight: '900', fontFamily: 'monospace', opacity: 0.7 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  weightBtn: { width: 45, height: 45, backgroundColor: '#000', borderWidth: 1, borderColor: DARK_TECH_GREEN, justifyContent: 'center', alignItems: 'center' },
  weightInput: { color: '#fff', fontSize: 24, fontWeight: '900', fontFamily: 'monospace', textAlign: 'center', minWidth: 80 },
  macroStrip: { flexDirection: 'row', backgroundColor: '#050505', paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER_COLOR, justifyContent: 'space-around' },
  macroBox: { alignItems: 'center' },
  macroVal: { color: '#fff', fontSize: 16, fontWeight: '900', fontFamily: 'monospace' },
  macroLabel: { color: '#444', fontSize: 8, fontWeight: 'bold', marginTop: 5, fontFamily: 'monospace' },
  section: { paddingHorizontal: 20, marginTop: 30 },
  sectionHeader: { color: TECH_GREEN, fontSize: 10, fontWeight: '900', marginBottom: 15, fontFamily: 'monospace', opacity: 0.6 },
  generateBtn: { backgroundColor: TECH_GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 2, gap: 10 },
  generateBtnText: { color: '#000', fontWeight: '900', fontSize: 11, fontFamily: 'monospace' },
  aiResultCard: { backgroundColor: '#050505', padding: 20, borderTopWidth: 1, borderTopColor: DARK_TECH_GREEN },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  aiLabel: { color: TECH_GREEN, fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' },
  aiContent: { color: '#ccc', fontSize: 13, lineHeight: 22, fontFamily: 'monospace' },
  resetAiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 25, alignSelf: 'flex-end' },
  resetAiText: { color: DARK_TECH_GREEN, fontSize: 8, fontWeight: 'bold', fontFamily: 'monospace' },
  fabContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  fabButton: { backgroundColor: TECH_GREEN, height: 70, borderRadius: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25 },
  fabTitle: { color: '#000', fontSize: 13, fontWeight: '900', fontFamily: 'monospace' },
  fabSub: { color: '#000', fontSize: 8, fontWeight: 'bold', opacity: 0.6 },
});