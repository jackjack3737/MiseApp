/**
 * Design system unico: Material 3 Light (stile Google).
 * Sfondo chiaro, card elevate, accent blu Google. Usa questo file in tutta l'app.
 */

// ─── Material 3 Light (Google) ───────────────────────────────────────────────
export const M3 = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#EEEEEE',
  border: '#DADCE0',
  borderLight: '#E8EAED',
  text: '#1C1C1E',
  textBody: '#3C3C43',
  textMuted: '#8E8E93',
  accent: '#1A73E8',
  accentPastel: '#AECBFA',
  accentDim: 'rgba(26, 115, 232, 0.12)',
  success: '#1E8E3E',
  warning: '#F9AB00',
  alert: '#D93025',
  protein: '#4285F4',
  carb: '#EA4335',
  fat: '#FBBC04',
  symptom: '#7C3AED',
} as const;

// ─── DS: palette principale (M3 Light) ─────────────────────────────────────
export const DS = {
  bg: M3.bg,
  surface: M3.surface,
  surfaceElevated: M3.surfaceElevated,
  border: M3.border,
  borderLight: M3.borderLight,
  text: M3.text,
  textSecondary: M3.textBody,
  textMuted: M3.textMuted,
  accent: M3.accent,
  accentDim: M3.accentDim,
  success: M3.success,
  warning: M3.warning,
  alert: M3.alert,
  protein: M3.protein,
  carb: M3.carb,
  fat: M3.fat,
  tabBg: M3.bg,
  tabActive: M3.accent,
  tabInactive: M3.textMuted,
} as const;

// ─── TIPOGRAFIA ─────────────────────────────────────────────────────────────
export const TYPO = {
  // Titoli
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '600' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  // Corpo
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  // Piccolo
  small: { fontSize: 13, fontWeight: '400' as const },
  smallMedium: { fontSize: 13, fontWeight: '500' as const },
  // Label / caption
  caption: { fontSize: 11, fontWeight: '500' as const },
  captionUpper: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  // Numeri / valori
  value: { fontSize: 28, fontWeight: '700' as const },
  valueSm: { fontSize: 17, fontWeight: '600' as const },
} as const;

// ─── SPACING & RADIUS ────────────────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// Alias tema (BioStatusScreen, tab Corpo, History, ecc.) — stesso M3 Light
export const TRACKER_BLACK = {
  BG: M3.bg,
  CARD: M3.surface,
  BORDER: M3.border,
  TEXT: M3.text,
  TEXT_MUTED: M3.textMuted,
  ACCENT: M3.accent,
  SUCCESS: M3.success,
  WARNING: M3.warning,
  ALERT: M3.alert,
  SYMPTOM: M3.symptom,
} as const;

export default DS;
