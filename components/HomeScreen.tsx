import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Platform,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { analyzeWeightTrend } from './MetabolicReactor';
import { DEFAULT_BIO_DATA, getStressAvg, isNadirAfter3AM, type BioStatusData } from '../constants/bioStatusDefault';
import { useBio } from '../context/BioContext';
import useHealthConnect from '../hooks/useHealthConnect';
import { estimateKetones, KETONE_ESTIMATE_EXPLANATION } from '../utils/ketones';

const LOGS_KEY = '@user_daily_logs';
const PROFILE_KEY = '@user_profile';
const SYMPTOM_LAST_USED_KEY = '@symptom_last_used';

function getTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function getYesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Material Light (M3) — sfondo bianco, stile Google ─────────────────────────
const M3 = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#EEEEEE',
  accent: '#1A73E8',
  accentPastel: '#AECBFA',
  warning: '#F9AB00',
  text: '#1C1C1E',
  textBody: '#3C3C43',
  textMuted: '#8E8E93',
  success: '#1E8E3E',
  alert: '#D93025',
  // Macro (pastello per donut)
  carb: '#EA4335',
  protein: '#4285F4',
  fat: '#FBBC04',
} as const;

const CARD_RADIUS = 28;
const PILL_RADIUS = 50;
const DONUT_R = 56;
const DONUT_STROKE = 12;

/** Gruppi per "Dati di oggi". Rischio calo e finestra post-allenamento sotto livello di stress. */
const METRIC_GROUPS: { title: string; ids: string[]; visual: 'gauge' | 'segments' | 'icons' }[] = [
  { title: 'Energia e recupero', ids: ['readiness', 'affaticamento', 'cnsBattery', 'recupero_notte', 'andamento_stress', 'rischio_calo', 'tempo_recupero_pasto'], visual: 'gauge' },
  { title: 'Metabolismo', ids: ['energia_grassi', 'glycogen', 'efficienza_metabolica', 'reagisci_carboidrati'], visual: 'segments' },
  { title: 'Sistema e idratazione', ids: ['difese', 'hydration', 'sodio_perso'], visual: 'icons' },
];

const GAUGE_R = 18;
const SEGMENTS_COUNT = 5;

function getReadinessColor(value: number): string {
  if (value > 70) return M3.success;
  if (value >= 40) return M3.warning;
  return M3.alert;
}

/** Mini gauge a semicerchio (0–100%) */
function MiniGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const cx = GAUGE_R + 4;
  const cy = GAUGE_R + 4;
  const r = GAUGE_R;
  const halfLen = Math.PI * r;
  const filled = (pct / 100) * halfLen;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <Svg width={GAUGE_R * 2 + 8} height={GAUGE_R + 10} viewBox={`0 0 ${GAUGE_R * 2 + 8} ${GAUGE_R + 10}`}>
      <Path d={d} stroke="rgba(0,0,0,0.1)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d={d} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={`${filled} ${halfLen}`} />
    </Svg>
  );
}

/** Blocchi discreti (es. 5 segmenti) */
function SegmentDots({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const filled = Math.round((pct / 100) * SEGMENTS_COUNT);
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: SEGMENTS_COUNT }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 20,
            borderRadius: 4,
            backgroundColor: i < filled ? color : 'rgba(0,0,0,0.08)',
          }}
        />
      ))}
    </View>
  );
}

/** Icone per Sistema e idratazione. Rischio calo e finestra post-allenamento usano orologio. */
const STATE_ICONS: Record<string, { outline: string; filled: string }> = {
  difese: { outline: 'shield-outline', filled: 'shield' },
  hydration: { outline: 'water-outline', filled: 'water' },
  sodio_perso: { outline: 'flask-outline', filled: 'flask' },
};

const ICON_FILL_SIZE = 32;

/** Icona fissa che si riempie dal basso (solo il livello sale, l'icona non si sposta) */
function StateIcon({ row }: { row: { id: string; barValue: number; barColor: string; value: string } }) {
  const map = STATE_ICONS[row.id];
  if (!map) return <Ionicons name="ellipse" size={ICON_FILL_SIZE} color={row.barColor} />;
  let pct = Math.min(100, Math.max(0, row.barValue));
  if (row.id === 'difese') pct = row.value === 'Stabili' ? 100 : 25;
  if (row.id === 'rischio_calo') pct = 100 - pct;
  const fillHeightPx = (pct / 100) * ICON_FILL_SIZE;
  return (
    <View style={{ width: ICON_FILL_SIZE, height: ICON_FILL_SIZE, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name={map.outline as any} size={ICON_FILL_SIZE} color="rgba(0,0,0,0.12)" />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: fillHeightPx, overflow: 'hidden', alignItems: 'center' }}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ICON_FILL_SIZE, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Ionicons name={map.filled as any} size={ICON_FILL_SIZE} color={row.barColor} />
        </View>
      </View>
    </View>
  );
}

/** Tachimetro stile auto per livello di stress: arco che si riempie in base alla % */
function StressTachometer({ value, color }: { value: number; color: string }) {
  return <MiniGauge value={value} color={color} />;
}

