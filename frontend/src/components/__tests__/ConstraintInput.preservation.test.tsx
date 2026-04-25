/**
 * Preservation Property Tests
 * Property 2: Existing Voice Input Behavior Unchanged
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * These tests capture CURRENT (unfixed) behavior for all non-lifecycle interactions.
 * All 4 tests MUST PASS on unfixed code to establish the baseline.
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
 * Preservation 1: Transcript preservation
 *
 * When onresult fires with a transcript string, onChange receives that exact string.
 * Validates: Requirements 3.1
 */
test('transcript preservation: onChange receives the exact transcript string from onresult', async () => {
  const onChange = jest.fn();
  render(<ConstraintInput value="" onChange={onChange} />);

  await startListening();

  const transcript = 'Arrive by 10 AM';

  await act(async () => {
    mockRecognition.onresult?.({
      results: {
        0: { 0: { transcript } },
        length: 1,
      },
    });
  });

  expect(onChange).toHaveBeenCalledWith(transcript);
  expect(onChange).toHaveBeenCalledTimes(1);
});

/**
 * Preservation 2: Disabled state
 *
 * When disabled={true}, the mic button has the disabled attribute.
 * Validates: Requirements 3.4
 */
test('disabled state: mic button is disabled when disabled prop is true', () => {
  render(<ConstraintInput value="" onChange={jest.fn()} disabled={true} />);

  const micButton = screen.getByRole('button', { name: /start voice input/i });
  expect(micButton).toBeDisabled();
});

/**
 * Preservation 3: Unsupported browser
 *
 * When SpeechRecognition is not available on window, the mic button is not rendered.
 * Validates: Requirements 3.3
 */
test('unsupported browser: mic button is not rendered when SpeechRecognition is unavailable', () => {
  // Remove SpeechRecognition from window
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  render(<ConstraintInput value="" onChange={jest.fn()} />);

  const micButton = screen.queryByRole('button', { name: /voice input/i });
  expect(micButton).not.toBeInTheDocument();
});

/**
 * Preservation 4: Start recognition
 *
 * Clicking the mic button while not listening calls recognition.start()
 * and sets the button to active state (aria-label changes to "Stop voice input").
 * Validates: Requirements 3.2
 */
test('start recognition: clicking mic button starts recognition and sets active state', async () => {
  render(<ConstraintInput value="" onChange={jest.fn()} />);

  await startListening();

  expect(mockRecognition.start).toHaveBeenCalledTimes(1);

  const stopButton = screen.getByRole('button', { name: /stop voice input/i });
  expect(stopButton).toBeInTheDocument();
});
