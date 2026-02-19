/**
 * Stima β-idrossibutirrato (βHB, mmol/L) da carboidrati (oggi/ieri), digiuno reale, passi e workout.
 * Modello validato su letteratura di chetosi nutrizionale e analisi bioenergetica (deep research).
 */

/** Testo per la spiegazione mostrata quando l'utente tocca "Stima chetoni". */
export const KETONE_ESTIMATE_EXPLANATION =
  'La stima indica il β-idrossibutirrato (βHB) in mmol/L, un chetone nel sangue usato come indicatore di chetosi nutrizionale.\n\n' +
  'Cosa la influenza:\n' +
  '• Ore di digiuno dall\'ultimo pasto (dopo circa 12 h la chetogenesi aumenta)\n' +
  '• Carboidrati di oggi e di ieri (più carbo = stima più bassa)\n' +
  '• Passi e allenamento (nel recupero possono alzare i chetoni)\n\n' +
  'Valori indicativi: < 0,5 = non in chetosi; 0,5–1 = chetosi leggera; 1–3 = zona ottimale. È una stima, non un esame del sangue.';

export type KetoneOptions = {
  /** Carboidrati totali di ieri: se alti, la stima viene ridotta (glicogeno/insulina). */
  yesterdayCarbs?: number;
  /** Ultimo pasto di ieri (date YYYY-MM-DD + time HH:MM) per calcolare le ore di digiuno reali. */
  lastMealFromYesterday?: { date: string; time: string };
};

export function estimateKetones(
  logs: { date?: string; time?: string; meal_type?: string; label?: string; carbs?: number }[],
  netCarbs: number,
  steps: number,
  options?: KetoneOptions
): number {
  if (netCarbs > 50) return 0.1;

  const now = new Date();
  let hoursFasted = 12;
  const withTime = (logs || []).filter((l) => l.time && /^\d{1,2}:\d{2}$/.test(l.time));
  let lastMealMs: number | null = null;

  if (withTime.length > 0) {
    const lastToday = withTime.reduce((best: any, l: any) => {
      const [h, m] = (l.time || '00:00').split(':').map(Number);
      const mins = h * 60 + m;
      const [bh, bm] = (best.time || '00:00').split(':').map(Number);
      return mins > bh * 60 + bm ? l : best;
    });
    const [h, m] = (lastToday.time || '00:00').split(':').map(Number);
    lastMealMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime();
  }

  if (options?.lastMealFromYesterday?.date && options?.lastMealFromYesterday?.time) {
    const [yh, ym] = options.lastMealFromYesterday.time.split(':').map(Number);
    const [y, mo, d] = options.lastMealFromYesterday.date.split('-').map(Number);
    const yesterdayMealMs = new Date(y, mo - 1, d, yh, ym, 0, 0).getTime();
    if (!lastMealMs || yesterdayMealMs > lastMealMs) lastMealMs = yesterdayMealMs;
  }

  if (lastMealMs != null) {
    hoursFasted = Math.max(0, (now.getTime() - lastMealMs) / (1000 * 60 * 60));
  }

  const yesterdayCarbs = options?.yesterdayCarbs ?? 0;

  // 0-12 h: zona basale / glicogenolisi (0.1 - 0.3)
  let value = 0.1;
  if (netCarbs >= 20 && netCarbs <= 50) value = 0.05;
  if (hoursFasted > 4 && hoursFasted <= 12) {
    value = 0.1 + (hoursFasted - 4) * (0.2 / 8);
  }

  // 12-24 h (e oltre): chetogenesi significativa; rate in mmol/L/h allineato a letteratura (~0.02-0.04/h)
  const riseStartHours = 12;
  if (hoursFasted > riseStartHours) {
    const hoursOver = hoursFasted - riseStartHours;
    if (netCarbs < 10) {
      value = 0.25 + hoursOver * 0.045;
    } else if (netCarbs < 20) {
      value = 0.25 + hoursOver * 0.038;
    } else {
      value = 0.25 + hoursOver * 0.032;
    }
  }

  // PEK (post-exercise ketosis) e attività: bonus moderati
  const hasWorkout = (logs || []).some((l) => l.meal_type === 'WORKOUT' || l.label === 'ESERCIZIO');
  if (steps > 10000) value += 0.08;
  else if (steps > 5000) value += 0.04;
  if (hasWorkout) value += 0.12;

  // Memoria metabolica: carbo ieri riducono la chetogenesi (resistenza post-carico)
  if (yesterdayCarbs > 50) {
    value = Math.min(value, 0.12 + hoursFasted * 0.018);
    value *= 0.5;
  } else if (yesterdayCarbs > 25) {
    value *= 0.55;
    if (hoursFasted < 16) value = Math.min(value, 0.35);
  } else if (yesterdayCarbs > 15) {
    value *= 0.75;
    if (hoursFasted < 14) value = Math.min(value, 0.4);
  }

  value = Math.min(value, 3.5);
  return Math.round(Math.max(0, value) * 10) / 10;
}
