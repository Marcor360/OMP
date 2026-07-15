declare module 'react-test-renderer' {
  export function act<T>(callback: () => T | Promise<T>): Promise<void>;
  export function create(element: unknown): {
    unmount: () => void;
    update: (element: unknown) => void;
    toJSON: () => unknown;
  };
}
