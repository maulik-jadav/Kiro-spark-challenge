"use client";

import { useEffect, useRef, useState } from "react";

interface ConstraintInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Extend Window to include vendor-prefixed SpeechRecognition
interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
    length: number;
  };
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const SR =
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  return (SR as SpeechRecognitionConstructor) ?? null;
}

export default function ConstraintInput({ value, onChange, disabled }: ConstraintInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  function toggleListening() {
    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setListening(false);
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onChange(transcript);
    };

    recognition.onerror = () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  const inputClass =
    "w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-all";

  return (
    <div>
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
        Constraint <span className="font-normal normal-case tracking-normal">(optional)</span>
      </p>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            tune
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g., Arrive by 10 AM, Budget under $5"
            className={inputClass}
            aria-label="Constraint"
          />
        </div>
        {supported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full border transition-colors ${
              listening
                ? "bg-error text-on-error border-error animate-pulse"
                : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-tertiary"
            } disabled:opacity-50`}
          >
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
        )}
      </div>
    </div>
  );
}
