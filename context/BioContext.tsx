import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import useHealthConnect from '../hooks/useHealthConnect';

// ─── TIPI ───────────────────────────────────────────────────────────────────
export type WeatherState = {
  temp: number;
  condition: string;
  saltAdvice: string;
  isLive: boolean;
  loading: boolean;
  error: string | null;
};

export type MetricsState = {
  readiness: number;   // 0-100
  cnsBattery: number;  // 0-100 (HRV-based o fallback sonno)
  glycogen: number;    // 0-100
  hydration: number;   // 0-100
};

export type BioContextValue = {
  weather: WeatherState;
  metrics: MetricsState;
  coachMessage: string;
  /** Se true, i dati da sensori (Battito, HRV, Sonno) potrebbero mancare: chiedi permessi Health Connect */
  healthPermissionMissing: boolean;
  actions: {
    updateWeather: (patch: Partial<WeatherState>) => void;
    updateMetrics: (patch: Partial<MetricsState>) => void;
    setCoachMessage: (msg: string) => void;
    refreshWeather: () => Promise<void>;
    refreshHealth: () => void;
    /** Richiedi permessi Health Connect (Battito, HRV, Sonno, ecc.). Chiamare se healthPermissionMissing o dati mancanti. */
    requestHealthPermissions: () => void;
    /** Apre l'app Impostazioni di Health Connect (Android). */
    openHealthConnectSettings: () => void;
    logWorkout: (intensity?: 'low' | 'medium' | 'high') => void;
  };
};

// ─── HELPERS METEO (GPS reale via expo-location) ─────────────────────────────
function getSaltAdviceFromTemp(temp: number): string {
  if (temp > 25) return '🔥 Caldo intenso. Pre-carico 1g sodio consigliato.';
  if (temp < 10) return '❄️ Freddo. Riscaldamento esteso e idratazione.';
  return '✅ Condizioni termiche ok. Idratazione standard.';
}

function getConditionFromCode(code: number): string {
  if (code === 0) return 'Sereno';
  if (code <= 3) return 'Nuvoloso';
  if (code <= 49) return 'Nebbia';
  if (code <= 59) return 'Pioggia';
  if (code <= 69) return 'Neve';
  if (code <= 79) return 'Rovesci';
  if (code <= 84) return 'Temporale';
  if (code <= 94) return 'Neve/ Temporale';
  return 'Variabile';
}

// ─── ALGORITMI RAW → SCORE (0-100) ───────────────────────────────────────────
/** Readiness: (OreSonno/8 * 50) + (HRV_Normalizzato * 50). Se HRV mancante, usa sonno come proxy. */
function computeReadiness(sleepHours: number, hrvMs: number | null): number {
  const sleepComponent = Math.min(1, sleepHours / 8) * 50;
  const hrvNorm = hrvMs != null
    ? Math.min(1, Math.max(0, (hrvMs - 20) / (100 - 20)))  // 20ms=0, 100ms=1
    : Math.min(1, sleepHours / 8);                        // fallback: proxy da sonno
  const hrvComponent = hrvNorm * 50;
  return Math.round(Math.min(100, Math.max(0, sleepComponent + hrvComponent)));
}

/** CNS Battery: HRV (ms) → 0-100 (20ms=0%, 100ms=100%). Se manca HRV, fallback da sonno. */
function computeCnsBattery(hrvMs: number | null, sleepHours: number): number {
  if (hrvMs != null && hrvMs > 0) {
    const pct = ((hrvMs - 20) / (100 - 20)) * 100;
    return Math.round(Math.min(100, Math.max(0, pct)));
  }
  return Math.round(Math.min(100, Math.max(0, (sleepHours / 8) * 100)));
}

