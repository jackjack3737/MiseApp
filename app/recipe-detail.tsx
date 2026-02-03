import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, Dimensions, StatusBar, ActivityIndicator, Vibration, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { ArrowLeft, Clock, Flame, Play, Pause, RotateCcw, Activity, WheatOff, MilkOff, Check, Utensils, X, Plus, Minus, ShoppingCart } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const MEALS = ['Colazione', 'Pranzo', 'Cena', 'Snack'];

const getMealByTime = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Colazione';
    if (hour >= 11 && hour < 15) return 'Pranzo';
    if (hour >= 15 && hour < 19) return 'Snack';
    return 'Cena';
};

// --- SMART SCALER FUNCTION ---
const scaleIngredients = (text, multiplier) => {
    if (!text) return "";
    if (multiplier === 1) return text;

    return text.replace(/(\d+(?:[.,]\d+)?)\s*(g|ml|kg|l|oz|lb|cucchiai|cucchiaini|cm|mm)/gi, (match, number, unit) => {
        const originalValue = parseFloat(number.replace(',', '.'));
        const newValue = Math.round(originalValue * multiplier);
        return `${newValue}${unit}`; 
    });
};

// --- COMPONENTE TIMER ---
const StepTimer = ({ durationMinutes, label }) => {
  const totalSeconds = durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => { setTimeLeft((prev) => prev - 1); }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false); setIsFinished(true); Vibration.vibrate([0, 500, 200, 500]);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const formatTime = (s) => {
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
             <Clock size={16} color={isFinished ? "#00b894" : "#fab1a0"} />
             <Text style={[styles.timerLabel, isFinished && {color: '#00b894'}]}>
               {isFinished ? "COTTURA TERMINATA" : (label || "TIMER COTTURA")}
             </Text>
          </View>
          {isFinished && <Check size={18} color="#00b894" />}
      </View>
      <View style={styles.digitalDisplay}>
        <Text style={[styles.timerDigits, isFinished && {color:'#00b894'}]}>{formatTime(timeLeft)}</Text>
        <View style={styles.controlsRow}>
            {!isFinished && (
                <TouchableOpacity onPress={toggleTimer} style={[styles.controlBtn, isRunning ? styles.btnPause : styles.btnPlay]}>
                    {isRunning ? <Pause size={24} color="#000" /> : <Play size={24} color="#000" fill="#000" />}
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={resetTimer} style={styles.btnReset}>
                <RotateCcw size={20} color="#fff" />
            </TouchableOpacity>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${((totalSeconds - timeLeft) / totalSeconds) * 100}%`, backgroundColor: isFinished ? '#00b894' : '#fab1a0' }]} />
      </View>
    </View>
  );
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [recipe, setRecipe] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [selectedMeal, setSelectedMeal] = useState(getMealByTime());
  const [logging, setLogging] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [scaledDescription, setScaledDescription] = useState("");

  useEffect(() => { fetchRecipeDetails(); }, [id]);

  useEffect(() => {
    if (recipe?.description) {
        setScaledDescription(scaleIngredients(recipe.description, multiplier));
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
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleTrackMeal() {
    setLogging(true);
    try {
        const payload = {
            food_name: `${recipe.title} (${multiplier}x)`, 
            kcal: Math.round(recipe.kcal * multiplier),
            carbs: Math.round(recipe.carbs * multiplier),
            proteins: Math.round(recipe.proteins * multiplier),
            fats: Math.round(recipe.fats * multiplier),
            meal_type: selectedMeal, 
            date: new Date().toISOString().split('T')[0]
        };

        const { error } = await supabase.from('daily_logs').insert([payload]);

        if (error) throw error;

        setModalVisible(false);
        Alert.alert("Successo", "Pasto tracciato correttamente!");
        router.push('/(tabs)/tracker');

    } catch (error) {
        console.error("Errore salvataggio:", error);
        Alert.alert("Errore", `Impossibile salvare il pasto.`);
    } finally {
        setLogging(false);
    }
  }

  async function handleAddToShoppingList() {
  setAddingToCart(true);
  try {
    // Se il Miner ha fatto il suo lavoro, abbiamo già l'array pronto
    const list = recipe.ingredients_list; // Array di stringhe o oggetti dal DB

    if (!list || list.length === 0) {
      Alert.alert("Info", "Nessuna lista ingredienti strutturata trovata.");
      return;
    }

    const itemsToInsert = list.map((ingredient: string) => ({
      name: ingredient,
      category: recipe.title, 
      is_bought: false
    }));

    const { error } = await supabase.from('shopping_list').insert(itemsToInsert);

    if (error) throw error;
    Alert.alert("🛒 Carrello", "Tutti gli ingredienti sono stati aggiunti correttamente!");
  } catch (e) {
    Alert.alert("Errore", "Impossibile caricare la lista dal database.");
  } finally {
    setAddingToCart(false);
  }
}

  const adjustMultiplier = (delta) => {
      setMultiplier(prev => Math.max(0.25, prev + delta));
  };

  const renderBadges = (tags) => {
    if (!tags) return null;
    return (
      <View style={styles.badgesRow}>
        {tags.includes('GlutenFree') && <View style={[styles.badge, {borderColor: '#fab1a0'}]}><WheatOff size={12} color="#fab1a0"/><Text style={[styles.badgeText, {color:'#fab1a0'}]}>NO GLUTINE</Text></View>}
        {tags.includes('DairyFree') && <View style={[styles.badge, {borderColor: '#74b9ff'}]}><MilkOff size={12} color="#74b9ff"/><Text style={[styles.badgeText, {color:'#74b9ff'}]}>NO LATTOSIO</Text></View>}
        {tags.includes('LowCarb') && <View style={[styles.badge, {borderColor: '#0984e3'}]}><Activity size={12} color="#0984e3"/><Text style={[styles.badgeText, {color:'#0984e3'}]}>LOW CARB</Text></View>}
      </View>
    );
  };

  if (loading || !recipe) return <View style={styles.center}><ActivityIndicator size="large" color="#00cec9" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.imageContainer}>
            <Image source={{ uri: recipe.image_url }} style={styles.image} resizeMode="cover" />
            <View style={styles.darkOverlay} />
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#fff" /></TouchableOpacity>
            <View style={styles.headerContent}>
                {renderBadges(recipe.tags)}
                <Text style={styles.title}>{recipe.title}</Text>
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}><Clock size={16} color="#bdc3c7" /><Text style={styles.metaText}>{recipe.total_time} min</Text></View>
                    <View style={styles.metaItem}><Flame size={16} color="#e17055" /><Text style={styles.metaText}>{recipe.kcal} kcal</Text></View>
                </View>
            </View>
        </View>

        <View style={styles.macroStrip}>
            <View style={styles.macroItem}><Text style={[styles.macroVal, {color:'#fdcb6e'}]}>{Math.round(recipe.carbs * multiplier)}g</Text><Text style={styles.macroLabel}>CARBS</Text></View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}><Text style={[styles.macroVal, {color:'#74b9ff'}]}>{Math.round(recipe.proteins * multiplier)}g</Text><Text style={styles.macroLabel}>PRO</Text></View>
            <View style={styles.macroDivider} />
            <View style={styles.macroItem}><Text style={[styles.macroVal, {color:'#ff7675'}]}>{Math.round(recipe.fats * multiplier)}g</Text><Text style={styles.macroLabel}>FATS</Text></View>
        </View>

        <View style={styles.section}>
            <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>INGREDIENTI BASE</Text>
                <TouchableOpacity style={styles.cartBtnSmall} onPress={handleAddToShoppingList} disabled={addingToCart}>
                    {addingToCart ? <ActivityIndicator size="small" color="#00cec9" /> : <ShoppingCart size={20} color="#00cec9" />}
                </TouchableOpacity>
            </View>
            <View style={styles.ingredientsCard}>
                <Text style={styles.ingredientsText}>{recipe.description || "Nessuna descrizione."}</Text>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>GUIDA PASSO-PASSO</Text>
            {steps.map((step) => (
                <View key={step.id} style={styles.stepCard}>
                    <View style={styles.stepHeader}>
                        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step.step_number}</Text></View>
                        <Text style={styles.stepHeaderLabel}>FASE {step.step_number}</Text>
                        {step.tool && <View style={styles.toolBadge}><Text style={styles.toolText}>{step.tool.toUpperCase()}</Text></View>}
                    </View>
                    <Text style={styles.stepText}>{step.instruction}</Text>
                    {step.target_value && (step.action_type === 'TIMER' || step.action_type === 'timer' || step.action_type === 'COOK' || step.action_type === 'BAKE') && (
                        <StepTimer durationMinutes={step.target_value} label={step.tool || "Timer"} />
                    )}
                </View>
            ))}
        </View>

        {recipe.micronutrients && (
           <View style={styles.microBox}>
              <View style={{flexDirection:'row', alignItems:'center', gap: 5, marginBottom:5}}>
                 <Activity size={16} color="#00cec9" />
                 <Text style={styles.microTitle}>ANALISI BIOCHIMICA</Text>
              </View>
              <Text style={styles.microText}>
                  {typeof recipe.micronutrients === 'object' 
                    ? `Ricco di: ${recipe.micronutrients.minerals?.join(', ')}, ${recipe.micronutrients.vitamins?.join(', ')}.\nBenefici: ${recipe.micronutrients.benefits}`
                    : recipe.micronutrients}
              </Text>
           </View>
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fabButton} onPress={() => setModalVisible(true)} activeOpacity={0.9}>
              <View style={{alignItems:'flex-start'}}>
                <Text style={styles.fabTitle}>CUCINA E TRACCIA</Text>
                <Text style={styles.fabSub}>{Math.round(recipe.kcal * multiplier)} kcal • {selectedMeal}</Text>
              </View>
              <View style={styles.fabIconBox}><Utensils size={24} color="#000" /></View>
          </TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>CALCOLATORE</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#636e72" /></TouchableOpacity>
                </View>
                <Text style={styles.label}>QUANTO MANGI / CUCINI?</Text>
                <View style={styles.portionControl}>
                    <TouchableOpacity onPress={() => adjustMultiplier(-0.25)} style={styles.portionBtn}><Minus size={24} color="#fff" /></TouchableOpacity>
                    <View style={{alignItems:'center'}}>
                        <Text style={styles.portionValue}>{multiplier}x</Text>
                        <Text style={styles.portionLabel}>PORZIONI</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustMultiplier(0.25)} style={styles.portionBtn}><Plus size={24} color="#fff" /></TouchableOpacity>
                </View>
                <Text style={styles.label}>DOSI AGGIORNATE:</Text>
                <View style={styles.scaledIngredientsBox}>
                     <ScrollView nestedScrollEnabled style={{maxHeight: 120}}>
                        <Text style={styles.scaledText}>{scaledDescription}</Text>
                     </ScrollView>
                </View>
                <View style={styles.previewBox}>
                    <View style={styles.previewItem}><Text style={styles.previewVal}>{Math.round(recipe.kcal * multiplier)}</Text><Text style={styles.previewLabel}>KCAL</Text></View>
                    <View style={styles.previewItem}><Text style={styles.previewVal}>{Math.round(recipe.carbs * multiplier)}g</Text><Text style={styles.previewLabel}>CARB</Text></View>
                    <View style={styles.previewItem}><Text style={styles.previewVal}>{Math.round(recipe.proteins * multiplier)}g</Text><Text style={styles.previewLabel}>PRO</Text></View>
                    <View style={styles.previewItem}><Text style={styles.previewVal}>{Math.round(recipe.fats * multiplier)}g</Text><Text style={styles.previewLabel}>FAT</Text></View>
                </View>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleTrackMeal} disabled={logging}>
                    {logging ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>CONFERMA E TRACCIA</Text>}
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { height: 320, width: '100%', position: 'relative' },
  image: { width: '100%', height: '100%' },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  headerContent: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  badgeText: { fontSize: 10, fontWeight: '900' },
  metaRow: { flexDirection: 'row', gap: 15 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  macroStrip: { flexDirection: 'row', backgroundColor: '#1e1e1e', padding: 20, marginHorizontal: 20, borderRadius: 15, marginTop: -30, elevation: 5, justifyContent: 'space-around', borderWidth: 1, borderColor: '#333' },
  macroItem: { alignItems: 'center' },
  macroVal: { fontSize: 22, fontWeight: '900', color: '#fff' },
  macroLabel: { color: '#636e72', fontSize: 10, fontWeight: '800', marginTop: 2 },
  macroDivider: { width: 1, backgroundColor: '#333', height: '80%' },
  section: { padding: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cartBtnSmall: { padding: 10, backgroundColor: '#00cec915', borderRadius: 12, borderWidth: 1, borderColor: '#00cec9' },
  sectionTitle: { color: '#636e72', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  ingredientsCard: { backgroundColor: '#111', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  ingredientsText: { color: '#dfe6e9', fontSize: 15, lineHeight: 24 },
  stepCard: { backgroundColor: '#1e1e1e', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 10 },
  stepBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#00cec9', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  stepBadgeText: { color: '#000', fontWeight: '900', fontSize: 16 },
  stepHeaderLabel: { color: '#00cec9', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  toolBadge: { backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  toolText: { color: '#636e72', fontSize: 9, fontWeight: '900' },
  stepText: { color: '#fff', fontSize: 17, lineHeight: 26, fontWeight: '400' },
  timerContainer: { backgroundColor: '#111', borderRadius: 12, padding: 15, marginTop: 20, borderWidth: 1, borderColor: '#fab1a0' },
  timerFinished: { borderColor: '#00b894', backgroundColor: 'rgba(0, 184, 148, 0.05)' },
  timerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  timerLabel: { color: '#fab1a0', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  digitalDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerDigits: { color: '#fff', fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  controlsRow: { flexDirection: 'row', gap: 15 },
  controlBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  btnPlay: { backgroundColor: '#fab1a0' },
  btnPause: { backgroundColor: '#ffeaa7' },
  btnReset: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2d3436', justifyContent: 'center', alignItems: 'center' },
  progressBarBg: { height: 6, backgroundColor: '#222', borderRadius: 3, marginTop: 15, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  microBox: { margin: 20, marginTop: 10, padding: 20, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  microTitle: { color: '#00cec9', fontWeight: '900', fontSize: 12 },
  microText: { color: '#b2bec3', fontSize: 13, lineHeight: 20 },
  fabContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  fabButton: { backgroundColor: '#00cec9', height: 75, borderRadius: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, elevation: 10 },
  fabTitle: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  fabSub: { color: '#2d3436', fontSize: 12, fontWeight: '600' },
  fabIconBox: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1e1e', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: 600 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  label: { color: '#636e72', fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 1 },
  portionControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: 20, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  portionBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#2d3436', justifyContent: 'center', alignItems: 'center' },
  portionValue: { color: '#fff', fontSize: 32, fontWeight: '900' },
  portionLabel: { color: '#636e72', fontSize: 10, fontWeight: '700' },
  scaledIngredientsBox: { backgroundColor: '#111', borderRadius: 15, padding: 15, marginBottom: 30, borderWidth: 1, borderColor: '#00cec9' },
  scaledText: { color: '#00cec9', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  previewBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 15 },
  previewItem: { alignItems: 'center' },
  previewVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  previewLabel: { color: '#636e72', fontSize: 10, fontWeight: '700', marginTop: 2 },
  confirmBtn: { backgroundColor: '#00cec9', padding: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});