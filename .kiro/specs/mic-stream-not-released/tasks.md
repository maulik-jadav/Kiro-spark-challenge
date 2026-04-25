# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - MediaStream Tracks Not Stopped on Recognition End
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists across all recognition lifecycle end triggers
  - **Scoped PBT Approach**: Scope the property to the four concrete failing triggers: silence-end, manual-stop, error, unmount
  - Mock `SpeechRecognition` and `navigator.mediaDevices.getUserMedia` to return a fake `MediaStream` with trackable `track.stop()` calls
  - For each trigger (`onend` fires, mic button clicked while listening, `onerror` fires, component unmounts mid-session), assert that `track.stop()` was called on all tracks
  - The test assertions match the Expected Behavior: `allTracksAreStopped(mediaStreamRef)` after any recognition lifecycle end
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (confirms the bug — `track.stop()` is never called in any scenario)
  - Document counterexamples found (e.g., "after `onend`, `track.stop()` call count = 0, expected ≥ 1")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Voice Input Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: clicking mic button starts recognition and sets `listening = true`
  - Observe on UNFIXED code: `onresult` with a transcript string calls `onChange(transcript)` with the exact string
  - Observe on UNFIXED code: when `SpeechRecognition` is unavailable, mic button is not rendered
  - Observe on UNFIXED code: when `disabled={true}`, mic button is disabled and `toggleListening` cannot start recognition
  - Write property-based tests capturing these observed behaviors for all non-lifecycle inputs (isBugCondition returns false):
    - For any valid transcript string, `onChange` receives it unchanged
    - For any `disabled` boolean value, mic button disabled state matches the prop
    - When `SpeechRecognition` is absent, mic button is never rendered regardless of other props
    - Clicking mic while not listening always starts recognition and sets active state
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix: mic stream not released when recognition ends

  - [x] 3.1 Implement the fix in `frontend/src/components/ConstraintInput.tsx`
    - Add `const mediaStreamRef = useRef<MediaStream | null>(null)` alongside `recognitionRef`
    - Add `stopMicStream` helper that calls `mediaStreamRef.current?.getTracks().forEach(t => t.stop())` then sets `mediaStreamRef.current = null`
    - In the `listening === false` branch of `toggleListening`, call `navigator.mediaDevices.getUserMedia({ audio: true })` before `recognition.start()`, store result in `mediaStreamRef.current`; handle unavailable/throwing `getUserMedia` gracefully (fall back without crashing)
    - In `recognition.onend`, call `stopMicStream()` after `setListening(false)`
    - In `recognition.onerror`, call `stopMicStream()` after `setListening(false)`
    - In the `listening === true` branch of `toggleListening`, call `stopMicStream()` after `recognitionRef.current?.stop()`
    - In the unmount `useEffect` cleanup, call `stopMicStream()` after `recognition.abort()`
    - _Bug_Condition: isBugCondition(event) — mediaStreamRef.current is not null AND contains live tracks AND stopMicStream() has not been called_
    - _Expected_Behavior: allTracksAreStopped(mediaStreamRef) — every track's readyState = 'ended' after any recognition lifecycle end_
    - _Preservation: all non-lifecycle interactions (start, transcript, disabled, unsupported) produce identical behavior to the original component_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - MediaStream Tracks Stopped on Recognition End
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: `track.stop()` is called for all four lifecycle triggers
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — `track.stop()` is called in every scenario)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Voice Input Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in start, transcript, disabled, unsupported-browser behaviors)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
