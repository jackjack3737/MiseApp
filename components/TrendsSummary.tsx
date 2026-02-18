/**
 * TrendsSummary — Vista Trend semplice con i dati che abbiamo davvero.
 * Ultimi 7 giorni: numeri in evidenza, grafico kcal vs target, sintesi testuale.
 */

import React, { useMemo } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DS } from '../constants/designSystem';

const { width } = Dimensions.get('window');
const PAD = 20;
const CARD_GAP = 12;
const BAR_CHART_HEIGHT = 140;
const SMALL_CHART_HEIGHT = 100;
/** Altezza massima barra in % del contenitore, così non esce mai dal quadrato */
const MAX_BAR_HEIGHT_PCT = 92;

const TEXT = DS.text;
const MUTED = DS.textMuted;
const CARD = DS.surface;
const BORDER = DS.border;
const ACCENT = DS.accent;
const GREEN = DS.success;
const RED = DS.alert;

export type HistoryDay = {
  totalKcal?: number;
  totalCarbs?: number;
  totalProt?: number;
  totalFat?: number;
  status?: string;
  medicalEvents?: { name: string }[];
  hasSymptom?: boolean;
};

export type BioSnapshot = {
  sleepHours?: number;
  readiness?: number;
  steps?: number;
  activeKcal?: number;
};

export type TrendsSummaryProps = {
  historyData: Record<string, HistoryDay>;
  getBioForDate: (dateStr: string) => BioSnapshot | null;
  targetKcal: number;
  targetCarbs: number;
};

function getLast7Days(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const i = (d.getDay() + 6) % 7;
  return ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][i];
}

