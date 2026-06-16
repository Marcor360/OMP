type LogArgs = unknown[];

const isDevelopment = (): boolean =>
  typeof __DEV__ !== 'undefined' && __DEV__ === true;

const withScope = (scope: string, args: LogArgs): LogArgs => [`[${scope}]`, ...args];

export const createLogger = (scope: string) => ({
  debug: (...args: LogArgs): void => {
    if (isDevelopment()) {
      console.debug(...withScope(scope, args));
    }
  },
  info: (...args: LogArgs): void => {
    if (isDevelopment()) {
      console.info(...withScope(scope, args));
    }
  },
  warn: (...args: LogArgs): void => {
    console.warn(...withScope(scope, args));
  },
  error: (...args: LogArgs): void => {
    console.error(...withScope(scope, args));
  },
});

export const logger = createLogger('OMP');
