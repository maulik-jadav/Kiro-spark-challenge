# mic-stream-not-released Bugfix Design

## Overview

The `ConstraintInput` component uses the browser `SpeechRecognition` API for voice input. When recognition ends — whether by silence timeout, manual stop, error, or component unmount — the component correctly updates its UI state but never explicitly stops the underlying `MediaStream` tracks. Because the browser only releases the hardware microphone when all tracks are stopped, the system-level mic indicator (tab bar, OS menu bar) stays ON even though the UI shows the mic as inactive.

The fix acquires an explicit `MediaStream` reference via `navigator.mediaDevices.getUserMedia` before starting recognition, stores it in a `mediaStreamRef`, and stops all tracks in every code path that ends recognition.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — recognition ends (or the component unmounts) without stopping the underlying `MediaStream` tracks
- **Property (P)**: The desired behavior — all `MediaStream` tracks are stopped whenever recognition ends, so the browser mic indicator turns OFF
- **Preservation**: Existing voice-input behavior (start, transcript population, disabled state, unsupported-browser hiding) that must remain unchanged by the fix
- **`toggleListening`**: The function in `frontend/src/components/ConstraintInput.tsx` that starts or stops speech recognition on mic-button click
- **`recognitionRef`**: The `useRef` holding the active `SpeechRecognitionInstance`, used to call `.stop()` / `.abort()`
- **`mediaStreamRef`**: New `useRef<MediaStream | null>` to be added — holds the `MediaStream` acquired before recognition starts
- **`stopMicStream`**: New helper function that calls `track.stop()` on every track in `mediaStreamRef.current` and clears the ref

## Bug Details

### Bug Condition

The bug manifests whenever speech recognition ends (naturally, manually, on error, or on unmount) and `stopMicStream()` has not been called. The `toggleListening` function and the unmount cleanup effect call `recognition.stop()` / `recognition.abort()` but never stop the `MediaStream` tracks, so the hardware mic remains acquired.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type RecognitionLifecycleEvent
         { trigger: 'silence-end' | 'manual-stop' | 'error' | 'unmount' }
  OUTPUT: boolean

  RETURN mediaStreamRef.current IS NOT NULL
         AND mediaStreamRef.current.getTracks() contains at least one track
             WHERE track.readyState = 'live'
         AND stopMicStream() HAS NOT been called for this session
END FUNCTION
```

### Examples

- **Silence timeout**: User speaks, recognition ends automatically → mic button goes inactive, but OS mic indicator stays ON (expected: OFF)
- **Manual stop**: User clicks mic button while listening → `recognition.stop()` called, UI updates, but OS mic indicator stays ON (expected: OFF)
- **Component unmount**: User navigates away mid-session → `recognition.abort()` called, but OS mic indicator stays ON (expected: OFF)
- **Recognition error**: Network or permission error fires `onerror` → UI goes inactive, but OS mic indicator stays ON (expected: OFF)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Clicking the mic button while not listening starts speech recognition and sets the button to the active/pulsing state
- Recognized speech transcripts are populated into the constraint input field
- When `SpeechRecognition` is unavailable, the mic button is hidden and no voice input is attempted
- When `disabled={true}` is set, the mic button is disabled and voice input cannot start
- Clicking the mic button while already listening stops recognition (and now also releases the stream)

**Scope:**
All inputs that do NOT involve the recognition lifecycle (silence end, manual stop, error, unmount) are completely unaffected by this fix. This includes:
- Text typed directly into the constraint input field
- Mouse/keyboard interactions with other form elements
- Component rendering and prop updates unrelated to voice input

## Hypothesized Root Cause

Based on the bug description and code review of `ConstraintInput.tsx`:

1. **No `MediaStream` reference is held**: The component never calls `navigator.mediaDevices.getUserMedia` directly — it relies entirely on the `SpeechRecognition` API, which acquires the mic internally. Without a reference to the stream, there is no way to call `track.stop()`.

2. **`recognition.stop()` / `recognition.abort()` do not release hardware**: The Web Speech API spec does not guarantee that stopping recognition releases the underlying `MediaStream`. Browsers (Chrome in particular) keep the mic open until all tracks are explicitly stopped.

3. **Unmount cleanup only aborts recognition**: The existing `useEffect` cleanup calls `recognition.abort()` but has no stream reference to stop, so the mic stays live after unmount.

4. **`onerror` and `onend` only update UI state**: Both handlers call `setListening(false)` but perform no stream cleanup, leaving the hardware mic acquired.

## Correctness Properties

Property 1: Bug Condition - MediaStream Tracks Stopped on Recognition End

_For any_ `RecognitionLifecycleEvent` where the bug condition holds (isBugCondition returns true — i.e., a live `MediaStream` exists and recognition is ending), the fixed `ConstraintInput` SHALL stop all `MediaStream` tracks (setting each track's `readyState` to `'ended'`), causing the browser system mic indicator to turn OFF.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing Voice Input Behavior Unchanged

_For any_ interaction that does NOT involve the recognition lifecycle end (isBugCondition returns false — e.g., starting recognition, receiving a transcript, typing in the field, disabled state), the fixed `ConstraintInput` SHALL produce exactly the same behavior as the original component, preserving all existing voice input and UI functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/components/ConstraintInput.tsx`

