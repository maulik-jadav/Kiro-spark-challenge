/**
 * Bug Condition Exploration Test
 * Property 1: MediaStream Tracks Not Stopped on Recognition End
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 *
 * CRITICAL: These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists — track.stop() is never called.
 * DO NOT fix the code when these tests fail.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConstraintInput from '../ConstraintInput';

// ── Mock setup ────────────────────────────────────────────────────────────────

type MockRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

let mockRecognition: MockRecognition;
let mockTrack: { stop: jest.Mock; readyState: string };
let mockStream: { getTracks: () => typeof mockTrack[] };

beforeEach(() => {
  // Fresh track mock for each test
  mockTrack = { stop: jest.fn(), readyState: 'live' };
  mockStream = { getTracks: () => [mockTrack] };

  // Mock getUserMedia to return our fake stream
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: jest.fn().mockResolvedValue(mockStream) },
    writable: true,
    configurable: true,
  });

  // Fresh recognition mock for each test
  mockRecognition = {
    continuous: false,
    interimResults: false,
    lang: '',
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    onresult: null,
    onerror: null,
    onend: null,
  };

  // Mock SpeechRecognition constructor on window
  (window as unknown as Record<string, unknown>).SpeechRecognition = jest.fn(
    () => mockRecognition
  );
  // Remove webkit prefix so only our mock is used
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function startListening() {
  const micButton = screen.getByRole('button', { name: /start voice input/i });
  await userEvent.click(micButton);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/**
 * Trigger 1: Silence timeout — recognition ends naturally via onend callback.
 *
 * Expected (unfixed): track.stop() call count = 0, expected ≥ 1
 * Counterexample: onend fires → setListening(false) called → track.stop() NOT called
 */
test('silence timeout: track.stop() is called when recognition ends via onend', async () => {
  render(<ConstraintInput value="" onChange={jest.fn()} />);

  await startListening();

  // Simulate recognition ending naturally (silence timeout)
  await act(async () => {
    mockRecognition.onend?.();
  });

  // EXPECTED TO FAIL on unfixed code: track.stop() is never called
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
});

/**
 * Trigger 2: Manual stop — user clicks mic button while listening.
 *
 * Expected (unfixed): track.stop() call count = 0, expected ≥ 1
 * Counterexample: mic click → recognition.stop() called → track.stop() NOT called
 */
test('manual stop: track.stop() is called when user clicks mic button to stop', async () => {
  render(<ConstraintInput value="" onChange={jest.fn()} />);

  await startListening();

  // Click mic button again to stop
  const micButton = screen.getByRole('button', { name: /stop voice input/i });
  await userEvent.click(micButton);

  // EXPECTED TO FAIL on unfixed code: track.stop() is never called
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
});

/**
 * Trigger 3: Error — recognition fires onerror callback.
 *
 * Expected (unfixed): track.stop() call count = 0, expected ≥ 1
 * Counterexample: onerror fires → setListening(false) called → track.stop() NOT called
 */
test('error: track.stop() is called when recognition fires onerror', async () => {
  render(<ConstraintInput value="" onChange={jest.fn()} />);

  await startListening();

  // Simulate a recognition error
  await act(async () => {
    mockRecognition.onerror?.({ error: 'network' });
  });

  // EXPECTED TO FAIL on unfixed code: track.stop() is never called
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
});

/**
 * Trigger 4: Unmount — component unmounts while recognition is active.
 *
 * Expected (unfixed): track.stop() call count = 0, expected ≥ 1
 * Counterexample: unmount → recognition.abort() called → track.stop() NOT called
 */
test('unmount: track.stop() is called when component unmounts mid-session', async () => {
  const { unmount } = render(<ConstraintInput value="" onChange={jest.fn()} />);

  await startListening();

  // Unmount the component while recognition is active
  await act(async () => {
    unmount();
  });

  // EXPECTED TO FAIL on unfixed code: track.stop() is never called
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
});
