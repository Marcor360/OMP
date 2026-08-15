import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type FatalConfigurationScreenProps = {
  missingKeys: readonly string[];
};

// Pantalla de arranque puro: no puede depender de Firebase, contexto ni
// navegación porque se monta cuando ninguno de esos sistemas está inicializado.
export function FatalConfigurationScreen({ missingKeys }: FatalConfigurationScreenProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // RootLayoutNav nunca se monta en este camino, así que nadie más oculta el splash.
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>OMP no pudo iniciar</Text>
      <Text style={styles.body}>
        La configuración de esta instalación está incompleta.{'\n'}Contacta al administrador del
        sistema.
      </Text>
      <Text style={styles.code}>Código: APP-CFG-001</Text>
      {__DEV__ && missingKeys.length > 0 ? (
        <View style={styles.devBox}>
          <Text style={styles.devTitle}>Variables faltantes (solo dev):</Text>
          {missingKeys.map((key) => (
            <Text key={key} style={styles.devKey}>
              • {key}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  code: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  devBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignSelf: 'stretch',
  },
  devTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  devKey: {
    fontSize: 14,
    color: '#991B1B',
  },
});
