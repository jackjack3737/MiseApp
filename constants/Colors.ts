import { DS, M3 } from './designSystem';

/** Tema Material 3 Light (Google). */
export const Colors = {
  light: {
    background: M3.bg,
    surface: M3.surface,
    border: M3.border,
    text: M3.text,
    textMuted: M3.textMuted,
    icon: M3.text,
    protein: M3.protein,
    netCarbs: M3.success,
    fat: M3.fat,
    error: M3.alert,
  },
  dark: {
    background: DS.bg,
    surface: DS.surface,
    border: DS.border,
    text: DS.text,
    textMuted: DS.textMuted,
    icon: DS.text,
    protein: DS.protein,
    netCarbs: DS.success,
    fat: DS.fat,
    error: DS.alert,
  },
};