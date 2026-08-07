/**
 * Stub CJS de `jose` para el entorno de pruebas.
 *
 * `firebase-admin` (>=14) depende de `jwks-rsa`, que importa `jose@6`, un paquete
 * ESM puro que Jest en modo CommonJS no puede parsear. Ninguna suite de esta
 * carpeta verifica tokens JWT reales, por lo que basta con cortar la cadena de
 * carga. Si en el futuro un test necesita verificación real de JWT, este stub
 * lanzará en lugar de devolver un resultado falso silencioso.
 */
const notImplemented = (name: string) => () => {
  throw new Error(
    `jose.${name} no está disponible en tests. Mockea explícitamente el módulo que lo usa.`,
  );
};

export const createRemoteJWKSet = notImplemented('createRemoteJWKSet');
export const jwtVerify = notImplemented('jwtVerify');
export const importJWK = notImplemented('importJWK');
export const decodeJwt = notImplemented('decodeJwt');
export const decodeProtectedHeader = notImplemented('decodeProtectedHeader');
