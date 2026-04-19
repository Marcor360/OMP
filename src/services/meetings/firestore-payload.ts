const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const sanitizeValue = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};

    Object.entries(value).forEach(([key, childValue]) => {
      const sanitizedChild = sanitizeValue(childValue);

      if (sanitizedChild !== undefined) {
        output[key] = sanitizedChild;
      }
    });

    return output;
  }

  return value;
};

/**
 * Firestore (web SDK) no permite campos con `undefined`.
 * Este helper limpia el payload en profundidad antes de addDoc/updateDoc.
 */
export const sanitizeForFirestore = <T>(value: T): T => {
  return sanitizeValue(value) as T;
};
