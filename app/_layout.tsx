import '../global.css';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const init = useGameStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0f172a' },
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
      </Stack>
    </>
  );
}
