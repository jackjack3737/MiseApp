import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { ACCENT_BTN, TEXT_PRIMARY, CARD_BG } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface SmartHintProps {
  text: string;
  visible: boolean;
  onDismiss?: () => void;
}

const ACCENT_ALPHA = 'rgba(79, 70, 229, 0.1)';

export default function SmartHint({ text, visible, onDismiss }: SmartHintProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (visible) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <Sparkles size={18} color={ACCENT_BTN} style={styles.icon} />
      <Text style={styles.text} numberOfLines={3}>{text}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.closeBtn}>
          <X size={18} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_ALPHA,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
  },
});
