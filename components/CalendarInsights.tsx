import { DS } from '../constants/designSystem';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getMonthlyPatterns, type MonthlyPattern } from '../database/db';

const DARK_CARD = DS.surface;
const DARK_TEXT = DS.text;
const DARK_MUTED = DS.textMuted;
const DARK_BORDER = DS.border;
const WARNING = DS.warning;
const RED_ALERT = DS.alert;

export type CalendarInsightsProps = {
  currentMonth: Date;
  onHighlightDates?: (dates: string[]) => void;
};

export function CalendarInsights({ currentMonth, onHighlightDates }: CalendarInsightsProps) {
  const [patterns, setPatterns] = useState<MonthlyPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const list = await getMonthlyPatterns(year, month);
      setPatterns(list);
    } catch (e) {
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, [currentMonth.getFullYear(), currentMonth.getMonth()]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNotePress = (p: MonthlyPattern) => {
    onHighlightDates?.(p.symptomDates);
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Note dell'Investigatore</Text>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={DS.accent} />
          <Text style={styles.loadingText}>Analisi pattern in corso...</Text>
        </View>
      </View>
    );
  }

  if (patterns.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Note dell'Investigatore</Text>
        <Text style={styles.emptyText}>Nessun indizio questo mese (serve almeno 2 occorrenze evento → sintomo in 24h).</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Note dell'Investigatore</Text>
      {patterns.map((p, idx) => {
        const isEvidence = p.count >= 3;
        return (
          <TouchableOpacity
            key={`${p.eventType}-${p.eventName}-${p.symptomName}-${idx}`}
            style={[styles.noteRow, isEvidence ? styles.noteRowEvidence : styles.noteRowClue]}
            onPress={() => handleNotePress(p)}
            activeOpacity={0.8}
          >
            <Text style={styles.noteIcon}>{isEvidence ? '🔴' : '🟡'}</Text>
            <Text style={[styles.noteText, isEvidence && styles.noteTextEvidence]}>
              {isEvidence
                ? `⚠️ PATTERN RILEVATO: C'è una correlazione sistematica tra "${p.eventName}" e "${p.symptomName}" (${p.count} casi). Considera di eliminarli.${p.ingredients?.length ? ` Ingredienti del pasto: ${p.ingredients.join(', ')}.` : ''}` 
                : `Sospetto: ${p.count} volte questo mese hai avuto "${p.symptomName}" dopo "${p.eventName}".${p.ingredients?.length ? ` Ingredienti: ${p.ingredients.join(', ')}.` : ''} Al prossimo scatta l'allarme.`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DARK_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 12,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: DARK_MUTED,
  },
  emptyText: {
    fontSize: 14,
    color: DARK_MUTED,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  noteRowClue: {
    backgroundColor: 'rgba(249, 171, 0, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: WARNING,
  },
  noteRowEvidence: {
    backgroundColor: 'rgba(217, 48, 37, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: RED_ALERT,
  },
  noteIcon: {
    fontSize: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: DARK_TEXT,
    lineHeight: 20,
  },
  noteTextEvidence: {
    color: DARK_TEXT,
    fontWeight: '500',
  },
});
