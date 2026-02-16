import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Activity, AlertTriangle, Beef, Calendar, Check, ChevronLeft, ChevronRight, Cpu, Edit3, Flame, Footprints, Moon, ShieldAlert, Trash2, TrendingUp, X, Zap } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DS, TRACKER_BLACK } from '../../constants/designSystem';
import { RED_ALERT, RING_CARB, RING_FAT, RING_PROTEIN, RING_TRACK } from '../../constants/theme';
import type { DailyBlackboxRecord } from '../../types/blackbox';
import { calculateCorrelations } from '../../utils/blackboxCorrelations';

const STATUS_SYMPTOM = TRACKER_BLACK.SYMPTOM;
const STATUS_WARNING = DS.warning;

const DARK_BG = DS.bg;
const DARK_CARD = DS.surface;
const DARK_BORDER = DS.border;
const DARK_ACCENT = DS.accent;
const DARK_TEXT = DS.text;
const DARK_MUTED = DS.textMuted;

// --- CONFIGURAZIONE BIO (Simulata per ora) ---
// In futuro: lettura da Health Connect / @user_daily_bio_snapshot
const getBioForDate = (date: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (date > today) return null;
    const dayNum = parseInt(date.split('-')[2]);
    const isBadSleep = dayNum % 3 === 0;
    const sleepHours = isBadSleep ? 5.5 : 7.5;
    const readiness = isBadSleep ? 58 : 85;
    const hrvMs = isBadSleep ? 32 : 58;
    return {
        sleepHours,
        sleepQuality: isBadSleep ? 'Critico' : 'Ottimo',
        readiness,
        hrvMs,
        steps: 8000 + (dayNum * 100),
        activeKcal: 350,
        zone: isBadSleep ? 'Sedentario' : 'Zona 2 (Ibrido)',
        reactorBonus: isBadSleep ? { c: 0, p: 10, f: 0 } : { c: 25, p: 20, f: 5 }
    };
};

const { width } = Dimensions.get('window');
const COLUMNS = 7;
const CELL_WIDTH = (width - 40) / COLUMNS;

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

/** Costruisce il record unificato Scatola Nera per un giorno (per correlazioni). */
function buildUnifiedRecord(
  dateStr: string,
  dayDetails: any,
  bioData: any,
  environment: { temp: number; condition: string } | null
): DailyBlackboxRecord {
  const meals = dayDetails?.meals ?? [];
  const mealTimes = meals
    .filter((m: any) => m.meal_type !== 'SINTOMO' && m.time)
    .map((m: any) => `${dateStr}T${String(m.time).padStart(5, '0')}:00`);
  return {
    date: dateStr,
    nutrition: {
      kcal: dayDetails?.totalKcal ?? 0,
      carbs: dayDetails?.totalCarbs ?? 0,
      proteins: dayDetails?.totalProt ?? 0,
      fats: dayDetails?.totalFat ?? 0,
      mealTimes,
    },
    bio: {
      hrvMs: bioData?.hrvMs ?? null,
      sleepHours: bioData?.sleepHours ?? 0,
      readiness: bioData?.readiness ?? 0,
      glycogenPercent: bioData?.glycogenPercent ?? 70,
      fatiguePredictorScore: bioData ? (100 - bioData.readiness) : 50,
      steps: bioData?.steps,
      activeKcal: bioData?.activeKcal,
    },
    medical: {
      symptoms: (dayDetails?.medicalEvents ?? []).map((e: any) => ({ name: e.name, impactLabel: e.impactLabel })),
    },
    environment: environment ?? { temp: 0, condition: '—' },
  };
}

type ViewMode = 'diary' | 'trends';

