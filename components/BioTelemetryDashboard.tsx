/**
 * BioTelemetryDashboard — Grafici biometrici su sfondo bianco, leggibili.
 * Efficienza (Rocca), Recupero (griglia), Macro (grassi/carb), Sintomi (scatter).
 */

import React, { useMemo } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');
const PAD = 20;
const CHART_W = width - PAD * 2;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

// ─── Tema bianco ───────────────────────────────────────────────────────────
const BG = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const GRID = '#E0E0E0';
const TEXT = '#1C1C1E';
const MUTED = '#666666';
const AXIS = '#888888';
const LINE = '#0EA5E9';
const LINE_FILL = '#0EA5E9';
const ORANGE = '#EA580C';
const BLUE = '#2563EB';
const RED = '#DC2626';
const GREEN = '#16A34A';

export type HistoryDay = {
  totalKcal?: number;
  totalCarbs?: number;
  totalProt?: number;
  totalFat?: number;
  medicalEvents?: { name: string; impactLabel?: string }[];
  hasSymptom?: boolean;
};

export type BioSnapshot = {
  sleepHours?: number;
  sleepQuality?: string;
  readiness?: number;
  steps?: number;
  activeKcal?: number;
  hrvMs?: number | null;
};

export type BioTelemetryDashboardProps = {
  historyData: Record<string, HistoryDay>;
  getBioForDate: (dateStr: string) => BioSnapshot | null;
};

function getLast14Days(): string[] {
  const out: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
}

function roccaIndex(bio: BioSnapshot | null): number {
  if (!bio) return 0;
  const steps = bio.steps ?? 0;
  const activeKcal = bio.activeKcal ?? 0;
  const activeMinutes = activeKcal > 0 ? Math.max(1, activeKcal / 4) : 1;
  const avgHR = 55 + ((bio.readiness ?? 50) / 100) * 40;
  if (avgHR <= 0) return 0;
  return (steps / activeMinutes) / avgHR;
}

function neuralBattery(bio: BioSnapshot | null): number {
  if (!bio) return 0;
  const readiness = bio.readiness ?? 0;
  const sleepHours = bio.sleepHours ?? 0;
  const sleepScore = Math.min(100, (sleepHours / 8) * 100);
  return sleepScore * 0.4 + readiness * 0.6;
}

function metabolicShift(day: HistoryDay | undefined): number {
  if (!day) return 0;
  const carb = Math.max(0.1, day.totalCarbs ?? 0.1);
  const fat = day.totalFat ?? 0;
  return fat / carb;
}

function glycogenEst(bio: BioSnapshot | null): number {
  return bio?.readiness ?? 70;
}

function stressIntensity(bio: BioSnapshot | null, day: HistoryDay | undefined): number {
  const base = 100 - (bio?.readiness ?? 70);
  const symptomBoost = (day?.medicalEvents?.length ?? 0) * 25;
  return Math.min(100, base + symptomBoost);
}

function bezierPath(points: { x: number; y: number }[], widthPx: number, heightPx: number): string {
  if (points.length < 2) return '';
  const x = (v: number) => v * widthPx;
  const y = (v: number) => heightPx - v * heightPx;
  let d = `M ${x(points[0].x)} ${y(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const cpX = (prev.x + p.x) / 2;
    d += ` C ${x(cpX)} ${y(prev.y)} ${x(cpX)} ${y(p.y)} ${x(p.x)} ${y(p.y)}`;
  }
  return d;
}

function areaPath(points: { x: number; y: number }[], widthPx: number, heightPx: number): string {
  const line = bezierPath(points, widthPx, heightPx);
  if (!line) return '';
  const x = (v: number) => v * widthPx;
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${x(last.x)} ${heightPx} L ${x(first.x)} ${heightPx} Z`;
}

