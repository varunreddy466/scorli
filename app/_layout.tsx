import '../global.css';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SyncIndicator } from '@/components/SyncIndicator';
import { initSync, runSync } from '@/sync';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  const initGameStore = useGameStore((state) => state.init);

  useEffect(() => {
    void initGameStore();
  }, [initGameStore]);

  useEffect(() => {
    let active = true;
    let unsubscribeAuth = () => {};

    void useAuthStore
      .getState()
      .init()
      .then((cleanup) => {
        if (!active) {
          cleanup();
          return;
        }
        unsubscribeAuth = cleanup;
        void runSync();
      });

    const unsubscribeSync = initSync();

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0f172a' },
          headerRight: () => <SyncIndicator />,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Scorli' }} />
        <Stack.Screen name="new-game" options={{ title: 'New Game' }} />
        <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
        <Stack.Screen
          name="game/[id]/round"
          options={{ title: 'Add Round', presentation: 'modal' }}
        />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: 'Sign In' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
      </Stack>
    </>
  );
}
