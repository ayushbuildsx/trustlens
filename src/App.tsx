import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { CaseReport, CaseLogItem, Verdict } from './types';
import { RulerScoreBar } from './components/RulerScoreBar';
import { AnnotatedText } from './components/AnnotatedText';
import { CaseLog } from './components/CaseLog';
import { sortRedFlagsByAppearance } from './utils/orderFlags';

const CATEGORIES = [
  'UPI / Payment Fraud',
  'Fake Job / Internship Offer',
  'KYC & Bank Suspension Warning',
  'Phishing & Account Takeover',
  'Lottery & Prize Scams',
  'WhatsApp Forward / Rumour',
  'Greenwashing & Deceptive Claims',
  'General Suspicious Claim',
];

const EXAMPLES = [
  {
    label: 'UPI refund',
    category: 'UPI / Payment Fraud',
    text: 'Dear customer, your UPI payment of Rs 4,999 failed but amount is debited. To get refund immediately click http://upi-refund-help.xyz/claim and enter your UPI PIN. Offer valid for 2 hours only!',
  },
  {
    label: 'Fee offer',
    category: 'Fake Job / Internship Offer',
    text: 'Congratulations! You are selected for Software Internship (Work From Home, Rs 40,000/month). No interview needed. Pay Rs 1,500 registration fee to confirm your seat. Send payment screenshot on WhatsApp.',
  },
  {
    label: 'Eco claim',
    category: 'Greenwashing & Deceptive Claims',
    text: 'Our new bottle is 100% natural, eco-friendly and chemical-free. Good for you, good for the planet!',
  },
];

