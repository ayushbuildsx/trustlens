import React from 'react';
import { CaseLogItem, CaseReport } from '../types';

interface CaseLogProps {
  logs: CaseLogItem[];
  currentCaseId?: string;
  onSelectCase: (report: CaseReport) => void;
  onClearLog: () => void;
}

export const CaseLog: React.FC<CaseLogProps> = ({
  logs,
  currentCaseId,
  onSelectCase,
  onClearLog,
}) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-4">
        <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)]">
          <span className="text-[var(--accent)] font-semibold">04</span> / CASE LOG
        </div>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={onClearLog}
            className="text-[12px] font-mono tracking-[0.08em] text-[var(--ink-3)] hover:text-[var(--accent)] transition-colors underline underline-offset-4 cursor-pointer"
          >
            CLEAR LOG
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-3)] font-inter italic max-w-[62ch]">
          Your last five checks will be logged here, on this device only.
        </p>
      ) : (
        <div className="border border-[var(--line-hairline)] bg-[var(--paper)]">
          {logs.map((item, idx) => {
            const isSelected = item.id === currentCaseId;
            const verdictColor =
              item.verdict === 'Looks Safe'
                ? 'var(--safe)'
                : item.verdict === 'Suspicious'
                ? 'var(--warn)'
                : 'var(--accent)';

            const preview =
              item.previewText && item.previewText.length > 40
                ? `${item.previewText.slice(0, 40)}...`
                : item.previewText || 'Visual screenshot evidence';

            return (
              <div
                key={item.id}
                onClick={() => onSelectCase(item.report)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCase(item.report);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Load Case #${item.caseNumber}: ${item.verdict}, score ${item.score}`}
                className={`flex items-center justify-between gap-3 p-3 cursor-pointer transition-colors duration-150 ${
                  idx !== logs.length - 1 ? 'border-b border-[var(--line-hairline)]' : ''
                } ${
                  isSelected
                    ? 'bg-[var(--paper-2)] border-l-2 border-l-[var(--accent)]'
                    : 'hover:bg-[var(--paper-2)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mono score */}
                  <span className="font-mono text-[13px] font-semibold text-[var(--ink)] w-[32px] text-right shrink-0">
                    {String(item.score).padStart(2, '0')}
                  </span>

                  {/* Verdict small colored text label */}
                  <span
                    className="font-mono text-[11px] tracking-[0.08em] uppercase shrink-0 font-medium"
                    style={{ color: verdictColor }}
                  >
                    {item.verdict}
                  </span>

                  {/* First 40 characters */}
                  <span className="text-[13px] font-inter text-[var(--ink-2)] truncate">
                    {preview}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-[var(--ink-3)] shrink-0 hidden sm:inline-block">
                  #{String(item.caseNumber).padStart(4, '0')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
