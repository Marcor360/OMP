import { CleaningDashboardScreen } from '@/src/modules/cleaning';
import { CleaningCacheProvider } from '@/src/modules/cleaning/context/CleaningCacheContext';

/**
 * Tab de Limpieza — Punto de entrada desde la barra de navegación inferior.
 * La pantalla completa de gestión de grupos vive en CleaningDashboardScreen.
 */
export default function CleaningTab() {
  return (
    <CleaningCacheProvider>
      <CleaningDashboardScreen />
    </CleaningCacheProvider>
  );
}