/** Orologio a anello: indica i minuti (es. tempo al calo o finestra post-allenamento). */
const CLOCK_R = 16;
function TimeClockRing({ minutes, maxMinutes, color }: { minutes: number; maxMinutes: number; color: string }) {
  const pct = maxMinutes > 0 ? Math.min(1, minutes / maxMinutes) : 0;
  const r = CLOCK_R;
  const cx = r + 4;
  const cy = r + 4;
  const circ = 2 * Math.PI * r;
  const filled = pct * circ;
  return (
    <View style={{ width: r * 2 + 8, height: r * 2 + 8, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={r * 2 + 8} height={r * 2 + 8} viewBox={`0 0 ${r * 2 + 8} ${r * 2 + 8}`}>
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(0,0,0,0.1)" strokeWidth={4} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color }}>{minutes}</Text>
      </View>
    </View>
  );
}

type BioRow = {
  id: string;
  label: string;
  value: string;
  barValue: number;
  barColor: string;
  rawMinutes?: number;
};

/** Tutte le righe della card Dati di oggi. Overrides per countdown live (rischio calo). */
function getBioRows(
  d: BioStatusData,
  m: { readiness: number; cnsBattery: number; glycogen: number; hydration: number },
  overrides?: { bonkMinutesLeft?: number | null }
): BioRow[] {
  const stressAvg = getStressAvg(d);
  const carbOk = d.deepSleepMinutes >= 60 && d.rhrDeviation <= 2;
  const bonk = overrides?.bonkMinutesLeft !== undefined ? overrides.bonkMinutesLeft : d.bonkMinutesLeft;
  return [
    { id: 'readiness', label: 'Energia di oggi', value: `${m.readiness}%`, barValue: m.readiness, barColor: getReadinessColor(m.readiness) },
    { id: 'affaticamento', label: 'Stanchezza nervosa', value: `${d.cnsFatiguePercent}%`, barValue: d.cnsFatiguePercent, barColor: d.cnsFatiguePercent > 60 ? M3.alert : d.cnsFatiguePercent > 40 ? M3.warning : M3.accent },
    { id: 'difese', label: 'Difese immunitarie', value: d.immuneShieldOk ? 'Stabili' : 'A rischio', barValue: 100, barColor: d.immuneShieldOk ? M3.success : M3.alert },
    { id: 'energia_grassi', label: 'Quota energia da grassi', value: `${d.fatBurnPercent}%`, barValue: d.fatBurnPercent, barColor: M3.accent },
    { id: 'glycogen', label: 'Serbatoio zuccheri', value: `${m.glycogen}%`, barValue: m.glycogen, barColor: M3.accent },
    { id: 'efficienza_metabolica', label: 'Efficienza mitocondri', value: `${d.mitochondrialScore}/10`, barValue: (d.mitochondrialScore / 10) * 100, barColor: M3.accent },
    { id: 'reagisci_carboidrati', label: 'Risposta ai carboidrati', value: carbOk ? 'Ottimale' : 'Ridotta', barValue: carbOk ? 100 : Math.min(100, (d.deepSleepMinutes / 60) * 50), barColor: carbOk ? M3.success : d.deepSleepMinutes >= 45 ? M3.warning : M3.alert },
    { id: 'cnsBattery', label: 'Batteria sistema nervoso', value: `${m.cnsBattery}%`, barValue: m.cnsBattery, barColor: m.cnsBattery >= 60 ? M3.success : m.cnsBattery >= 40 ? M3.warning : M3.accent },
    { id: 'recupero_notte', label: 'Recupero notturno', value: `Nadir ${d.hrNadirTime}`, barValue: isNadirAfter3AM(d.hrNadirTime) ? 25 : 100, barColor: isNadirAfter3AM(d.hrNadirTime) ? M3.alert : M3.success },
    { id: 'andamento_stress', label: 'Livello di stress', value: `${Math.round(stressAvg)}%`, barValue: stressAvg, barColor: stressAvg > 60 ? M3.alert : stressAvg > 40 ? M3.warning : M3.accent },
    { id: 'hydration', label: 'Idratazione generale', value: `${m.hydration}%`, barValue: m.hydration, barColor: M3.accent },
    { id: 'sodio_perso', label: 'Sale perso oggi', value: `${d.sodiumLossMg} mg`, barValue: Math.min(100, (d.sodiumLossMg / 2000) * 100), barColor: M3.accent },
    ...(bonk != null ? [{ id: 'rischio_calo' as const, label: 'Rischio calo di energia', value: `Tra ${bonk} min`, barValue: Math.min(100, (bonk / 120) * 100), barColor: bonk >= 60 ? M3.warning : M3.alert, rawMinutes: bonk }] : []),
    ...(d.metabolicWindowMinutesLeft != null ? [{ id: 'tempo_recupero_pasto' as const, label: 'Finestra post-allenamento', value: `${d.metabolicWindowMinutesLeft} min`, barValue: Math.min(100, (d.metabolicWindowMinutesLeft / 45) * 100), barColor: M3.accent, rawMinutes: d.metabolicWindowMinutesLeft }] : []),
  ];
}

const BLOCK_EXPLANATIONS: Record<string, { title: string; body: string }> = {
  macros: {
    title: 'Macro di oggi',
    body: 'I grammi di carboidrati (C), proteine (P) e grassi (F) che hai assunto oggi, confrontati con i target del tuo profilo. I totali sono gli stessi del Tracker: ogni pasto aggiunto lì si riflette qui. Le calorie al centro sono stimate da C×4 + P×4 + F×9.',
  },
  readiness: {
    title: 'Pronto oggi',
    body: 'Punteggio di prontezza (0–100%) che combina qualità del sonno, recupero e variabili fisiologiche. Sopra 70% puoi spingere su allenamento e carico; tra 40% e 70% mantieni; sotto 40% è meglio dare priorità al riposo e non stressare ulteriormente il sistema.',
  },
  glycogen: {
    title: 'Riserve energia',
    body: 'Stima della capacità dei muscoli e del fegato di immagazzinare glucosio (glicogeno). Dipende da pasti recenti, tipo di attività e tempo dall’ultimo pasto. Valori bassi indicano che le riserve sono state parzialmente consumate.',
  },
  hydration: {
    title: 'Idratazione',
    body: 'Stima del livello di idratazione in base a clima (temperatura e umidità), movimento e passi. In ambienti caldi o dopo attività intensa è importante reintegrare liquidi e sali.',
  },
  cnsBattery: {
    title: 'Recupero nervoso',
    body: 'Indica quanto il sistema nervoso centrale si è recuperato. Si basa su HRV (variabilità della frequenza cardiaca) e qualità/quantità del sonno. Un valore alto suggerisce che sei pronto per carichi di lavoro mentali e fisici impegnativi.',
  },
};
const BIO_EXPLANATIONS: Record<string, { title: string; body: string }> = {
  affaticamento: {
    title: 'Affaticamento',
    body: 'Stima dell’affaticamento del sistema nervoso centrale (CNS). Un valore alto può indicare accumulo di stress, sonno insufficiente o carico di lavoro eccessivo. Utile per decidere se ridurre l’intensità dell’allenamento o dedicare tempo al recupero.',
  },
  difese: {
    title: 'Difese',
    body: 'Indice che combina segnali come temperatura corporea e frequenza respiratoria per valutare se le difese immunitarie sono in uno stato stabile o a rischio. “A rischio” suggerisce di evitare eccessi e favorire riposo e nutrizione.',
  },
  energia_grassi: {
    title: 'Energia da grassi',
    body: 'Percentuale stimata di energia che il corpo sta ricavando dai grassi rispetto ad altri substrati. In regime chetogenico questa percentuale tende a essere più alta; durante i pasti con carboidrati può scendere temporaneamente.',
  },
  efficienza_metabolica: {
    title: 'Efficienza metabolica',
    body: 'Punteggio (su 10) che riflette la stima dell’efficienza mitocondriale: quanto bene le cellule producono energia. Sonno, nutrizione e attività regolari tendono a supportare valori più alti.',
  },
  reagisci_carboidrati: {
    title: 'Reagisci ai carboidrati',
    body: 'Valuta se in questo momento il tuo corpo è in una condizione ottimale per gestire i carboidrati (sonno adeguato, battito stabile). “Ottimale” significa che puoi reintrodurli con più margine; “Ridotta” suggerisce di essere più prudente con quantità e timing.',
  },
  recupero_notte: {
    title: 'Recupero nella notte',
    body: 'Il “nadir” è il momento in cui la frequenza cardiaca raggiunge il valore più basso durante il sonno. Un nadir nelle ore piccole (dopo le 3) è spesso associato a un sonno più ristoratore; un nadir troppo presto può indicare un recupero non completo.',
  },
  sodio_perso: {
    title: 'Sodio perso',
    body: 'Stima approssimativa del sodio perso (in mg) attraverso sudore e adattamento chetogenico. In chetosi il corpo espelle più acqua e sali: reintegrare sodio (e potassio) aiuta a evitare crampi, stanchezza e “keto flu”.',
  },
  rischio_calo: {
    title: 'Rischio calo energia',
    body: 'Stima del tempo (in minuti) prima di un possibile calo energetico legato all’esaurimento del glicogeno. Utile per programmare uno spuntino o un pasto prima di un impegno importante.',
  },
  tempo_recupero_pasto: {
    title: 'Tempo recupero pasto',
    body: 'Finestra metabolica post-allenamento: indica per quanto tempo (in minuti) il corpo è ancora in una fase favorevole per assimilare nutrienti e sostenere il recupero muscolare. È il momento ideale per il pasto post-workout.',
  },
  andamento_stress: {
    title: 'Andamento stress',
    body: 'Stima dell’andamento dello stress acuto (fisico e/o psicologico). Valori alti e prolungati suggeriscono di inserire più recupero, sonno e gestione del carico per evitare sovrallenamento e burnout.',
  },
};

/** Registra un sintomo e restituisce l'id del log creato. */
async function logSymptomToHistory(symptomName: string, message?: string, severityFactor = 0.8): Promise<string> {
  const today = getTodayLocal();
  const id = Date.now().toString();
  const newLog = {
    id,
    date: today,
    food_name: `SINTOMO: ${symptomName.toUpperCase()}`,
    meal_type: 'SINTOMO',
    kcal: 0, carbs: 0, proteins: 0, fats: 0,
    label: 'MEDICAL_CHECK',
    icon_type: 'activity',
    symptom_message: message ?? 'Registrato da Home',
    severity_factor: severityFactor,
  };
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  const list = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([newLog, ...list]));
  return id;
}

/** Rimuove un log per id (per annullare sintomo). */
async function removeSymptomLogById(logId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  if (!raw) return;
  const list = JSON.parse(raw);
  const filtered = list.filter((l: any) => l.id !== logId);
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(filtered));
}