/** Glycogen: 100% - 1% per 15 kcal active. + aggiunta da carboidrati loggati (10g → +2%). */
function computeGlycogen(activeKcal: number, todayCarbs: number): number {
  const fromSport = activeKcal / 15;
  const fromCarbs = (todayCarbs / 10) * 2;
  const value = 100 - fromSport + fromCarbs;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Hydration: stima da meteo e passi. Alta temp + molti passi = più dispersione. */
function computeHydration(temp: number, steps: number): number {
  const tempFactor = (temp - 20) * 2;
  const stepsFactor = steps / 2000;
  const value = 100 - tempFactor - stepsFactor;
  return Math.round(Math.min(100, Math.max(0, value)));
}

// ─── DEFAULT ─────────────────────────────────────────────────────────────────
const DEFAULT_WEATHER: WeatherState = {
  temp: 20,
  condition: '—',
  saltAdvice: 'Caricamento meteo...',
  isLive: false,
  loading: true,
  error: null,
};

const DEFAULT_METRICS: MetricsState = {
  readiness: 0,
  cnsBattery: 0,
  glycogen: 100,
  hydration: 80,
};

const LOGS_KEY = '@user_daily_logs';

function createDefaultValue(): BioContextValue {
  const noop = () => {};
  const noopAsync = async () => {};
  return {
    weather: DEFAULT_WEATHER,
    metrics: DEFAULT_METRICS,
    coachMessage: 'Caricamento...',
    healthPermissionMissing: false,
    actions: {
      updateWeather: noop,
      updateMetrics: noop,
      setCoachMessage: noop,
      refreshWeather: noopAsync,
      refreshHealth: noop,
      requestHealthPermissions: noop,
      logWorkout: noop,
    },
  };
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const BioContext = createContext<BioContextValue>(createDefaultValue());

export function BioProvider({ children }: { children: React.ReactNode }) {
  const [weather, setWeatherState] = useState<WeatherState>(DEFAULT_WEATHER);
  const [metrics, setMetrics] = useState<MetricsState>(DEFAULT_METRICS);
  const [coachMessage, setCoachMessageState] = useState<string>('Caricamento...');
  const [todayCarbs, setTodayCarbs] = useState<number>(0);
  const [healthRefreshTick, setHealthRefreshTick] = useState(0);

  const health = useHealthConnect();
  const {
    steps,
    calories: activeKcal,
    sleepHours,
    heartRate,
    hrvMs,
    loading: healthLoading,
    error: healthError,
    refresh: refreshHealthConnect,
    connect: requestHealthConnect,
    openSettings: openHealthConnectSettings,
  } = health;

  const healthPermissionMissing =
    Platform.OS === 'android' && !healthLoading && healthError != null;

  const updateWeather = useCallback((patch: Partial<WeatherState>) => {
    setWeatherState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateMetrics = useCallback((patch: Partial<MetricsState>) => {
    setMetrics((prev) => ({ ...prev, ...patch }));
  }, []);

  const setCoachMessage = useCallback((msg: string) => {
    setCoachMessageState(msg);
  }, []);

  const refreshWeather = useCallback(async () => {
    setWeatherState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
      let lat = 41.9;
      let lon = 12.5;
      const isLive = status === 'granted';
      if (isLive) {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        } catch {
          // coordinate di default (Roma)
        }
      }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const res = await fetch(url);
      const json = await res.json();
      const temp = json?.current_weather?.temperature;
      const code = json?.current_weather?.weathercode ?? 0;
      if (typeof temp !== 'number') {
        setWeatherState((prev) => ({
          ...prev,
          loading: false,
          error: 'Dato meteo non disponibile',
          saltAdvice: getSaltAdviceFromTemp(20),
          isLive: false,
        }));
        return;
      }
      setWeatherState({
        temp: Math.round(temp * 10) / 10,
        condition: getConditionFromCode(code),
        saltAdvice: getSaltAdviceFromTemp(temp),
        isLive,
        loading: false,
        error: null,
      });
    } catch (e) {
      setWeatherState((prev) => ({
        ...prev,
        loading: false,
        error: (e as Error).message || 'Errore meteo',
        saltAdvice: getSaltAdviceFromTemp(20),
        isLive: false,
      }));
    }
  }, []);

  const refreshHealth = useCallback(() => {
    refreshHealthConnect();
    setHealthRefreshTick((t) => t + 1);
  }, [refreshHealthConnect]);

  const requestHealthPermissions = useCallback(() => {
    requestHealthConnect();
    setHealthRefreshTick((t) => t + 1);
  }, [requestHealthConnect]);
  const openHealthConnectSettingsAction = useCallback(() => {
    openHealthConnectSettings();
  }, [openHealthConnectSettings]);

  const logWorkout = useCallback((intensity: 'low' | 'medium' | 'high' = 'medium') => {
    setMetrics((prev) => ({
      ...prev,
      cnsBattery: Math.max(0, prev.cnsBattery - (intensity === 'high' ? 25 : intensity === 'medium' ? 15 : 8)),
      glycogen: Math.max(0, prev.glycogen - (intensity === 'high' ? 30 : intensity === 'medium' ? 20 : 10)),
    }));
  }, []);

  // Carica carboidrati di oggi da @user_daily_logs (per Glycogen)
  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    AsyncStorage.getItem(LOGS_KEY).then((raw) => {
      if (cancelled) return;
      if (!raw) {
        setTodayCarbs(0);
        return;
      }
      try {
        const logs: any[] = JSON.parse(raw);
        const carbs = logs
          .filter((l: any) => l.date === today)
          .reduce((acc: number, l: any) => acc + (l.carbs ?? l.c ?? 0), 0);
        setTodayCarbs(carbs);
      } catch {
        setTodayCarbs(0);
      }
    });
    return () => { cancelled = true; };
  }, [steps, activeKcal, sleepHours, healthRefreshTick]);

  // Calcolo metriche da dati REALI (Health Connect: sonno, HRV, battito + carbs + weather)
  useEffect(() => {
    if (healthLoading && Platform.OS === 'android') return;

    const sleep = sleepHours ?? 0;
    const readiness = computeReadiness(sleep, hrvMs ?? null);
    const cnsBattery = computeCnsBattery(hrvMs ?? null, sleep);
    const glycogen = computeGlycogen(activeKcal ?? 0, todayCarbs);
    const hydration = computeHydration(weather.temp, steps ?? 0);

    const next = { readiness, cnsBattery, glycogen, hydration };
    setMetrics(next);

    if (__DEV__) {
      const realData = {
        steps: steps ?? 0,
        activeKcal: Math.round(activeKcal ?? 0),
        sleepHours: sleep,
        heartRate: heartRate ?? 0,
        hrvMs: hrvMs ?? null,
        todayCarbs,
        weatherTemp: weather.temp,
        computed: next,
      };
      console.log('REAL DATA FETCHED:', realData);
    }
  }, [healthLoading, steps, activeKcal, sleepHours, heartRate, hrvMs, todayCarbs, weather.temp]);

  // Fetch meteo dopo il primo mount (posizione GPS reale)
  useEffect(() => {
    const t = setTimeout(() => refreshWeather(), 100);
    return () => clearTimeout(t);
  }, [refreshWeather]);

  // Coach message da weather + metrics reali
  useEffect(() => {
    const { temp, loading } = weather;
    const { readiness, cnsBattery } = metrics;
    if (loading) {
      setCoachMessageState('Caricamento dati...');
      return;
    }
    if (temp < 10) {
      setCoachMessageState('Fa freddo. Riscaldamento esteso richiesto.');
      return;
    }
    if (readiness < 50) {
      setCoachMessageState('Batteria scarica. Priorità al recupero.');
      return;
    }
    if (cnsBattery < 40) {
      setCoachMessageState('Sistema nervoso sotto stress. Oggi meglio Active Recovery.');
      return;
    }
    if (readiness >= 70 && cnsBattery >= 60) {
      setCoachMessageState('Sistema pronto. Puoi spingere in sicurezza.');
      return;
    }
    setCoachMessageState('Stato nella norma. Mantieni idratazione e sonno.');
  }, [weather.loading, weather.temp, metrics.readiness, metrics.cnsBattery]);

  const value: BioContextValue = {
    weather,
    metrics,
    coachMessage,
    healthPermissionMissing,
    actions: {
      updateWeather,
      updateMetrics,
      setCoachMessage,
      refreshWeather,
      refreshHealth,
      requestHealthPermissions,
      openHealthConnectSettings: openHealthConnectSettingsAction,
      logWorkout,
    },
  };

  return <BioContext.Provider value={value}>{children}</BioContext.Provider>;
}

export function useBio(): BioContextValue {
  return useContext(BioContext);
}
