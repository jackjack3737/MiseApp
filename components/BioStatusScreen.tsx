import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { analyzeWeightTrend } from './MetabolicReactor';
import { useBio } from '../context/BioContext';
import useHealthConnect from '../hooks/useHealthConnect';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── DESIGN: Tracker Black unificato ───────────────────────────────────────────
import { RED_ALERT, RING_FAT, SUCCESS } from '../constants/theme';
import { TRACKER_BLACK } from '../constants/trackerBlack';
const ACCENT_AMBER = RING_FAT;
const BG = TRACKER_BLACK.BG;
const CARD_BG = TRACKER_BLACK.CARD;
const TEXT_PRIMARY = TRACKER_BLACK.TEXT;
const TEXT_SECONDARY = TRACKER_BLACK.TEXT_MUTED;
const ACCENT_BTN = TRACKER_BLACK.ACCENT;
const RING_TRACK = TRACKER_BLACK.BORDER;

// ─── PROPS: dati condivisi con Home (Dati di oggi) ─────────────────────────
import { DEFAULT_BIO_DATA as DEFAULT_DATA, getStressAvg, isNadirAfter3AM, type BioStatusData } from '../constants/bioStatusDefault';
export type { BioStatusData } from '../constants/bioStatusDefault';

// ─── COMPONENTI UI RIUTILIZZABILI ──────────────────────────────────────────
const SectionCard = ({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
}) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={ACCENT_BTN} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const BarMeter = ({
  value,
  max = 100,
  color,
  height = 8,
  label,
}: {
  value: number;
  max?: number;
  color: string;
  height?: number;
  label?: string;
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <View style={styles.barMeterWrap}>
      {label ? <Text style={styles.barMeterLabel}>{label}</Text> : null}
      <View style={[styles.barMeterTrack, { height }]}>
        <View
          style={[
            styles.barMeterFill,
            { width: `${pct}%`, backgroundColor: color, height },
          ]}
        />
      </View>
    </View>
  );
};