**Specific Changes**:

1. **Add `mediaStreamRef`**: Declare `const mediaStreamRef = useRef<MediaStream | null>(null)` alongside `recognitionRef`

2. **Add `stopMicStream` helper**: Define a function (stable across renders, e.g. via `useCallback` or declared inside the component) that calls:
   ```ts
   mediaStreamRef.current?.getTracks().forEach(t => t.stop());
   mediaStreamRef.current = null;
   ```

3. **Acquire stream before starting recognition**: In the `listening === false` branch of `toggleListening`, call `navigator.mediaDevices.getUserMedia({ audio: true })` before `recognition.start()`, store the result in `mediaStreamRef.current`, and only then call `recognition.start()`. Handle the case where `getUserMedia` is unavailable or throws (fall back gracefully).

4. **Call `stopMicStream()` in `recognition.onend`**: After `setListening(false)`, call `stopMicStream()` to release the hardware mic on natural end and silence timeout.

5. **Call `stopMicStream()` in `recognition.onerror`**: After `setListening(false)`, call `stopMicStream()` to release the hardware mic on error.

6. **Call `stopMicStream()` on manual stop**: In the `listening === true` branch of `toggleListening`, call `stopMicStream()` after `recognitionRef.current?.stop()`.

7. **Call `stopMicStream()` in unmount cleanup**: In the existing `useEffect` cleanup, call `stopMicStream()` after `recognition.abort()`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that mock `SpeechRecognition` and `navigator.mediaDevices.getUserMedia`, simulate recognition lifecycle events, and assert that `track.stop()` is called on all tracks. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Silence timeout test**: Start recognition, fire `onend` callback → assert `track.stop()` was called (will fail on unfixed code)
2. **Manual stop test**: Start recognition, click mic button again → assert `track.stop()` was called (will fail on unfixed code)
3. **Error test**: Start recognition, fire `onerror` callback → assert `track.stop()` was called (will fail on unfixed code)
4. **Unmount test**: Start recognition, unmount component → assert `track.stop()` was called (will fail on unfixed code)

**Expected Counterexamples**:
- `track.stop()` is never called in any of the above scenarios on unfixed code
- Possible causes: no `MediaStream` reference held, `recognition.stop()` does not release hardware, cleanup only aborts recognition

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed component stops all `MediaStream` tracks.

**Pseudocode:**
```
FOR ALL event WHERE isBugCondition(event) DO
  result := handleRecognitionEnd_fixed(event)
  ASSERT allTracksAreStopped(mediaStreamRef)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed component produces the same behavior as the original.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(interaction) DO
  ASSERT originalComponent(interaction) = fixedComponent(interaction)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-lifecycle interactions (typing, starting recognition, receiving transcripts), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Start recognition preservation**: Verify that clicking the mic button starts recognition and sets listening state — observe on unfixed code, then verify unchanged after fix
2. **Transcript preservation**: Verify that `onresult` still populates the input field — observe on unfixed code, then verify unchanged after fix
3. **Disabled state preservation**: Verify that `disabled={true}` prevents voice input — observe on unfixed code, then verify unchanged after fix
4. **Unsupported browser preservation**: Verify mic button is hidden when `SpeechRecognition` is unavailable — observe on unfixed code, then verify unchanged after fix

### Unit Tests

- Test that `track.stop()` is called after `onend` fires
- Test that `track.stop()` is called after `onerror` fires
- Test that `track.stop()` is called when the component unmounts mid-session
- Test that `track.stop()` is called when the user manually stops via the mic button
- Test edge case: no `MediaStream` acquired (e.g., `getUserMedia` unavailable) — no crash

### Property-Based Tests

- Generate random sequences of start/stop/error/unmount events and verify `track.stop()` is always called exactly once per session end
- Generate random transcript strings and verify they are always passed to `onChange` unchanged after the fix
- Generate random `disabled` prop values and verify the mic button state is always consistent with the prop

### Integration Tests

- Full flow: click mic → speak → silence timeout → verify OS mic indicator is released (track `readyState === 'ended'`)
- Full flow: click mic → click mic again (manual stop) → verify track is stopped
- Full flow: click mic → navigate away (unmount) → verify track is stopped
- Regression: click mic → speak → verify transcript appears in constraint field
