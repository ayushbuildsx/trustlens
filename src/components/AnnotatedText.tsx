import React from 'react';
import { RedFlag } from '../types';
import { sortRedFlagsByAppearance } from '../utils/orderFlags';

interface AnnotatedTextProps {
  text: string;
  redFlags: RedFlag[];
}

interface MatchInterval {
  start: number;
  end: number;
  flagIndex: number;
  quoteText: string;
}

export const AnnotatedText: React.FC<AnnotatedTextProps> = ({ text, redFlags }) => {
  if (!text || text.trim().length === 0) {
    return (
      <div className="border border-[var(--line)] bg-[var(--paper)] p-4 font-mono text-[14px] leading-[1.8] text-[var(--ink-3)] italic">
        No text content recorded for this case.
      </div>
    );
  }

  // Ensure redFlags are sorted by the order their quotes appear in the text
  const sortedFlags = sortRedFlagsByAppearance(redFlags, text);

  // Find occurrences of quotes in the text
  const intervals: MatchInterval[] = [];

  sortedFlags.forEach((flag, idx) => {
    if (!flag.quote || flag.quote.trim().length < 2) return;
    const cleanQuote = flag.quote.trim().replace(/^["']|["']$/g, '');

    // Try exact search first
    let pos = text.indexOf(cleanQuote);

    // If not found, try case-insensitive search
    if (pos === -1) {
      pos = text.toLowerCase().indexOf(cleanQuote.toLowerCase());
    }

    if (pos !== -1) {
      const start = pos;
      const end = pos + cleanQuote.length;

      // Ensure no overlapping interval
      const overlaps = intervals.some(
        (existing) => Math.max(start, existing.start) < Math.min(end, existing.end)
      );

      if (!overlaps) {
        intervals.push({
          start,
          end,
          flagIndex: idx,
          quoteText: text.substring(start, end),
        });
      }
    }
  });

  // Sort intervals by their start position in the original text
  intervals.sort((a, b) => a.start - b.start);

  // Build rendered tokens
  const renderedElements: React.ReactNode[] = [];
  let cursor = 0;

  intervals.forEach((interval, i) => {
    // Normal text before this highlighted match
    if (interval.start > cursor) {
      renderedElements.push(
        <span key={`text-${i}`}>
          {text.substring(cursor, interval.start)}
        </span>
      );
    }

    // Highlighted phrase with superscript matching the ordered red flag index
    const flagNumber = interval.flagIndex + 1;

    renderedElements.push(
      <mark
        key={`highlight-${i}`}
        style={{
          backgroundColor: 'rgba(217, 58, 31, 0.22)',
          WebkitBoxDecorationBreak: 'clone',
          boxDecorationBreak: 'clone',
          padding: '1px 3px',
        }}
        className="text-[var(--ink)] font-mono font-medium rounded-[1px] inline"
      >
        {interval.quoteText}
        <sup
          className="text-[var(--accent)] font-mono font-bold text-[11px] ml-0.5 select-none"
          title={`Red Flag #${flagNumber}: ${sortedFlags[interval.flagIndex]?.title}`}
        >
          [{flagNumber}]
        </sup>
      </mark>
    );

    cursor = interval.end;
  });

  // Remaining text after last match
  if (cursor < text.length) {
    renderedElements.push(
      <span key="text-end">
        {text.substring(cursor)}
      </span>
    );
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--paper)] p-4 font-mono text-[14px] leading-[1.8] text-[var(--ink)] whitespace-pre-wrap break-words select-text">
      {renderedElements.length > 0 ? renderedElements : text}
    </div>
  );
};
