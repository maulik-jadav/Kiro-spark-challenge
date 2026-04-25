# Bugfix Requirements Document

## Introduction

When a user activates voice input in the `ConstraintInput` component, the browser acquires a system microphone stream via the `SpeechRecognition` API. After recognition ends (either by silence timeout or manual stop), the website's mic button UI correctly returns to inactive — but the browser's system-level mic indicator (visible in the tab bar and macOS menu bar) remains ON. This happens because the underlying `MediaStream` tracks are never explicitly stopped; calling `.stop()` or `.abort()` on the `SpeechRecognition` instance alone does not release the hardware mic. The fix must acquire a `MediaStream` reference explicitly and stop all its tracks whenever recognition ends or the component unmounts.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN speech recognition ends naturally due to silence timeout THEN the system sets the mic button UI to inactive but does NOT stop the underlying MediaStream tracks, leaving the browser system mic indicator ON

1.2 WHEN the user manually clicks the mic button to stop recording THEN the system calls `recognition.stop()` and sets the mic button UI to inactive but does NOT stop the underlying MediaStream tracks, leaving the browser system mic indicator ON

1.3 WHEN the `ConstraintInput` component unmounts while recognition is active THEN the system calls `recognition.abort()` but does NOT stop the underlying MediaStream tracks, leaving the browser system mic indicator ON

1.4 WHEN a recognition error occurs THEN the system sets the mic button UI to inactive but does NOT stop the underlying MediaStream tracks, leaving the browser system mic indicator ON

### Expected Behavior (Correct)

2.1 WHEN speech recognition ends naturally due to silence timeout THEN the system SHALL stop all MediaStream tracks, turning off the browser system mic indicator, in addition to setting the mic button UI to inactive

2.2 WHEN the user manually clicks the mic button to stop recording THEN the system SHALL stop all MediaStream tracks, turning off the browser system mic indicator, in addition to setting the mic button UI to inactive

2.3 WHEN the `ConstraintInput` component unmounts while recognition is active THEN the system SHALL stop all MediaStream tracks, turning off the browser system mic indicator, in addition to aborting recognition

2.4 WHEN a recognition error occurs THEN the system SHALL stop all MediaStream tracks, turning off the browser system mic indicator, in addition to setting the mic button UI to inactive

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user clicks the mic button to start recording THEN the system SHALL CONTINUE TO start speech recognition and set the mic button UI to the active/listening state

3.2 WHEN the user speaks and recognition produces a result THEN the system SHALL CONTINUE TO populate the constraint input field with the recognized transcript

3.3 WHEN the `SpeechRecognition` API is not available in the browser THEN the system SHALL CONTINUE TO hide the mic button and not attempt to use voice input

3.4 WHEN the component or its parent sets `disabled={true}` THEN the system SHALL CONTINUE TO disable the mic button and prevent voice input from starting

3.5 WHEN the user clicks the mic button while already listening THEN the system SHALL CONTINUE TO stop recognition (in addition to now also releasing the MediaStream)
