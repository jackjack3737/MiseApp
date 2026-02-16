import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import OnboardingFlow from './OnboardingFlow';
import { ONBOARDING_COMPLETED_KEY } from '../constants/onboarding';
import { TRACKER_BLACK } from '../constants/trackerBlack';

type Props = {
  children: React.ReactNode;
};

export default function AppGate({ children }: Props) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
      .then((value) => {
        if (!cancelled) setHasCompletedOnboarding(value === 'true');
      })
      .catch(() => {
        if (!cancelled) setHasCompletedOnboarding(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleOnboardingComplete = () => setHasCompletedOnboarding(true);

  if (hasCompletedOnboarding === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={TRACKER_BLACK.ACCENT} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: TRACKER_BLACK.BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
