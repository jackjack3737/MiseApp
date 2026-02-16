/**
 * Dati di default per Bio Status. Usato da BioStatusScreen (tab Corpo) e HomeScreen (Dati di oggi).
 */

export interface BioStatusData {
  readinessScore: number;
  readinessLabel: string;
  cnsFatiguePercent: number;
  immuneShieldOk: boolean;
  fatBurnPercent: number;
  sugarBurnPercent: number;
  glycogenLevelPercent: number;
  mitochondrialScore: number;
  ghostCarbsWarning: boolean;
  ghostCarbsMessage?: string;
  deepSleepMinutes: number;
  rhrDeviation: number;
  hrvScore: number;
  remSleepMinutes: number;
  hrNadirTime: string;
  sodiumLossMg: number;
  saltLoadingMessage: string | null;
  ketoneEsterOptimalTime: string | null;
  bonkMinutesLeft: number | null;
  metabolicWindowMinutesLeft: number | null;
  stressWaveData: number[];
}

export const DEFAULT_BIO_DATA: BioStatusData = {
  readinessScore: 65,
  readinessLabel: 'Sistema Nervoso Affaticato',
  cnsFatiguePercent: 42,
  immuneShieldOk: true,
  fatBurnPercent: 98,
  sugarBurnPercent: 2,
  glycogenLevelPercent: 68,
  mitochondrialScore: 7,
  ghostCarbsWarning: false,
  ghostCarbsMessage: undefined,
  deepSleepMinutes: 45,
  rhrDeviation: 2.5,
  hrvScore: 38,
  remSleepMinutes: 90,
  hrNadirTime: '04:15',
  sodiumLossMg: 1200,
  saltLoadingMessage: 'Domani 30°C → Carica 1g sale stasera',
  ketoneEsterOptimalTime: '06:45',
  bonkMinutesLeft: 45,
  metabolicWindowMinutesLeft: 28,
  stressWaveData: [20, 45, 30, 70, 40, 55, 35, 60, 25],
};

function timeToMinutes(hhmm: string): number {
  const parts = hhmm.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

/** true se il nadir cardiaco è dopo le 03:00. */
export function isNadirAfter3AM(hrNadirTime: string): boolean {
  return timeToMinutes(hrNadirTime) > 3 * 60;
}

export function getStressAvg(d: BioStatusData): number {
  return d.stressWaveData?.length ? d.stressWaveData.reduce((a, b) => a + b, 0) / d.stressWaveData.length : 0;
}
