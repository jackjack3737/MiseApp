import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Beef, Camera, Clock, Cookie, CookingPot, Cpu, Dumbbell, Fish, Flame, Footprints, Leaf, Mic, Minus, Moon, Plus, Trash2, X, Zap } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Linking, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getFoodFromAI } from '../../utils/gemini-cache';
import { OpenFoodFactsProduct, searchOpenFoodFacts } from '../../utils/openfoodfacts';

import MetabolicReactor from '../../components/MetabolicReactor';
import QuickAddMeal, { analyzeMeal, type FoodItem } from '../../components/QuickAddMeal';
import SmartHint from '../../components/SmartHint';
import { DS, RADIUS, SPACE } from '../../constants/designSystem';
import { getWorkoutMultiplier } from '../../constants/workoutTypes';
import useAnabolicAlgorithm from '../../hooks/useAnabolicAlgorithm';
import useHealthConnect from '../../hooks/useHealthConnect';
import { estimateKetones as calculateEstimatedKetones, KETONE_ESTIMATE_EXPLANATION } from '../../utils/ketones';
import { calculateMetabolicReactor } from '../../utils/smart-algorithm';

const BG = DS.bg;
const TEXT_PRIMARY = DS.text;
const TEXT_SECONDARY = DS.textMuted;
const CARD_BG = DS.surface;
const RING_CARB = DS.carb;
const RING_PROTEIN = DS.protein;
const RING_FAT = DS.fat;
const RING_TRACK = DS.border;
const ACCENT_MIC = DS.accent;
const ACCENT_BTN = DS.accent;
const MEALS = ['Colazione', 'Pranzo', 'Cena', 'Snack'];
const RED_ALERT = DS.alert;
const NEAT_ORANGE = DS.warning;

const HEADER_BG = DS.bg;
const HEADER_ACCENT = DS.accent;
const HEADER_TEXT = DS.text;

const getCurrentTimeString = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Data locale YYYY-MM-DD (non UTC), così dopo mezzanotte si vedono i pasti di oggi. */
const getTodayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getYesterdayLocal = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const IconMap: any = {
  meat: <Beef size={18} color={TEXT_SECONDARY} />,
  fish: <Fish size={18} color={TEXT_SECONDARY} />,
  eggs: <CookingPot size={18} color={TEXT_SECONDARY} />,
  veggies: <Leaf size={18} color={TEXT_SECONDARY} />,
  shake: <Zap size={18} color={TEXT_SECONDARY} />,
  snack: <Cookie size={18} color={TEXT_SECONDARY} />,
  default: <Cpu size={18} color={TEXT_SECONDARY} />
};

