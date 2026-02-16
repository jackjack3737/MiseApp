import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Minus, Utensils } from 'lucide-react-native';
import { M3 } from '../constants/designSystem';

const BG = M3.bg;
const ACCENT = M3.accent;
const CARB_COLOR = M3.carb;
const PROTEIN_COLOR = M3.protein;
const FAT_COLOR = M3.fat;
const MUTED = M3.textMuted;
const SPRING_CONFIG: WithSpringConfig = { damping: 18, stiffness: 120 };

export interface FoodItem {
  id: string;
  name: string;
  grams: number;
  macrosPer100: { kcal: number; c: number; p: number; f: number };
}

export interface AnalyzedMeal {
  name: string;
  grams: number;
  macros: { kcal: number; c: number; p: number; f: number };
}

/** Mock: simula riconoscimento pasti da testo naturale. Sostituire con chiamata API reale. */
export async function analyzeMeal(text: string): Promise<AnalyzedMeal[]> {
  await new Promise((r) => setTimeout(r, 800));
  const t = text.toLowerCase().trim();
  const mock: Record<string, { kcal: number; c: number; p: number; f: number }> = {
    pollo: { kcal: 165, c: 0, p: 31, f: 3.6 },
    riso: { kcal: 130, c: 28, p: 2.7, f: 0.3 },
    pasta: { kcal: 131, c: 25, p: 5, f: 1.1 },
    uova: { kcal: 155, c: 1.1, p: 13, f: 11 },
    insalata: { kcal: 15, c: 2.9, p: 1.4, f: 0.2 },
    pane: { kcal: 265, c: 49, p: 9, f: 3.2 },
    tonno: { kcal: 132, c: 0, p: 28, f: 1 },
    olio: { kcal: 884, c: 0, p: 0, f: 100 },
    formaggio: { kcal: 402, c: 1.3, p: 25, f: 33 },
    salmone: { kcal: 208, c: 0, p: 20, f: 13 },
    manzo: { kcal: 250, c: 0, p: 26, f: 15 },
    verdure: { kcal: 35, c: 7, p: 2, f: 0.2 },
  };
  const words = t.split(/\s+|\s*,\s*|e\s+/).filter((w) => w.length > 2);
  const seen = new Set<string>();
  const result: AnalyzedMeal[] = [];
  for (const w of words) {
    for (const [key, macros] of Object.entries(mock)) {
      if (w.includes(key) && !seen.has(key)) {
        seen.add(key);
        result.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          grams: key === 'olio' ? 10 : key === 'uova' ? 50 : 100,
          macros: { ...macros },
        });
        break;
      }
    }
  }
  if (result.length === 0) {
    result.push({
      name: text.slice(0, 30) || 'Alimento',
      grams: 100,
      macros: { kcal: 150, c: 15, p: 10, f: 8 },
    });
  }
  return result;
}

function macrosForGrams(macrosPer100: FoodItem['macrosPer100'], grams: number) {
  const r = grams / 100;
  return {
    kcal: Math.round(macrosPer100.kcal * r),
    c: Math.round(macrosPer100.c * r),
    p: Math.round(macrosPer100.p * r),
    f: Math.round(macrosPer100.f * r),
  };
}

const DONUT_R = 44;
const DONUT_STROKE = 10;

export interface QuickAddMealProps {
  mealType: string;
  onSave: (entries: { food_name: string; kcal: number; carbs: number; proteins: number; fats: number; label: string }[]) => void;
  initialItems?: FoodItem[];
}