const LOCAL_STORAGE_KEY_LOGS = 'trustlens_case_logs_v1';
const LOCAL_STORAGE_KEY_COUNTER = 'trustlens_case_counter_v1';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categorySelectId = useId();

  // Mode: text or screenshot
  const [mode, setMode] = useState<'text' | 'screenshot'>('text');
  const [inputText, setInputText] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);

  // Image upload state
  const [imageFile, setImageFile] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
    name: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // App submission state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Current active report
  const [activeReport, setActiveReport] = useState<CaseReport | null>(null);

  // Animated score counter state
  const [displayScore, setDisplayScore] = useState<number>(0);

  // Checked verification steps for the active report
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  // Case filing log & counter in localStorage
  const [logs, setLogs] = useState<CaseLogItem[]>([]);
  const [caseCounter, setCaseCounter] = useState<number>(1);

  // Track elapsed seconds during analysis
  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Load logs and counter on initial mount
  useEffect(() => {
    try {
      const storedLogs = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
      if (storedLogs) {
        const parsed = JSON.parse(storedLogs);
        if (Array.isArray(parsed)) {
          setLogs(parsed);
        }
      }
      const storedCounter = localStorage.getItem(LOCAL_STORAGE_KEY_COUNTER);
      if (storedCounter) {
        const parsedCount = parseInt(storedCounter, 10);
        if (!isNaN(parsedCount) && parsedCount > 0) {
          setCaseCounter(parsedCount);
        }
      }
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
  }, []);

  // Reset checked steps whenever the active case changes or is cleared
  useEffect(() => {
    setCheckedSteps({});
  }, [activeReport?.id]);

  // Animate score from 0 to activeReport.score over 800ms
  useEffect(() => {
    if (!activeReport) {
      setDisplayScore(0);
      return;
    }

    const target = activeReport.score;
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      setDisplayScore(target);
      return;
    }

    let startTime: number | null = null;
    const duration = 800; // ms

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic: 1 - Math.pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * easeOut);
      setDisplayScore(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [activeReport]);

  // Resize uploaded screenshot to max 1024px width before sending
  const resizeImageToMax1024 = (
    file: File
  ): Promise<{ base64: string; mimeType: string; previewUrl: string; name: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxWidth = 1024;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const resultStr = reader.result as string;
            return resolve({
              base64: resultStr.split(',')[1],
              mimeType: file.type,
              previewUrl: resultStr,
              name: file.name,
            });
          }

          ctx.drawImage(img, 0, 0, width, height);
          const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outMime, 0.85);
          resolve({
            base64: dataUrl.split(',')[1],
            mimeType: outMime,
            previewUrl: dataUrl,
            name: file.name,
          });
        };
        img.onerror = () => reject(new Error('Failed to load image for resizing.'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Selected file must be an image format (PNG, JPEG, WebP).');
      return;
    }

    setErrorMessage(null);
    try {
      const resized = await resizeImageToMax1024(file);
      setImageFile(resized);
    } catch (e: any) {
      setErrorMessage('Failed to process image screenshot. Please try another image.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyExample = (example: (typeof EXAMPLES)[number]) => {
    setMode('text');
    setInputText(example.text);
    setCategory(example.category);
    setErrorMessage(null);
  };

  // Perform Analysis with 30-second timeout
  const handleCheckNow = async () => {
    if (mode === 'text' && !inputText.trim()) {
      setErrorMessage('Please enter suspicious message text to analyze.');
      return;
    }
    if (mode === 'screenshot' && !imageFile) {
      setErrorMessage('Please upload a screenshot or drop an image file.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const payload: Record<string, any> = {
        category,
      };

      if (mode === 'text') {
        payload.text = inputText.trim();
      } else if (imageFile) {
        payload.imageBase64 = imageFile.base64;
        payload.mimeType = imageFile.mimeType;
        if (inputText.trim()) {
          payload.text = inputText.trim();
        }
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server responded with status ${response.status}`
        );
      }

      const data = await response.json();

      const newCaseNumber = caseCounter;
      const nextCounter = caseCounter + 1;
      setCaseCounter(nextCounter);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_COUNTER, String(nextCounter));
      } catch (e) {
        console.warn('Failed saving counter:', e);
      }

      const extractedText =
        data.extractedText ||
        (mode === 'text' ? inputText.trim() : 'Visual evidence examined');

      // Sort red flags by the exact order their trigger quotes appear in the evidence text
      const sortedRedFlags = sortRedFlagsByAppearance(data.redFlags || [], extractedText);

      const newReport: CaseReport = {
        id: `case-${Date.now()}`,
        caseNumber: newCaseNumber,
        timestamp: Date.now(),
        score: data.score,
        verdict: data.verdict as Verdict,
        summary: data.summary,
        redFlags: sortedRedFlags,
        verifySteps: data.verifySteps || [],
        extractedText,
        category,
        imagePreviewUrl: imageFile ? imageFile.previewUrl : undefined,
        originalInputPreview:
          mode === 'text' ? inputText.trim() : `Screenshot: ${imageFile?.name || 'Evidence'}`,
      };

      setActiveReport(newReport);
      setCheckedSteps({});

      // Update case logs (store last 5)
      const newLogItem: CaseLogItem = {
        id: newReport.id,
        caseNumber: newReport.caseNumber,
        timestamp: newReport.timestamp,
        score: newReport.score,
        verdict: newReport.verdict,
        previewText: newReport.extractedText || newReport.summary,
        category: newReport.category,
        report: newReport,
      };

      const updatedLogs = [newLogItem, ...logs.filter((l) => l.id !== newReport.id)].slice(
        0,
        5
      );
      setLogs(updatedLogs);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
      } catch (e) {
        console.warn('Failed saving logs:', e);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Analysis error:', err);
      if (err.name === 'AbortError') {
        setErrorMessage('Analysis timed out after 30 seconds. Please try again.');
      } else {
        setErrorMessage(
          err.message || 'Unable to connect to the forensic desk. Please try again.'
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const handleSelectCaseFromLog = (report: CaseReport) => {
    const sortedFlags = sortRedFlagsByAppearance(report.redFlags || [], report.extractedText);
    setActiveReport({ ...report, redFlags: sortedFlags });
    setCheckedSteps({});
    setErrorMessage(null);
  };

  const handleClearLog = () => {
    setLogs([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_LOGS);
    } catch (e) {
      console.warn('Failed to clear logs:', e);
    }
  };

  const formattedDeskCaseNumber = String(
    activeReport ? activeReport.caseNumber : caseCounter
  ).padStart(4, '0');

  const isSubmitDisabled =
    isAnalyzing ||
    (mode === 'text' && !inputText.trim()) ||
    (mode === 'screenshot' && !imageFile);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col selection:bg-[rgba(217,58,31,0.22)]">
      {/* 48px Top bar */}
      <header className="h-[48px] border-b border-[var(--line)] bg-[var(--paper)] px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)]">
          TRUSTLENS / CASE DESK
        </div>
        <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-2)]">
          CASE FILE No. {formattedDeskCaseNumber}
        </div>
      </header>

      {/* Main Container: max-width 1200px, centered, padding 24px (16px on mobile) */}
      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex-1">
        {/* Hero Section */}
        <div className="pb-8 border-b border-[var(--line)]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="font-fraunces font-bold text-[var(--ink)] text-[clamp(48px,8vw,96px)] leading-[0.95] tracking-[-0.02em]">
                Trust<span className="italic text-[var(--accent)] font-semibold">Lens</span>
              </h1>
              <p className="mt-3 text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-3)]">
                AI TRUST CHECKER FOR SUSPICIOUS OFFERS & MESSAGES · INDIA DESK
              </p>
            </div>
            <div className="max-w-[44ch] text-[15px] font-inter text-[var(--ink-2)] leading-relaxed">
              Verify UPI payment requests, fake work-from-home offers, phishing SMS,
              KYC intimidation alerts, and unverified viral claims.
            </div>
          </div>
        </div>

        {/* Layout Grid: Desktop 5fr 7fr with 1px vertical rule, Mobile single column */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[5fr_1px_7fr] gap-8 lg:gap-12 items-start">
          {/* LEFT COLUMN: Input & Settings (Sticky on Desktop) */}
          <div className="lg:sticky lg:top-6 flex flex-col">
            {/* 01 / EVIDENCE */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-4">
                <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] whitespace-nowrap">
                  <span className="text-[var(--accent)] font-semibold">01</span> / EVIDENCE
                </div>

                {/* Mode toggle "Paste text | Upload screenshot" */}
                <div className="flex items-center gap-2 text-[12px] font-mono tracking-[0.08em] uppercase whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('text');
                      setErrorMessage(null);
                    }}
                    className={`transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      mode === 'text'
                        ? 'text-[var(--ink)] font-medium underline decoration-[var(--accent)] decoration-2 underline-offset-[6px]'
                        : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Paste text
                  </button>
                  <span className="text-[var(--line-hairline)] select-none">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('screenshot');
                      setErrorMessage(null);
                    }}
                    className={`transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      mode === 'screenshot'
                        ? 'text-[var(--ink)] font-medium underline decoration-[var(--accent)] decoration-2 underline-offset-[6px]'
                        : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Upload screenshot
                  </button>
                </div>
              </div>

              {/* Textarea or Dropzone */}
              {mode === 'text' ? (
                <div>
                  <label htmlFor="evidence-text" className="sr-only">
                    Evidence Text
                  </label>
                  <textarea
                    id="evidence-text"
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Paste the suspicious SMS, WhatsApp message, email, or offer text here..."
                    className="w-full min-h-[280px] border border-[var(--line)] p-4 text-[15px] font-inter text-[var(--ink)] placeholder-[var(--ink-3)] ruled-paper resize-y outline-none transition-all"
                  />

                  {/* Example links row */}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px] font-inter">
                    <span className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-3)]">
                      Samples:
                    </span>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        onClick={() => handleApplyExample(ex)}
                        className="text-[var(--ink-2)] hover:text-[var(--ink)] underline underline-offset-4 decoration-[var(--ink-3)] hover:decoration-[var(--accent)] cursor-pointer transition-colors"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload-input"
                  />
                  {!imageFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      tabIndex={0}
                      role="button"
                      aria-label="Upload evidence screenshot"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`h-[200px] border border-dashed border-[var(--line)] p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragging ? 'bg-[var(--paper-2)]' : 'hover:bg-[var(--paper-2)]'
                      }`}
                    >
                      <span className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] text-center">
                        DROP IMAGE OR CLICK TO UPLOAD
                      </span>
                      <span className="text-[12px] text-[var(--ink-3)] font-inter mt-2">
                        Accepts PNG, JPG, or screenshot clips up to 8MB
                      </span>
                    </div>
                  ) : (
                    <div className="border border-[var(--line)] bg-[var(--paper-2)] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-mono uppercase tracking-[0.08em] text-[var(--ink-2)] truncate max-w-[220px]">
                          {imageFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-[12px] font-mono uppercase tracking-[0.08em] text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          REMOVE
                        </button>
                      </div>
                      <div className="max-h-[220px] overflow-hidden border border-[var(--line-hairline)] bg-[var(--paper)] flex items-center justify-center">
                        <img
                          src={imageFile.previewUrl}
                          alt="Uploaded evidence preview"
                          className="max-h-[220px] object-contain w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Optional notes for screenshot */}
                  <div className="mt-4">
                    <label
                      htmlFor="screenshot-notes"
                      className="block text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-3)] mb-1"
                    >
                      Context or notes (optional)
                    </label>
                    <input
                      id="screenshot-notes"
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="e.g. Received via WhatsApp from unknown number +91..."
                      className="w-full border border-[var(--line)] bg-[var(--paper)] p-3 text-[14px] font-inter text-[var(--ink)] outline-none"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Single 1px horizontal ink rule with 32px vertical spacing */}
            <div className="my-[32px] h-[1px] bg-[var(--line)]" />

            {/* 02 / CATEGORY */}
            <section>
              <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] mb-4">
                <span className="text-[var(--accent)] font-semibold">02</span> / CATEGORY
              </div>

              <div className="relative border-b border-[var(--line)]">
                <label htmlFor={categorySelectId} className="sr-only">
                  Select fraud or claim category
                </label>
                <select
                  id={categorySelectId}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent py-2 pr-8 font-fraunces text-[20px] text-[var(--ink)] cursor-pointer outline-none border-none font-semibold"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="font-inter text-[15px] font-normal text-[var(--ink)]">
                      {cat}
                    </option>
                  ))}
                </select>
                {/* Custom chevron */}
                <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--ink)] font-mono text-[14px]">
                  ▼
                </div>
              </div>
            </section>

            {/* Single 1px horizontal ink rule with 32px vertical spacing */}
            <div className="my-[32px] h-[1px] bg-[var(--line)]" />

            {/* 03 / SUBMIT */}
            <section>
              <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] mb-4">
                <span className="text-[var(--accent)] font-semibold">03</span> / SUBMIT
              </div>

              <button
                type="button"
                onClick={handleCheckNow}
                disabled={isSubmitDisabled}
                className={`w-full h-[56px] text-white font-mono text-[14px] uppercase tracking-[0.08em] rounded-none transition-all duration-150 flex items-center justify-center ${
                  isSubmitDisabled
                    ? 'bg-[#9C9A93] cursor-not-allowed opacity-90'
                    : 'bg-[var(--ink)] hover:bg-[var(--accent)] active:translate-y-[1px] cursor-pointer'
                } ${isAnalyzing ? 'animate-subtle-pulse' : ''}`}
              >
                {isAnalyzing ? `ANALYZING... ${elapsedSeconds}s` : 'CHECK NOW'}
              </button>
            </section>

            {/* Single 1px horizontal ink rule with 32px vertical spacing */}
            <div className="my-[32px] h-[1px] bg-[var(--line)]" />

            {/* 04 / CASE LOG */}
            <section>
              <CaseLog
                logs={logs}
                currentCaseId={activeReport?.id}
                onSelectCase={handleSelectCaseFromLog}
                onClearLog={handleClearLog}
              />
            </section>
          </div>

          {/* Vertical 1px ink rule on desktop */}
          <div className="hidden lg:block w-[1px] bg-[var(--line)] self-stretch" />

          {/* Mobile section divider between left form and case report */}
          <div className="block lg:hidden my-[32px] h-[1px] bg-[var(--line)]" />

          {/* RIGHT COLUMN: Result Report */}
          <div className="w-full">
            {/* Header row */}
            <div className="flex items-baseline justify-between pb-3">
              <h2 className="font-fraunces font-semibold text-[28px] text-[var(--ink)]">
                Case report
              </h2>
              <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-2)]">
                CASE FILE No. {formattedDeskCaseNumber}
              </div>
            </div>
            {/* 2px ink rule below header */}
            <div className="h-[2px] bg-[var(--line)] mb-6" />

            {/* Error State */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-[var(--paper-2)] border-l-[3px] border-l-[var(--accent)] border border-[var(--line-hairline)]">
                <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--accent)] font-bold mb-1">
                  FILING ERROR
                </div>
                <p className="text-[15px] font-inter text-[var(--ink)] mb-2">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={handleCheckNow}
                  className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--accent)] hover:underline cursor-pointer"
                >
                  TRY AGAIN
                </button>
              </div>
            )}

            {/* Empty State */}
            {!activeReport && !errorMessage && !isAnalyzing && (
              <div className="border border-[var(--line)] bg-[var(--paper-2)] p-8 sm:p-12 case-paper-rotate paper-shadow">
                <div className="font-fraunces italic text-[28px] text-[var(--ink)]">
                  No case on file.
                </div>
                <p className="mt-3 text-[15px] font-inter text-[var(--ink-3)] max-w-[50ch] leading-relaxed">
                  Enter message text, paste a WhatsApp forward, or upload a screenshot
                  on the left and press &ldquo;Check Now&rdquo; to generate a forensic case report.
                </p>
                <div className="mt-8 pt-6 border-t border-[var(--line-hairline)] text-[12px] font-mono text-[var(--ink-3)] uppercase tracking-[0.08em]">
                  DESK STATUS: STANDBY · READY FOR EVIDENCE
                </div>
              </div>
            )}

            {/* Analyzing State Overlay (if no prior report) */}
            {isAnalyzing && !activeReport && (
              <div className="border border-[var(--line)] bg-[var(--paper-2)] p-12 text-center animate-subtle-pulse">
                <div className="font-fraunces text-[24px] text-[var(--ink)] mb-2">
                  Examining Evidence... ({elapsedSeconds}s)
                </div>
                <div className="font-mono text-[12px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                  CROSS-REFERENCING PATTERNS & REGULATORY SIGNALS
                </div>
              </div>
            )}

            {/* Active Case Report */}
            {activeReport && (
              <div className="border border-[var(--line)] bg-[var(--paper-2)] p-6 sm:p-8 case-paper-rotate paper-shadow animate-fade-in relative">
                {/* Top Row: Category tag and Rubber Stamp */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-3)]">
                      EXAMINED CATEGORY
                    </div>
                    <div className="font-fraunces font-semibold text-[20px] text-[var(--ink)] mt-0.5">
                      {activeReport.category}
                    </div>
                  </div>

                  {/* Rubber-stamp verdict */}
                  <div
                    className={`self-start font-mono font-bold text-[20px] tracking-[0.12em] uppercase px-4 py-2 select-none animate-stamp ${
                      activeReport.verdict === 'Looks Safe'
                        ? 'stamp-looks-safe'
                        : activeReport.verdict === 'Suspicious'
                        ? 'stamp-suspicious'
                        : 'stamp-likely-fake'
                    }`}
                  >
                    {activeReport.verdict}
                  </div>
                </div>

                {/* Score section */}
                <div className="my-6">
                  <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-3)]">
                    TRUST SCORE
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-fraunces font-bold text-[64px] sm:text-[88px] leading-none text-[var(--ink)]">
                      {displayScore}
                    </span>
                    <span className="font-mono text-[20px] text-[var(--ink-3)] tracking-[0.08em]">
                      / 100
                    </span>
                  </div>

                  {/* Horizontal ruler bar */}
                  <RulerScoreBar score={displayScore} verdict={activeReport.verdict} />

                  {/* One-line summary */}
                  <p className="mt-4 font-inter text-[18px] text-[var(--ink)] leading-snug max-w-[62ch]">
                    {activeReport.summary}
                  </p>
                </div>

                {/* Hairline separator */}
                <div className="my-6 h-[1px] bg-[var(--line-hairline)]" />

                {/* ANNOTATED TEXT */}
                <div className="mb-6">
                  <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] mb-3">
                    ANNOTATED TEXT
                  </div>

                  {activeReport.imagePreviewUrl && (
                    <div className="mb-3 p-2 bg-[var(--paper)] border border-[var(--line-hairline)] flex items-center justify-between">
                      <span className="text-[12px] font-mono text-[var(--ink-2)] uppercase">
                        EXAMINED SCREENSHOT EVIDENCE
                      </span>
                      <a
                        href={activeReport.imagePreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] font-mono text-[var(--accent)] hover:underline uppercase"
                      >
                        VIEW FULL IMAGE
                      </a>
                    </div>
                  )}

                  <AnnotatedText
                    text={activeReport.extractedText}
                    redFlags={activeReport.redFlags}
                  />
                </div>

                {/* Hairline separator */}
                <div className="my-6 h-[1px] bg-[var(--line-hairline)]" />

                {/* RED FLAGS */}
                <div className="mb-6">
                  <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] mb-3">
                    RED FLAGS ({activeReport.redFlags.length})
                  </div>

                  {activeReport.redFlags.length === 0 ? (
                    <div className="p-4 bg-[var(--paper)] border border-[var(--line-hairline)] text-[14px] font-inter text-[var(--safe)] font-medium">
                      No severe red flags detected. The message conforms to standard alert protocols without requesting credentials, OTPs, or urgent payments.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--line-hairline)]">
                      {activeReport.redFlags.map((flag, idx) => (
                        <div key={idx} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex items-start gap-3">
                            <span className="text-[var(--accent)] font-mono text-[13px] font-bold shrink-0 pt-0.5">
                              [{String(idx + 1).padStart(2, '0')}]
                            </span>
                            <div>
                              <div className="font-inter font-medium text-[16px] text-[var(--ink)]">
                                {flag.title}
                              </div>
                              <div className="text-[14px] font-inter text-[var(--ink-2)] mt-1">
                                {flag.reason}
                              </div>
                              {flag.quote && (
                                <div className="mt-2 text-[13px] font-mono text-[var(--ink-3)] bg-[var(--paper)] p-2 border-l-2 border-l-[var(--accent)]">
                                  &ldquo;{flag.quote}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hairline separator */}
                <div className="my-6 h-[1px] bg-[var(--line-hairline)]" />

                {/* BEFORE YOU ACT: Checklist */}
                <div className="mb-6">
                  <div className="text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink)] mb-3">
                    BEFORE YOU ACT (VERIFICATION CHECKLIST)
                  </div>

                  <div className="space-y-3">
                    {activeReport.verifySteps.map((step, idx) => {
                      const isChecked = Boolean(checkedSteps[idx]);
                      return (
                        <label
                          key={`${activeReport.id}-step-${idx}`}
                          className="flex items-start gap-3 cursor-pointer group select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setCheckedSteps((prev) => ({
                                ...prev,
                                [idx]: e.target.checked,
                              }));
                            }}
                            className="paper-checkbox"
                          />
                          <span
                            className={`text-[16px] font-inter leading-snug transition-colors ${
                              isChecked
                                ? 'line-through text-[var(--ink-3)]'
                                : 'text-[var(--ink)] group-hover:text-[var(--ink-2)]'
                            }`}
                          >
                            {step}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Report footer line */}
                <div className="mt-8 pt-4 border-t border-[var(--line-hairline)] text-[12px] font-mono text-[var(--ink-3)]">
                  AI analysis can be wrong. Verify through official sources.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-[var(--line)] bg-[var(--paper)] py-6 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] font-mono tracking-[0.08em] uppercase text-[var(--ink-3)]">
          <div>TRUSTLENS / CASE DESK</div>
          <div>AI can be wrong. Verify before you act.</div>
        </div>
      </footer>
    </div>
  );
}