// ─── INTERACTIVE METRIC: superficie semplice (Maria) + tap = Dettagli (nerd) ──
const InteractiveMetric = ({
  label,
  value,
  statusColor,
  simpleSubtitle,
  scienceText,
  children,
  wrapperStyle,
  leftElement,
}: {
  label: string;
  value?: string;
  statusColor?: string;
  /** Una riga in linguaggio semplice, sempre visibile (Signora Maria) */
  simpleSubtitle?: string;
  scienceText: string;
  children?: React.ReactNode;
  wrapperStyle?: object;
  leftElement?: React.ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  const onPress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.interactiveMetricWrap, wrapperStyle]}
    >
      {leftElement}
      <View style={styles.interactiveMetricContent}>
        <View style={styles.interactiveMetricHeader}>
          <View style={styles.interactiveMetricLabelWrap}>
            <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
          </View>
          {value != null && (
            <View style={styles.interactiveMetricValueWrap}>
              <Text style={[styles.interactiveMetricValue, statusColor ? { color: statusColor } : {}]} numberOfLines={1}>
                {value}
              </Text>
            </View>
          )}
        </View>
        {simpleSubtitle ? (
          <Text style={styles.metricSimpleSubtitle}>{simpleSubtitle}</Text>
        ) : null}
        {children}
        {expanded && (
          <View style={styles.bioLogicBox}>
            <Text style={styles.bioLogicTitle}>Dettagli</Text>
            <Text style={styles.bioLogicText}>{scienceText}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── BIO STATUS SCREEN ────────────────────────────────────────────────────
const PROFILE_KEY = '@user_profile';
const LOGS_KEY = '@user_daily_logs';

export default function BioStatusScreen({
  data = DEFAULT_DATA,
  noScroll,
}: {
  data?: Partial<BioStatusData>;
  /** Se true, il contenuto è in un View (per essere inserito dentro uno ScrollView padre, es. Oggi) */
  noScroll?: boolean;
}) {
  const d: BioStatusData = { ...DEFAULT_DATA, ...data };
  const { weather, actions, healthPermissionMissing } = useBio();
  const { weight: healthWeight, lastWorkoutType } = useHealthConnect();
  const [profileWeight, setProfileWeight] = useState<number | undefined>(undefined);
  const [profileHeight, setProfileHeight] = useState<number | undefined>(undefined);
  const [todayCarbsFromLogs, setTodayCarbsFromLogs] = useState(0);
  const [yesterdayCarbs, setYesterdayCarbs] = useState(0);

  const loadLabData = useCallback(async () => {
    try {
      const profileRaw = await AsyncStorage.getItem(PROFILE_KEY);
      if (profileRaw) {
        const p = JSON.parse(profileRaw);
        const w = parseFloat(p.weight);
        const h = parseFloat(p.height);
        if (Number.isFinite(w)) setProfileWeight(w);
        if (Number.isFinite(h)) setProfileHeight(h);
      }
      const logsRaw = await AsyncStorage.getItem(LOGS_KEY);
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (logsRaw) {
        const all: any[] = JSON.parse(logsRaw);
        const todayList = all.filter((l: any) => l.date === today);
        const yesterdayList = all.filter((l: any) => l.date === yesterday);
        setTodayCarbsFromLogs(todayList.reduce((acc: number, l: any) => acc + (l.carbs || 0), 0));
        setYesterdayCarbs(yesterdayList.reduce((acc: number, l: any) => acc + (l.carbs || 0), 0));
      }
    } catch (_) {}
  }, []);

  useEffect(() => { loadLabData(); }, [loadLabData]);

  const effectiveSaltMessage = weather.loading ? null : (weather.saltAdvice ?? d.saltLoadingMessage);
  const showLiveBadge = !weather.loading && weather.isLive && weather.saltAdvice != null;

  // Sincronizza metriche con il Global Store (Home e altri screen leggono da qui)
  useEffect(() => {
    const hydrationScore = Math.round(100 - Math.min(100, (d.sodiumLossMg / 2000) * 100));
    actions.updateMetrics({
      readiness: d.readinessScore,
      cnsBattery: d.hrvScore,
      glycogen: d.glycogenLevelPercent,
      hydration: hydrationScore,
    });
  }, [d.readinessScore, d.hrvScore, d.glycogenLevelPercent, d.sodiumLossMg]);

  const stressAvg = getStressAvg(d);
  const stressLevel = stressAvg > 60 ? 'High' : stressAvg < 30 ? 'Low' : 'Medium';
  const weight = profileWeight ?? healthWeight ?? undefined;
  const bmi = weight != null && profileHeight != null && profileHeight > 0 ? weight / Math.pow(profileHeight / 100, 2) : null;
  const activityType = lastWorkoutType === 'aerobic_intense' ? 'Running' : undefined;
  const isHighRisk = (bmi != null && bmi > 27) && activityType === 'Running';
  const weightDiff = healthWeight != null && profileWeight != null ? healthWeight - profileWeight : 0;
  const detectiveMessage = analyzeWeightTrend(weightDiff, todayCarbsFromLogs, stressLevel, { deficit: false, prevCarbs: yesterdayCarbs });
  const roccaIndex = null as number | null; // Richiede distanceMeters, durationMinutes, avgHeartRate da ultimo workout

  const content = (
    <>
      {healthPermissionMissing && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={actions.requestHealthPermissions}
          activeOpacity={0.8}
        >
          <Ionicons name="fitness-outline" size={22} color={ACCENT_BTN} style={{ marginRight: 10 }} />
          <Text style={styles.permissionBannerText}>
            I dati di battito, sonno e recupero vengono dal telefono. Tocca per abilitare l’accesso.
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.tapHint}>
        <Ionicons name="information-circle-outline" size={18} color={TEXT_SECONDARY} />
        <Text style={styles.tapHintText}>Tocca una voce per saperne di più</Text>
      </View>

      {/* MODULO 1: Oggi in sintesi */}
      <SectionCard title="Oggi in sintesi" icon="pulse-outline">
        <InteractiveMetric
          label="Pronto oggi"
          value={`${d.readinessScore}%`}
          statusColor={d.readinessScore >= 70 ? SUCCESS : d.readinessScore >= 40 ? ACCENT_AMBER : RED_ALERT}
          simpleSubtitle="Quanto sei in forma per la giornata (sonno e recupero)"
          scienceText="L'algoritmo incrocia la tua HRV notturna (variabilità cardiaca) e il sonno profondo. Un punteggio basso indica un Sistema Nervoso Simpatico dominante (stress): oggi niente HIIT, solo Zone 2 o riposo."
          wrapperStyle={styles.metricBlock}
        >
          <Text style={styles.readinessSub}>{d.readinessLabel}</Text>
          <BarMeter value={d.readinessScore} color={d.readinessScore >= 70 ? SUCCESS : d.readinessScore >= 40 ? ACCENT_AMBER : RED_ALERT} height={10} />
        </InteractiveMetric>

        <InteractiveMetric
          label="Affaticamento"
          simpleSubtitle="Quanto sei stanco a livello nervoso: se è alto, meglio non sforzarsi"
          scienceText="Stima dell'affaticamento del Sistema Nervoso Centrale. Se la barra è rossa, i tuoi riflessi e la forza massimale sono compromessi. Rischio infortuni alto."
          wrapperStyle={styles.metricBlock}
        >
          <BarMeter value={d.cnsFatiguePercent} color={d.cnsFatiguePercent > 60 ? RED_ALERT : d.cnsFatiguePercent > 40 ? ACCENT_AMBER : ACCENT_BTN} height={12} />
        </InteractiveMetric>

        <InteractiveMetric
          label="Difese"
          value={d.immuneShieldOk ? 'Stabile' : 'A rischio'}
          statusColor={d.immuneShieldOk ? SUCCESS : RED_ALERT}
          simpleSubtitle="Stato generale delle difese: stabile vuol dire che non ci sono segnali di allarme"
          scienceText="Analisi combinata di Temperatura Basale e Frequenza Respiratoria. Un rialzo improvviso >0.5°C anticipa spesso l'arrivo di virus di 24h. Attiva protocollo Vitamina C/Zinco."
          wrapperStyle={[styles.shieldRow, d.immuneShieldOk ? styles.shieldOk : styles.shieldDanger]}
          leftElement={<Ionicons name="shield-checkmark" size={28} color={d.immuneShieldOk ? SUCCESS : RED_ALERT} style={{ marginRight: 12 }} />}
        >
          <BarMeter value={100} color={d.immuneShieldOk ? SUCCESS : RED_ALERT} height={8} />
        </InteractiveMetric>
      </SectionCard>

      {/* MODULO 2: Metabolismo */}
      <SectionCard title="Metabolismo" icon="flash-outline">
        <InteractiveMetric
          label="Energia: grassi / zuccheri"
          simpleSubtitle="Da cosa stai bruciando ora: più grassi è meglio per la resistenza"
          scienceText="Indica il tuo substrato energetico attuale. In Zona 2 (Verde) i mitocondri ossidano grassi. Sopra la soglia anaerobica (Ambra), il corpo switcha violentemente sul glucosio."
          wrapperStyle={styles.gaugeWrap}
        >
          <View style={styles.gaugeRow}>
            <View style={styles.gaugeSegment}>
              <View style={[styles.gaugeBar, { width: `${d.fatBurnPercent}%`, backgroundColor: ACCENT_BTN }]} />
              <Text style={styles.gaugeText}>{d.fatBurnPercent}% Grassi</Text>
            </View>
            <View style={styles.gaugeSegment}>
              <View style={[styles.gaugeBar, { width: `${d.sugarBurnPercent}%`, backgroundColor: ACCENT_AMBER }]} />
              <Text style={styles.gaugeText}>{d.sugarBurnPercent}% Zuccheri</Text>
            </View>
          </View>
        </InteractiveMetric>

        <InteractiveMetric
          label="Riserve di energia"
          simpleSubtitle={'Quanto sei "pieno" di zuccheri nei muscoli: si riempie mangiando carboidrati'}
          scienceText="Livello stimato di zuccheri nei muscoli. Se il serbatoio è basso (<50%), i carboidrati che mangi ora non verranno stoccati come grasso, ma usati per riempire le riserve (Supercompensazione)."
          wrapperStyle={styles.metricBlock}
        >
          <BarMeter value={d.glycogenLevelPercent} color={ACCENT_AMBER} height={14} />
        </InteractiveMetric>

        <InteractiveMetric
          label="Efficienza metabolica"
          value={`${d.mitochondrialScore}/10`}
          statusColor={ACCENT_BTN}
          simpleSubtitle="Quanto bene il corpo brucia i grassi: più alto, meglio lavora"
          scienceText="Stima l'efficienza dei mitocondri nel bruciare grassi (fat adaptation). Più alto è il punteggio, più il corpo è adattato all'ossidazione lipidica e meno dipende dal glucosio."
          wrapperStyle={styles.metricBlock}
        >
          <BarMeter value={d.mitochondrialScore} max={10} color={ACCENT_BTN} height={10} />
        </InteractiveMetric>

        {d.ghostCarbsWarning && (
          <InteractiveMetric
            label="Attenzione zucchero da stress"
            simpleSubtitle="Lo stress può alzare gli zuccheri anche senza mangiare: respira e rilassati"
            scienceText="ATTENZIONE: Il cortisolo (stress) stimola la Gluconeogenesi. Il fegato sta producendo zucchero nel sangue anche se sei a digiuno. Fai 5 min di Box Breathing per abbassare l'insulina."
            wrapperStyle={styles.ghostAlert}
            leftElement={<Ionicons name="warning" size={20} color={RED_ALERT} style={{ marginRight: 10 }} />}
          >
            <Text style={styles.ghostText}>
              {d.ghostCarbsMessage || 'Stress (Cortisolo) può alzare la glicemia senza cibo.'}
            </Text>
          </InteractiveMetric>
        )}
      </SectionCard>

      {/* Sonno e recupero */}
      <SectionCard title="Sonno e recupero" icon="moon-outline">
        <InteractiveMetric
          label="Come reagisci ai carboidrati oggi"
          value={d.deepSleepMinutes < 60 || d.rhrDeviation > 2 ? 'Ridotta' : 'Ottimale'}
          statusColor={d.deepSleepMinutes < 60 || d.rhrDeviation > 2 ? RED_ALERT : SUCCESS}
          simpleSubtitle="Poco sonno o battito alto: oggi meglio non esagerare con i carboidrati"
          scienceText="Una notte con poco sonno profondo (<1h) o battito alto mantiene il Cortisolo elevato al risveglio. Le cellule diventano temporaneamente insulino-resistenti: oggi riduci i carboidrati del 20% per evitare picchi glicemici."
          wrapperStyle={styles.metricBlock}
          leftElement={<Ionicons name="nutrition-outline" size={22} color={d.deepSleepMinutes < 60 || d.rhrDeviation > 2 ? RED_ALERT : SUCCESS} style={{ marginRight: 10 }} />}
        >
          <BarMeter
            value={d.deepSleepMinutes >= 60 && d.rhrDeviation <= 2 ? 100 : Math.min(100, (d.deepSleepMinutes / 60) * 50)}
            color={d.deepSleepMinutes >= 60 && d.rhrDeviation <= 2 ? SUCCESS : d.deepSleepMinutes >= 45 ? ACCENT_AMBER : RED_ALERT}
            height={10}
          />
        </InteractiveMetric>

        <InteractiveMetric
          label="Recupero nervoso"
          simpleSubtitle="Batteria muscolo-nervi: se è bassa, meglio attività leggera"
          scienceText="Stato della batteria neuro-muscolare basato su HRV. Se la carica è bassa (<40%), il Sistema Nervoso Centrale è in 'Fight or Flight'. Allenamenti pesanti oggi aumentano il rischio infortuni del 60%. Consigliato: Active Recovery."
          wrapperStyle={styles.metricBlock}
          leftElement={<Ionicons name="battery-charging-outline" size={22} color={ACCENT_BTN} style={{ marginRight: 10 }} />}
        >
          <BarMeter
            value={d.hrvScore}
            max={100}
            color={d.hrvScore < 40 ? RED_ALERT : d.hrvScore < 60 ? ACCENT_AMBER : ACCENT_BTN}
            height={12}
            label={`HRV ${d.hrvScore}% • REM ${d.remSleepMinutes} min`}
          />
        </InteractiveMetric>

        <InteractiveMetric
          label="Recupero nella notte"
          value={`Battito minimo: ${d.hrNadirTime}`}
          statusColor={isNadirAfter3AM(d.hrNadirTime) ? RED_ALERT : SUCCESS}
          simpleSubtitle={isNadirAfter3AM(d.hrNadirTime) ? 'Il cuore è sceso tardi: stasera prova a cenare un po\' prima' : 'Ottimo: hai recuperato bene nel sonno'}
          scienceText={isNadirAfter3AM(d.hrNadirTime)
            ? `Il picco di Ormone della Crescita (GH) brucia-grassi avviene nel sonno profondo, ma solo se il cuore raggiunge il minimo battito (Nadir) presto. Il tuo Nadir è arrivato alle ${d.hrNadirTime}: hai perso parte della finestra anabolica. Stasera cena 1h prima.`
            : `Il picco di Ormone della Crescita (GH) avviene nel sonno profondo quando il battito raggiunge il Nadir. Il tuo Nadir alle ${d.hrNadirTime} è nella finestra ottimale (prima delle 03:00): hai sfruttato la finestra anabolica notturna.`}
          wrapperStyle={styles.metricBlock}
          leftElement={<Ionicons name="pulse-outline" size={22} color={isNadirAfter3AM(d.hrNadirTime) ? RED_ALERT : SUCCESS} style={{ marginRight: 10 }} />}
        >
          <BarMeter value={isNadirAfter3AM(d.hrNadirTime) ? 25 : 100} color={isNadirAfter3AM(d.hrNadirTime) ? RED_ALERT : SUCCESS} height={10} />
        </InteractiveMetric>
      </SectionCard>

      {/* Idratazione e sali */}
      <SectionCard title="Idratazione e sali" icon="water-outline">
        <InteractiveMetric
          label="Sodio perso (stima)"
          value={`${d.sodiumLossMg} mg`}
          statusColor={ACCENT_BTN}
          simpleSubtitle="Quanto sale perdi: con dieta povera di carboidrati può servire un po\' di sale in più"
          scienceText="In chetosi (bassa insulina), i reni smettono di trattenere il sodio e lo espellono con l'acqua. Senza integrazione, questo porta a 'Keto Flu', nebbia mentale e crampi."
          wrapperStyle={styles.metricBlock}
        >
          <BarMeter value={Math.min(100, (d.sodiumLossMg / 2000) * 100)} color={ACCENT_BTN} height={10} />
        </InteractiveMetric>

        {weather.loading && (
          <View style={styles.weatherLoadingRow}>
            <ActivityIndicator size="small" color={ACCENT_BTN} />
            <Text style={styles.weatherLoadingText}>Caricamento meteo...</Text>
          </View>
        )}
        {effectiveSaltMessage && (
          <InteractiveMetric
            label="Consiglio sale e meteo"
            simpleSubtitle="In base al meteo: quando fa caldo può servire un po\' di sale in più"
            scienceText="Prima di condizioni di caldo o sforzo prolungato, una piccola carica di sodio la sera prima aiuta a trattenere liquidi e riduce il rischio di crampi e cali di performance il giorno dopo."
            wrapperStyle={styles.alertBox}
            leftElement={<Ionicons name="partly-sunny" size={22} color={ACCENT_AMBER} style={{ marginRight: 10 }} />}
          >
            <View>
              {showLiveBadge && (
                <View style={styles.liveWeatherBadge}>
                  <Text style={styles.liveWeatherBadgeText}>LIVE</Text>
                </View>
              )}
              <Text style={styles.alertText}>{effectiveSaltMessage}</Text>
            </View>
          </InteractiveMetric>
        )}

        {d.ketoneEsterOptimalTime && (
          <InteractiveMetric
            label="Quando assumere integratori chetoni"
            value={`Orario ${d.ketoneEsterOptimalTime}`}
            statusColor={ACCENT_BTN}
            simpleSubtitle="Miglior momento per assumerli: a digiuno o prima dell'allenamento"
            scienceText="I chetoni esogeni (esteri) vanno assunti a digiuno o pre-workout per massimizzare l'ingresso nel cervello e nei muscoli senza competere con il cibo. Evita di assumerli insieme a carboidrati."
            wrapperStyle={styles.ketoneBox}
            leftElement={<Ionicons name="time" size={20} color={ACCENT_BTN} style={{ marginRight: 10 }} />}
          />
        )}
      </SectionCard>

      {/* Lab: Prevenzione infiammazione, Metabolic Detective, Rocca Index */}
      <SectionCard title="Lab" icon="flask-outline">
        {isHighRisk && (
          <InteractiveMetric
            label="Prevenzione infiammazione"
            simpleSubtitle="Carico articolare eccessivo: preferisci Camminata in Salita"
            scienceText="Con BMI > 27 e attività di tipo Running, il carico articolare (fino a 3× il peso) e il cortisolo aumentano. Passa a Camminata in Salita per ridurre impatto e stress infiammatorio."
            wrapperStyle={styles.labWarningWrap}
            leftElement={<Ionicons name="warning" size={22} color={ACCENT_AMBER} style={{ marginRight: 10 }} />}
          >
            <Text style={styles.labWarningText}>Carico articolare eccessivo (Peso ×3). Cortisolo in aumento. Passa a Camminata in Salita.</Text>
          </InteractiveMetric>
        )}
        {detectiveMessage != null && (
          <InteractiveMetric
            label="Metabolic Detective"
            value={detectiveMessage}
            statusColor={ACCENT_BTN}
            simpleSubtitle="Interpretazione trend peso / carbo / stress"
            scienceText={detectiveMessage}
            wrapperStyle={styles.metricBlock}
          />
        )}
        {roccaIndex != null && roccaIndex > 0 && (
          <InteractiveMetric
            label="Rocca Index (Oxygen Efficiency)"
            value={`${roccaIndex.toFixed(2)} m/bpm`}
            statusColor={ACCENT_BTN}
            simpleSubtitle="Efficienza mitocondriale: metri per battito"
            scienceText="Indice del Dott. Rocca: metri percorsi al minuto divisi per frequenza cardiaca media. Più alto è il valore, maggiore è l'efficienza nell'utilizzo dell'ossigeno."
            wrapperStyle={styles.metricBlock}
          />
        )}
        {!isHighRisk && detectiveMessage == null && (roccaIndex == null || roccaIndex <= 0) && (
          <Text style={styles.labPlaceholder}>Nessun insight al momento. I dati del Lab si aggiornano con profilo, pasti e attività.</Text>
        )}
      </SectionCard>

      {/* Previsioni */}
      <SectionCard title="Previsioni" icon="trending-up-outline">
        {d.bonkMinutesLeft != null && (
          <InteractiveMetric
            label="Rischio calo energia"
            value={`Tra ${d.bonkMinutesLeft} min`}
            statusColor={RED_ALERT}
            simpleSubtitle="A questo ritmo potresti avere un calo: meglio mangiare o integrare prima"
            scienceText={`Basato sul tuo dispendio calorico attuale e le scorte stimate. A questo ritmo, esaurirai il glicogeno epatico e muscolare tra ${d.bonkMinutesLeft} minuti. Integra ora.`}
            wrapperStyle={styles.metricBlock}
            leftElement={<Ionicons name="alert-circle" size={22} color={RED_ALERT} style={{ marginRight: 10 }} />}
          >
            <BarMeter value={Math.min(100, (d.bonkMinutesLeft / 120) * 100)} color={d.bonkMinutesLeft >= 60 ? ACCENT_AMBER : RED_ALERT} height={10} />
          </InteractiveMetric>
        )}

        {d.metabolicWindowMinutesLeft != null && (
          <InteractiveMetric
            label="Tempo per recuperare con il pasto"
            value={`${d.metabolicWindowMinutesLeft} min`}
            statusColor={ACCENT_BTN}
            simpleSubtitle="Dopo l'allenamento: in questo periodo mangiare aiuta il recupero"
            scienceText="Dopo l'allenamento, i muscoli sono più ricettivi a glucosio e proteine per circa 30-45 minuti. Assumere carboidrati in questa finestra favorisce il ripristino del glicogeno e il recupero."
            wrapperStyle={styles.metricBlock}
            leftElement={<Ionicons name="nutrition" size={22} color={ACCENT_BTN} style={{ marginRight: 10 }} />}
          >
            <BarMeter value={Math.min(100, (d.metabolicWindowMinutesLeft / 45) * 100)} color={ACCENT_BTN} height={10} />
          </InteractiveMetric>
        )}

        <InteractiveMetric
          label="Andamento stress"
          simpleSubtitle="Come va lo stress nel tempo: picchi alti = meglio riposo e attività leggera"
          scienceText="Onda stimata dello stress acuto (cortisolo, attivazione simpatica). I picchi ripetuti indicano carico cronico: priorità a sonno, Zone 2 e gestione del recupero."
          wrapperStyle={styles.stressBlock}
        >
          <BarMeter
            value={stressAvg}
            color={stressAvg > 60 ? RED_ALERT : stressAvg > 40 ? ACCENT_AMBER : ACCENT_BTN}
            height={10}
          />
          <View style={styles.waveContainer}>
            {d.stressWaveData.map((val, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: Math.max(6, (val / 100) * 36),
                    flex: 1,
                    backgroundColor: val > 60 ? RED_ALERT : val > 40 ? ACCENT_AMBER : ACCENT_BTN,
                  },
                ]}
              />
            ))}
          </View>
        </InteractiveMetric>
      </SectionCard>

      <View style={styles.bottomPad} />
    </>
  );

  if (noScroll) {
    return <View style={[styles.scrollContent, { backgroundColor: BG }]}>{content}</View>;
  }
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RING_TRACK,
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 224, 255, 0.1)',
    borderWidth: 1,
    borderColor: ACCENT_BTN,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  permissionBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: RING_TRACK,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 3 } }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: RING_TRACK,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: TEXT_PRIMARY,
  },
  interactiveMetricWrap: {
    marginTop: 14,
  },
  interactiveMetricContent: {
    flex: 1,
  },
  interactiveMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  interactiveMetricLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  interactiveMetricValueWrap: {
    flexShrink: 0,
  },
  metricSimpleSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 6,
    fontWeight: '500',
  },
  interactiveMetricValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  bioLogicBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  bioLogicTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT_BTN,
    letterSpacing: 1,
    marginBottom: 8,
  },
  bioLogicText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    fontWeight: '500',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricBlock: {
    marginTop: 14,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  readinessValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  readinessSub: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  barMeterWrap: {
    marginTop: 4,
  },
  barMeterTrack: {
    width: '100%',
    backgroundColor: RING_TRACK,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barMeterFill: {
    borderRadius: 4,
    height: '100%',
  },
  barMeterLabel: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  shieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
  },
  shieldOk: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  shieldDanger: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  shieldStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  gaugeWrap: {
    marginTop: 8,
  },
  gaugeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  gaugeSegment: {
    flex: 1,
  },
  gaugeBar: {
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  gaugeText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT_BTN,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '900',
    color: ACCENT_BTN,
  },
  scoreMax: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginLeft: 2,
  },
  ghostAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: RED_ALERT,
  },
  ghostText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  sodiumValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT_BTN,
    marginTop: 6,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT_AMBER,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  weatherLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
  },
  weatherLoadingText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  liveWeatherBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  liveWeatherBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: ACCENT_BTN,
    letterSpacing: 1,
  },
  ketoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  ketoneText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  labWarningWrap: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT_AMBER,
  },
  labWarningText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  labPlaceholder: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  predText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  stressBlock: {
    marginTop: 18,
  },
  waveContainer: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 8,
  },
  waveBar: {
    borderRadius: 3,
    minWidth: 6,
  },
  bottomPad: {
    height: 40,
  },
});