export function BioTelemetryDashboard({ historyData, getBioForDate }: BioTelemetryDashboardProps) {
  const days = useMemo(() => getLast14Days(), []);

  const telemetry = useMemo(() => {
    return days.map((date) => {
      const day = historyData[date];
      const bio = getBioForDate(date);
      return {
        date,
        rocca: roccaIndex(bio),
        neural: neuralBattery(bio),
        metabolic: metabolicShift(day),
        fat: day?.totalFat ?? 0,
        carb: day?.totalCarbs ?? 0,
        kcal: day?.totalKcal ?? 0,
        glycogen: glycogenEst(bio),
        stress: stressIntensity(bio, day),
        hasSymptom: (day?.medicalEvents?.length ?? 0) > 0,
        sleepHours: bio?.sleepHours ?? 0,
      };
    });
  }, [days, historyData, getBioForDate]);

  const chartW = Math.max(200, CHART_W - 60);
  const chartH = 140;

  // ─── A. Efficienza (Rocca Index) ─────────────────────────────────────────
  const roccas = telemetry.map((t) => t.rocca);
  const minR = Math.min(...roccas, 0);
  const maxR = Math.max(...roccas, 1);
  const rangeR = maxR - minR || 1;
  const engineData = telemetry.map((t, i) => ({
    x: i / Math.max(1, telemetry.length - 1),
    y: (t.rocca - minR) / rangeR,
  }));
  const engineRising = engineData.length >= 2 && engineData[engineData.length - 1].y > engineData[0].y;
  const enginePath = bezierPath(engineData, chartW, chartH);
  const engineArea = areaPath(engineData, chartW, chartH);

  // ─── B. Griglia recupero (7x2) ───────────────────────────────────────────
  const gridCols = 7;
  const gridRows = 2;
  const cellW = chartW / gridCols;
  const cellH = 44;
  const neuralValues = telemetry.slice(0, gridCols * gridRows).map((t) => {
    const load = Math.min(1, (t.kcal / 2500) * 1.2);
    const recovery = Math.min(1, (t.sleepHours / 8));
    return Math.max(0, recovery - load * 0.5 + 0.3);
  });
  while (neuralValues.length < gridCols * gridRows) neuralValues.push(0);

  // ─── C. Grassi e carboidrati (stacked) ───────────────────────────────────
  const maxMacro = Math.max(1, ...telemetry.map((t) => t.fat + t.carb));
  const fuelPoints = telemetry.map((t, i) => ({
    x: i / Math.max(1, telemetry.length - 1),
    fatNorm: t.fat / maxMacro,
    carbNorm: t.carb / maxMacro,
    highCarb: t.carb > (t.fat + t.carb) * 0.55,
  }));
  const fh = 100;
  let fatPath = `M 0 ${fh}`;
  let carbPath = '';
  let lastFatY = fh;
  for (let i = 0; i < fuelPoints.length; i++) {
    const p = fuelPoints[i];
    const x = p.x * chartW;
    const fatY = fh - p.fatNorm * fh;
    const carbY = fatY - p.carbNorm * fh;
    fatPath += ` L ${x} ${fatY}`;
    if (i === 0) carbPath = `M 0 ${fatY} L 0 ${carbY}`;
    else carbPath += ` L ${x} ${carbY}`;
    lastFatY = fatY;
  }
  fatPath += ` L ${chartW} ${fh} Z`;
  const firstFatY = fuelPoints[0] ? fh - fuelPoints[0].fatNorm * fh : fh;
  carbPath += ` L ${chartW} ${lastFatY} L 0 ${firstFatY} Z`;

  // ─── D. Scatter sintomi ──────────────────────────────────────────────────
  const scatterW = chartW;
  const scatterH = 120;
  const scatterPoints = telemetry.map((t) => ({
    x: (t.glycogen / 100) * scatterW,
    y: scatterH - (t.stress / 100) * scatterH,
    hasSymptom: t.hasSymptom,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* A. Efficienza */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Efficienza (Rocca Index)</Text>
        <Text style={styles.sectionSub}>Ultimi 14 giorni • Più alto = migliore efficienza (passi/battito)</Text>
        <View style={styles.chartWrap}>
          <View style={styles.axisRow}>
            <Text style={styles.axisYLabel}>{maxR.toFixed(1)}</Text>
            <Svg width={chartW} height={chartH} style={styles.svg}>
              <Defs>
                <LinearGradient id="engineGrad" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0%" stopColor={LINE_FILL} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={LINE_FILL} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {[...Array(5)].map((_, i) => (
                <Rect key={`hy${i}`} x={0} y={(chartH / 4) * i} width={chartW} height={1} fill={GRID} />
              ))}
              {[...Array(8)].map((_, i) => (
                <Rect key={`vx${i}`} x={(chartW / 7) * i} y={0} width={1} height={chartH} fill={GRID} />
              ))}
              <Path d={engineArea} fill="url(#engineGrad)" />
              <Path d={enginePath} stroke={LINE} strokeWidth={2} fill="none" />
            </Svg>
          </View>
          <Text style={styles.axisYLabelMin}>{minR.toFixed(1)}</Text>
          <View style={styles.axisXRow}>
            <Text style={styles.axisXLabel}>Giorno 1</Text>
            <Text style={styles.axisXLabel}>14</Text>
          </View>
          <Text style={[styles.insight, engineRising && styles.insightPositive]}>
            {engineRising ? '✓ Andamento in miglioramento' : 'Andamento stabile'}
          </Text>
        </View>
      </View>

      {/* B. Griglia recupero */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recupero (carico vs sonno)</Text>
        <Text style={styles.sectionSub}>Ogni quadrato = un giorno • Verde = recuperato, Rosso = sotto carico</Text>
        <View style={styles.chartWrap}>
          <Svg width={chartW} height={gridRows * cellH} style={styles.svg}>
            {neuralValues.map((v, idx) => {
              const row = Math.floor(idx / gridCols);
              const col = idx % gridCols;
              const r = Math.round(255 - v * 255);
              const g = Math.round(150 + v * 105);
              const fill = `rgb(${r},${g},80)`;
              return (
                <Rect
                  key={idx}
                  x={col * cellW + 1}
                  y={row * cellH + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  fill={fill}
                  stroke={GRID}
                  strokeWidth={1}
                />
              );
            })}
          </Svg>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: RED }]} />
            <Text style={styles.legendText}>Sotto carico</Text>
            <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
            <Text style={styles.legendText}>Recuperato</Text>
          </View>
        </View>
      </View>

      {/* C. Grassi e carboidrati */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Macro (grassi e carboidrati)</Text>
        <Text style={styles.sectionSub}>Arancione = grassi, Blu = carboidrati • Pallino = giorno alto in carb</Text>
        <View style={styles.chartWrap}>
          <Svg width={chartW} height={fh} style={styles.svg}>
            {[...Array(5)].map((_, i) => (
              <Rect key={`fy${i}`} x={0} y={(fh / 4) * i} width={chartW} height={1} fill={GRID} />
            ))}
            <Path d={fatPath} fill={ORANGE} opacity={0.85} />
            <Path d={carbPath} fill={BLUE} opacity={0.85} />
            {fuelPoints.map((p, i) =>
              p.highCarb ? (
                <Circle key={i} cx={p.x * chartW} cy={fh - (p.fatNorm + p.carbNorm) * fh - 4} r={4} fill={GREEN} />
              ) : null
            )}
          </Svg>
          <View style={styles.axisXRow}>
            <Text style={styles.axisXLabel}>Giorno 1</Text>
            <Text style={styles.axisXLabel}>14</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
            <Text style={styles.legendText}>Grassi</Text>
            <View style={[styles.legendDot, { backgroundColor: BLUE }]} />
            <Text style={styles.legendText}>Carboidrati</Text>
          </View>
        </View>
      </View>

      {/* D. Sintomi e stress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Giorni con sintomi</Text>
        <Text style={styles.sectionSub}>Asse X = recupero stimato, Asse Y = stress • Cerchi rossi = giorni con sintomi</Text>
        <View style={styles.chartWrap}>
          <View style={styles.axisRow}>
            <Text style={styles.axisYLabel}>100</Text>
            <Svg width={scatterW} height={scatterH} style={styles.svg}>
              {[...Array(5)].map((_, i) => (
                <Rect key={`sy${i}`} x={0} y={(scatterH / 4) * i} width={scatterW} height={1} fill={GRID} />
              ))}
              {[...Array(6)].map((_, i) => (
                <Rect key={`sx${i}`} x={(scatterW / 5) * i} y={0} width={1} height={scatterH} fill={GRID} />
              ))}
              {scatterPoints.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={p.hasSymptom ? 8 : 5}
                  fill={p.hasSymptom ? RED : AXIS}
                  opacity={p.hasSymptom ? 1 : 0.5}
                  stroke={p.hasSymptom ? '#B91C1C' : 'transparent'}
                  strokeWidth={1}
                />
              ))}
            </Svg>
          </View>
          <Text style={styles.axisYLabelMin}>0</Text>
          <View style={styles.axisXRow}>
            <Text style={styles.axisXLabel}>Recup. basso</Text>
            <Text style={styles.axisXLabel}>Alto</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: RED }]} />
            <Text style={styles.legendText}>Giorno con sintomo</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: PAD, paddingBottom: 80 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: MUTED, marginBottom: 12 },
  chartWrap: {
    borderWidth: 1,
    borderColor: GRID,
    borderRadius: 12,
    padding: 16,
    backgroundColor: CARD_BG,
  },
  axisRow: { flexDirection: 'row', alignItems: 'flex-start' },
  axisYLabel: { fontSize: 10, color: AXIS, width: 28, marginTop: 0, fontFamily: MONO },
  axisYLabelMin: { fontSize: 10, color: AXIS, marginLeft: 28, fontFamily: MONO },
  axisXRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  axisXLabel: { fontSize: 10, color: AXIS, fontFamily: MONO },
  svg: { overflow: 'visible' },
  insight: { fontSize: 13, color: MUTED, marginTop: 12 },
  insightPositive: { color: GREEN, fontWeight: '600' },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12, flexWrap: 'wrap' },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: MUTED },
});