const FEELING_TABS: { id: string; label: string; message: string; severity?: number }[] = [
  { id: 'stanco', label: 'Stanco', message: 'Priorità al recupero.', severity: 0.8 },
  { id: 'malditesta', label: 'Mal di testa', message: 'Riposo e idratazione.', severity: 0.8 },
  { id: 'gonfio', label: 'Gonfio', message: 'Riduci carboidrati.', severity: 0.8 },
  { id: 'nausea', label: 'Nausea', message: 'Riposo e pasti leggeri.', severity: 0.7 },
  { id: 'crampi', label: 'Crampi', message: 'Idratazione e elettroliti.', severity: 0.8 },
  { id: 'dolori', label: 'Dolori', message: 'Riposo consigliato.', severity: 0.8 },
];

/** Ordina i sintomi: ultimo usato (data più vicina) prima. */
function sortTabsByLastUsed(
  tabs: typeof FEELING_TABS,
  lastUsed: Record<string, string>
): typeof FEELING_TABS {
  return [...tabs].sort((a, b) => {
    const dateA = lastUsed[a.id] || '';
    const dateB = lastUsed[b.id] || '';
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    if (dateA && dateB) return dateB.localeCompare(dateA);
    return 0;
  });
}

/** Stesso calcolo totali del Tracker: da @user_daily_logs, campi carbs/proteins/fats. */
function calculateTotalsFromLogs(todayList: any[]): { kcal: number; c: number; p: number; f: number } {
  return todayList.reduce(
    (acc: any, item: any) => ({
      kcal: acc.kcal + (item.kcal || 0),
      c: acc.c + (item.carbs || 0),
      p: acc.p + (item.proteins || 0),
      f: acc.f + (item.fats || 0),
    }),
    { kcal: 0, c: 0, p: 0, f: 0 }
  );
}

