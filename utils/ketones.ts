/**
 * Stima chetoni (mmol/L) da carboidrati, passi e log pasti con orario.
 * Usato da Tracker e HomeScreen.
 */
export function estimateKetones(logs: { time?: string; meal_type?: string; label?: string }[], netCarbs: number, steps: number): number {
  if (netCarbs > 50) return 0.1;
  let base = netCarbs >= 20 && netCarbs <= 50 ? 0.3 : 0.5;
  let value = base;

  const now = new Date();
  const withTime = (logs || []).filter((l) => l.time && /^\d{1,2}:\d{2}$/.test(l.time));
  let hoursFasted = 12;
  if (withTime.length > 0) {
    const last = withTime.reduce((best: any, l: any) => {
      const [h, m] = (l.time || '00:00').split(':').map(Number);
      const mins = h * 60 + m;
      const [bh, bm] = (best.time || '00:00').split(':').map(Number);
      return mins > bh * 60 + bm ? l : best;
    });
    const [h, m] = (last.time || '00:00').split(':').map(Number);
    const lastMeal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    hoursFasted = Math.max(0, (now.getTime() - lastMeal.getTime()) / (1000 * 60 * 60));
  }
  if (hoursFasted > 4) value += (hoursFasted - 4) * 0.1;

  if (steps > 10000) value += 0.4;
  else if (steps > 5000) value += 0.2;
  const hasWorkout = (logs || []).some((l) => l.meal_type === 'WORKOUT' || l.label === 'ESERCIZIO');
  if (hasWorkout) value += 0.5;

  value = Math.min(value, 3.5);
  return Math.round(Math.max(0, value) * 10) / 10;
}
