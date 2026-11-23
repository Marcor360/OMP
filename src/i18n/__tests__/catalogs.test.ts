import { interpolate } from '../interpolate';
import { en } from '../locales/en';
import { es } from '../locales/es';

const keysOf = (node: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(node).flatMap(([key, value]) => typeof value === 'string'
    ? [prefix + key]
    : keysOf(value as Record<string, unknown>, prefix + key + '.'));

it('keeps the Spanish and English catalog keys aligned', () => {
  expect(keysOf(en).sort()).toEqual(keysOf(es).sort());
});

it('replaces both catalog placeholder formats and preserves unknown placeholders', () => {
  expect(interpolate('Hello {name} · {{count}} · {missing}', { name: 'Ana', count: 0 }))
    .toBe('Hello Ana · 0 · {missing}');
});