export type HomeScreenProps = { refreshKey?: number };

const HomeScreen: React.FC<HomeScreenProps> = ({ refreshKey = 0 }) => {
  const router = useRouter();
  const { metrics, coachMessage, weather, healthPermissionMissing, actions } = useBio();
  const { steps, sleepHours, weight: healthWeight, lastWorkoutType } = useHealthConnect();
  const [syncing, setSyncing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const [todayTotals, setTodayTotals] = useState({ kcal: 0, c: 0, p: 0, f: 0 });
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [userBMR, setUserBMR] = useState(1500);
  const [macroTargets, setMacroTargets] = useState({ c: 25, p: 100, f: 150 });
  const [profileWeight, setProfileWeight] = useState<number | undefined>(undefined);
  const [profileHeight, setProfileHeight] = useState<number | undefined>(undefined);
  const [yesterdayCarbs, setYesterdayCarbs] = useState(0);
  const [yesterdayLastMealTime, setYesterdayLastMealTime] = useState<string | null>(null);
  const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);
  const [lastSymptomLogId, setLastSymptomLogId] = useState<string | null>(null);
  const [symptomLastUsed, setSymptomLastUsed] = useState<Record<string, string>>({});
  const toastOpacity = useState(() => new Animated.Value(0))[0];

  const sortedFeelingTabs = React.useMemo(
    () => sortTabsByLastUsed(FEELING_TABS, symptomLastUsed),
    [symptomLastUsed]
  );

  const loadProfileAndLogs = useCallback(async () => {
    try {
      const profileRaw = await AsyncStorage.getItem(PROFILE_KEY);
      const p = profileRaw ? JSON.parse(profileRaw) : null;
      if (p) {
        const w = parseFloat(p.weight);
        const h = parseFloat(p.height);
        if (Number.isFinite(w)) setProfileWeight(w);
        if (Number.isFinite(h)) setProfileHeight(h);
        // Stessa identica logica del Tracker: stessi fallback così target e totali coincidono
        setMacroTargets({
          c: parseInt(p.targetCarbs ?? p.carbs, 10) || 25,
          p: parseInt(p.protein ?? p.targetProtein, 10) || 100,
          f: parseInt(p.fat ?? p.targetFat, 10) || 150,
        });
      } else {
        setMacroTargets({ c: 25, p: 100, f: 150 });
      }
      const lastUsedRaw = await AsyncStorage.getItem(SYMPTOM_LAST_USED_KEY);
      if (lastUsedRaw) {
        try {
          setSymptomLastUsed(JSON.parse(lastUsedRaw));
        } catch (_) {}
      }
      const logsRaw = await AsyncStorage.getItem(LOGS_KEY);
      const today = getTodayLocal();
      const yesterday = getYesterdayLocal();
      if (logsRaw) {
        const all = JSON.parse(logsRaw);
        const todayList = all.filter((l: any) => l.date === today);
        setTodayLogs(todayList);
        setTodayTotals(calculateTotalsFromLogs(todayList));
        const yesterdayList = all.filter((l: any) => l.date === yesterday);
        const yCarbs = yesterdayList.reduce((acc: number, item: any) => acc + (item.carbs || 0), 0);
        setYesterdayCarbs(yCarbs);
        const withTimeY = yesterdayList.filter((l: any) => l.time && /^\d{1,2}:\d{2}$/.test(l.time));
        const lastY = withTimeY.length ? withTimeY.reduce((best: any, l: any) => {
          const [h, m] = (l.time || '00:00').split(':').map(Number);
          const [bh, bm] = (best.time || '00:00').split(':').map(Number);
          return h * 60 + m >= bh * 60 + bm ? l : best;
        }) : null;
        setYesterdayLastMealTime(lastY ? lastY.time : null);
        const symptomLog = todayList.find((l: any) => l.meal_type === 'SINTOMO' && l.food_name && l.food_name.startsWith('SINTOMO:'));
        if (symptomLog) {
          const namePart = (symptomLog.food_name || '').replace('SINTOMO:', '').trim().toLowerCase();
          const tab = FEELING_TABS.find((t) => t.label.toLowerCase() === namePart);
          if (tab) {
            setSelectedSymptomId(tab.id);
            setLastSymptomLogId(symptomLog.id);
          }
        } else {
          setSelectedSymptomId(null);
          setLastSymptomLogId(null);
        }
      } else {
        setTodayLogs([]);
        setTodayTotals({ kcal: 0, c: 0, p: 0, f: 0 });
        setYesterdayCarbs(0);
        setYesterdayLastMealTime(null);
        setSelectedSymptomId(null);
        setLastSymptomLogId(null);
      }
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => loadProfileAndLogs(), 400);
    return () => clearTimeout(t);
  }, [loadProfileAndLogs]));

  useEffect(() => {
    loadProfileAndLogs();
  }, [refreshKey, loadProfileAndLogs]);

  const kcalAssunte = Math.round((todayTotals.p * 4) + (todayTotals.c * 4) + (todayTotals.f * 9)) || Math.round(todayTotals.kcal);
  const sportKcal = todayLogs.reduce((sum: number, log: any) => {
    const isWorkout = log.meal_type === 'WORKOUT' || log.label === 'ESERCIZIO';
    return sum + (isWorkout ? (Number(log.kcal) || 0) : 0);
  }, 0);
  const neatKcal = Math.round((steps || 0) * 0.045);
  const bmrPerMinute = userBMR / 1440;
  const now = new Date();
  const minutesPassed = now.getHours() * 60 + now.getMinutes();
  const bmrBurnedSoFar = Math.round(bmrPerMinute * minutesPassed);
  const totalBurned = bmrBurnedSoFar + neatKcal + sportKcal;
  const bilancioKcal = kcalAssunte - totalBurned;
  const estimatedKetones = estimateKetones(todayLogs, todayTotals.c || 0, steps || 0, {
    yesterdayCarbs: yesterdayCarbs || undefined,
    lastMealFromYesterday: yesterdayLastMealTime ? { date: getYesterdayLocal(), time: yesterdayLastMealTime } : undefined,
  });
  const sleepDisplay = (sleepHours || 0) > 0 ? ((sleepHours || 0) % 1 === 0 ? `${Math.round(sleepHours || 0)}h` : `${(sleepHours || 0).toFixed(1)}h`) : '--';
  const activityDisplay = sportKcal > 0 ? `${sportKcal} kcal` : `${(steps || 0).toLocaleString('it-IT')} passi`;

  const dateLabel = now.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

  const bonkInitial = DEFAULT_BIO_DATA.bonkMinutesLeft ?? null;
  const [countdownTick, setCountdownTick] = useState(0);
  const bonkStartRef = React.useRef<{ initial: number; startAt: number } | null>(null);
  if (bonkInitial != null && bonkStartRef.current == null) bonkStartRef.current = { initial: bonkInitial, startAt: Date.now() };
  const liveBonkMinutes: number | null = bonkStartRef.current
    ? Math.max(0, bonkStartRef.current.initial - Math.floor((Date.now() - bonkStartRef.current.startAt) / 60000))
    : bonkInitial;
  useEffect(() => {
    const t = setInterval(() => setCountdownTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const bioRows = getBioRows(DEFAULT_BIO_DATA, metrics, { bonkMinutesLeft: liveBonkMinutes ?? undefined });
  const carbKcal = (todayTotals.c || 0) * 4;
  const proteinKcal = (todayTotals.p || 0) * 4;
  const fatKcal = (todayTotals.f || 0) * 9;
  const totalMacroKcal = carbKcal + proteinKcal + fatKcal;
  const macroCircumference = 2 * Math.PI * (DONUT_R - DONUT_STROKE / 2);
  const carbDash = totalMacroKcal > 0 ? (carbKcal / totalMacroKcal) * macroCircumference : 0;
  const proteinDash = totalMacroKcal > 0 ? (proteinKcal / totalMacroKcal) * macroCircumference : 0;
  const fatDash = totalMacroKcal > 0 ? (fatKcal / totalMacroKcal) * macroCircumference : macroCircumference;

  const getExplanation = (id: string): { title: string; body: string } | null => {
    const block = BLOCK_EXPLANATIONS[id];
    if (block) return block;
    const bio = BIO_EXPLANATIONS[id];
    if (bio) return bio;
    return null;
  };

  // Lab: Prevenzione infiammazione, Metabolic Detective (Rocca Index richiede distanza/durata/FC da workout)
  const weight = profileWeight ?? healthWeight;
  const height = profileHeight;
  const bmi = weight != null && height != null && height > 0 ? weight / Math.pow(height / 100, 2) : null;
  const activityType = lastWorkoutType === 'aerobic_intense' ? 'Running' : undefined;
  const isHighRisk = (bmi != null && bmi > 27) && activityType === 'Running';
  const stressLevel = metrics.readiness < 40 ? 'High' : metrics.readiness >= 70 ? 'Low' : 'Medium';
  const weightDiff = healthWeight != null && profileWeight != null ? healthWeight - profileWeight : 0;
  const detectiveMessage = analyzeWeightTrend(weightDiff, todayTotals.c || 0, stressLevel, {
    deficit: bilancioKcal < 0,
    prevCarbs: yesterdayCarbs,
  });

  const showToast = useCallback(() => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  }, [toastOpacity]);

  const handleSymptomPress = useCallback(async (tab: typeof FEELING_TABS[0]) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    if (selectedSymptomId === tab.id && lastSymptomLogId) {
      await removeSymptomLogById(lastSymptomLogId);
      setSelectedSymptomId(null);
      setLastSymptomLogId(null);
      const raw = await AsyncStorage.getItem(LOGS_KEY);
      if (raw) {
        const all = JSON.parse(raw);
        const today = getTodayLocal();
        setTodayLogs(all.filter((l: any) => l.date === today));
      }
      return;
    }
    const id = await logSymptomToHistory(tab.label, tab.message, tab.severity ?? 0.8);
    setSelectedSymptomId(tab.id);
    setLastSymptomLogId(id);
    showToast();
  }, [showToast, selectedSymptomId, lastSymptomLogId]);

  const onSync = useCallback(async () => {
    if (syncing) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    setSyncing(true);
    actions.refreshHealth();
    await actions.refreshWeather();
    await new Promise((r) => setTimeout(r, 1500));
    setSyncing(false);
  }, [syncing, actions]);

  return (
    <>
      {/* Intestazione come altre pagine: titolo + riga separatrice */}
      <View style={styles.pageHeader}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>Oggi</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>Ketolab · Sinelica Digital</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="person-circle-outline" size={28} color={M3.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSync} disabled={syncing} style={styles.iconBtn} hitSlop={12}>
            {syncing ? <ActivityIndicator size="small" color={M3.text} /> : <Ionicons name="sync" size={24} color={M3.text} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dateRow}>
          <Text style={styles.datePillText}>{dateLabel}</Text>
        </View>

        {/* Health Connect banner (Android) */}
        {Platform.OS === 'android' && healthPermissionMissing && (
          <TouchableOpacity style={styles.healthBanner} onPress={actions.openHealthConnectSettings} activeOpacity={0.8}>
            <Ionicons name="fitness" size={18} color={M3.accent} />
            <Text style={styles.healthBannerText}>Abilita Health Connect</Text>
          </TouchableOpacity>
        )}

        {/* Card: cerchio macro (C/P/F) + dati di oggi — kcal al centro del cerchio */}
        <View style={styles.macroCard}>
          <View style={styles.macroDonutWrap}>
            <View style={styles.macroDonutSvgWrap}>
              <Svg width={DONUT_R * 2 + 24} height={DONUT_R * 2 + 24} style={styles.macroDonutSvg}>
                <Circle cx={DONUT_R + 12} cy={DONUT_R + 12} r={DONUT_R - DONUT_STROKE / 2} stroke={M3.surfaceElevated} strokeWidth={DONUT_STROKE} fill="none" />
                {totalMacroKcal > 0 && (
                  <>
                    <Circle cx={DONUT_R + 12} cy={DONUT_R + 12} r={DONUT_R - DONUT_STROKE / 2} stroke={M3.carb} strokeWidth={DONUT_STROKE} fill="none" strokeDasharray={`${carbDash} ${macroCircumference}`} strokeDashoffset={0} transform={`rotate(-90 ${DONUT_R + 12} ${DONUT_R + 12})`} />
                    <Circle cx={DONUT_R + 12} cy={DONUT_R + 12} r={DONUT_R - DONUT_STROKE / 2} stroke={M3.protein} strokeWidth={DONUT_STROKE} fill="none" strokeDasharray={`${proteinDash} ${macroCircumference}`} strokeDashoffset={-carbDash} transform={`rotate(-90 ${DONUT_R + 12} ${DONUT_R + 12})`} />
                    <Circle cx={DONUT_R + 12} cy={DONUT_R + 12} r={DONUT_R - DONUT_STROKE / 2} stroke={M3.fat} strokeWidth={DONUT_STROKE} fill="none" strokeDasharray={`${fatDash} ${macroCircumference}`} strokeDashoffset={-(carbDash + proteinDash)} transform={`rotate(-90 ${DONUT_R + 12} ${DONUT_R + 12})`} />
                  </>
                )}
              </Svg>
              <View style={styles.macroDonutCenter} pointerEvents="none">
                <Text style={styles.macroDonutKcal}>{kcalAssunte}</Text>
                <Text style={styles.macroDonutLabel}>kcal</Text>
              </View>
            </View>
            <View style={styles.macroLegend}>
              <View style={styles.macroLegendRow}><View style={[styles.macroLegendDot, { backgroundColor: M3.carb }]} /><Text style={styles.macroLegendText}>C  {todayTotals.c || 0}g/{macroTargets.c}g</Text></View>
              <View style={styles.macroLegendRow}><View style={[styles.macroLegendDot, { backgroundColor: M3.protein }]} /><Text style={styles.macroLegendText}>P  {todayTotals.p || 0}g/{macroTargets.p}g</Text></View>
              <View style={styles.macroLegendRow}><View style={[styles.macroLegendDot, { backgroundColor: M3.fat }]} /><Text style={styles.macroLegendText}>F  {todayTotals.f || 0}g/{macroTargets.f}g</Text></View>
            </View>
          </View>
          <View style={styles.dailyDataBlock}>
            <View style={styles.dailyDataRow}><Text style={styles.dailyDataLabel}>Kcal assunte</Text><Text style={styles.dailyDataValue}>{kcalAssunte}</Text></View>
            <View style={styles.dailyDataRow}><Text style={styles.dailyDataLabel}>Kcal bruciate</Text><Text style={styles.dailyDataValue}>{totalBurned}</Text></View>
            <View style={styles.dailyDataRow}><Text style={styles.dailyDataLabel}>Attività</Text><Text style={styles.dailyDataValue}>{activityDisplay}</Text></View>
            <View style={styles.dailyDataRow}><Text style={styles.dailyDataLabel}>Sonno</Text><Text style={styles.dailyDataValue}>{sleepDisplay}</Text></View>
            <TouchableOpacity style={styles.dailyDataRow} onPress={() => Alert.alert('Stima chetoni', KETONE_ESTIMATE_EXPLANATION)} activeOpacity={0.8}>
              <Text style={styles.dailyDataLabel}>Stima chetoni</Text><Text style={styles.dailyDataValue}>{estimatedKetones.toFixed(1)}</Text>
            </TouchableOpacity>
            <View style={[styles.dailyDataRow, styles.dailyDataRowBalance]}><Text style={styles.dailyDataLabel}>Bilancio</Text><Text style={[styles.dailyDataValue, { color: bilancioKcal <= 0 ? M3.success : M3.text }]}>{bilancioKcal} kcal</Text></View>
          </View>
        </View>

        {/* Pill: Aggiungi il pasto di oggi */}
        <TouchableOpacity style={styles.pillBtn} onPress={() => router.push('/tracker')} activeOpacity={0.8}>
          <Ionicons name="restaurant-outline" size={20} color={M3.accent} />
          <Text style={styles.pillBtnText}>Aggiungi il pasto di oggi</Text>
        </TouchableOpacity>

        {/* Pulsante unico → Medical (salute e sintomi) */}
        <TouchableOpacity style={styles.pillBtn} onPress={() => router.push('/(tabs)/medical')} activeOpacity={0.8}>
          <Ionicons name="medkit-outline" size={20} color={M3.accent} />
          <Text style={styles.pillBtnText}>Salute e sintomi</Text>
        </TouchableOpacity>

        {/* Dati di oggi — card raggruppate, gauge + segmenti */}
        <View style={styles.metricsCard}>
          <Text style={styles.metricsCardTitle}>Dati di oggi</Text>
          {METRIC_GROUPS.map((group) => {
            const rows = bioRows.filter((r) => group.ids.includes(r.id));
            if (rows.length === 0) return null;
            return (
              <View key={group.title} style={styles.metricGroupBlock}>
                <Text style={styles.metricGroupTitle}>{group.title}</Text>
                {rows.map((row) => {
                  const isExpanded = expandedMetricId === row.id;
                  const explanation = getExplanation(row.id);
                  const useGauge = group.visual === 'gauge';
                  const useIcons = group.visual === 'icons';
                  return (
                    <View key={row.id} style={styles.metricRowWrap}>
                      <TouchableOpacity style={styles.metricRowMixed} onPress={() => setExpandedMetricId((prev) => (prev === row.id ? null : row.id))} activeOpacity={0.8}>
                        <View style={styles.metricRowLeft}>
                          <Text style={styles.metricRowLabel}>{row.label}</Text>
                          <Text style={[styles.metricRowValue, { color: row.barColor }]}>{row.value}</Text>
                        </View>
                        <View style={styles.metricRowRight}>
                          {row.id === 'andamento_stress' ? (
                            <StressTachometer value={row.barValue} color={row.barColor} />
                          ) : (row.id === 'rischio_calo' || row.id === 'tempo_recupero_pasto') && row.rawMinutes != null ? (
                            <TimeClockRing
                              minutes={row.rawMinutes}
                              maxMinutes={row.id === 'rischio_calo' ? 120 : 45}
                              color={row.barColor}
                            />
                          ) : useIcons ? (
                            <StateIcon row={row} />
                          ) : useGauge ? (
                            <MiniGauge value={row.barValue} color={row.barColor} />
                          ) : (
                            <SegmentDots value={row.barValue} color={row.barColor} />
                          )}
                        </View>
                      </TouchableOpacity>
                      {isExpanded && explanation && (
                        <View style={styles.metricTendina}>
                          <Text style={styles.metricTendinaTitle}>{explanation.title}</Text>
                          <Text style={styles.metricTendinaBody}>{explanation.body}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
          {isHighRisk && (
            <View style={styles.metricRowWrap}>
              <View style={styles.labWarningBox}>
                <Text style={styles.labWarningLabel}>Prevenzione infiammazione</Text>
                <Text style={styles.labWarningText}>Carico articolare eccessivo (Peso ×3). Cortisolo in aumento. Passa a Camminata in Salita.</Text>
              </View>
            </View>
          )}
          {detectiveMessage != null && (
            <View style={styles.metricRowWrap}>
              <TouchableOpacity style={styles.metricRow} onPress={() => setExpandedMetricId((prev) => (prev === 'detective' ? null : 'detective'))} activeOpacity={0.8}>
                <Text style={styles.metricRowLabel}>Metabolic Detective</Text>
                <Text style={[styles.metricRowValue, { color: M3.accent }]} numberOfLines={1}>{detectiveMessage}</Text>
              </TouchableOpacity>
              {expandedMetricId === 'detective' && (
                <View style={styles.metricTendina}>
                  <Text style={styles.metricTendinaTitle}>Interpretazione trend peso / carbo / stress</Text>
                  <Text style={styles.metricTendinaBody}>{detectiveMessage}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Coach */}
        <View style={styles.coachCard}>
          <Text style={styles.coachMessage} numberOfLines={4}>
            {coachMessage || 'Nessun consiglio al momento.'}
          </Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {toastVisible && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>Registrato.</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: M3.bg },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    backgroundColor: M3.bg,
  },
  headerTitleBlock: { flex: 1, flexDirection: 'column', justifyContent: 'center', minWidth: 0 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: M3.text },
  headerSubtitle: { fontSize: 12, color: M3.textMuted, fontWeight: '500', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  dateRow: { marginBottom: 12 },
  datePillText: { fontSize: 13, color: M3.textBody, fontWeight: '500' },
  iconBtn: { padding: 4, minWidth: 40, alignItems: 'center', justifyContent: 'center' },

  healthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: M3.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 10,
  },
  healthBannerText: { fontSize: 14, color: M3.textBody },

  macroCard: {
    backgroundColor: M3.surface,
    borderRadius: CARD_RADIUS,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  macroDonutWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  macroDonutSvgWrap: {
    width: DONUT_R * 2 + 24,
    height: DONUT_R * 2 + 24,
    position: 'relative',
    marginRight: 16,
  },
  macroDonutSvg: { position: 'absolute', left: 0, top: 0 },
  macroDonutCenter: {
    position: 'absolute',
    left: (DONUT_R * 2 + 24 - (DONUT_R - DONUT_STROKE) * 2) / 2,
    top: (DONUT_R * 2 + 24 - (DONUT_R - DONUT_STROKE) * 2) / 2,
    width: (DONUT_R - DONUT_STROKE) * 2,
    height: (DONUT_R - DONUT_STROKE) * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroDonutKcal: { fontSize: 22, fontWeight: '700', color: M3.text },
  macroDonutLabel: { fontSize: 12, color: M3.textMuted },
  macroLegend: { marginLeft: 12 },
  macroLegendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  macroLegendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  macroLegendText: { fontSize: 13, fontWeight: '500', color: M3.text },
  macroTapHint: { fontSize: 11, color: M3.textMuted, marginTop: 8, textAlign: 'center' },
  dailyDataBlock: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', width: '100%' },
  dailyDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  dailyDataRowBalance: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  dailyDataLabel: { fontSize: 14, color: M3.textMuted },
  dailyDataValue: { fontSize: 16, fontWeight: '600', color: M3.text },

  sectionLabel: { fontSize: 18, fontWeight: '600', color: M3.text, marginBottom: 16 },
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  symptomTile: {
    backgroundColor: M3.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  symptomTileSelected: { backgroundColor: M3.accentPastel, borderColor: M3.accent },
  symptomTileLabel: { fontSize: 13, fontWeight: '500', color: M3.textBody },
  symptomTileLabelSelected: { color: M3.accent, fontWeight: '600' },

  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: M3.surface,
    borderRadius: PILL_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  pillBtnText: { fontSize: 15, fontWeight: '600', color: M3.accent },

  dataCard: {
    backgroundColor: M3.surface,
    borderRadius: CARD_RADIUS,
    padding: 20,
    marginBottom: 24,
  },
  dataCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  dataCardLabel: { fontSize: 15, color: M3.textMuted },
  dataCardValue: { fontSize: 17, fontWeight: '600', color: M3.text },

  metricsCard: {
    backgroundColor: M3.surface,
    borderRadius: CARD_RADIUS,
    padding: 20,
    marginBottom: 24,
  },
  metricsCardTitle: { fontSize: 13, color: M3.textMuted, marginBottom: 16, letterSpacing: 0.5 },
  metricGroupBlock: { marginBottom: 20 },
  metricGroupTitle: { fontSize: 12, fontWeight: '600', color: M3.textMuted, letterSpacing: 0.5, marginBottom: 10 },
  metricRowWrap: { marginBottom: 14 },
  metricRow: {},
  metricRowMixed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricRowLeft: { flex: 1, minWidth: 0 },
  metricRowRight: { marginLeft: 12 },
  metricRowLabel: { fontSize: 14, color: M3.textBody, marginBottom: 2 },
  metricRowValue: { fontSize: 16, fontWeight: '600' },
  metricTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 3 },
  metricTendina: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: M3.accent,
  },
  metricTendinaTitle: { fontSize: 15, fontWeight: '600', color: M3.text, marginBottom: 6 },
  metricTendinaBody: { fontSize: 14, color: M3.textBody, lineHeight: 22 },
  labWarningBox: { marginTop: 8, padding: 12, backgroundColor: 'rgba(249,171,0,0.12)', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: M3.warning },
  labWarningLabel: { fontSize: 12, fontWeight: '600', color: M3.textMuted, marginBottom: 4 },
  labWarningText: { fontSize: 14, color: M3.text, lineHeight: 20 },

  coachCard: {
    backgroundColor: M3.surface,
    borderRadius: CARD_RADIUS,
    padding: 20,
  },
  coachMessage: { fontSize: 15, color: M3.textBody, lineHeight: 22 },

  bottomPad: { height: 32 },

  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 100,
    backgroundColor: M3.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  toastText: { fontSize: 15, fontWeight: '500', color: M3.text },
});

export default HomeScreen;