export default function HistoryScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('diary');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Dati
  const [historyData, setHistoryData] = useState<any>({});
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [bioData, setBioData] = useState<any>(null);

  const [userTargets, setUserTargets] = useState({ kcal: 2000, carbs: 50 });
  const [loading, setLoading] = useState(true);

  // Modale
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // --- 1. CARICAMENTO DATI ---
  const loadData = async () => {
    setLoading(true);
    try {
      const profile = await AsyncStorage.getItem('@user_profile');
      const targets = { kcal: 2000, carbs: 25 };
      if (profile) {
        const p = JSON.parse(profile);
        targets.kcal = Number(p.targetCalories) ?? 2000;
        targets.carbs = p.protocol === 'Keto' ? 25 : p.protocol === 'Low Carb' ? 35 : Number(p.targetCarbs ?? p.carbs) ?? 100;
        setUserTargets(targets);
      } else {
        setUserTargets(targets);
      }
      await refreshHistory(targets);
    } catch (_) { /* load error */ }
    finally { setLoading(false); }
  };

  const refreshHistory = async (targetsOverride?: { kcal: number; carbs: number }) => {
      // Dati reali dal diario alimentare (stesso storage del Tracker)
      const logsJson = await AsyncStorage.getItem('@user_daily_logs');
      const t = targetsOverride ?? userTargets;
      if (logsJson) {
        const logs = JSON.parse(logsJson);
        processHistory(logs, t);
      } else {
        setHistoryData({});
        setDayDetails(null);
      }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // --- 2. ELABORAZIONE ---
  const inferSymptomImpact = (symptomName: string): string => {
    const n = symptomName.toLowerCase();
    if (n.includes('gonfiore') || n.includes('stomaco') || n.includes('reflusso')) return 'Target Carbo ridotto del 50%';
    if (n.includes('stanchezza') || n.includes('brain fog')) return 'Target Carbo ridotto del 30%';
    return 'Adattamento metabolico attivo';
  };

  const processHistory = (logs: any[], targets: { kcal: number; carbs: number }) => {
    const processed: any = {};

    logs.forEach(log => {
      const date = log.date;
      if (!processed[date]) {
        processed[date] = {
          totalKcal: 0, totalCarbs: 0, totalProt: 0, totalFat: 0,
          meals: [], status: 'neutral', hasSymptom: false, medicalEvents: []
        };
      }
      if (log.meal_type === 'SINTOMO') {
        processed[date].hasSymptom = true;
        const rawName = log.food_name || '';
        const name = rawName.replace(/^SINTOMO:\s*/i, '').trim() || 'Sintomo registrato';
        const message = log.symptom_message;
        const impact = message || inferSymptomImpact(name);
        processed[date].medicalEvents.push({
          name: name.toUpperCase(),
          message: message || null,
          severity_factor: log.severity_factor,
          impactLabel: impact
        });
      } else {
        processed[date].totalKcal += (Number(log.kcal) || 0);
        processed[date].totalCarbs += (Number(log.carbs) || 0);
        processed[date].totalProt += (Number(log.proteins) || 0);
        processed[date].totalFat += (Number(log.fats) || 0);
      }
      processed[date].meals.push(log);
    });

    Object.keys(processed).forEach(date => {
      const day = processed[date];
      const isKcalOver = day.totalKcal > targets.kcal;
      const isCarbsOver = day.totalCarbs > targets.carbs;
      if (isKcalOver || isCarbsOver) day.status = 'bad';
      else if (day.totalKcal > 0) day.status = 'good';
      else day.status = 'neutral';
    });

    setHistoryData(processed);
    updateCurrentView(selectedDate, processed);
  };

  const updateCurrentView = (dateStr: string, dataMap: any) => {
      setDayDetails(dataMap[dateStr] || null);
      setBioData(getBioForDate(dateStr)); // Carica anche i dati bio finti
  };

  // --- 3. GESTIONE AZIONI ---
  const handleDelete = (id: string) => {
      Alert.alert("ELIMINA", "Sicuro di voler cancellare?", [
          { text: "ANNULLA", style: "cancel" },
          { text: "ELIMINA", style: "destructive", onPress: async () => {
              const logsJson = await AsyncStorage.getItem('@user_daily_logs');
              if (logsJson) {
                  const logs = JSON.parse(logsJson);
                  const updatedLogs = logs.filter((l: any) => l.id !== id);
                  await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updatedLogs));
                  processHistory(updatedLogs, userTargets);
              }
          }}
      ]);
  };

  const handleEdit = (item: any) => {
      setEditingItem({...item});
      setEditModalVisible(true);
  };

  const saveEdit = async () => {
      if (!editingItem) return;
      try {
          const logsJson = await AsyncStorage.getItem('@user_daily_logs');
          if (logsJson) {
              const logs = JSON.parse(logsJson);
              const updatedLogs = logs.map((l: any) => l.id === editingItem.id ? editingItem : l);
              await AsyncStorage.setItem('@user_daily_logs', JSON.stringify(updatedLogs));
              processHistory(updatedLogs, userTargets);
              setEditModalVisible(false);
          }
      } catch (e) { Alert.alert("ERRORE", "SALVATAGGIO_FALLITO"); }
  };

  // --- 4. CALENDARIO ---
  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const handleDayPress = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    setSelectedDate(dateStr);
    updateCurrentView(dateStr, historyData);
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); 
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for (let i = 0; i < startDay; i++) grid.push({ day: null });
    for (let i = 1; i <= daysInMonth; i++) grid.push({ day: i });
    return grid;
  };

  const renderCalendarItem = ({ item }: any) => {
    if (!item.day) return <View style={[styles.dayCell, styles.emptyCell]} />;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${item.day.toString().padStart(2, '0')}`;
    const dayData = historyData[dateStr];
    const isSelected = dateStr === selectedDate;

    return (
      <TouchableOpacity
        style={[styles.dayCell, isSelected && styles.selectedDayCell]}
        onPress={() => handleDayPress(item.day)}
      >
        <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{item.day}</Text>
        <View style={styles.segmentsRow}>
          {dayData && dayData.status === 'good' && <View style={[styles.segment, styles.segmentGreen]} />}
          {dayData && dayData.status === 'bad' && <View style={[styles.segment, styles.segmentRed]} />}
          {dayData && dayData.hasSymptom && <View style={[styles.segment, styles.segmentSymptom]} />}
        </View>
      </TouchableOpacity>
    );
  };

  const getMealIcon = (meal: any) => {
    const type = (meal.icon_type || meal.meal_type || '').toLowerCase();
    if (type.includes('meat') || type.includes('cena') || type.includes('pranzo')) return <Beef size={18} color={DARK_MUTED} />;
    if (type.includes('snack') || type.includes('colazione')) return <Zap size={18} color={DARK_MUTED} />;
    if (type.includes('shake') || type.includes('prote')) return <Flame size={18} color={DARK_MUTED} />;
    return <Cpu size={18} color={DARK_MUTED} />;
  };

  const getMealBorderColor = (meal: any) => {
    if (meal.meal_type === 'SINTOMO') return RING_TRACK;
    const c = Number(meal.carbs) || 0, p = Number(meal.proteins) || 0, f = Number(meal.fats) || 0;
    if (c >= p && c >= f) return RING_CARB;
    if (f >= p && f >= c) return RING_FAT;
    return RING_PROTEIN;
  };

  // Correlazioni Scatola Nera (causality, fatigue, metabolic window)
  const getYesterdayStr = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };
  const yesterdayStr = getYesterdayStr(selectedDate);
  const todayRecord = buildUnifiedRecord(selectedDate, dayDetails, bioData, null);
  const yesterdayRecord = historyData[yesterdayStr]
    ? buildUnifiedRecord(yesterdayStr, historyData[yesterdayStr], getBioForDate(yesterdayStr), null)
    : null;
  const correlations = calculateCorrelations(todayRecord, yesterdayRecord);

  // Card giorno: 3 sezioni + correlazioni (Scatola Nera)
  const DaySummaryCard = () => {
    const kcal = dayDetails?.totalKcal ?? 0;
    const carb = Math.round(dayDetails?.totalCarbs ?? 0);
    const prot = Math.round(dayDetails?.totalProt ?? 0);
    const fat = Math.round(dayDetails?.totalFat ?? 0);
    const sleepStr = bioData ? (bioData.sleepHours % 1 === 0 ? `${Math.round(bioData.sleepHours)}h` : `${bioData.sleepHours.toFixed(1)}h`) : '—';
    const readinessStr = bioData ? `${bioData.readiness ?? 0}%` : '—';
    const symptoms = dayDetails?.medicalEvents ?? [];
    const healthText = symptoms.length > 0 ? `⚠️ ${symptoms.map((e: any) => e.name).join(', ')}` : 'Nessun sintomo';

    return (
      <View style={styles.daySummaryCard}>
        <View style={[styles.daySummaryRow, styles.daySummaryNutrizione]}>
          <Text style={styles.daySummaryEmoji}>🍽️</Text>
          <Text style={styles.daySummaryLabel}>Nutrizione</Text>
          <Text style={styles.daySummaryVal}>{Math.round(kcal)} kcal | {carb}g Carb | {prot}g Prot | {fat}g Grassi</Text>
        </View>
        <View style={[styles.daySummaryRow, styles.daySummaryCorpo]}>
          <Text style={styles.daySummaryEmoji}>🧬</Text>
          <Text style={styles.daySummaryLabel}>Corpo</Text>
          <Text style={styles.daySummaryVal}>Sonno {sleepStr} | Readiness {readinessStr}</Text>
        </View>
        <View style={[styles.daySummaryRow, styles.daySummarySalute]}>
          <Text style={styles.daySummaryEmoji}>🩺</Text>
          <Text style={styles.daySummaryLabel}>Salute</Text>
          <Text style={[styles.daySummaryVal, symptoms.length > 0 && { color: STATUS_SYMPTOM }]}>{healthText}</Text>
        </View>
        {(correlations.causality || correlations.fatigueAlert || correlations.metabolicWindowHours != null || (symptoms.length > 0 && (dayDetails?.totalCarbs != null || dayDetails?.totalKcal != null))) && (
          <View style={[styles.daySummaryRow, styles.daySummaryCorrelations]}>
            <AlertTriangle size={16} color={DARK_ACCENT} style={{ marginRight: 8 }} />
            <View style={styles.correlationsContent}>
              {symptoms.length > 0 && (dayDetails?.totalKcal != null || dayDetails?.totalCarbs != null) && (
                <Text style={styles.correlationsText}>
                  Quel giorno: {symptoms.map((e: any) => e.name).join(', ')}. Nutrizione: {Math.round(dayDetails?.totalKcal ?? 0)} kcal, {Math.round(dayDetails?.totalCarbs ?? 0)}g carb.
                </Text>
              )}
              {correlations.causality && <Text style={styles.correlationsText}>{correlations.causality}</Text>}
              {correlations.fatigueAlert && <Text style={[styles.correlationsText, styles.correlationsAlert]}>⚠️ Allerta affaticamento: HRV in calo</Text>}
              {correlations.metabolicWindowHours != null && <Text style={styles.correlationsText}>Finestra metabolica: {correlations.metabolicWindowHours}h (ultimo pasto → sonno)</Text>}
            </View>
          </View>
        )}
      </View>
    );
  };

  const BioStatsCard = ({ bio }: any) => {
    if (!bio) return null;
    const isSleepBad = bio.sleepHours < 6;
    const sleepPenalty = isSleepBad ? (bio.sleepHours >= 6 ? 10 : 25) : 0;
    return (
      <View style={styles.bioContainer}>
        <View style={[styles.bioRow, isSleepBad && styles.bioRowWarn]}>
          <Moon size={16} color={isSleepBad ? RED_ALERT : DARK_ACCENT} />
          <Text style={styles.bioLabel}>Sonno ({bio.sleepHours % 1 === 0 ? Math.round(bio.sleepHours) : bio.sleepHours.toFixed(1)}h)</Text>
          <Text style={[styles.bioVal, isSleepBad && { color: RED_ALERT }]}>
            {isSleepBad ? `-${sleepPenalty}% tolleranza` : 'Ottimale'}
          </Text>
        </View>
        <View style={styles.bioRow}>
          <Footprints size={16} color={DARK_ACCENT} />
          <Text style={styles.bioLabel}>Passi</Text>
          <Text style={styles.bioVal}>{Math.round(bio.steps)}</Text>
        </View>
        <View style={styles.bioRow}>
          <Flame size={16} color={DARK_MUTED} />
          <Text style={styles.bioLabel}>Attività</Text>
          <Text style={styles.bioVal}>{bio.zone} • {Math.round(bio.activeKcal)} kcal</Text>
        </View>
        <View style={styles.bonusRow}>
          <Text style={styles.bonusLabel}>Bonus reattore</Text>
          <Text style={[styles.bonusTag, { color: RING_CARB }]}>+{bio.reactorBonus.c}g C</Text>
          <Text style={[styles.bonusTag, { color: DARK_TEXT }]}>+{bio.reactorBonus.p}g P</Text>
        </View>
      </View>
    );
  };

  // --- Ultimi 7 giorni (da oggi indietro) ---
  const getLast7Days = () => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(d.toISOString().split('T')[0]);
    }
    return out.reverse();
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayIndex = (d.getDay() + 6) % 7;
    return ['L', 'M', 'M', 'G', 'V', 'S', 'D'][dayIndex];
  };

  const TrendsDashboard = () => {
    const days = getLast7Days();
    const targetKcal = userTargets.kcal || 2000;
    const maxKcal = Math.max(targetKcal, 2000, ...days.map(d => historyData[d]?.totalKcal || 0));
    const maxSleep = 10;
    const sleepTarget = 7;

    const metabolicBars = days.map((date) => {
      const day = historyData[date];
      const kcal = day ? day.totalKcal : 0;
      const isOver = kcal > targetKcal;
      const heightPct = maxKcal > 0 ? Math.min(100, (kcal / maxKcal) * 100) : 0;
      return { date, kcal, isOver, heightPct, label: getDayLabel(date) };
    });

    const sleepBars = days.map((date) => {
      const bio = getBioForDate(date);
      const hours = bio?.sleepHours ?? 0;
      const heightPct = Math.min(100, (hours / maxSleep) * 100);
      return { date, hours, heightPct, label: getDayLabel(date) };
    });

    let sumC = 0, sumP = 0, sumF = 0, count = 0;
    days.forEach(d => {
      const day = historyData[d];
      if (day && (day.totalCarbs + day.totalProt + day.totalFat) > 0) {
        sumC += day.totalCarbs; sumP += day.totalProt; sumF += day.totalFat;
        count++;
      }
    });
    const tot = sumC + sumP + sumF;
    const avgC = tot > 0 ? (sumC / tot) * 100 : 33.33;
    const avgP = tot > 0 ? (sumP / tot) * 100 : 33.33;
    const avgF = tot > 0 ? (sumF / tot) * 100 : 33.34;

    return (
      <View style={styles.trendsContainer}>
        <View style={styles.trendCard}>
          <Text style={styles.trendCardTitle}>Carico metabolico</Text>
          <Text style={styles.trendCardSub}>Ultimi 7 giorni • Target {targetKcal} kcal</Text>
          <View style={styles.barChartRow}>
            {metabolicBars.map((bar, i) => (
              <View key={bar.date} style={styles.barChartCol}>
                <View style={styles.barChartBarWrap}>
                  <View
                    style={[
                      styles.barChartBar,
                      { height: `${Math.max(bar.heightPct, 4)}%` },
                      bar.kcal === 0 ? styles.barChartBarEmpty : (bar.isOver ? styles.barChartBarRed : styles.barChartBarGreen)
                    ]}
                  />
                </View>
                <Text style={styles.barChartLabel}>{bar.label}</Text>
                {bar.kcal > 0 && <Text style={styles.barChartVal} numberOfLines={1}>{Math.round(bar.kcal)}</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.trendCard}>
          <Text style={styles.trendCardTitle}>Qualità del sonno</Text>
          <Text style={styles.trendCardSub}>Ore per notte • Target 7h</Text>
          <View style={styles.sleepChartWrap}>
            <View style={[styles.sleepTargetLine, { bottom: `${(sleepTarget / maxSleep) * 100}%` }]} />
            <View style={styles.barChartRow}>
              {sleepBars.map((bar) => (
                <View key={bar.date} style={styles.barChartCol}>
                  <View style={styles.barChartBarWrap}>
                    <View
                      style={[
                        styles.barChartBar,
                        { height: `${Math.max(bar.heightPct, 4)}%` },
                        bar.hours === 0 ? styles.barChartBarEmpty : styles.barChartBarSleep
                      ]}
                    />
                  </View>
                  <Text style={styles.barChartLabel}>{bar.label}</Text>
                  {bar.hours > 0 && <Text style={styles.barChartVal}>{bar.hours.toFixed(1)}h</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.trendCard}>
          <Text style={styles.trendCardTitle}>Ripartizione macro media</Text>
          <Text style={styles.trendCardSub}>% media ultima settimana</Text>
          <View style={styles.macroBarTrack}>
            <View style={[styles.macroBarSegment, { flex: avgC }, { backgroundColor: RING_CARB }]} />
            <View style={[styles.macroBarSegment, { flex: avgP }, { backgroundColor: RING_PROTEIN }]} />
            <View style={[styles.macroBarSegment, { flex: avgF }, { backgroundColor: RING_FAT }]} />
          </View>
          <View style={styles.macroLegend}>
            <View style={styles.macroLegendItem}><View style={[styles.macroLegendDot, { backgroundColor: RING_CARB }]} /><Text style={styles.macroLegendText}>C {avgC.toFixed(0)}%</Text></View>
            <View style={styles.macroLegendItem}><View style={[styles.macroLegendDot, { backgroundColor: RING_PROTEIN }]} /><Text style={styles.macroLegendText}>P {avgP.toFixed(0)}%</Text></View>
            <View style={styles.macroLegendItem}><View style={[styles.macroLegendDot, { backgroundColor: RING_FAT }]} /><Text style={styles.macroLegendText}>F {avgF.toFixed(0)}%</Text></View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={DARK_BG} />
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Calendar size={24} color={DARK_ACCENT} />
          <View>
            <Text style={styles.headerSubtitle}>Cronologia</Text>
            <Text style={styles.headerTitle}>Storico</Text>
          </View>
        </View>
        {viewMode === 'diary' && (
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowBtn}><ChevronLeft size={20} color={DARK_ACCENT} /></TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowBtn}><ChevronRight size={20} color={DARK_ACCENT} /></TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.segmentedWrap}>
        <TouchableOpacity
          style={[styles.segmentedBtn, viewMode === 'diary' && styles.segmentedBtnActive]}
          onPress={() => setViewMode('diary')}
        >
          <Calendar size={16} color={viewMode === 'diary' ? DARK_BG : DARK_MUTED} />
          <Text style={[styles.segmentedText, viewMode === 'diary' && styles.segmentedTextActive]}>Diario</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentedBtn, viewMode === 'trends' && styles.segmentedBtnActive]}
          onPress={() => setViewMode('trends')}
        >
          <TrendingUp size={16} color={viewMode === 'trends' ? DARK_BG : DARK_MUTED} />
          <Text style={[styles.segmentedText, viewMode === 'trends' && styles.segmentedTextActive]}>Trend</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {viewMode === 'diary' && (
          <>
        {/* CALENDARIO */}
        <View style={styles.calendarContainer}>
            <View style={styles.weekHeader}>
                {['L','M','M','G','V','S','D'].map((d, i) => <Text key={i} style={styles.weekDayText}>{d}</Text>)}
            </View>
            <FlatList
                data={generateCalendarDays()}
                renderItem={renderCalendarItem}
                keyExtractor={(item, index) => index.toString()}
                numColumns={7}
                scrollEnabled={false}
            />
        </View>

        <View style={styles.detailSection}>
            <Text style={styles.detailDateTitle}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <DaySummaryCard />
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Reattore storico</Text>
            <BioStatsCard bio={bioData} />

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Rilevazioni</Text>
            {dayDetails ? (
                <>
                    {(dayDetails.medicalEvents || []).length > 0 && (
                        <View style={styles.medicalEventsWrap}>
                            {(dayDetails.medicalEvents || []).map((ev: any, idx: number) => (
                                <View key={idx} style={styles.medicalEventCard}>
                                    <View style={styles.medicalEventHeader}>
                                        <ShieldAlert size={20} color={STATUS_SYMPTOM} />
                                        <Text style={styles.medicalEventName}>{ev.name}</Text>
                                    </View>
                                    <View style={styles.medicalEventImpact}>
                                        <Text style={styles.medicalEventImpactLabel}>Impatto sul Reattore</Text>
                                        <View style={styles.medicalEventBadge}>
                                            <Text style={styles.medicalEventBadgeText}>{ev.impactLabel}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                    <View style={styles.statsCard}>
                        <View style={styles.macroGrid}>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, { color: RING_CARB }]}>{Math.round(dayDetails.totalCarbs)}g</Text><Text style={styles.macroSub}>Carbs</Text></View>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, { color: RING_PROTEIN }]}>{Math.round(dayDetails.totalProt)}g</Text><Text style={styles.macroSub}>Prot</Text></View>
                            <View style={styles.macroBox}><Text style={[styles.macroVal, { color: RING_FAT }]}>{Math.round(dayDetails.totalFat)}g</Text><Text style={styles.macroSub}>Grassi</Text></View>
                            <View style={styles.macroBox}><Text style={styles.macroVal}>{Math.round(dayDetails.totalKcal)}</Text><Text style={styles.macroSub}>kcal</Text></View>
                        </View>
                    </View>
                    {dayDetails.meals.map((meal: any, index: number) => (
                        <View key={meal.id || index} style={styles.mealItem}>
                            <View style={[styles.mealTimeLine, { backgroundColor: getMealBorderColor(meal) }]} />
                            <View style={styles.mealIcon}>{getMealIcon(meal)}</View>
                            <View style={styles.mealContent}>
                                <Text style={[styles.mealName, meal.meal_type === 'SINTOMO' && { color: DARK_MUTED }]}>{String(meal.food_name || '')}</Text>
                                <Text style={styles.mealMeta}>
                                    {String(meal.meal_type || '')} {meal.meal_type !== 'SINTOMO' && `• ${meal.kcal} kcal • P:${meal.proteins} C:${meal.carbs} F:${meal.fats}`}
                                </Text>
                            </View>
                            <View style={styles.actionsBox}>
                                {meal.meal_type !== 'SINTOMO' && (
                                    <TouchableOpacity onPress={() => handleEdit(meal)} style={styles.actionIcon}><Edit3 size={16} color={DARK_ACCENT} /></TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => handleDelete(meal.id)} style={styles.actionIcon}><Trash2 size={16} color={RED_ALERT} /></TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </>
            ) : (
                <View style={styles.emptyState}>
                    <Activity size={40} color={DARK_MUTED} />
                    <Text style={styles.emptyText}>Nessun record</Text>
                    <Text style={styles.emptySub}>Diario vuoto per questa data</Text>
                </View>
            )}
        </View>
          </>
        )}

        {viewMode === 'trends' && <TrendsDashboard />}
      </ScrollView>

      {/* MODALE DI MODIFICA */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica pasto</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><X color={DARK_MUTED} size={24} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Alimento</Text>
              <TextInput style={styles.input} value={editingItem?.food_name} onChangeText={(t) => setEditingItem({ ...editingItem, food_name: t })} placeholderTextColor={DARK_MUTED} />
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>kcal</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.kcal?.toString()} onChangeText={(t) => setEditingItem({ ...editingItem, kcal: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.inputLabel}>Proteine (g)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.proteins?.toString()} onChangeText={(t) => setEditingItem({ ...editingItem, proteins: t })} />
                </View>
              </View>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Carboidrati (g)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.carbs?.toString()} onChangeText={(t) => setEditingItem({ ...editingItem, carbs: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.inputLabel}>Grassi (g)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editingItem?.fats?.toString()} onChangeText={(t) => setEditingItem({ ...editingItem, fats: t })} />
                </View>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                <Check color={DARK_BG} size={20} />
                <Text style={styles.saveBtnText}>Salva</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  header: { padding: 20, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: DARK_BORDER, backgroundColor: DARK_BG },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerSubtitle: { color: DARK_MUTED, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  headerTitle: { color: DARK_TEXT, fontSize: 22, fontWeight: '700' },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: DARK_CARD, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: DARK_BORDER, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 } }) },
  monthLabel: { color: DARK_TEXT, fontSize: 14, fontWeight: '600', width: 140, textAlign: 'center' },
  arrowBtn: { padding: 6 },

  segmentedWrap: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, marginBottom: 16, backgroundColor: DARK_BORDER, borderRadius: 14, padding: 4, ...Platform.select({ android: { elevation: 1 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 } }) },
  segmentedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  segmentedBtnActive: { backgroundColor: DARK_ACCENT },
  segmentedText: { color: DARK_MUTED, fontSize: 14, fontWeight: '600' },
  segmentedTextActive: { color: DARK_BG },

  trendsContainer: { paddingHorizontal: 20, paddingBottom: 24 },
  trendCard: { backgroundColor: DARK_CARD, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: DARK_BORDER, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 } }) },
  trendCardTitle: { color: DARK_TEXT, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  trendCardSub: { color: DARK_MUTED, fontSize: 12, fontWeight: '500', marginBottom: 16 },
  barChartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 },
  barChartCol: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  barChartBarWrap: { width: '100%', height: 100, justifyContent: 'flex-end', alignItems: 'center' },
  barChartBar: { width: '80%', minHeight: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barChartBarGreen: { backgroundColor: '#22C55E' },
  barChartBarRed: { backgroundColor: RED_ALERT },
  barChartBarEmpty: { backgroundColor: DARK_BORDER },
  barChartBarSleep: { backgroundColor: '#1E40AF' },
  barChartLabel: { color: DARK_MUTED, fontSize: 11, fontWeight: '600', marginTop: 6 },
  barChartVal: { color: DARK_MUTED, fontSize: 9, marginTop: 2 },
  sleepChartWrap: { position: 'relative', height: 120 },
  sleepTargetLine: { position: 'absolute', left: 0, right: 0, height: 2, borderStyle: 'dashed', borderWidth: 1, borderColor: DARK_ACCENT, zIndex: 1 },
  macroBarTrack: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: DARK_BORDER, marginBottom: 12 },
  macroBarSegment: { minWidth: 4 },
  macroLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  macroLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroLegendDot: { width: 10, height: 10, borderRadius: 5 },
  macroLegendText: { color: DARK_MUTED, fontSize: 12, fontWeight: '600' },

  calendarContainer: { paddingHorizontal: 20 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekDayText: { color: DARK_MUTED, width: CELL_WIDTH, textAlign: 'center', fontSize: 11, fontWeight: '600' },

  dayCell: { width: CELL_WIDTH, height: 52, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 12, borderWidth: 1, borderColor: DARK_BORDER, backgroundColor: DARK_CARD },
  selectedDayCell: { borderColor: DARK_ACCENT, backgroundColor: DARK_ACCENT },
  emptyCell: { backgroundColor: 'transparent', borderWidth: 0 },
  dayText: { fontSize: 14, fontWeight: '600', color: DARK_MUTED },
  dayTextSelected: { color: DARK_BG },
  segmentsRow: { position: 'absolute', bottom: 6, flexDirection: 'row', gap: 4 },
  segment: { width: 14, height: 2, borderRadius: 1 },
  segmentGreen: { backgroundColor: '#22C55E' },
  segmentRed: { backgroundColor: RED_ALERT },
  segmentSymptom: { backgroundColor: STATUS_SYMPTOM },

  detailSection: { padding: 20, marginTop: 12 },
  detailDateTitle: { color: DARK_TEXT, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  sectionLabel: { color: DARK_MUTED, fontSize: 12, fontWeight: '600', marginBottom: 10 },

  daySummaryCard: { backgroundColor: DARK_CARD, borderRadius: 16, borderWidth: 1, borderColor: DARK_BORDER, overflow: 'hidden', marginBottom: 20, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 } }) },
  daySummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: DARK_BORDER },
  daySummaryNutrizione: { borderLeftWidth: 4, borderLeftColor: RING_CARB },
  daySummaryCorpo: { borderLeftWidth: 4, borderLeftColor: '#1E40AF' },
  daySummarySalute: { borderLeftWidth: 4, borderLeftColor: STATUS_SYMPTOM, borderBottomWidth: 0 },
  daySummaryCorrelations: { borderLeftWidth: 4, borderLeftColor: DARK_ACCENT, borderBottomWidth: 0 },
  correlationsContent: { flex: 1 },
  correlationsText: { color: DARK_MUTED, fontSize: 12, marginBottom: 4 },
  correlationsAlert: { color: RED_ALERT, fontWeight: '600' },
  daySummaryEmoji: { fontSize: 18 },
  daySummaryLabel: { color: DARK_MUTED, fontSize: 12, fontWeight: '600', width: 72 },
  daySummaryVal: { flex: 1, color: DARK_TEXT, fontSize: 14, fontWeight: '600' },

  bioContainer: { backgroundColor: DARK_CARD, borderRadius: 16, borderWidth: 1, borderColor: DARK_BORDER, overflow: 'hidden', marginBottom: 20, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: DARK_BORDER },
  bioRowWarn: { backgroundColor: 'rgba(239,68,68,0.12)' },
  bioLabel: { color: DARK_MUTED, fontSize: 12, fontWeight: '600', flex: 1 },
  bioVal: { color: DARK_TEXT, fontSize: 13, fontWeight: '600' },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: DARK_BORDER },
  bonusLabel: { color: DARK_MUTED, fontSize: 11, fontWeight: '600' },
  bonusTag: { fontSize: 12, fontWeight: '600', backgroundColor: DARK_BG, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, color: DARK_TEXT },

  medicalEventsWrap: { marginBottom: 20 },
  medicalEventCard: { backgroundColor: DARK_CARD, borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: STATUS_SYMPTOM, borderWidth: 1, borderColor: DARK_BORDER, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  medicalEventHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  medicalEventName: { color: DARK_TEXT, fontSize: 15, fontWeight: '700', flex: 1 },
  medicalEventImpact: { marginTop: 4 },
  medicalEventImpactLabel: { color: DARK_MUTED, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  medicalEventBadge: { backgroundColor: 'rgba(124,58,237,0.2)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)' },
  medicalEventBadgeText: { color: STATUS_SYMPTOM, fontSize: 12, fontWeight: '600' },

  statsCard: { backgroundColor: DARK_CARD, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: DARK_BORDER, marginBottom: 20, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 } }) },
  macroGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  macroBox: { alignItems: 'center' },
  macroVal: { color: DARK_TEXT, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  macroSub: { color: DARK_MUTED, fontSize: 11, fontWeight: '600' },

  mealItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK_CARD, borderBottomWidth: 1, borderBottomColor: DARK_BORDER, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 12, marginBottom: 8, ...Platform.select({ android: { elevation: 1 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 } }) },
  mealTimeLine: { width: 4, position: 'absolute', left: 0, top: 0, bottom: 0, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  mealIcon: { marginRight: 14 },
  mealContent: { flex: 1 },
  mealName: { color: DARK_TEXT, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  mealMeta: { color: DARK_MUTED, fontSize: 12 },
  actionsBox: { flexDirection: 'row', gap: 8 },
  actionIcon: { padding: 6 },

  emptyState: { alignItems: 'center', padding: 48 },
  emptyText: { color: DARK_MUTED, fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySub: { color: DARK_MUTED, fontSize: 13, marginTop: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: DARK_CARD, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: DARK_BORDER },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { color: DARK_TEXT, fontSize: 18, fontWeight: '600' },
  inputLabel: { color: DARK_MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: DARK_BG, padding: 14, color: DARK_TEXT, fontWeight: '600', fontSize: 15, borderWidth: 1, borderColor: DARK_BORDER, borderRadius: 10 },
  inputRow: { flexDirection: 'row', gap: 0 },
  saveBtn: { backgroundColor: DARK_ACCENT, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, marginTop: 24, gap: 10 },
  saveBtnText: { color: DARK_BG, fontWeight: '600', fontSize: 15 },
});