export function TrendsSummary({
  historyData,
  getBioForDate,
  targetKcal,
  targetCarbs,
}: TrendsSummaryProps) {
  const days = useMemo(() => getLast7Days(), []);

  const { bars, avgKcal, avgCarbs, daysOnTarget, daysWithSymptoms, avgSleep, summaryLines, stepsBars, sleepBars, activityBars, avgSteps, avgActivity } = useMemo(() => {
    const bars = days.map((date) => {
      const day = historyData[date];
      const kcal = day?.totalKcal ?? 0;
      const carbs = day?.totalCarbs ?? 0;
      const onTarget = (targetKcal <= 0 || kcal <= targetKcal) && (targetCarbs <= 0 || carbs <= targetCarbs);
      const hasData = kcal > 0 || (day?.medicalEvents?.length ?? 0) > 0;
      return {
        date,
        label: dayLabel(date),
        kcal,
        carbs,
        onTarget,
        hasSymptom: (day?.medicalEvents?.length ?? 0) > 0,
        hasData,
      };
    });

    const withKcal = bars.filter((b) => b.kcal > 0);
    const avgKcal = withKcal.length ? Math.round(withKcal.reduce((s, b) => s + b.kcal, 0) / withKcal.length) : 0;
    const withCarbs = bars.filter((b) => b.kcal > 0);
    const avgCarbs = withCarbs.length ? Math.round(withCarbs.reduce((s, b) => s + b.carbs, 0) / withCarbs.length) : 0;
    const daysOnTarget = bars.filter((b) => b.hasData && b.onTarget).length;
    const daysWithSymptoms = bars.filter((b) => b.hasSymptom).length;
    const sleepValues = days.map((d) => getBioForDate(d)?.sleepHours).filter((h): h is number => typeof h === 'number' && h > 0);
    const avgSleep = sleepValues.length ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1) : null;

    const stepsBars = days.map((date) => ({ date, label: dayLabel(date), steps: getBioForDate(date)?.steps ?? 0 }));
    const sleepBars = days.map((date) => ({ date, label: dayLabel(date), hours: getBioForDate(date)?.sleepHours ?? 0 }));
    const activityBars = days.map((date) => ({ date, label: dayLabel(date), activeKcal: getBioForDate(date)?.activeKcal ?? 0 }));

    const avgSteps = stepsBars.some((b) => b.steps > 0)
      ? Math.round(stepsBars.reduce((s, b) => s + b.steps, 0) / Math.max(1, stepsBars.filter((b) => b.steps > 0).length))
      : null;
    const avgActivity = activityBars.some((b) => b.activeKcal > 0)
      ? Math.round(activityBars.reduce((s, b) => s + b.activeKcal, 0) / Math.max(1, activityBars.filter((b) => b.activeKcal > 0).length))
      : null;

    const lines: string[] = [];
    if (withKcal.length > 0) {
      lines.push(`Media ${avgKcal} kcal negli ultimi 7 giorni${targetKcal > 0 ? ` (target ${targetKcal})` : ''}.`);
    }
    lines.push(`Target rispettato ${daysOnTarget} giorni su ${bars.filter((b) => b.hasData).length || 7}.`);
    if (daysWithSymptoms > 0) {
      const which = bars.filter((b) => b.hasSymptom).map((b) => b.label).join(', ');
      lines.push(`${daysWithSymptoms} ${daysWithSymptoms === 1 ? 'giorno' : 'giorni'} con sintomi${which ? `: ${which}` : ''}.`);
    } else {
      lines.push('Nessun giorno con sintomi registrati.');
    }
    if (avgSleep) {
      lines.push(`Media sonno: ${avgSleep} h per notte.`);
    }
    if (avgSteps != null) {
      lines.push(`Media passi: ${avgSteps.toLocaleString('it-IT')} al giorno.`);
    }
    if (avgActivity != null) {
      lines.push(`Media attività: ${avgActivity} kcal bruciate.`);
    }

    return {
      bars,
      avgKcal,
      avgCarbs,
      daysOnTarget,
      daysWithSymptoms,
      avgSleep,
      summaryLines: lines,
      stepsBars,
      sleepBars,
      activityBars,
      avgSteps,
      avgActivity,
    };
  }, [days, historyData, getBioForDate, targetKcal, targetCarbs]);

  const maxKcal = Math.max(targetKcal, 2000, ...bars.map((b) => b.kcal));
  const maxSteps = Math.max(5000, ...stepsBars.map((b) => b.steps));
  const maxSleep = Math.max(8, ...sleepBars.map((b) => b.hours), 1);
  const maxActivity = Math.max(200, ...activityBars.map((b) => b.activeKcal));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Ultimi 7 giorni</Text>

      <View style={styles.cardsRow}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{avgKcal}</Text>
          <Text style={styles.cardLabel}>Media kcal</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{daysOnTarget}<Text style={styles.cardValueSmall}>/7</Text></Text>
          <Text style={styles.cardLabel}>Giorni nel target</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{daysWithSymptoms}</Text>
          <Text style={styles.cardLabel}>Giorni con sintomi</Text>
        </View>
      </View>
      {avgSleep != null && (
        <View style={styles.cardWide}>
          <Text style={styles.cardValue}>{avgSleep}h</Text>
          <Text style={styles.cardLabelWide}>Media ore di sonno (ultimi 7 giorni)</Text>
        </View>
      )}

      <Text style={styles.chartTitle}>Kcal per giorno</Text>
      <Text style={styles.chartSub}>Barra verde = sotto target, rossa = sopra target</Text>
      <View style={styles.barChartCard}>
        {targetKcal > 0 && targetKcal <= maxKcal && (
          <View style={[styles.targetLine, { bottom: (BAR_CHART_HEIGHT - 24) * (1 - targetKcal / maxKcal) + 22 }]} />
        )}
        <View style={styles.barChartInner}>
          {bars.map((bar) => {
            const heightPct = maxKcal > 0 ? Math.min(MAX_BAR_HEIGHT_PCT, (bar.kcal / maxKcal) * MAX_BAR_HEIGHT_PCT) : 0;
            return (
              <View key={bar.date} style={styles.barCol}>
                <View style={styles.barWrap}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max(heightPct, 2)}%` },
                      !bar.hasData ? styles.barEmpty : bar.onTarget ? styles.barGood : styles.barOver,
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{bar.label}</Text>
                {bar.kcal > 0 && <Text style={styles.barVal}>{Math.round(bar.kcal)}</Text>}
                <View style={styles.barSymptomWrap}>
                  {bar.hasSymptom ? <Text style={styles.barSymptom}>⚠</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
        {targetKcal > 0 && (
          <Text style={styles.targetLegend}>Linea tratteggiata = target {targetKcal} kcal</Text>
        )}
      </View>

      <Text style={styles.chartTitle}>Trend passi</Text>
      <Text style={styles.chartSub}>Passi per giorno</Text>
      <View style={styles.barChartCard}>
        <View style={[styles.barChartInner, { height: SMALL_CHART_HEIGHT }]}>
          {stepsBars.map((bar) => {
            const heightPct = maxSteps > 0 ? Math.min(MAX_BAR_HEIGHT_PCT, (bar.steps / maxSteps) * MAX_BAR_HEIGHT_PCT) : 0;
            return (
              <View key={bar.date} style={styles.barCol}>
                <View style={[styles.barWrap, { height: SMALL_CHART_HEIGHT - 24, overflow: 'hidden' }]}>
                  <View style={[styles.bar, styles.barSteps, { height: `${Math.max(heightPct, 2)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{bar.label}</Text>
                {bar.steps > 0 && <Text style={styles.barVal}>{bar.steps >= 1000 ? `${(bar.steps / 1000).toFixed(1)}k` : bar.steps}</Text>}
              </View>
            );
          })}
        </View>
        {avgSteps != null && <Text style={styles.targetLegend}>Media: {avgSteps.toLocaleString('it-IT')} passi/giorno</Text>}
      </View>

      <Text style={styles.chartTitle}>Trend sonno</Text>
      <Text style={styles.chartSub}>Ore per notte</Text>
      <View style={styles.barChartCard}>
        <View style={[styles.barChartInner, { height: SMALL_CHART_HEIGHT }]}>
          {sleepBars.map((bar) => {
            const heightPct = maxSleep > 0 ? Math.min(MAX_BAR_HEIGHT_PCT, (bar.hours / maxSleep) * MAX_BAR_HEIGHT_PCT) : 0;
            return (
              <View key={bar.date} style={styles.barCol}>
                <View style={[styles.barWrap, { height: SMALL_CHART_HEIGHT - 24, overflow: 'hidden' }]}>
                  <View style={[styles.bar, styles.barSleep, { height: `${Math.max(heightPct, 2)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{bar.label}</Text>
                {bar.hours > 0 && <Text style={styles.barVal}>{bar.hours.toFixed(1)}h</Text>}
              </View>
            );
          })}
        </View>
        {avgSleep != null && <Text style={styles.targetLegend}>Media: {avgSleep} h per notte</Text>}
      </View>

      <Text style={styles.chartTitle}>Trend attività</Text>
      <Text style={styles.chartSub}>Kcal attive per giorno (movimento, sport)</Text>
      <View style={styles.barChartCard}>
        <View style={[styles.barChartInner, { height: SMALL_CHART_HEIGHT }]}>
          {activityBars.map((bar) => {
            const heightPct = maxActivity > 0 ? Math.min(MAX_BAR_HEIGHT_PCT, (bar.activeKcal / maxActivity) * MAX_BAR_HEIGHT_PCT) : 0;
            return (
              <View key={bar.date} style={styles.barCol}>
                <View style={[styles.barWrap, { height: SMALL_CHART_HEIGHT - 24, overflow: 'hidden' }]}>
                  <View style={[styles.bar, styles.barActivity, { height: `${Math.max(heightPct, 2)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{bar.label}</Text>
                {bar.activeKcal > 0 && <Text style={styles.barVal}>{Math.round(bar.activeKcal)}</Text>}
              </View>
            );
          })}
        </View>
        {avgActivity != null && <Text style={styles.targetLegend}>Media: {avgActivity} kcal attive/giorno</Text>}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>In sintesi</Text>
        {summaryLines.map((line, i) => (
          <Text key={i} style={styles.summaryLine}>{line}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.bg },
  content: { padding: PAD, paddingBottom: 80 },
  heading: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 16 },
  cardsRow: { flexDirection: 'row', gap: CARD_GAP, marginBottom: CARD_GAP },
  card: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    alignItems: 'center',
  },
  cardWide: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: CARD_GAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardValue: { fontSize: 22, fontWeight: '800', color: TEXT },
  cardValueSmall: { fontSize: 16, fontWeight: '600', color: MUTED },
  cardLabel: { fontSize: 11, color: MUTED, marginTop: 4, textAlign: 'center' },
  cardLabelWide: { fontSize: 13, color: MUTED, flex: 1, textAlign: 'left' },
  chartTitle: { fontSize: 16, fontWeight: '700', color: TEXT, marginTop: 8, marginBottom: 4 },
  chartSub: { fontSize: 12, color: MUTED, marginBottom: 12 },
  barChartCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 20,
    position: 'relative',
  },
  targetLine: { position: 'absolute', left: 16, right: 16, height: 2, borderStyle: 'dashed', borderWidth: 1, borderColor: ACCENT, zIndex: 1 },
  barChartInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: BAR_CHART_HEIGHT,
  },
  barCol: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  barWrap: { width: '100%', height: BAR_CHART_HEIGHT - 24, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  bar: { width: '80%', minHeight: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barEmpty: { backgroundColor: BORDER },
  barGood: { backgroundColor: GREEN },
  barOver: { backgroundColor: RED },
  barSteps: { backgroundColor: '#2563EB' },
  barSleep: { backgroundColor: '#7C3AED' },
  barActivity: { backgroundColor: '#EA580C' },
  barLabel: { fontSize: 11, color: MUTED, fontWeight: '600', marginTop: 6 },
  barVal: { fontSize: 10, color: MUTED, marginTop: 2 },
  barSymptomWrap: { height: 16, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  barSymptom: { fontSize: 10 },
  targetLegend: { fontSize: 11, color: MUTED, marginTop: 10, textAlign: 'center' },
  summaryCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 10 },
  summaryLine: { fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 4 },
});
