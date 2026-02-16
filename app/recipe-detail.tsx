import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, CookingPot, Cpu, Leaf, Minus, Plus, RotateCcw, Scale, ShoppingCart, Sparkles, Target, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACCENT_BTN, BG, CARD_BG, RING_CARB, RING_FAT, RING_PROTEIN, RING_TRACK, TEXT_PRIMARY, TEXT_SECONDARY } from '../constants/theme';
import { supabase } from '../src/lib/supabase';
import { getFoodFromAI } from '../utils/gemini-cache';

const IconMap: any = {
  'Keto': <CookingPot size={40} color={ACCENT_BTN} />,
  'Low Carb': <Zap size={40} color={ACCENT_BTN} />,
  'Bilanciata': <Leaf size={40} color={ACCENT_BTN} />,
  'Personalizza': <Target size={40} color={ACCENT_BTN} />,
  default: <Cpu size={40} color={ACCENT_BTN} />
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
  const [ingredientsList, setIngredientsList] = useState<string[]>([]);
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());

  /** Scala tutti i numeri nella riga in base a currentGrams/100. Usata per display e per addToCart. */
  const getDynamicIngredientLine = (originalLine: string, currentGrams: number): string => {
    const ratio = currentGrams / 100;
    return originalLine.replace(/(\d+([.,]\d+)?)/g, (match) => {
      const num = parseFloat(match.replace(',', '.'));
      if (isNaN(num)) return match;
      return Math.round(num * ratio).toString();
    });
  };

  useEffect(() => { 
    fetchRecipeDetails(); 
  }, [id]);

  async function fetchRecipeDetails() {
    try {
      const { data, error } = await supabase.from('recipes').select('*').eq('id', id).single();
      if (error) throw error;
      setRecipe(data);
      if (data?.ingredients && typeof data.ingredients === 'string') {
        const parsed = data.ingredients
          .split(/[\n,]+/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        setIngredientsList(parsed);
      } else {
        setIngredientsList([]);
      }
    } catch (e) { 
      Alert.alert("SISTEMA", "FALLIMENTO_RECUPERO_DATI");
    } finally { setLoading(false); }
  }

  /** Aggiunge al carrello la stringa già scalata (quella mostrata a video). */
  async function addToCart(scaledIngredient: string) {
    try {
      const finalIngredient = scaledIngredient.trim();
      if (!finalIngredient) return;

      const raw = await AsyncStorage.getItem('@user_shopping_cart');
      const cart: string[] = raw ? JSON.parse(raw) : [];
      if (cart.some((item) => item.toLowerCase() === finalIngredient.toLowerCase())) {
        Alert.alert("LISTA SPESA", "COMPONENTE_GIÀ_PRESENTE");
        return;
      }
      cart.push(finalIngredient);
      await AsyncStorage.setItem('@user_shopping_cart', JSON.stringify(cart));
      if (Platform.OS !== 'web') Vibration.vibrate(50);
      setAddedToCart((prev) => new Set(prev).add(finalIngredient));
      Alert.alert("LISTA SPESA", "COMPONENTE ACQUISITO");
    } catch (e) {
      Alert.alert("ERRORE", "SCRITTURA_CARRELLO_FALLITA");
    }
  }

  const generateAIProtocol = async () => {
    setGenerating(true);
    Vibration.vibrate(50);
    try {
      const cleanTitle = recipe.title.replace(/["']/g, "");
      const cleanIngredients = (recipe.ingredients || "").replace(/["']/g, "");

      const prompt = `ROLE: Sei un Executive Chef Biochimico. TASK: Genera una procedura operativa tecnica step-by-step per la ricetta: "${cleanTitle}". INGREDIENTI RIFERIMENTO: "${cleanIngredients}". VINCOLO: NON chiedere le quantità. Ipotizza quantità standard per una singola porzione (es. 1 frutto medio, 2 uova, 30g grassi). OUTPUT: Restituisci SOLO la lista numerata dei passaggi di preparazione. Usa un tono tecnico, imperativo e sintetico.`;

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
      <ActivityIndicator size="large" color={ACCENT_BTN} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={ACCENT_BTN} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Ricetta</Text>
          <Text style={styles.headerSubtitle}>Dettaglio e ingredienti</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.heroSection}>
            <View style={styles.iconCircle}>
                {IconMap[recipe.category] || IconMap.default}
            </View>
            <Text style={styles.title}>{recipe.title}</Text>
        </View>

        <View style={styles.weightSelectorCard}>
            <View style={styles.weightHeader}>
                <Scale size={14} color={ACCENT_BTN} />
                <Text style={styles.weightLabel}>Grammatura (g)</Text>
            </View>
            <View style={styles.weightInputRow}>
                <TouchableOpacity onPress={() => setTargetGrams(Math.max(50, targetGrams - 50))} style={styles.weightBtn}><Minus size={20} color={ACCENT_BTN} /></TouchableOpacity>
                <TextInput 
                    style={styles.weightInput} 
                    keyboardType="numeric" 
                    value={targetGrams.toString()} 
                    onChangeText={(t) => setTargetGrams(Number(t) || 0)}
                />
                <TouchableOpacity onPress={() => setTargetGrams(targetGrams + 50)} style={styles.weightBtn}><Plus size={20} color={ACCENT_BTN} /></TouchableOpacity>
            </View>
        </View>

        {ingredientsList.length > 0 && (
            <View style={styles.ingredientsSection}>
              <Text style={styles.sectionHeader}>Ingredienti</Text>
              <View style={styles.ingredientsCard}>
                {ingredientsList.map((ingredient, index) => {
                  const dynamicLine = getDynamicIngredientLine(ingredient, targetGrams);
                  const isAdded = addedToCart.has(dynamicLine.trim());
                  return (
                    <View key={index} style={styles.ingredientRow}>
                      <Text style={styles.ingredientName} numberOfLines={2}>{dynamicLine}</Text>
                      <TouchableOpacity
                        style={[styles.cartBtn, isAdded && styles.cartBtnAdded]}
                        onPress={() => addToCart(dynamicLine)}
                        activeOpacity={0.7}
                      >
                        <ShoppingCart size={18} color={isAdded ? TEXT_SECONDARY : ACCENT_BTN} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
        )}

        {(recipe.instructions || recipe.description) && (
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionHeader}>Preparazione</Text>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsText}>
                {recipe.instructions || recipe.description}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.macroStrip}>
            <View style={styles.macroBox}>
                <Text style={styles.macroVal}>{Math.round(parseFloat(recipe.kcal_100g) * (targetGrams / 100))}</Text>
                <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroBox}>
                <Text style={[styles.macroVal, { color: RING_CARB }]}>{Math.round(parseFloat(recipe.carbs_100g) * (targetGrams / 100))}g</Text>
                <Text style={styles.macroLabel}>Carbo</Text>
            </View>
            <View style={styles.macroBox}>
                <Text style={[styles.macroVal, { color: RING_PROTEIN }]}>{Math.round(parseFloat(recipe.protein_100g) * (targetGrams / 100))}g</Text>
                <Text style={styles.macroLabel}>Prot</Text>
            </View>
            <View style={styles.macroBox}>
                <Text style={[styles.macroVal, { color: RING_FAT }]}>{Math.round(parseFloat(recipe.fat_100g) * (targetGrams / 100))}g</Text>
                <Text style={styles.macroLabel}>Grassi</Text>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionHeader}>Elaborazione AI</Text>
            
            {!aiProtocol ? (
                <TouchableOpacity 
                    style={styles.generateBtn} 
                    onPress={generateAIProtocol}
                    disabled={generating}
                >
                    {generating ? (
                        <ActivityIndicator color={CARD_BG} />
                    ) : (
                        <>
                            <Sparkles size={18} color={CARD_BG} />
                            <Text style={styles.generateBtnText}>Genera procedura ({targetGrams}g)</Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={styles.aiResultCard}>
                    <View style={styles.aiHeader}>
                        <Cpu size={14} color={ACCENT_BTN} />
                        <Text style={styles.aiLabel}>Protocollo generato</Text>
                    </View>
                    <Text style={styles.aiContent}>{aiProtocol}</Text>
                    <TouchableOpacity style={styles.resetAiBtn} onPress={() => setAiProtocol(null)}>
                        <RotateCcw size={14} color={TEXT_SECONDARY} />
                        <Text style={styles.resetAiText}>Rigenera</Text>
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
                <Text style={styles.fabTitle}>Registra nel diario</Text>
                <Text style={styles.fabSub}>{targetGrams}g</Text>
              </View>
              <Check size={24} color={CARD_BG} />
          </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 56, borderBottomWidth: 1, borderBottomColor: RING_TRACK },
  headerTitleBlock: { alignItems: 'center' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600', marginTop: 2 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  heroSection: { alignItems: 'center', marginTop: 28, marginBottom: 24 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: RING_TRACK, marginBottom: 20, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 } }) },
  title: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', textAlign: 'center', paddingHorizontal: 24 },
  weightSelectorCard: { backgroundColor: CARD_BG, marginHorizontal: 20, padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: RING_TRACK, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  weightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  weightLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  weightBtn: { width: 48, height: 48, backgroundColor: BG, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  weightInput: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '700', textAlign: 'center', minWidth: 80 },
  ingredientsSection: { paddingHorizontal: 20, marginBottom: 20 },
  ingredientsCard: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: RING_TRACK, borderRadius: 16, overflow: 'hidden', ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: RING_TRACK },
  ingredientName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', flex: 1, marginRight: 14 },
  cartBtn: { width: 44, height: 44, backgroundColor: BG, borderWidth: 1, borderColor: ACCENT_BTN, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cartBtnAdded: { borderColor: RING_TRACK, backgroundColor: BG },
  instructionsSection: { paddingHorizontal: 20, marginBottom: 20 },
  instructionsCard: { backgroundColor: CARD_BG, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: RING_TRACK, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  instructionsText: { color: TEXT_PRIMARY, fontSize: 14, lineHeight: 24 },
  macroStrip: { flexDirection: 'row', backgroundColor: BG, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: RING_TRACK, justifyContent: 'space-around' },
  macroBox: { alignItems: 'center' },
  macroVal: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  macroLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', marginTop: 4 },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionHeader: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600', marginBottom: 14 },
  generateBtn: { backgroundColor: ACCENT_BTN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 14, gap: 10 },
  generateBtnText: { color: CARD_BG, fontWeight: '600', fontSize: 15 },
  aiResultCard: { backgroundColor: CARD_BG, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: RING_TRACK },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  aiLabel: { color: ACCENT_BTN, fontSize: 12, fontWeight: '600' },
  aiContent: { color: TEXT_PRIMARY, fontSize: 14, lineHeight: 22 },
  resetAiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, alignSelf: 'flex-end' },
  resetAiText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  fabContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  fabButton: { backgroundColor: ACCENT_BTN, height: 64, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, ...Platform.select({ android: { elevation: 4 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 } }) },
  fabTitle: { color: CARD_BG, fontSize: 16, fontWeight: '600' },
  fabSub: { color: CARD_BG, fontSize: 12, fontWeight: '500', opacity: 0.9 },
});