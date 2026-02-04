import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, StatusBar, ActivityIndicator, Vibration, Modal, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Clock, Flame, Play, Pause, RotateCcw, Check, Utensils, X, Plus, Minus, ShoppingCart, Zap, Biohazard, Beef, Fish, CookingPot, Leaf, Cookie } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// --- ICON MAP (Stessa di Explore) ---
const IconMap: any = {
  meat: <Beef size={40} color="#ff7675" />,
  fish: <Fish size={40} color="#74b9ff" />,
  eggs: <CookingPot size={40} color="#fdcb6e" />,
  veggies: <Leaf size={40} color="#55efc4" />,
  shake: <Zap size={40} color="#a29bfe" />,
  snack: <Cookie size={40} color="#fab1a0" />,
  default: <Utensils size={40} color="#00cec9" />
};

// --- HELPER RENDERING ---
const safeRender = (data: any) => {
    if (!data) return "";
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.join('\n• ');
    if (typeof data === 'object') {
        if (data.name) return `${data.quantity || ''} ${data.unit || ''} ${data.name}`;
        return data.instruction || data.description || JSON.stringify(data);
    }
    return String(data);
};

// --- SMART SCALER ---
const scaleIngredients = (text: string, multiplier: number) => {
    if (!text) return "";
    if (multiplier === 1) return text;
    return text.replace(/(\d+(?:[.,]\d+)?)\s*(g|ml|kg|l|oz|lb|cucchiai|cucchiaini|cm|mm|misurini)/gi, (match, number, unit) => {
        const originalValue = parseFloat(number.replace(',', '.'));
        const newValue = Math.round(originalValue * multiplier);
        return `${newValue} ${unit}`; 
    });
};

