import type { ConfigContext, ExpoConfig } from 'expo/config';
import baseConfigJson from './app.json';

// app.json conserva el manifiesto base. EAS puede materializar GOOGLE_SERVICES_JSON
// como file environment variable; el archivo nunca se versiona.
// La validación de que exista corresponde al perfil de EAS antes de un release.
const baseConfig = baseConfigJson.expo as ExpoConfig;

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (process.env.EAS_BUILD_PROFILE === 'production' && !googleServicesFile) {
    throw new Error('GOOGLE_SERVICES_JSON is required for production EAS builds.');
  }

  return {
    ...baseConfig,
    ...config,
    android: {
      ...baseConfig.android,
      ...config.android,
      googleServicesFile: googleServicesFile || './google-services.json',
    },
  };
};
