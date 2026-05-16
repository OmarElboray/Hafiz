"use client";

import { Amiri } from "next/font/google";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSurahTextOnly } from "@/lib/quran";

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
});

type Tasmi3Props = {
  initialSurah?: number;
};

type WebkitSpeechRecognitionConstructor = new () => SpeechRecognition;
type WordStatus = "pending" | "correct" | "wrong" | "current";

type SurahWord = {
  word: string;
  normalized: string;
  status: WordStatus;
  ayahNumber: number;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: WebkitSpeechRecognitionConstructor;
  }
}

function normalizeArabic(text: string): string {
  return text
    .normalize("NFKD")
    .replace(
      /[\u064B-\u0652\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g,
      ""
    )
    .replace(/[\u0671\u0623\u0625\u0622]/g, "ا")
    .replace(/\u0629/g, "ه")
    .replace(/\u0649/g, "ي")
    .replace(/\u0624/g, "و")
    .replace(/\u0626/g, "ي")
    .replace(/\u0621/g, "")
    .replace(/[\u0640\u06DD\u06DE\u200C\u200D]/g, "")
    .replace(/[^\u0621-\u063A\u0641-\u064A ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitArabicWords(text: string): string[] {
  const normalized = normalizeArabic(text);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

function splitOriginalArabicWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => normalizeArabic(word).length > 0);
}

function orderedSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const A = Array.from(a);
  const B = Array.from(b);
  const rows = A.length + 1;
  const cols = B.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[A.length][B.length] / Math.max(A.length, B.length);
}

const WordToken = memo(function WordToken({
  item,
  index,
  isListening,
  isCurrentIndex,
  setRef,
}: {
  item: SurahWord;
  index: number;
  isListening: boolean;
  isCurrentIndex: boolean;
  setRef: (index: number, el: HTMLSpanElement | null) => void;
}) {
  const statusTextClass =
    item.status === "correct"
      ? "text-emerald-400"
      : item.status === "wrong"
      ? "text-rose-400"
      : item.status === "current"
      ? "text-amber-300"
      : "text-white";

  return (
    <span
      ref={(el) => setRef(index, el)}
      data-index={index}
      data-status={item.status}
      className={`${statusTextClass} ${
        isCurrentIndex && isListening ? "rounded-md bg-amber-400/15 px-1 animate-pulse" : ""
      }`}
    >
      {item.word}
    </span>
  );
});

export default function Tasmi3({ initialSurah = 1 }: Tasmi3Props) {
  const [surah] = useState(initialSurah);
  const [surahName, setSurahName] = useState("");
  const [surahWords, setSurahWords] = useState<SurahWord[]>([]);
  const surahWordsRef = useRef<SurahWord[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isLoadingSurah, setIsLoadingSurah] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSpokenWord, setLastSpokenWord] = useState("");

  const wordSpanRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const currentWordIndexRef = useRef(0);

  const isSpeechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const score = useMemo(() => {
    if (!surahWords.length) return 0;
    const attempted = surahWords.filter((w) => w.status === "correct" || w.status === "wrong");
    if (!attempted.length) return 0;
    const correctCount = attempted.filter((w) => w.status === "correct").length;
    return Math.round((correctCount / attempted.length) * 100);
  }, [surahWords]);

  const currentAyahNumber = useMemo(() => {
    if (!surahWords.length) return 1;
    const clamped = Math.min(currentWordIndex, surahWords.length - 1);
    return surahWords[clamped]?.ayahNumber ?? 1;
  }, [currentWordIndex, surahWords]);

  const moveCurrentPointer = useCallback((nextIndex: number) => {
    setSurahWords((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      if (nextIndex < next.length && next[nextIndex].status === "pending") {
        next[nextIndex] = { ...next[nextIndex], status: "current" };
      }
      return next;
    });
    currentWordIndexRef.current = nextIndex;
    setCurrentWordIndex(nextIndex);
  }, []);

  const MATCH_THRESHOLD = 0.75;
  const ADVANCE_INTERIM_CONFIDENCE = 0.8;

  const computeBestMatch = useCallback(
    (recognizedWord: string): { bestIndex: number; bestScore: number } | null => {
      if (!recognizedWord || !surahWords.length) return null;

      const start = currentWordIndexRef.current;
      if (start >= surahWords.length) return null;

      const expectedCurrent = surahWords[start]?.normalized ?? "";
      const expectedNext = surahWords[start + 1]?.normalized ?? "";
      if (!expectedCurrent) return null;

      const recognizedVariants: string[] = [];
      recognizedVariants.push(recognizedWord);
      if (recognizedWord.startsWith("ال")) {
        recognizedVariants.push(recognizedWord.slice(2));
      }
      const cleanedRecognizedVariants = recognizedVariants.map((v) => v.trim()).filter(Boolean);

      const expectedVariants = [
        { index: start, word: expectedCurrent },
        ...(expectedNext ? [{ index: start + 1, word: expectedNext }] : []),
      ];

      let bestIndex = -1;
      let bestScore = 0;

      const firstTwoMatch = (exp: string, rec: string) => {
        if (exp.length < 2 || rec.length < 2) return false;
        return exp.slice(0, 2) === rec.slice(0, 2) && Math.abs(exp.length - rec.length) <= 1;
      };

      for (const exp of expectedVariants) {
        for (const recVariant of cleanedRecognizedVariants) {
          const special = firstTwoMatch(exp.word, recVariant);
          const score = special ? 1 : orderedSimilarity(exp.word, recVariant);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = exp.index;
          }
        }
      }

      return { bestIndex, bestScore };
    },
    [surahWords]
  );

  const applyMatch = useCallback(
    ({
      recognizedWord,
      confidence,
      isFinal,
      bestIndex,
      matched,
    }: {
      recognizedWord: string;
      confidence: number;
      isFinal: boolean;
      bestIndex: number;
      matched: boolean;
    }) => {
      const start = currentWordIndexRef.current;
      if (!surahWords.length || start >= surahWords.length) return;
      setLastSpokenWord(recognizedWord);

      const advanceAllowed = isFinal || confidence >= ADVANCE_INTERIM_CONFIDENCE;
      if (!advanceAllowed) return;

      if (matched) {
        if (bestIndex === start) {
          if (surahWords[start]?.status === "wrong") return; // keep it red until NEXT word is correct

          setSurahWords((prev) => {
            if (start >= prev.length) return prev;
            const next = [...prev];
            next[start] = { ...next[start], status: "correct" };
            return next;
          });
          moveCurrentPointer(start + 1);
          return;
        }

        // bestIndex must be start + 1
        setSurahWords((prev) => {
          const next = [...prev];
          if (start < next.length) next[start] = { ...next[start], status: "wrong" };
          if (bestIndex < next.length) next[bestIndex] = { ...next[bestIndex], status: "correct" };
          return next;
        });
        moveCurrentPointer(bestIndex + 1);
        return;
      }

      // No match: mark current word wrong, but never advance.
      setSurahWords((prev) => {
        const next = [...prev];
        if (start < next.length) next[start] = { ...next[start], status: "wrong" };
        return next;
      });
    },
    [moveCurrentPointer, surahWords]
  );

  const buildRecognition = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!event.results || event.results.length === 0) return;

      // Use ONLY the LATEST result (do not accumulate transcripts).
      const latestResult = event.results[event.results.length - 1];
      const isFinal = Boolean(latestResult.isFinal);

      const expectedIndex = currentWordIndexRef.current;
      const expectedNormalized = surahWordsRef.current[expectedIndex]?.normalized ?? "";
      if (!expectedNormalized) return;

      const latestAny = latestResult as any;
      const alternativesCount = typeof latestAny?.length === "number" ? latestAny.length : 1;

      let matched = false;
      let matchedWord = "";

      for (let altIdx = 0; altIdx < alternativesCount; altIdx += 1) {
        const alt = latestAny[altIdx] as { transcript?: string } | undefined;
        const transcript = alt?.transcript ?? "";
        if (!transcript.trim()) continue;

        // (3) Normalize + split into individual words.
        const normalizedTranscript = normalizeArabic(transcript);
        const words = normalizedTranscript ? normalizedTranscript.split(/\s+/).filter(Boolean) : [];

        // (4) Match against ONLY currentWordIndex.
        for (const heardWord of words) {
          const similarity = orderedSimilarity(expectedNormalized, heardWord);
          if (similarity >= 0.75) {
            matched = true;
            matchedWord = heardWord;
            break;
          }
        }

        if (matched) break;
      }

      if (!isFinal) {
        // (6) Interim: if matched, highlight current word, but do NOT advance.
        if (!matched) return;

        setLastSpokenWord(matchedWord);
        setSurahWords((prev) => {
          const next = [...prev];
          for (let i = 0; i < next.length; i += 1) {
            if (next[i].status === "current") next[i] = { ...next[i], status: "pending" };
          }
          if (expectedIndex < next.length) next[expectedIndex] = { ...next[expectedIndex], status: "current" };
          return next;
        });
        return;
      }

      // (5,7) Final: mark green if matched else red, then advance by 1.
      const startIndex = expectedIndex;
      const nextIndex = Math.min(startIndex + 1, surahWordsRef.current.length - 1);
      setLastSpokenWord(matched ? matchedWord : "");

      setSurahWords((prev) => {
        const next = [...prev];
        for (let i = 0; i < next.length; i += 1) {
          if (next[i].status === "current") next[i] = { ...next[i], status: "pending" };
        }

        if (startIndex < next.length) {
          next[startIndex] = { ...next[startIndex], status: matched ? "correct" : "wrong" };
        }

        if (nextIndex !== startIndex && nextIndex < next.length) {
          next[nextIndex] = { ...next[nextIndex], status: "current" };
        }
        return next;
      });

      currentWordIndexRef.current = nextIndex;
      setCurrentWordIndex(nextIndex);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (!shouldKeepListeningRef.current) {
        setIsListening(false);
        return;
      }
      try {
        recognition.start(); // immediate restart, no delay
      } catch {
        setIsListening(false);
      }
    };

    return recognition;
  }, []);

  const startListening = useCallback(() => {
    if (!isSpeechSupported) {
      setError("Web Speech API is not supported in this browser.");
      return;
    }
    shouldKeepListeningRef.current = true;
    setError(null);

    const recognition = buildRecognition();
    if (!recognition) {
      setError("Speech recognition is unavailable.");
      return;
    }
    recognitionRef.current = recognition;
    recognition.start();
  }, [buildRecognition, isSpeechSupported]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    recognitionRef.current?.abort?.();
    setIsListening(false);
  }, []);

  const loadSurah = useCallback(async () => {
    setError(null);
    setIsLoadingSurah(true);
    setLastSpokenWord("");

    try {
      const surahResult = await fetchSurahTextOnly(surah);
      setSurahName(surahResult.name);

      const words = surahResult.ayahs.flatMap((ayah) =>
        splitOriginalArabicWords(ayah.text).map((word) => ({
          word,
          normalized: normalizeArabic(word),
          status: "pending" as WordStatus,
          ayahNumber: ayah.numberInSurah,
        }))
      );

      if (!words.length) throw new Error("Unable to load any ayahs for this surah.");

      words[0] = { ...words[0], status: "current" };
      setSurahWords(words);
      currentWordIndexRef.current = 0;
      setCurrentWordIndex(0);
    } catch (err) {
      setSurahWords([]);
      setSurahName("");
      setError(err instanceof Error ? err.message : "Failed to load ayah.");
    } finally {
      setIsLoadingSurah(false);
    }
  }, [surah]);

  const handleResetRecitation = useCallback(() => {
    setSurahWords((prev) =>
      prev.map((w, i) => ({
        ...w,
        status: i === 0 ? "current" : "pending",
      }))
    );
    currentWordIndexRef.current = 0;
    setCurrentWordIndex(0);
    setLastSpokenWord("");
    setError(null);
  }, []);

  useEffect(() => {
    void loadSurah();
  }, [loadSurah]);

  useEffect(() => {
    surahWordsRef.current = surahWords;
  }, [surahWords]);

  useEffect(() => {
    const el = wordSpanRefs.current[currentWordIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentWordIndex]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
    };
  }, []);

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 pb-32 text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-emerald-400">Surah {surah}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetRecitation}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-emerald-400/60 hover:text-white"
          >
            Reset
          </button>
          <p className="text-sm text-zinc-400">Accuracy {score}%</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0f1020] p-8">
        {isLoadingSurah ? (
          <p className="text-center text-zinc-400">Loading full surah...</p>
        ) : (
          <p className={`${amiri.className} text-center text-4xl leading-[2.2] text-white md:text-5xl`} dir="rtl">
            {surahWords.map((word, idx) => {
              const markerAfter =
                idx === surahWords.length - 1 || surahWords[idx + 1].ayahNumber !== word.ayahNumber;

              return (
                <span key={`${word.ayahNumber}-${idx}`}>
                  <WordToken
                    item={word}
                    index={idx}
                    isListening={isListening}
                    isCurrentIndex={idx === currentWordIndex}
                    setRef={(wordIndex, el) => {
                      wordSpanRefs.current[wordIndex] = el;
                    }}
                  />{" "}
                  {markerAfter && (
                    <span className="mx-1 inline-flex h-7 w-7 translate-y-[-2px] items-center justify-center rounded-full border border-emerald-400/40 text-sm text-zinc-300">
                      {word.ayahNumber}
                    </span>
                  )}{" "}
                </span>
              );
            })}
          </p>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#1a1a2e]/95 px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isLoadingSurah}
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/20 text-3xl text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={isListening ? "Stop recording" : "Start recording"}
            title={isListening ? "Stop recording" : "Start recording"}
          >
            {isListening ? "■" : "🎤"}
          </button>
          <button
            type="button"
            onClick={stopListening}
            className="rounded-full border border-white/20 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-rose-400/60 hover:text-white"
          >
            Stop
          </button>
          <p className="text-sm text-zinc-300">
            {surahName || `Surah ${surah}`} • Ayah {currentAyahNumber}
          </p>
          <p className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
            {score}% accuracy
          </p>
          {isListening && lastSpokenWord && (
            <p className="max-w-24 truncate text-xs text-zinc-400">"{lastSpokenWord}"</p>
          )}
        </div>
      </div>
    </section>
  );
}