// --- COMPONENTE TIMER ---
const StepTimer = ({ durationMinutes, label }: any) => {
  const totalSeconds = durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => { setTimeLeft((prev: number) => prev - 1); }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false); setIsFinished(true); Vibration.vibrate([0, 500, 200, 500]);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const toggleTimer = () => { if (!isFinished) setIsRunning(!isRunning); };
  const resetTimer = () => { setIsRunning(false); setIsFinished(false); setTimeLeft(totalSeconds); };

  return (
    <View style={[styles.timerContainer, isFinished && styles.timerFinished]}>
      <View style={styles.timerHeaderRow}>
          <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
             <Clock size={16} color={isFinished ? "#00cec9" : "#fab1a0"} />
             <Text style={[styles.timerLabel, isFinished && {color: '#00cec9'}]}>
               {isFinished ? "OPERAZIONE COMPLETATA" : (label?.toUpperCase() || "TIMER")}
             </Text>
          </View>
          {isFinished ? <Check size={18} color="#00cec9" /> : null}
      </View>
      <View style={styles.digitalDisplay}>
        <Text style={[styles.timerDigits, isFinished && {color:'#00cec9'}]}>{formatTime(timeLeft)}</Text>
        <View style={styles.controlsRow}>
            {!isFinished ? (
                <TouchableOpacity onPress={toggleTimer} style={[styles.controlBtn, isRunning ? styles.btnPause : styles.btnPlay]}>
                    {isRunning ? <Pause size={24} color="#000" /> : <Play size={24} color="#000" fill="#000" />}
                </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={resetTimer} style={styles.btnReset}>
                <RotateCcw size={20} color="#fff" />
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [recipe, setRecipe] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [logging, setLogging] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [scaledDescription, setScaledDescription] = useState("");

  const [bioConflict, setBioConflict] = useState<string[]>([]);
  const [isFilterActive, setIsFilterActive] = useState(false);

  useEffect(() => { fetchRecipeDetails(); }, [id]);

  useEffect(() => {
    if (recipe?.ingredients_list) {
        const textList = Array.isArray(recipe.ingredients_list) ? recipe.ingredients_list.map(i => safeRender(i)).join('\n') : safeRender(recipe.ingredients_list);
        setScaledDescription(scaleIngredients(textList, multiplier));
    }
  }, [multiplier, recipe]);

  async function fetchRecipeDetails() {
    try {
      const { data: recipeData, error: recipeError } = await supabase.from('recipes').select('*').eq('id', id).single();
      if (recipeError) throw recipeError;
      const { data: stepsData, error: stepsError } = await supabase.from('steps').select('*').eq('recipe_id', id).order('step_number', { ascending: true });
      if (stepsError) throw stepsError;
      
      setRecipe(recipeData);
      setSteps(stepsData || []);
      checkBioCompatibility(recipeData);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function checkBioCompatibility(recipeData: any) {
    const profileJson = await AsyncStorage.getItem('@user_profile');
    const symptomJson = await AsyncStorage.getItem('@last_symptom_search');
    
    if (profileJson && symptomJson) {
      const profile = JSON.parse(profileJson);
      const symptom = JSON.parse(symptomJson);
      
      if (profile.isFilterActive && symptom.forbidden_foods) {
        setIsFilterActive(true);
        const ingredientsText = JSON.stringify(recipeData.ingredients_list).toLowerCase();
        const conflicts = symptom.forbidden_foods.filter((food: string) => 
          ingredientsText.includes(food.toLowerCase())
        );
        setBioConflict(conflicts);
      }
    }
  }

  async function handleTrackMeal() {
    setLogging(true);
    try {
        const newLog = {
            id: Date.now().toString(),
            food_name: recipe.title, 
            kcal: Math.round(recipe.kcal * multiplier),
            carbs: Math.round(recipe.carbs * multiplier),
            proteins: Math.round(recipe.proteins * multiplier),
            fats: Math.round(recipe.fats * multiplier),
            date: new Date().toISOString().split('T')[0],
            meal_type: 'Pranzo',
            recipe_id: recipe.id 
        };

        const existingLogsJson = await AsyncStorage.getItem('@user_daily_logs');
        const existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
        const updatedLogs = [newLog, ...existingLogs];
        await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updatedLogs));

        setModalVisible(false);
        Alert.alert("🔥 Bio-Hack Logged", "Dati salvati localmente nel tracker.");
        router.push('/(tabs)/tracker');
    } catch (error) {
        Alert.alert("Errore", "Impossibile salvare il pasto localmente.");
    } finally { setLogging(false); }
  }

  async function handleAddToShoppingList() {
    setAddingToCart(true);
    try {
      let list: any[] = [];
      const rawData = recipe.ingredients_list;
      
      if (Array.isArray(rawData)) {
          list = rawData;
      } else if (typeof rawData === 'string') {
        try {
          if (rawData.trim().startsWith('[')) list = JSON.parse(rawData);
          else list = rawData.split(/\n|,/).map(s => s.trim()).filter(s => s.length > 0);
        } catch (e) { list = [rawData]; }
      }

      if (!list || list.length === 0) {
        Alert.alert("Attenzione", "Nessun ingrediente trovato.");
        setAddingToCart(false); return;
      }

      const { data: partnerProducts } = await supabase.from('partner_products').select('product_name, shop_url, keywords');

      const newItems = list.map((ingredient) => {
        const ingredientString = safeRender(ingredient).replace(/["'[\]]/g, '').trim();
        const ingredientLower = ingredientString.toLowerCase();
        
        const partnerMatch = partnerProducts?.find((p: any) => {
            const keys = p.keywords || [p.product_name];
            return keys.some((key: string) => ingredientLower.includes(key.toLowerCase()));
        });

        return {
            id: Date.now() + Math.random().toString(),
            name: ingredientString,
            category: recipe.title,
            is_bought: false,
            product_url: partnerMatch ? partnerMatch.shop_url : null,
            created_at: new Date().toISOString()
        };
      });

      const existingListJson = await AsyncStorage.getItem('@user_shopping_list');
      let existingList = existingListJson ? JSON.parse(existingListJson) : [];
      await AsyncStorage.setItem('@user_shopping_list', JSON.stringify([...newItems, ...existingList]));
      
      Vibration.vibrate(100);
      Alert.alert("🛒 Carrello Aggiornato", `Aggiunti ${newItems.length} ingredienti per "${recipe.title}"`);
    
    } catch (e) { Alert.alert("Errore", "Impossibile salvare nel carrello."); }
    finally { setAddingToCart(false); }
  }

  if (loading || !recipe) return <View style={styles.center}><ActivityIndicator size="large" color="#00cec9" /></View>;

  const RecipeIcon = IconMap[recipe.category_icon] || IconMap.default;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DETTAGLIO BIO-HACK</Text>
        <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        
        {/* --- HEADER ICONA --- */}
        <View style={styles.iconHeaderContainer}>
            <View style={styles.bigIconCircle}>
                {/* Visualizziamo l'icona ingrandita */}
                {React.cloneElement(RecipeIcon, { size: 60, color: '#000' })} 
            </View>
            
            <View style={styles.headerTextGroup}>
                <Text style={styles.title}>{recipe.title}</Text>
                
                {recipe.tags?.includes('LiveBetter') && (
                    <View style={styles.badge}>
                        <Zap size={10} color="#00cec9" fill="#00cec9"/>
                        <Text style={styles.badgeText}>LIVE BETTER APPROVED</Text>
                    </View>
                )}

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}><Clock size={14} color="#636e72" /><Text style={styles.metaText}>{recipe.total_time} min</Text></View>
                    <View style={styles.metaItem}><Flame size={14} color="#00cec9" /><Text style={[styles.metaText, {color: '#00cec9'}]}>{recipe.kcal} kcal</Text></View>
                </View>
            </View>
        </View>

        {/* ⚠️ BIO-SCANNER ALERT */}
        {isFilterActive && bioConflict.length > 0 && (
          <View style={styles.bioAlertBanner}>
            <Biohazard size={20} color="#fff" />
            <View style={{flex: 1}}>
              <Text style={styles.bioAlertTitle}>CONFLITTO BIOLOGICO RILEVATO</Text>
              <Text style={styles.bioAlertSub}>Contiene: {bioConflict.join(', ')}. Sconsigliato.</Text>
            </View>
          </View>
        )}

        <View style={styles.macroStrip}>
            <View style={styles.macroItem}><Text style={[styles.macroVal, {color:'#fdcb6e'}]}>{Math.round(recipe.carbs * multiplier)}g</Text><Text style={styles.macroLabel}>CARBS</Text></View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}><Text style={[styles.macroVal, {color:'#74b9ff'}]}>{Math.round(recipe.proteins * multiplier)}g</Text><Text style={styles.macroLabel}>PRO</Text></View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}><Text style={[styles.macroVal, {color:'#ff7675'}]}>{Math.round(recipe.fats * multiplier)}g</Text><Text style={styles.macroLabel}>FATS</Text></View>
        </View>

        {/* SEZIONE MICRONUTRIENTI */}
        {recipe.micronutrients && recipe.micronutrients.vitamins && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BIO-DENSITÀ NUTRIZIONALE</Text>
            <View style={styles.microGrid}>
              {recipe.micronutrients.vitamins?.map((v: string) => (
                <View key={v} style={styles.microBadge}><Text style={styles.microText}>VIT {v}</Text></View>
              ))}
              {recipe.micronutrients.minerals?.map((m: string) => (
                <View key={m} style={[styles.microBadge, {borderColor: '#fab1a0'}]}><Text style={[styles.microText, {color: '#fab1a0'}]}>{m.toUpperCase()}</Text></View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
            <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>INGREDIENTI E DOSI</Text>
                
                <TouchableOpacity 
                    style={styles.cartBtnLarge} 
                    onPress={handleAddToShoppingList} 
                    disabled={addingToCart}
                    activeOpacity={0.7}
                >
                    {addingToCart ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <>
                            <ShoppingCart size={16} color="#000" />
                            <Text style={styles.cartBtnText}>AGGIUNGI AL CARRELLO</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
            
            <View style={styles.ingredientsCard}>
                <Text style={styles.ingredientsText}>
                    {Array.isArray(recipe.ingredients_list) 
                      ? recipe.ingredients_list.map((i: any) => `• ${safeRender(i)}`).join('\n')
                      : safeRender(recipe.ingredients_list)}
                </Text>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROTOCOLLO DI PREPARAZIONE</Text>
            {steps.map((step) => (
                <View key={step.id} style={styles.stepCard}>
                    <View style={styles.stepHeader}>
                        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step.step_number}</Text></View>
                        <Text style={styles.stepHeaderLabel}>FASE {step.step_number}</Text>
                        {step.tool && step.tool !== 'plate' ? (
                          <View style={styles.toolBadge}><Text style={styles.toolText}>{safeRender(step.tool).toUpperCase()}</Text></View>
                        ) : null}
                    </View>
                    <Text style={styles.stepText}>{safeRender(step.instruction)}</Text>
                    {step.target_value && (step.action_type === 'TIMER' || step.action_type === 'COOK' || step.action_type === 'BAKE') ? (
                        <StepTimer durationMinutes={step.target_value} label={step.tool || "Timer"} />
                    ) : null}
                </View>
            ))}
        </View>
      </ScrollView>

      <View style={styles.fabContainer}>
          <TouchableOpacity 
            style={[styles.fabButton, bioConflict.length > 0 && {backgroundColor: '#2d3436'}]} 
            onPress={() => setModalVisible(true)} 
            activeOpacity={0.9}
          >
              <View>
                <Text style={styles.fabTitle}>CUCINA E TRACCIA</Text>
                <Text style={styles.fabSub}>
                  {bioConflict.length > 0 ? "⚠️ SCONSIGLIATA" : "✅ COMPATIBILE BIOLOGICA"}
                </Text>
              </View>
              <View style={styles.fabIconBox}><Utensils size={22} color="#000" /></View>
          </TouchableOpacity>
      </View>

      {/* MODAL SCALER */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>SCALATORE PORZIONI</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#636e72" /></TouchableOpacity>
                </View>
                <View style={styles.portionControl}>
                    <TouchableOpacity onPress={() => setMultiplier(Math.max(0.5, multiplier - 0.5))} style={styles.portionBtn}><Minus size={24} color="#fff" /></TouchableOpacity>
                    <View style={{alignItems:'center'}}>
                        <Text style={styles.portionValue}>{multiplier}x</Text>
                        <Text style={styles.portionLabel}>MOLTIPLICATORE</Text>
                    </View>
                    <TouchableOpacity onPress={() => setMultiplier(multiplier + 0.5)} style={styles.portionBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
                </View>
                <View style={styles.scaledIngredientsBox}>
                    <ScrollView style={{maxHeight: 200}}>
                        <Text style={styles.scaledText}>{scaledDescription}</Text>
                    </ScrollView>
                </View>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleTrackMeal} disabled={logging}>
                    {logging ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>LOG NEL TRACKER</Text>}
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  headerTitle: { color: '#636e72', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },

  // --- NUOVO HEADER ---
  iconHeaderContainer: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  bigIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#00cec9', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 10, shadowColor: '#00cec9', shadowOpacity: 0.4, shadowRadius: 10 },
  headerTextGroup: { alignItems: 'center', paddingHorizontal: 30 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 10, lineHeight: 32 },
  
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00cec910', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#00cec950', marginBottom: 15 },
  badgeText: { color: '#00cec9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  metaRow: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#bdc3c7', fontWeight: '800', fontSize: 14 },

  bioAlertBanner: { backgroundColor: '#ff7675', flexDirection: 'row', padding: 15, alignItems: 'center', gap: 15, marginHorizontal: 20, borderRadius: 15, marginBottom: 20 },
  bioAlertTitle: { color: '#fff', fontSize: 12, fontWeight: '900' },
  bioAlertSub: { color: '#fff', fontSize: 10, fontWeight: '600', opacity: 0.9 },
  
  macroStrip: { flexDirection: 'row', backgroundColor: '#111', padding: 18, marginHorizontal: 25, borderRadius: 25, marginBottom: 20, justifyContent: 'space-around', borderWidth: 1, borderColor: '#222' },
  macroItem: { alignItems: 'center' },
  macroVal: { fontSize: 20, fontWeight: '900' },
  macroLabel: { color: '#636e72', fontSize: 9, fontWeight: '900', marginTop: 4 },
  macroDivider: { width: 1, backgroundColor: '#222', height: '60%', alignSelf:'center' },
  
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  microBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#00cec9' },
  microText: { color: '#00cec9', fontSize: 10, fontWeight: '900' },
  
  section: { paddingHorizontal: 25, marginTop: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  
  cartBtnLarge: { backgroundColor: '#00cec9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, gap: 8, shadowColor: '#00cec9', shadowOpacity: 0.3, shadowRadius: 5 },
  cartBtnText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  sectionTitle: { color: '#636e72', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  ingredientsCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a1a' },
  ingredientsText: { color: '#dfe6e9', fontSize: 16, lineHeight: 26, fontWeight: '500' },
  
  stepCard: { backgroundColor: '#111', borderRadius: 25, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  stepBadge: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#00cec9', justifyContent: 'center', alignItems: 'center' },
  stepBadgeText: { color: '#000', fontWeight: '900', fontSize: 14 },
  stepHeaderLabel: { color: '#00cec9', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  toolBadge: { backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#333' },
  toolText: { color: '#636e72', fontSize: 9, fontWeight: '900' },
  stepText: { color: '#fff', fontSize: 16, lineHeight: 26, fontWeight: '400' },
  
  timerContainer: { backgroundColor: '#050505', borderRadius: 20, padding: 15, marginTop: 15, borderWidth: 1, borderColor: '#fab1a0' },
  timerFinished: { borderColor: '#00cec9' },
  timerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  timerLabel: { color: '#fab1a0', fontWeight: '900', fontSize: 11 },
  digitalDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerDigits: { color: '#fff', fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  controlsRow: { flexDirection: 'row', gap: 10 },
  controlBtn: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fab1a0' },
  btnReset: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  btnPause: { backgroundColor: '#fab1a0' },
  btnPlay: { backgroundColor: '#fab1a0' },
  
  fabContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 20, left: 20, right: 20 },
  fabButton: { backgroundColor: '#00cec9', height: 75, borderRadius: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, elevation: 10, shadowColor: '#00cec9', shadowOpacity: 0.3, shadowRadius: 10 },
  fabTitle: { color: '#000', fontSize: 18, fontWeight: '900' },
  fabSub: { color: '#000', fontSize: 12, fontWeight: '600', opacity: 0.7 },
  fabIconBox: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, minHeight: 500 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  portionControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#000', borderRadius: 25, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  portionBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  portionValue: { color: '#fff', fontSize: 36, fontWeight: '900' },
  portionLabel: { color: '#636e72', fontSize: 10, fontWeight: '800' },
  scaledIngredientsBox: { backgroundColor: '#00cec905', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: '#00cec920' },
  scaledText: { color: '#00cec9', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#00cec9', height: 70, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '900' },
});