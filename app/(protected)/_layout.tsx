import { Stack } from 'expo-router';
import { UserProvider } from '@/src/context/user-context';

export default function ProtectedLayout() {
  return (
    <UserProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="users/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="users/create" options={{ headerShown: false }} />
        <Stack.Screen name="users/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/create" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/midweek" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/midweek/create" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/midweek/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/create" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/edit/[id]" options={{ headerShown: false }} />
        {/* Módulo de limpieza */}
        <Stack.Screen name="cleaning/index" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/create" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="unauthorized" options={{ headerShown: false }} />
        {/* Settings */}
        <Stack.Screen name="settings/theme" options={{ title: 'Tema', headerShown: true }} />
        <Stack.Screen name="settings/language" options={{ title: 'Idioma', headerShown: true }} />
        <Stack.Screen name="settings/about" options={{ title: 'Acerca de', headerShown: true }} />
      </Stack>
    </UserProvider>
  );
}
