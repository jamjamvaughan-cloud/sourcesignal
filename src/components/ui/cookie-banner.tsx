"use client";

import * as React from "react";

interface CookieConsentState {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: string;
}

const CONSENT_KEY = "sourcesignal_cookie_consent";
const CONSENT_VERSION = "1.0.0";

function getStoredConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setStoredConsent(consent: CookieConsentState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export function CookieBanner() {
  const [consent, setConsent] = React.useState<CookieConsentState | null>(() => {
    if (typeof window === "undefined") return null;
    return getStoredConsent();
  });
  const [showing, setShowing] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowing(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  if (consent !== null) return null;

  if (!showing) return null;

  const acceptAll = () => {
    const next: CookieConsentState = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    setStoredConsent(next);
    setConsent(next);
  };

  const rejectNonEssential = () => {
    const next: CookieConsentState = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    setStoredConsent(next);
    setConsent(next);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      aria-modal="true"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={rejectNonEssential} />

      {/* Banner Card */}
      <div className="relative z-[101] w-full max-w-md mx-4 mb-4 lg:mx-6 lg:mb-6 lg:max-w-lg">
        <div className="glass-card p-6 lg:p-8 max-w-full min-w-0 transform-style-flat backface-visibility-hidden text-rendering-optimizeLegibility antialiased">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-5 w-5 text-D4AF37" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <h2 id="cookie-banner-title" className="text-lg font-inter font-semibold text-[#E5E5EA] leading-tight">
                  Cookie Preferences
                </h2>
              </div>
              <p id="cookie-banner-description" className="text-sm font-inter text-slate-400 leading-relaxed antialiased">
                SourceSignal uses cookies and similar technologies to ensure the site functions
                properly, analyze traffic, and improve your experience. Essential cookies are always
                enabled. You can choose to allow analytics and marketing cookies below.
              </p>
            </div>
          </div>

          <div className="flex gap-1 pt-4 border-t border-white/5">
            <button
              onClick={rejectNonEssential}
              className="flex-1 sm:flex-none px-5 py-3 text-[10px] font-inter font-semibold text-slate-400 border border-white/10 hover:bg-white/5 hover:text-white transition-all duration-200 ease-out rounded-sm"
            >
              Reject Non-Essential
            </button>
            <button
              onClick={acceptAll}
              className="flex-1 sm:flex-none px-5 py-3 text-[#09090b] font-inter font-semibold bg-D4AF37 hover:bg-D4AF37/90 transition-all duration-200 ease-out rounded-sm"
            >
              Accept All
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <a
              href="/privacy"
              className="text-[10px] font-inter text-slate-500 hover:text-white transition-colors underline"
            >
              Privacy Policy
            </a>
            <span className="text-[10px] font-inter text-slate-500 mx-1">/</span>
            <a
              href="/terms"
              className="text-[10px] font-inter text-slate-500 hover:text-white transition-colors underline"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
