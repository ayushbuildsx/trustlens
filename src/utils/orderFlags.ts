import { RedFlag } from '../types';

/**
 * Sorts red flags based on the order their trigger quotes appear in the evidence text.
 * The earliest quote in the text will be index 0, so it receives [1] / [01].
 */
export function sortRedFlagsByAppearance(flags: RedFlag[], text: string): RedFlag[] {
  if (!Array.isArray(flags) || flags.length <= 1 || !text) {
    return flags || [];
  }

  const textLower = text.toLowerCase();

  const getPosition = (flag: RedFlag): number => {
    if (!flag.quote) return Number.MAX_SAFE_INTEGER;
    const cleanQuote = flag.quote.trim().toLowerCase();
    if (!cleanQuote) return Number.MAX_SAFE_INTEGER;
    const pos = textLower.indexOf(cleanQuote);
    return pos === -1 ? Number.MAX_SAFE_INTEGER : pos;
  };

  return [...flags].sort((a, b) => getPosition(a) - getPosition(b));
}
