const DEFAULT_SYMBOLS = [
  'ALFA',
  'BETA',
  'GAMMA',
  'DELTA',
  'EPSILON',
] as const;

export function createInstrumentSymbols(
  count: number,
): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (index < DEFAULT_SYMBOLS.length) {
      return DEFAULT_SYMBOLS[index];
    }

    return `ASSET${String(index + 1).padStart(2, '0')}`;
  });
}
