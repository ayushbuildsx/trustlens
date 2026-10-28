import React from 'react';
import { Verdict } from '../types';

interface RulerScoreBarProps {
  score: number;
  verdict: Verdict;
}

export const RulerScoreBar: React.FC<RulerScoreBarProps> = ({ score, verdict }) => {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine indicator color
  const markerColor =
    verdict === 'Looks Safe'
      ? 'var(--safe)'
      : verdict === 'Suspicious'
      ? 'var(--warn)'
      : 'var(--accent)';

  // 11 tick stops: 0, 10, 20, ..., 100
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div className="w-full my-4" aria-label={`Trust Score Ruler: ${score} out of 100`}>
      {/* Ruler container */}
      <div className="relative w-full h-[28px] select-none">
        {/* Baseline 1px ink rule */}
        <div
          className="absolute left-0 right-0 top-[14px] h-[1px]"
          style={{ backgroundColor: 'var(--line)' }}
        />

        {/* Active fill line up to current score in verdict color */}
        <div
          className="absolute left-0 top-[13px] h-[3px] transition-all duration-300 ease-out"
          style={{
            width: `${clampedScore}%`,
            backgroundColor: markerColor,
          }}
        />

        {/* Tick marks every 10 units */}
        {ticks.map((tick) => {
          const isMajor = tick === 0 || tick === 50 || tick === 100;
          return (
            <div
              key={tick}
              className="absolute -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${tick}%`, top: isMajor ? '8px' : '11px' }}
            >
              <div
                style={{
                  width: isMajor ? '1.5px' : '1px',
                  height: isMajor ? '12px' : '6px',
                  backgroundColor: isMajor ? 'var(--ink)' : 'var(--ink-3)',
                }}
              />
            </div>
          );
        })}

        {/* 12px Marker Notch showing current score */}
        <div
          className="absolute -translate-x-1/2 top-[8px] z-10 transition-all duration-300 ease-out flex flex-col items-center"
          style={{ left: `${clampedScore}%` }}
        >
          {/* Vertical 12px bar marker */}
          <div
            className="w-[3px] h-[12px]"
            style={{ backgroundColor: markerColor }}
          />
        </div>
      </div>

      {/* Axis labels: 0 (Fake), 50, 100 (Safe) in Mono 12px */}
      <div className="flex justify-between items-center text-[12px] font-mono tracking-[0.08em] text-[var(--ink-3)] uppercase mt-1">
        <span>00 / FAKE</span>
        <span>50</span>
        <span>100 / SAFE</span>
      </div>
    </div>
  );
};