const formatSleepHours = (value: number): string => {
  const h = Math.floor(value);
  const m = Math.round((value % 1) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const KETONE_GREY = TEXT_SECONDARY;
const KETONE_BLUE = '#2563EB';
const KETONE_EMERALD = '#059669';
const KETONE_VIOLET = '#7C3AED';

const getKetoneFeedback = (value: number): { label: string; color: string; bg: string } => {
  if (value < 0.5) return { label: 'Glicolisi (Brucia Zuccheri)', color: KETONE_GREY, bg: DS.surfaceElevated };
  if (value < 1.0) return { label: 'Light Ketosis (Inizio adattamento)', color: KETONE_BLUE, bg: DS.surfaceElevated };
  if (value <= 3.0) return { label: 'Optimal Ketosis (Zona brucia-grassi massima)', color: KETONE_EMERALD, bg: DS.accentDim };
  return { label: 'Deep Ketosis (Digiuno profondo/Autofagia)', color: KETONE_VIOLET, bg: DS.surfaceElevated };
};

// --- HEADER: barre che si riempiono (P/C/F) + chip Chetosi + sensori (sonno, passi, attività) ---
const BAR_HEIGHT = 100;
const getPct = (val: number, max: number) => Math.min((val / (max || 1)) * 100, 100);

const BarsHeader = ({
  totals,
  targets,
  limitC,
  estimatedKetones,
  sleepHours,
  bmrBurnedSoFar,
  neatKcal,
  sportKcal,
  steps,
  proteinBoostMessage,
  onPressP,
  onPressC,
  onPressF,
  onPressKetone,
}: {
  totals: { c: number; p: number; f: number; kcal: number };
  targets: { c: number; p: number; f: number };
  limitC: number;
  estimatedKetones: number;
  sleepHours: number;
  bmrBurnedSoFar: number;
  neatKcal: number;
  sportKcal: number;
  steps: number;
  proteinBoostMessage?: string | null;
  onPressP?: () => void;
  onPressC?: () => void;
  onPressF?: () => void;
  onPressKetone?: () => void;
}) => {
  const effectiveC = limitC || targets.c;
  const carbPct = getPct(totals.c, effectiveC);
  const proPct = getPct(totals.p, targets.p);
  const fatPct = getPct(totals.f, targets.f);
  const kcalAssunte = Math.round((totals.p * 4) + (totals.c * 4) + (totals.f * 9));
  const totalBurned = bmrBurnedSoFar + neatKcal + sportKcal;
  const bilancioNetto = kcalAssunte - totalBurned;
  const sleepDisplay = sleepHours > 0 ? (sleepHours % 1 === 0 ? `${Math.round(sleepHours)}h` : `${sleepHours.toFixed(1)}h`) : '--';
  const ketoneFeedback = getKetoneFeedback(estimatedKetones);
  const ketoneValueStr = estimatedKetones.toFixed(1);
  const stepsFormatted = (steps || 0).toLocaleString('it-IT') + ' passi';
  return (
    <View style={styles.headerCard}>
      <TouchableOpacity style={[styles.ketoneChip, { backgroundColor: ketoneFeedback.bg }]} onPress={onPressKetone} activeOpacity={0.8}>
        <Text style={styles.ketoneChipTitle}>Stima chetoni</Text>
        <Text style={[styles.ketoneChipValue, { color: ketoneFeedback.color }]}>{ketoneValueStr}</Text>
        <Text style={[styles.ketoneChipLabel, { color: ketoneFeedback.color }]}>{ketoneFeedback.label}</Text>
      </TouchableOpacity>
      <View style={styles.barsRow}>
        <TouchableOpacity style={styles.barWrap} onPress={onPressP} activeOpacity={0.8} disabled={!onPressP}>
          <View style={styles.barLabelRow}>
            <Text style={[styles.barLabel, { color: RING_PROTEIN }]}>P</Text>
            <Text style={styles.barLabelFull}>Proteine</Text>
            {proteinBoostMessage ? <Text style={styles.proteinBoostBadge} numberOfLines={1}>{proteinBoostMessage}</Text> : null}
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${proPct}%`, backgroundColor: RING_PROTEIN }]} />
          </View>
          <Text style={styles.barVal}>{totals.p}<Text style={styles.barValLimit}>/{targets.p}</Text></Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barWrap} onPress={onPressC} activeOpacity={0.8} disabled={!onPressC}>
          <View style={styles.barLabelRow}>
            <Text style={[styles.barLabel, { color: RING_CARB }]}>C</Text>
            <Text style={styles.barLabelFull}>Carboidrati</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${carbPct}%`, backgroundColor: RING_CARB }]} />
          </View>
          <Text style={styles.barVal}>{totals.c}<Text style={styles.barValLimit}>/{effectiveC}</Text></Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barWrap} onPress={onPressF} activeOpacity={0.8} disabled={!onPressF}>
          <View style={styles.barLabelRow}>
            <Text style={[styles.barLabel, { color: RING_FAT }]}>F</Text>
            <Text style={styles.barLabelFull}>Grassi</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${fatPct}%`, backgroundColor: RING_FAT }]} />
          </View>
          <Text style={styles.barVal}>{totals.f}<Text style={styles.barValLimit}>/{targets.f}</Text></Text>
        </TouchableOpacity>
      </View>
      {/* The Bio Row: Sonno | NEAT | Sport */}
      <View style={styles.bioRow}>
        <View style={styles.bioCard}>
          <Moon size={20} color={sleepHours < 6 ? RED_ALERT : TEXT_SECONDARY} style={styles.bioIcon} />
          <Text style={[styles.bioValue, sleepHours < 6 && { color: RED_ALERT }]}>{sleepDisplay}</Text>
          <Text style={styles.bioLabel}>Sonno</Text>
        </View>
        <View style={styles.bioCard}>
          <Flame size={20} color={NEAT_ORANGE} style={styles.bioIcon} />
          <Text style={styles.bioLabel}>Bruciate oggi</Text>
          <Text style={styles.bioValue}>{totalBurned} kcal</Text>
          <View style={styles.bioStepsRow}>
            <Footprints size={14} color={TEXT_SECONDARY} />
            <Text style={styles.bioStepsText}>{stepsFormatted}</Text>
          </View>
        </View>
        <View style={styles.bioCard}>
          <Dumbbell size={20} color={ACCENT_BTN} style={styles.bioIcon} />
          <Text style={styles.bioValue}>{sportKcal > 0 ? `${sportKcal} kcal` : '--'}</Text>
          <Text style={styles.bioLabel}>Allenamento</Text>
        </View>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Bilancio</Text>
        <Text style={[styles.balanceVal, { color: bilancioNetto <= 0 ? '#059669' : TEXT_PRIMARY }]}>{bilancioNetto} kcal</Text>
      </View>
    </View>
  );
};

export default function TrackerScreen() {
  // --- HOOK INTEGRATO (ANTI-CRASH) ---
  const { steps, calories, sleepHours, weight: healthWeight, lastWorkoutType, refresh, connect, error } = useHealthConnect();

  const healthData = {
      steps: steps || 0,
      calories: calories || 0,
      sleep: sleepHours || 0
  };

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('Pranzo');

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event: { results: { transcript?: string }[] }) => {
    const t = event.results?.[0]?.transcript?.trim();
    if (t) setInputText(t);
  });
  useSpeechRecognitionEvent('error', (event: { error: string; message?: string }) => {
    setIsListening(false);
    if (event.error !== 'aborted' && event.error !== 'no-speech')
      Alert.alert('Voce', event.message || 'Errore riconoscimento vocale.');
  });
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [targets, setTargets] = useState({ kcal: 2000, c: 25, p: 100, f: 150, protocol: 'Keto' });
  const [userBMR, setUserBMR] = useState(1500); // BMR giornaliero (default 1500)
  const [refreshing, setRefreshing] = useState(false);
  const [symptomFactor, setSymptomFactor] = useState({ factor: 1.0, name: '' });
  const [yesterdayCarbs, setYesterdayCarbs] = useState(0);
  const [profileWeight, setProfileWeight] = useState<number | undefined>(undefined);
  const [profileHeight, setProfileHeight] = useState<number | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempFood, setTempFood] = useState<any>(null);
  const [currentWeight, setCurrentWeight] = useState(100);
  const [suggestions, setSuggestions] = useState<OpenFoodFactsProduct[]>([]);
  const [quickAddItems, setQuickAddItems] = useState<FoodItem[]>([]);
  const [quickAddAnalyzing, setQuickAddAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [yesterdayLastMealTime, setYesterdayLastMealTime] = useState<string | null>(null);
  const [timeEditVisible, setTimeEditVisible] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState({ h: 12, m: 0 });
  const router = useRouter();

  const clearLocalCache = async () => {
    try { await AsyncStorage.removeItem('gemini_cache'); } catch (e) {}
  };

  const loadData = async () => {
    try {
        const savedProfile = await AsyncStorage.getItem('@user_profile');
        if (savedProfile) {
            const p = JSON.parse(savedProfile);
            setTargets({
                kcal: parseInt(p.targetCalories) || 2000,
                c: parseInt(p.targetCarbs ?? p.carbs) || 25,
                p: parseInt(p.protein) || 100,
                f: parseInt(p.fat) || 150,
                protocol: p.protocol || 'Keto'
            });
            // BMR Harris-Benedict rivisitata (come in Profile) per Real-Time TDEE
            const w = parseFloat(p.weight) || 70;
            const h = parseFloat(p.height) || 170;
            setProfileWeight(w);
            setProfileHeight(h);
            const age = parseInt(p.age) || 30;
            const gender = p.gender === 'male' || p.gender === 'female' ? p.gender : 'male';
            const bmr = (10 * w) + (6.25 * h) - (5 * age) + (gender === 'male' ? 5 : -161);
            setUserBMR(Math.round(Math.max(800, bmr)));
        } else {
            setTargets({ kcal: 2000, c: 25, p: 100, f: 150, protocol: 'Keto' });
            setUserBMR(1500);
            setProfileWeight(undefined);
            setProfileHeight(undefined);
        }
        
        const symptomRaw = await AsyncStorage.getItem('@user_daily_symptom_factor');
        const today = getTodayLocal();
        const yesterday = getYesterdayLocal();
        let symptomFactorValue = { factor: 1.0, name: '' };
        if (symptomRaw) {
          try {
            const parsed = JSON.parse(symptomRaw);
            if (parsed.date === today && parsed.factor != null) {
              symptomFactorValue = { factor: parsed.factor, name: parsed.name || '' };
            } else {
              await AsyncStorage.removeItem('@user_daily_symptom_factor');
            }
          } catch (_) {
            await AsyncStorage.removeItem('@user_daily_symptom_factor');
          }
        }
        setSymptomFactor(symptomFactorValue);

        const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
        if (savedLogs) {
            const allLogs = JSON.parse(savedLogs);

            const todayLogs = allLogs.filter((log: any) => log.date === today);
            setLogs(todayLogs.sort((a: any, b: any) => Number(b.id) - Number(a.id)));
            calculateTotals(todayLogs);

            const yesterdayLogs = allLogs.filter((log: any) => log.date === yesterday);
            const yCarbs = yesterdayLogs.reduce((acc: number, item: any) => acc + (item.carbs || 0), 0);
            setYesterdayCarbs(yCarbs);
            const withTime = yesterdayLogs.filter((l: any) => l.time && /^\d{1,2}:\d{2}$/.test(l.time));
            const last = withTime.length ? withTime.reduce((best: any, l: any) => {
              const [h, m] = l.time.split(':').map(Number);
              const [bh, bm] = (best.time || '00:00').split(':').map(Number);
              return h * 60 + m >= bh * 60 + bm ? l : best;
            }) : null;
            setYesterdayLastMealTime(last ? last.time : null);
        }
    } catch (_) { /* load error */ }
  };

  const calculateTotals = (data: any[]) => {
    const totals = data.reduce((acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        c: acc.c + (item.carbs || 0),
        p: acc.p + (item.proteins || 0),
        f: acc.f + (item.fats || 0),
    }), { kcal: 0, c: 0, p: 0, f: 0 });
    setTodayTotals(totals);
  };

  const getFastingHours = useCallback((todayLogs: any[], lastYesterdayTime: string | null): number => {
      const now = new Date();
      const withTime = (todayLogs || []).filter((l: any) => l.time && /^\d{1,2}:\d{2}$/.test(l.time));
      if (withTime.length > 0) {
          const latest = withTime.reduce((best: any, l: any) => {
              const [h, m] = l.time.split(':').map(Number);
              const mins = h * 60 + m;
              const [bh, bm] = (best.time || '00:00').split(':').map(Number);
              return mins > bh * 60 + bm ? l : best;
          });
          const [h, m] = latest.time.split(':').map(Number);
          const lastMeal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
          const diffMs = now.getTime() - lastMeal.getTime();
          return Math.max(0, diffMs / (1000 * 60 * 60));
      }
      if (lastYesterdayTime) {
          const [h, m] = lastYesterdayTime.split(':').map(Number);
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(h, m, 0, 0);
          return Math.max(0, (now.getTime() - yesterday.getTime()) / (1000 * 60 * 60));
      }
      return 0;
  }, []);

  useFocusEffect(useCallback(() => { 
    loadData(); 
    refresh(); 
  }, [refresh]));

  const onRefresh = async () => { 
    setRefreshing(true); 
    await clearLocalCache(); 
    await loadData(); 
    refresh(); 
    setRefreshing(false); 
  };

  const safeParse = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
      return 0;
  };

  const searchQueryRef = React.useRef('');
  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    if (text.length <= 2) {
      setSuggestions([]);
      return;
    }
    searchQueryRef.current = text;
    searchOpenFoodFacts(text).then((list) => {
      if (searchQueryRef.current === text) setSuggestions(list);
    });
  }, []);

  const selectSuggestion = useCallback((product: OpenFoodFactsProduct) => {
    const displayName = product.brand ? `${product.brand} - ${product.name}` : product.name;
    const n = product.nutriments;
    setTempFood({
      name: displayName,
      kcal: n.kcal,
      c: n.carbs,
      p: n.proteins,
      f: n.fat,
      weight_g: 100,
      category_icon: 'snack',
    });
    setCurrentWeight(100);
    setSuggestions([]);
    setInputText('');
    setModalVisible(true);
    Keyboard.dismiss();
  }, []);

  async function startListening() {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const requestPermission = Platform.OS === 'android'
      ? () => ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()
      : () => ExpoSpeechRecognitionModule.requestPermissionsAsync();
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Permesso microfono',
        'Per dettare il pasto a voce è necessario consentire l\'accesso al microfono. Puoi attivarlo dalle Impostazioni dell\'app.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Apri impostazioni', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'it-IT',
        interimResults: true,
        continuous: false,
      });
    } catch (e) {
      setIsListening(false);
      Alert.alert('Voce', 'Riconoscimento vocale non disponibile su questo dispositivo.');
    }
  }

  const pickImage = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permesso fotocamera',
          'Per scattare una foto del pasto è necessario consentire l\'accesso alla fotocamera.',
          [{ text: 'OK' }, { text: 'Impostazioni', onPress: () => Linking.openSettings() }]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setSelectedImage(result.assets[0].base64);
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permesso galleria',
          'Per analizzare una foto del pasto è necessario consentire l\'accesso alla galleria.',
          [{ text: 'OK' }, { text: 'Impostazioni', onPress: () => Linking.openSettings() }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setSelectedImage(result.assets[0].base64);
      }
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert('Foto del pasto', 'Scegli come aggiungere l\'immagine', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Fotocamera', onPress: () => pickImage('camera') },
      { text: 'Galleria', onPress: () => pickImage('library') },
    ]);
  };

  async function runQuickAdd() {
    const phrase = inputText.trim();
    if (!phrase) return;
    setQuickAddAnalyzing(true);
    try {
      const analyzed = await analyzeMeal(phrase);
      const newItems: FoodItem[] = analyzed.map((a, i) => ({
        id: `meal-${Date.now()}-${i}`,
        name: a.name,
        grams: a.grams,
        macrosPer100: a.macros,
      }));
      setQuickAddItems(newItems);
    } finally {
      setQuickAddAnalyzing(false);
    }
  }

  async function searchFood() {
    const phrase = inputText.trim();
    const hasImage = Boolean(selectedImage);
    if (!phrase && !hasImage) return;
    setLoading(true);
    Keyboard.dismiss();
    const queryForAI = phrase || 'Analizza questa foto di un pasto: descrivi il piatto e stima peso in grammi e macro (kcal, proteine, carboidrati, grassi) per la porzione visibile.';
    try {
        const response = await getFoodFromAI(queryForAI, selectedImage);
        let data = (typeof response === 'string')
            ? { food_name: queryForAI, kcal: 0, carbs: 0, proteins: 0, fats: 0, weight_g: 100 }
            : response;

        if (data.isText && data.ai_advice) {
            Alert.alert("Attenzione", data.ai_advice);
            setLoading(false);
            setSelectedImage(null);
            return;
        }

        const cleanName = (data.food_name || queryForAI).replace(/^(Colazione|Pranzo|Cena|Snack|Ecco|Dati|Risultato)[:\s- \t]*/i, '').trim();

        setCurrentWeight(data.weight_g || 100);
        const ingredients = Array.isArray(data.ingredients) ? data.ingredients.filter((x: unknown) => typeof x === 'string') : [];
        setTempFood({
            name: cleanName,
            kcal: safeParse(data.kcal), c: safeParse(data.carbs || data.carb),
            p: safeParse(data.proteins || data.protein), f: safeParse(data.fats || data.fat),
            weight_g: safeParse(data.weight_g || 100), category_icon: 'default',
            ingredients: ingredients.length ? ingredients : undefined,
        });
        setModalVisible(true);
    } catch (e) {
        await clearLocalCache();
        const isPhotoOnly = hasImage && !phrase;
        Alert.alert(
          'Analisi non riuscita',
          isPhotoOnly
            ? "Non sono riuscito a analizzare la foto. Prova con una foto più nitida del piatto, con buona luce, oppure scrivi una breve descrizione (es. \"pasta al pomodoro\") insieme alla foto."
            : "L'intelligenza artificiale non ha compreso la richiesta. Prova a descrivere il pasto in modo più semplice o aggiungi una foto del piatto."
        );
    } finally {
        setLoading(false);
        setSelectedImage(null);
    }
  }

  async function confirmAndSave() {
    if(!tempFood) return;
    const ratio = currentWeight / (tempFood.weight_g || 100);
    const today = getTodayLocal();
    
    const newEntry: Record<string, unknown> = { 
        id: Date.now().toString(), meal_type: selectedMeal, food_name: tempFood.name, 
        kcal: Math.round(tempFood.kcal * ratio), carbs: Math.round(tempFood.c * ratio), 
        proteins: Math.round(tempFood.p * ratio), fats: Math.round(tempFood.f * ratio), 
        date: today, label: `${currentWeight}g`, icon_type: 'default', time: getCurrentTimeString()
    };
    if (tempFood.ingredients?.length) newEntry.ingredients = tempFood.ingredients;

    const savedLogsJson = await AsyncStorage.getItem('@user_daily_logs');
    const currentLogs = savedLogsJson ? JSON.parse(savedLogsJson) : [];
    await AsyncStorage.setItem('@user_daily_logs', JSON.stringify([newEntry, ...currentLogs]));
    try {
      const { logEvent } = require('../../database/db');
      await logEvent('FOOD', tempFood.name, { ingredients: tempFood.ingredients || [] });
    } catch (_) { /* SQLite non disponibile (es. Expo Go) */ }
    setModalVisible(false); setInputText(''); loadData();
  }

  async function deleteLog(id: string) {
      const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
      if(savedLogs) {
          const filtered = JSON.parse(savedLogs).filter((l:any)=>l.id!==id);
          await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(filtered));
          loadData();
      }
  }

  const openTimeEdit = (item: any) => {
      const t = (item.time || '12:00').match(/^(\d{1,2}):(\d{2})$/);
      setEditingLogId(item.id);
      setEditingTime({ h: t ? parseInt(t[1], 10) % 24 : 12, m: t ? parseInt(t[2], 10) % 60 : 0 });
      setTimeEditVisible(true);
  };

  const saveTimeEdit = async () => {
      if (!editingLogId) return;
      const timeStr = `${String(editingTime.h).padStart(2, '0')}:${String(editingTime.m).padStart(2, '0')}`;
      const savedLogs = await AsyncStorage.getItem('@user_daily_logs');
      if (savedLogs) {
          const list = JSON.parse(savedLogs);
          const updated = list.map((l: any) => l.id === editingLogId ? { ...l, time: timeStr } : l);
          await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updated));
          loadData();
      }
      setTimeEditVisible(false);
      setEditingLogId(null);
  };

  const smartAdjustment = calculateMetabolicReactor({
      steps: healthData.steps || 0,
      activeCalories: healthData.calories || 0,
      sleepHours: healthData.sleep || 0,
      protocol: targets.protocol as any,
      symptomFactor: symptomFactor.factor,
      symptomName: symptomFactor.name
  });

  // Bonus in tempo reale per MetabolicReactor (NET CARBS) — moltiplicatore per tipo di workout
  const baseTarget = targets.c;
  const currentCarbs = todayTotals.c;
  const stepsBonus = healthData.steps > 6000 ? ((healthData.steps - 6000) / 1000) * 5 : 0;
  const workoutMultiplier = getWorkoutMultiplier(lastWorkoutType ?? null);
  const baseSportBonus = (healthData.calories || 0) / 20;
  const sportBonus = baseSportBonus * workoutMultiplier;
  const effectiveSleepHours = (healthData.sleep != null && healthData.sleep > 0) ? healthData.sleep : 7.5;
  const sleepFactor = effectiveSleepHours >= 7 ? 1.0 : (effectiveSleepHours >= 6 ? 0.9 : 0.75);
  const symptomMult = symptomFactor.factor != null && symptomFactor.factor > 0 ? symptomFactor.factor : 1.0;
  const dynamicCarbLimit = Math.round((targets.c + (stepsBonus + sportBonus)) * sleepFactor * symptomMult);

  // Nitrogen Balance Optimizer — target proteine dinamico (peso da Health Connect)
  const weightForAlgorithm = healthWeight ?? 0;
  const { dynamicProteinTarget, proteinMessage } = useAnabolicAlgorithm(weightForAlgorithm, lastWorkoutType ?? null, healthData.calories || 0, targets.p);
  const targetsForBars = { ...targets, p: dynamicProteinTarget };

  const sortedLogs = [...logs].sort((a, b) => {
    const tA = (a.time || '00:00').replace(':', '');
    const tB = (b.time || '00:00').replace(':', '');
    return Number(tA) - Number(tB);
  });

  // Bio Row: NEAT = solo passi; Sport = solo log WORKOUT/ESERCIZIO (no mischiare)
  const neatKcal = Math.round((healthData.steps || 0) * 0.045);
  const sportKcal = logs.reduce((sum: number, log: any) => {
    const isWorkout = log.meal_type === 'WORKOUT' || log.label === 'ESERCIZIO';
    return sum + (isWorkout ? (Number(log.kcal) || 0) : 0);
  }, 0);

  // Real-Time TDEE: BMR accumulato da mezzanotte + NEAT + Sport
  const bmrPerMinute = userBMR / 1440;
  const now = new Date();
  const minutesPassed = now.getHours() * 60 + now.getMinutes();
  const bmrBurnedSoFar = Math.round(bmrPerMinute * minutesPassed);
  const totalBurned = bmrBurnedSoFar + neatKcal + sportKcal;

  const estimatedKetones = calculateEstimatedKetones(logs, todayTotals.c || 0, healthData.steps || 0, {
    yesterdayCarbs: yesterdayCarbs || undefined,
    lastMealFromYesterday: yesterdayLastMealTime ? { date: getYesterdayLocal(), time: yesterdayLastMealTime } : undefined,
  });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={HEADER_BG} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header: SX Calendar → Storico | Centro titolo | DX vuoto (focus solo pasti e passato) */}
        <View style={styles.trackerHeader}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/history')}
            style={styles.trackerHeaderBtn}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={24} color={HEADER_ACCENT} />
          </TouchableOpacity>
          <View style={styles.trackerHeaderTitleBlock}>
            <Text style={styles.trackerHeaderTitle} numberOfLines={1}>Diario Alimentare</Text>
            <Text style={styles.trackerHeaderSubtitle} numberOfLines={1}>Pasti e macro</Text>
          </View>
          <View style={styles.trackerHeaderBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_BTN} />}
          showsVerticalScrollIndicator={false}
        >
          <BarsHeader
            totals={todayTotals}
            targets={targetsForBars}
            limitC={dynamicCarbLimit}
            estimatedKetones={estimatedKetones}
            sleepHours={healthData.sleep || 0}
            bmrBurnedSoFar={bmrBurnedSoFar}
            neatKcal={neatKcal}
            sportKcal={sportKcal}
            steps={healthData.steps || 0}
            proteinBoostMessage={proteinMessage}
            onPressP={() => Alert.alert('Proteine', 'Quanto ne serve per mantenere i muscoli. Il target si adatta al tuo peso e all’allenamento.')}
            onPressC={() => Alert.alert('Carboidrati', 'Il limite si adatta in base a passi, sonno e attività di oggi.')}
            onPressF={() => Alert.alert('Grassi', 'Completano le calorie dopo proteine e carboidrati.')}
            onPressKetone={() => Alert.alert('Stima chetoni', KETONE_ESTIMATE_EXPLANATION)}
          />

          <SmartHint
            visible={logs.length === 0}
            text="Scrivi cosa hai mangiato o usa il microfono, poi tocca + per aggiungere il primo pasto."
          />

          <View style={styles.reactorWrap}>
            <MetabolicReactor
              variant="light"
              baseTarget={baseTarget}
              currentCarbs={currentCarbs}
              stepsBonus={stepsBonus}
              sportBonus={sportBonus}
              sleepFactor={sleepFactor}
              sleepHours={effectiveSleepHours}
              dynamicCarbLimit={dynamicCarbLimit}
              steps={healthData.steps}
              activeCalories={healthData.calories}
              lastWorkoutType={lastWorkoutType ?? undefined}
              symptomFactor={symptomMult}
              symptomName={symptomFactor.name}
              weight={profileWeight ?? healthWeight ?? undefined}
              height={profileHeight}
              activityType={lastWorkoutType === 'aerobic_intense' ? 'Running' : undefined}
              weightDiff={healthWeight != null && profileWeight != null ? healthWeight - profileWeight : 0}
              stressLevel="Medium"
              inCaloricDeficit={(Math.round((todayTotals.p * 4) + (todayTotals.c * 4) + (todayTotals.f * 9)) - (bmrBurnedSoFar + neatKcal + sportKcal)) < 0}
              prevDayCarbs={yesterdayCarbs}
            />
          </View>

          <View style={styles.timelineBlock}>
            {sortedLogs.length > 0 && <View style={styles.timelineVerticalLine} pointerEvents="none" />}
            {sortedLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Nessun pasto registrato</Text>
                <Text style={styles.emptyStateSub}>Usa la barra in basso per aggiungere</Text>
              </View>
            ) : (
              sortedLogs.map((item: any, index: number) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={styles.timelineDot} />
                    <Text style={styles.timelineTime}>{item.time || '—'}</Text>
                  </View>
                  <View style={styles.mealCard}>
                    <View style={styles.mealCardInner}>
                      <View style={styles.mealCardTop}>
                        <Text style={styles.mealCardName} numberOfLines={1}>{item.food_name}</Text>
                        <TouchableOpacity onPress={() => deleteLog(item.id)} hitSlop={10} style={styles.mealCardDelete}>
                          <Trash2 size={18} color={TEXT_SECONDARY} />
                        </TouchableOpacity>
                      </View>
                      {item.ingredients && Array.isArray(item.ingredients) && item.ingredients.length > 0 ? (
                        <Text style={styles.mealCardIngredients} numberOfLines={2}>Ingredienti: {item.ingredients.join(', ')}</Text>
                      ) : null}
                      <Text style={styles.mealCardKcal}>{item.kcal} kcal</Text>
                      <View style={styles.mealCardDots}>
                        <View style={[styles.macroDot, { backgroundColor: RING_CARB }]} />
                        <Text style={styles.macroDotLabel}>{item.carbs}C</Text>
                        <View style={[styles.macroDot, { backgroundColor: RING_PROTEIN }]} />
                        <Text style={styles.macroDotLabel}>{item.proteins}P</Text>
                        <View style={[styles.macroDot, { backgroundColor: RING_FAT }]} />
                        <Text style={styles.macroDotLabel}>{item.fats}F</Text>
                      </View>
                      <TouchableOpacity style={styles.mealCardTimeBadge} onPress={() => openTimeEdit(item)} activeOpacity={0.8}>
                        <Clock size={12} color={TEXT_SECONDARY} />
                        <Text style={styles.mealCardTimeText}>{item.time || '—'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Floating pill — sopra la tab bar */}
        <View style={styles.floatingBarWrap}>
          {selectedImage ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${selectedImage}` }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <Text style={styles.imagePreviewHint}>Tocca + per analizzare il pasto</Text>
              <TouchableOpacity
                style={styles.imagePreviewClose}
                onPress={() => setSelectedImage(null)}
                hitSlop={8}
              >
                <X size={16} color={CARD_BG} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={[styles.floatingBar, isListening && styles.floatingBarListening]}>
            <TouchableOpacity style={styles.floatingMic} onPress={startListening} activeOpacity={0.85}>
              <Mic size={22} color={isListening ? RED_ALERT : ACCENT_MIC} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatingCamera} onPress={showImagePickerOptions} activeOpacity={0.85}>
              <Camera size={22} color={ACCENT_MIC} strokeWidth={2} />
            </TouchableOpacity>
            <TextInput
              style={styles.floatingInput}
              placeholder="Aggiungi pasto o scatta foto..."
              placeholderTextColor={TEXT_SECONDARY}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={searchFood}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.floatingPlus}
              onPress={searchFood}
              disabled={loading || (!inputText.trim() && !selectedImage)}
            >
              {loading ? <ActivityIndicator color={CARD_BG} size="small" /> : <Plus size={22} color={CARD_BG} strokeWidth={2.5} />}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.quickAddChip, (!inputText.trim() || quickAddAnalyzing) && styles.quickAddChipDisabled]}
            onPress={runQuickAdd}
            disabled={!inputText.trim() || quickAddAnalyzing}
          >
            {quickAddAnalyzing ? <ActivityIndicator size="small" color={ACCENT_BTN} /> : <Text style={styles.quickAddChipText}>Aggiungi veloce</Text>}
          </TouchableOpacity>
        </View>

        <QuickAddMeal
          mealType={selectedMeal}
          initialItems={quickAddItems}
          onSave={async (entries) => {
            setQuickAddItems([]);
            const today = getTodayLocal();
            const nowTime = getCurrentTimeString();
            const newEntries = entries.map((e, i) => ({
              id: `${Date.now()}-qam-${i}`,
              meal_type: selectedMeal,
              food_name: e.food_name,
              kcal: e.kcal,
              carbs: e.carbs,
              proteins: e.proteins,
              fats: e.fats,
              date: today,
              label: e.label,
              icon_type: 'default',
              time: nowTime,
            }));
            const savedLogsJson = await AsyncStorage.getItem('@user_daily_logs');
            const currentLogs = savedLogsJson ? JSON.parse(savedLogsJson) : [];
            await AsyncStorage.setItem('@user_daily_logs', JSON.stringify([...newEntries, ...currentLogs]));
            loadData();
          }}
        />

        <Modal animationType="fade" transparent visible={modalVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ecco il pasto</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color={TEXT_SECONDARY} /></TouchableOpacity>
              </View>
              {tempFood && (
                <>
                  <Text style={styles.foodNameDisplay}>{tempFood.name}</Text>
                  <View style={styles.macroPreview}>
                    <Text style={styles.macroPrevItem}>{Math.round(tempFood.kcal * (currentWeight / tempFood.weight_g))} kcal</Text>
                    <Text style={styles.macroPrevItem}>P: {Math.round(tempFood.p * (currentWeight / tempFood.weight_g))}</Text>
                    <Text style={[styles.macroPrevItem, { color: RING_CARB }]}>C: {Math.round(tempFood.c * (currentWeight / tempFood.weight_g))}</Text>
                    <Text style={styles.macroPrevItem}>F: {Math.round(tempFood.f * (currentWeight / tempFood.weight_g))}</Text>
                  </View>
                  <View style={styles.weightControl}>
                    <TouchableOpacity onPress={() => setCurrentWeight(p => Math.max(10, p - 50))} style={styles.portionBtn}><Minus color={ACCENT_BTN} /></TouchableOpacity>
                    <View style={styles.weightInputWrap}>
                      <TextInput
                        style={styles.weightValueInput}
                        value={currentWeight === 0 ? '' : String(currentWeight)}
                        onChangeText={(t) => setCurrentWeight(t === '' ? 0 : Math.min(9999, Math.max(0, Number(t) || 0)))}
                        keyboardType="numeric"
                        maxLength={4}
                        selectTextOnFocus
                      />
                      <Text style={styles.weightUnit}>g</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCurrentWeight(p => p + 50)} style={styles.portionBtn}><Plus color={ACCENT_BTN} /></TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}>
                    <Text style={styles.confirmBtnText}>Conferma</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal animationType="fade" transparent visible={timeEditVisible}>
          <View style={styles.modalOverlay}>
            <View style={styles.timeModalContent}>
              <Text style={styles.timeModalTitle}>Modifica orario pasto</Text>
              <View style={styles.timeModalRow}>
                <Text style={styles.timeModalLabel}>Ora</Text>
                <View style={styles.timeControlRow}>
                  <TouchableOpacity style={styles.timeControlBtn} onPress={() => setEditingTime(t => ({ ...t, h: (t.h - 1 + 24) % 24 }))}><Minus size={20} color={ACCENT_BTN} /></TouchableOpacity>
                  <Text style={styles.timeControlValue}>{String(editingTime.h).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.timeControlBtn} onPress={() => setEditingTime(t => ({ ...t, h: (t.h + 1) % 24 }))}><Plus size={20} color={ACCENT_BTN} /></TouchableOpacity>
                </View>
              </View>
              <View style={styles.timeModalRow}>
                <Text style={styles.timeModalLabel}>Minuti</Text>
                <View style={styles.timeControlRow}>
                  <TouchableOpacity style={styles.timeControlBtn} onPress={() => setEditingTime(t => ({ ...t, m: (t.m - 5 + 60) % 60 }))}><Minus size={20} color={ACCENT_BTN} /></TouchableOpacity>
                  <Text style={styles.timeControlValue}>{String(editingTime.m).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.timeControlBtn} onPress={() => setEditingTime(t => ({ ...t, m: (t.m + 5) % 60 }))}><Plus size={20} color={ACCENT_BTN} /></TouchableOpacity>
                </View>
              </View>
              <View style={styles.timeModalButtons}>
                <TouchableOpacity style={styles.timeModalCancel} onPress={() => { setTimeEditVisible(false); setEditingLogId(null); }}>
                  <Text style={styles.timeModalCancelText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timeModalSave} onPress={saveTimeEdit}>
                  <Text style={styles.timeModalSaveText}>Salva</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  trackerHeaderBtn: { padding: 8, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  trackerHeaderTitleBlock: { flex: 1, justifyContent: 'center', marginHorizontal: 8 },
  trackerHeaderTitle: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: HEADER_TEXT,
  },
  trackerHeaderSubtitle: { textAlign: 'center', fontSize: 11, color: DS.textMuted, fontWeight: '600', marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '700' },
  headerRefresh: { padding: 8 },

  scrollContent: { paddingBottom: 120, paddingHorizontal: 20 },
  headerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 3 } }),
  },
  ketoneChip: { marginBottom: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center' },
  ketoneChipTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase' },
  ketoneChipValue: { fontSize: 18, fontWeight: '700' },
  ketoneChipLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 20, height: BAR_HEIGHT + 44 },
  barWrap: { flex: 1, alignItems: 'center' },
  barLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 },
  barLabel: { fontSize: 12, fontWeight: '700' },
  barLabelFull: { fontSize: 9, color: TEXT_SECONDARY, fontWeight: '600' },
  proteinBoostBadge: { fontSize: 9, color: ACCENT_BTN, fontWeight: '600', maxWidth: 80 },
  barTrack: { width: '100%', height: BAR_HEIGHT, backgroundColor: RING_TRACK, borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  barVal: { fontSize: 12, fontWeight: '700', marginTop: 8, color: TEXT_PRIMARY },
  barValLimit: { color: TEXT_SECONDARY, fontWeight: '600' },
  bioRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  bioCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: RING_TRACK,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 72,
  },
  bioIcon: { marginBottom: 6 },
  bioValue: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  bioLabel: { fontSize: 10, fontWeight: '600', color: TEXT_SECONDARY, marginTop: 2 },
  bioStepsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  bioStepsText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  bioSubtitle: { fontSize: 9, fontWeight: '500', color: TEXT_SECONDARY, marginTop: 4, textAlign: 'center' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: RING_TRACK },
  balanceLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  balanceVal: { fontSize: 15, fontWeight: '700' },
  reactorWrap: { marginBottom: 24 },

  timelineBlock: { position: 'relative', paddingLeft: 4 },
  timelineVerticalLine: {
    position: 'absolute',
    left: 13,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: RING_TRACK,
    borderRadius: 1,
  },
  timelineRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  timelineLeft: { width: 56, alignItems: 'center', marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: CARD_BG, borderWidth: 2, borderColor: RING_TRACK, marginBottom: 6 },
  timelineTime: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  mealCard: { flex: 1, backgroundColor: CARD_BG, borderRadius: 20, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 }, android: { elevation: 2 } }) },
  mealCardInner: { padding: 16 },
  mealCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mealCardName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600', flex: 1 },
  mealCardIngredients: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2, marginBottom: 4 },
  mealCardDelete: { padding: 4 },
  mealCardKcal: { color: TEXT_SECONDARY, fontSize: 12, marginBottom: 8 },
  mealCardDots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroDotLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },
  mealCardTimeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  mealCardTimeText: { color: TEXT_SECONDARY, fontSize: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { color: TEXT_SECONDARY, fontSize: 15, fontWeight: '600' },
  emptyStateSub: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 6, opacity: 0.8 },

  floatingBarWrap: { position: 'absolute', left: 20, right: 20, bottom: 90, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 }, android: { elevation: 5 } }) },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 28,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: RING_TRACK,
  },
  floatingBarListening: { borderColor: RED_ALERT },
  floatingMic: { width: 44, height: 44, borderRadius: 22, backgroundColor: DS.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  floatingCamera: { width: 44, height: 44, borderRadius: 22, backgroundColor: DS.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  floatingInput: { flex: 1, color: TEXT_PRIMARY, paddingVertical: 12, fontSize: 16, fontWeight: '500' },
  floatingPlus: { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT_BTN, justifyContent: 'center', alignItems: 'center' },
  imagePreviewWrap: { position: 'relative', alignSelf: 'flex-start', marginBottom: 10 },
  imagePreview: { width: 64, height: 64, borderRadius: 12, backgroundColor: RING_TRACK },
  imagePreviewHint: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 2 },
  imagePreviewClose: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: RED_ALERT, justifyContent: 'center', alignItems: 'center' },
  quickAddChip: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: DS.surfaceElevated },
  quickAddChipDisabled: { opacity: 0.5 },
  quickAddChipText: { color: ACCENT_BTN, fontSize: 13, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: SPACE.xxl },
  modalContent: { backgroundColor: CARD_BG, padding: SPACE.xxl, borderRadius: RADIUS.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.xl },
  modalTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  foodNameDisplay: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: SPACE.lg },
  macroPreview: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: DS.surfaceElevated, padding: SPACE.lg, marginBottom: SPACE.xl, borderRadius: RADIUS.md },
  macroPrevItem: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  weightControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  portionBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: DS.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  weightInputWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  weightValueInput: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '700', textAlign: 'center', minWidth: 72, padding: 0 },
  weightUnit: { fontSize: 14, color: TEXT_SECONDARY, fontWeight: '600', marginLeft: 4 },
  confirmBtn: { backgroundColor: ACCENT_BTN, height: 48, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: CARD_BG, fontSize: 15, fontWeight: '600' },

  timeModalContent: { backgroundColor: CARD_BG, padding: SPACE.xxl, borderRadius: RADIUS.lg, minWidth: 280 },
  timeModalTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  timeModalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  timeModalLabel: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  timeControlRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  timeControlBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: DS.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  timeControlValue: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  timeModalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  timeModalCancel: { flex: 1, paddingVertical: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: DS.surfaceElevated, alignItems: 'center' },
  timeModalCancelText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  timeModalSave: { flex: 1, paddingVertical: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: ACCENT_BTN, alignItems: 'center' },
  timeModalSaveText: { color: CARD_BG, fontSize: 14, fontWeight: '600' },
});