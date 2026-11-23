/** OMP catalogs use both {name} and {{name}}. */
export const interpolate = (message: string, values: Record<string, string | number>): string =>
  message.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (placeholder, doubleKey: string, singleKey: string) => {
    const value = values[doubleKey ?? singleKey];
    return value === undefined ? placeholder : String(value);
  });
