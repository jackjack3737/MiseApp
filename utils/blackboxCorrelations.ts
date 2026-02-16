/**
 * Algoritmi di correlazione per la Scatola Nera (History).
 * Causality, Fatigue Predictor, Metabolic Window.
 */

import type { DailyBlackboxRecord, CorrelationResult } from '../types/blackbox';

/**
 * Confronta il giorno corrente con il precedente per:
 * 1. Causality: sintomi di oggi vs dati del giorno prima (sonno, HRV, sodio).
 * 2. Fatigue Predictor: HRV in calo + stress/readiness in calo → allerta.
 * 3. Metabolic Window: ore tra ultimo pasto e inizio sonno (se disponibili).
 */
export function calculateCorrelations(
  today: DailyBlackboxRecord,
  yesterday: DailyBlackboxRecord | null
): CorrelationResult {
  const result: CorrelationResult = {
    causality: null,
    fatigueAlert: false,
    metabolicWindowHours: null,
  };

  const { nutrition, bio, medical } = today;

  // --- 1. CAUSALITY: sintomi oggi vs ieri
  if (medical.symptoms.length > 0 && yesterday) {
    const hints: string[] = [];
    const prevBio = yesterday.bio;
    if (prevBio.sleepHours > 0 && prevBio.sleepHours < 6.5) {
      hints.push(`poco sonno ieri (${prevBio.sleepHours.toFixed(1)}h)`);
    }
    if (prevBio.hrvMs != null && prevBio.hrvMs < 40) {
      hints.push('HRV bassa ieri');
    }
    if (yesterday.medical.symptoms.length > 0) {
      hints.push('sintomi già presenti ieri');
    }
    if (hints.length > 0) {
      result.causality = `Possibile legame con: ${hints.join(', ')}`;
    }
  }

  // --- 2. FATIGUE PREDICTOR: HRV in calo + readiness in calo
  if (yesterday && bio.hrvMs != null && yesterday.bio.hrvMs != null) {
    const hrvDropped = bio.hrvMs < yesterday.bio.hrvMs;
    const readinessDropped = bio.readiness < yesterday.bio.readiness;
    const fatigueHigher = bio.fatiguePredictorScore > yesterday.bio.fatiguePredictorScore;
    if (hrvDropped && (readinessDropped || fatigueHigher)) {
      result.fatigueAlert = true;
    }
  }

  // --- 3. METABOLIC WINDOW: ultimo pasto → inizio sonno
  const lastMealTime = nutrition.mealTimes.length > 0
    ? nutrition.mealTimes.reduce((a, b) => (a > b ? a : b))
    : null;
  const sleepStartIso = bio.sleepStartIso ?? undefined;
  if (lastMealTime && sleepStartIso) {
    try {
      const lastMeal = new Date(lastMealTime).getTime();
      const sleepStart = new Date(sleepStartIso).getTime();
      result.metabolicWindowHours = Math.round((sleepStart - lastMeal) / (1000 * 60 * 60) * 10) / 10;
    } catch {
      result.metabolicWindowHours = null;
    }
  }

  return result;
}
