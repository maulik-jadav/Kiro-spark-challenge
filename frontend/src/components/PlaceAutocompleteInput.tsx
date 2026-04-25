"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

export interface PlaceAutocompleteInputProps {
  /** Current value of the input field */
  value: string;
  /** Callback when the text input changes (for controlled input) */
  onChange: (value: string) => void;
  /** Callback when a place is selected from suggestions */
  onPlaceSelect: (
    place: { formattedAddress: string; placeId: string } | null
  ) => void;
  /** Placeholder text */
  placeholder?: string;
  /** HTML id attribute */
  id?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the input is required */
  required?: boolean;
  /** Label text for accessibility */
  label?: string;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * A reusable autocomplete input that queries Google Places for address suggestions.
 * Self-contained: wraps itself with <APIProvider> so it can be dropped anywhere.
 * Falls back to a plain text input when no API key is configured.
 */
export default function PlaceAutocompleteInput(
  props: PlaceAutocompleteInputProps
) {
  if (!API_KEY) {
    return <PlainInput {...props} />;
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <AutocompleteInner {...props} />
    </APIProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Plain fallback (no API key)                                       */
/* ------------------------------------------------------------------ */

function PlainInput({
  value,
  onChange,
  placeholder,
  id,
  className,
  required,
  label,
}: PlaceAutocompleteInputProps) {
  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={className}
        aria-label={label}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Core autocomplete implementation (runs inside APIProvider)        */
/* ------------------------------------------------------------------ */

function AutocompleteInner({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  id,
  className,
  required,
  label,
}: PlaceAutocompleteInputProps) {
  const placesLib = useMapsLibrary("places");

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const autocompleteServiceRef =
    useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(
    null
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A ref to track whether the latest change was a selection (skip re-querying)
  const justSelectedRef = useRef(false);

  const listboxId = id ? `${id}-listbox` : "place-autocomplete-listbox";

  /* ---------- Initialise services when Places lib loads ---------- */

  useEffect(() => {
    if (!placesLib) return;
    autocompleteServiceRef.current =
      new placesLib.AutocompleteService();

    // PlacesService needs a DOM node (or map); create a hidden div
    const attrDiv = document.createElement("div");
    placesServiceRef.current = new placesLib.PlacesService(attrDiv);
  }, [placesLib]);

  /* ---------- Fetch predictions (debounced) ---------- */

  const fetchPredictions = useCallback(
    (input: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      if (input.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        if (!autocompleteServiceRef.current) return;
        setIsLoading(true);

        autocompleteServiceRef.current.getPlacePredictions(
          { input },
          (predictions, status) => {
            setIsLoading(false);
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              predictions
            ) {
              setSuggestions(predictions.slice(0, 5));
              setIsOpen(true);
              setHighlightedIndex(-1);
            } else if (
              status ===
              google.maps.places.PlacesServiceStatus.ZERO_RESULTS
            ) {
              setSuggestions([]);
              setIsOpen(true);
              setHighlightedIndex(-1);
            } else {
              // API failure — degrade gracefully
              setSuggestions([]);
              setIsOpen(false);
            }
          }
        );
      }, 300);
    },
    []
  );

  /* ---------- Handle input change ---------- */

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }

      if (newValue === "") {
        onPlaceSelect(null);
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }

      fetchPredictions(newValue);
    },
    [onChange, onPlaceSelect, fetchPredictions]
  );

  /* ---------- Select a suggestion ---------- */

  const selectSuggestion = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      justSelectedRef.current = true;

      if (placesServiceRef.current) {
        placesServiceRef.current.getDetails(
          { placeId: prediction.place_id, fields: ["formatted_address"] },
          (place, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              place?.formatted_address
            ) {
              onChange(place.formatted_address);
              onPlaceSelect({
                formattedAddress: place.formatted_address,
                placeId: prediction.place_id,
              });
            } else {
              // Fallback to description if getDetails fails
              onChange(prediction.description);
              onPlaceSelect({
                formattedAddress: prediction.description,
                placeId: prediction.place_id,
              });
            }
          }
        );
      } else {
        // No PlacesService — use description directly
        onChange(prediction.description);
        onPlaceSelect({
          formattedAddress: prediction.description,
          placeId: prediction.place_id,
        });
      }

      setSuggestions([]);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange, onPlaceSelect]
  );

  /* ---------- Keyboard navigation ---------- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        }
        case "Enter": {
          if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
            e.preventDefault();
            selectSuggestion(suggestions[highlightedIndex]);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        }
      }
    },
    [isOpen, suggestions, highlightedIndex, selectSuggestion]
  );

  /* ---------- Close dropdown on outside click ---------- */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---------- Cleanup debounce timer ---------- */

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  /* ---------- Render ---------- */

  const activeDescendant =
    highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={className}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-label={label}
      />

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded shadow-lg max-h-60 overflow-y-auto"
        >
          {isLoading && (
            <li className="px-3 py-2 text-sm text-outline">Loading…</li>
          )}

          {!isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-outline">
              No results found
            </li>
          )}

          {suggestions.map((prediction, index) => (
            <li
              key={prediction.place_id}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on input
                selectSuggestion(prediction);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                index === highlightedIndex
                  ? "bg-tertiary-container text-on-tertiary-container"
                  : "text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {prediction.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