export default function QuickAddMeal({ mealType, onSave, initialItems = [] }: QuickAddMealProps) {
  const [items, setItems] = useState<FoodItem[]>([]);

  React.useEffect(() => {
    setItems(initialItems?.length ? initialItems : []);
  }, [initialItems]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const m = macrosForGrams(it.macrosPer100, it.grams);
        acc.kcal += m.kcal;
        acc.c += m.c;
        acc.p += m.p;
        acc.f += m.f;
        return acc;
      },
      { kcal: 0, c: 0, p: 0, f: 0 }
    );
  }, [items]);

  const totalKcal = totals.kcal || 1;
  const carbShare = (totals.c * 4) / totalKcal;
  const proteinShare = (totals.p * 4) / totalKcal;
  const fatShare = (totals.f * 9) / totalKcal;

  const animKcal = useSharedValue(0);

  React.useEffect(() => {
    animKcal.value = withSpring(totals.kcal, SPRING_CONFIG);
  }, [totals.kcal]);

  const animatedCenterStyle = useAnimatedStyle(() => ({
    opacity: withSpring(1),
    transform: [{ scale: withSpring(1) }],
  }));

  const updateGrams = useCallback((id: string, grams: number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, grams: Math.round(grams) } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleSaveToLog = useCallback(() => {
    const entries = items.map((it) => {
      const m = macrosForGrams(it.macrosPer100, it.grams);
      return {
        food_name: it.name,
        kcal: m.kcal,
        carbs: m.c,
        proteins: m.p,
        fats: m.f,
        label: `${it.grams}g`,
      };
    });
    onSave(entries);
    setItems([]);
  }, [items, onSave]);

  const circumference = 2 * Math.PI * (DONUT_R - DONUT_STROKE / 2);
  const carbDash = (carbShare / (carbShare + proteinShare + fatShare || 1)) * circumference;
  const proteinDash = (proteinShare / (carbShare + proteinShare + fatShare || 1)) * circumference;
  const fatDash = (fatShare / (carbShare + proteinShare + fatShare || 1)) * circumference;

  return (
    <View style={styles.container}>
      {items.length > 0 && (
        <>
          <View style={styles.donutWrap}>
            <Svg width={DONUT_R * 2 + 20} height={DONUT_R * 2 + 20} style={styles.donutSvg}>
              <Circle
                cx={DONUT_R + 10}
                cy={DONUT_R + 10}
                r={DONUT_R - DONUT_STROKE / 2}
                stroke={BG}
                strokeWidth={DONUT_STROKE}
                fill="none"
              />
              <Circle
                cx={DONUT_R + 10}
                cy={DONUT_R + 10}
                r={DONUT_R - DONUT_STROKE / 2}
                stroke={CARB_COLOR}
                strokeWidth={DONUT_STROKE}
                fill="none"
                strokeDasharray={`${carbDash} ${circumference}`}
                strokeDashoffset={0}
                transform={`rotate(-90 ${DONUT_R + 10} ${DONUT_R + 10})`}
              />
              <Circle
                cx={DONUT_R + 10}
                cy={DONUT_R + 10}
                r={DONUT_R - DONUT_STROKE / 2}
                stroke={PROTEIN_COLOR}
                strokeWidth={DONUT_STROKE}
                fill="none"
                strokeDasharray={`${proteinDash} ${circumference}`}
                strokeDashoffset={-carbDash}
                transform={`rotate(-90 ${DONUT_R + 10} ${DONUT_R + 10})`}
              />
              <Circle
                cx={DONUT_R + 10}
                cy={DONUT_R + 10}
                r={DONUT_R - DONUT_STROKE / 2}
                stroke={FAT_COLOR}
                strokeWidth={DONUT_STROKE}
                fill="none"
                strokeDasharray={`${fatDash} ${circumference}`}
                strokeDashoffset={-(carbDash + proteinDash)}
                transform={`rotate(-90 ${DONUT_R + 10} ${DONUT_R + 10})`}
              />
            </Svg>
            <Animated.View style={[styles.donutCenter, animatedCenterStyle]}>
              <Text style={styles.donutKcal}>{totals.kcal}</Text>
              <Text style={styles.donutLabel}>kcal</Text>
            </Animated.View>
            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: CARB_COLOR }]} />
                <Text style={styles.legendText}>C {totals.c}g</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: PROTEIN_COLOR }]} />
                <Text style={styles.legendText}>P {totals.p}g</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: FAT_COLOR }]} />
                <Text style={styles.legendText}>F {totals.f}g</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.listScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {items.map((it) => {
              const m = macrosForGrams(it.macrosPer100, it.grams);
              return (
                <View key={it.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <TouchableOpacity onPress={() => removeItem(it.id)} hitSlop={12}>
                      <Minus size={18} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.sliderRow}>
                    <Text style={styles.gramsLabel}>{it.grams}g</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={10}
                      maximumValue={500}
                      step={5}
                      value={it.grams}
                      onValueChange={(v) => updateGrams(it.id, v)}
                      minimumTrackTintColor={ACCENT}
                      maximumTrackTintColor={MUTED}
                      thumbTintColor={ACCENT}
                    />
                  </View>
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroChip, { color: CARB_COLOR }]}>{m.kcal} kcal</Text>
                    <Text style={[styles.macroChip, { color: CARB_COLOR }]}>C{m.c}</Text>
                    <Text style={[styles.macroChip, { color: PROTEIN_COLOR }]}>P{m.p}</Text>
                    <Text style={[styles.macroChip, { color: FAT_COLOR }]}>F{m.f}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveToLog}>
            <Utensils size={18} color={M3.bg} />
            <Text style={styles.saveBtnText}>Aggiungi a {mealType}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUTED,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: M3.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: M3.text,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    borderWidth: 1,
    borderColor: M3.border,
  },
  sendBtn: {
    position: 'absolute',
    right: 24,
    top: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.7 },
  donutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  donutSvg: { marginRight: 12 },
  donutCenter: {
    position: 'absolute',
    left: 10,
    top: 20,
    width: DONUT_R * 2 - 10,
    height: DONUT_R * 2 - 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutKcal: { color: ACCENT, fontSize: 22, fontWeight: '800', fontFamily: 'monospace' },
  donutLabel: { color: MUTED, fontSize: 10, marginTop: 2 },
  legend: { marginLeft: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: MUTED, fontSize: 11, fontFamily: 'monospace' },
  listScroll: { maxHeight: 280 },
  itemCard: {
    backgroundColor: M3.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemName: { color: M3.text, fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gramsLabel: { color: ACCENT, fontSize: 12, fontWeight: '700', minWidth: 36, fontFamily: 'monospace' },
  slider: { flex: 1, height: 32 },
  macroRow: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  macroChip: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  saveBtnText: { color: M3.bg, fontSize: 14, fontWeight: '800', fontFamily: 'monospace' },
});
