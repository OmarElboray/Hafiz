"use client";

import { useState, useEffect, useRef } from "react";

type TokenState = "pending" | "current" | "correct" | "wrong";

interface WordToken {
  text: string;
  state: TokenState;
}

// Sample target verification text (Surah Al-Ikhlas)
const TARGET_SURAH = "قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد";

export default function Tasmi3() {
  const [tokens, setTokens] = useState<WordToken[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [accuracy, setAccuracy] = useState(100);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  
  const recognitionRef = useRef<any>(null);

  // Initialize Word State Matrix Array
  useEffect(() => {
    const initializedTokens = TARGET_SURAH.split(" ").map((word, idx) => ({
      text: word,
      state: idx === 0 ? ("current" as TokenState) : ("pending" as TokenState),
    }));
    setTokens(initializedTokens);
  }, []);

  // ── Linguistic Normalization Pipeline ──────────────────────
  function normalizeArabic(text: string): string {
    if (!text) return "";
    return text
      .normalize("NFKD")
      // Strips Harakat / Diacritics sequences completely
      .replace(/[\u064B-\u0652\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g, "")
      // Standardizes orthographic variations
      .replace(/[\u0671\u0623\u0625\u0622]/g, "ا") // Uniforms Alef variants
      .replace(/ة/g, "ه")                         // Uniforms Ta Marbuta
      .replace(/ى/g, "ي")                         // Uniforms Alif Maqsurah
      .trim();
  }

  // ── Speech Processing Stream Manager ──────────────────────
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Web Speech Engine is not supported inside this browser architecture.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "ar-SA"; // Set acoustic isolation profile targeting Arabic

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);

    rec.onresult = (event: any) => {
      let latestTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          latestTranscript += event.results[i][0].transcript;
        }
      }

      if (!latestTranscript) return;

      const spokenWords = latestTranscript.split(" ").filter(Boolean);
      
      setTokens((prevTokens) => {
        const updated = [...prevTokens];
        let runningIndex = currentIndex;

        spokenWords.forEach((userWord) => {
          if (runningIndex >= updated.length) return;

          const targetNormalized = normalizeArabic(updated[runningIndex].text);
          const userNormalized = normalizeArabic(userWord);

          if (userNormalized === targetNormalized) {
            updated[runningIndex].state = "correct";
            runningIndex++;
            if (runningIndex < updated.length) {
              updated[runningIndex].state = "current";
            }
          } else {
            updated[runningIndex].state = "wrong";
            setErrorLog((prev) => [...new Set([...prev, `المتوقع: ${updated[runningIndex].text} | مسموع: ${userWord}`)]);
          }
        });

        setCurrentIndex(runningIndex);
        
        // Dynamically compute tracking score accuracy parameters
        const correctCount = updated.filter((t) => t.state === "correct").length;
        const totalProcessed = updated.filter((t) => t.state !== "pending" && t.state !== "current").length;
        if (totalProcessed > 0) {
          setAccuracy(Math.round((correctCount / totalProcessed) * 100));
        }

        return updated;
      });
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const resetStudio = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setCurrentIndex(0);
    setAccuracy(100);
    setErrorLog([]);
    const reset = TARGET_SURAH.split(" ").map((word, idx) => ({
      text: word,
      state: idx === 0 ? ("current" as TokenState) : ("pending" as TokenState),
    }));
    setTokens(reset);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Real-time Score Tracking Grid */}
      <div className="grid grid-cols-2 gap-4 w-full border-b border-zinc-800 pb-6 text-sm font-mono">
        <div className="text-right">
          <span className="text-zinc-500">معدل الحفظ والتحقق: </span>
          <span className={`font-bold ${accuracy >= 85 ? "text-emerald-400" : "text-amber-400"}`}>
            {accuracy}%
          </span>
        </div>
        <div className="text-left">
          <span className="text-zinc-500">حالة الصوت: </span>
          <span className={isListening ? "text-red-400 animate-pulse" : "text-zinc-400"}>
            {isListening ? "● تسجيل مباشر" : "○ متوقف"}
          </span>
        </div>
      </div>

      {/* Recitation Studio Visual Layout Panel */}
      <div 
        className="w-full py-8 px-4 text-center leading-loose font-arabic text-3xl md:text-4xl border border-zinc-800/50 rounded-xl bg-zinc-950/40 selection:bg-transparent"
        style={{ fontVariantNumeric: "traditional" }}
      >
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 direction-rtl">
          {tokens.map((token, index) => {
            let stateClasses = "text-zinc-600 opacity-40"; // pending default
            if (token.state === "current") stateClasses = "text-zinc-100 border-b-2 border-dashed border-zinc-400 animate-pulse";
            if (token.state === "correct") stateClasses = "text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.2)] font-medium";
            if (token.state === "wrong") stateClasses = "text-rose-400 font-medium line-through decoration-rose-500/50 decoration-2";

            return (
              <span key={index} className={`transition-all duration-200 ${stateClasses}`}>
                {token.text}
              </span>
            );
          })}
        </div>
      </div>

      {/* Core Studio Action Controllers */}
      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={toggleListening}
          className={`px-6 py-3 rounded-xl font-medium tracking-wide shadow-md transition-all duration-200 active:scale-95 ${
            isListening
              ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
              : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 hover:shadow-emerald-500/20"
          }`}
        >
          {isListening ? "إيقاف التسميع" : "بدء التسميع الصوتي"}
        </button>
        
        <button
          onClick={resetStudio}
          className="px-4 py-3 rounded-xl font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-all active:scale-95"
        >
          إعادة تعيين ↺
        </button>
      </div>

      {/* Evaluation Trace Log Panel */}
      {errorLog.length > 0 && (
        <div className="w-full text-right mt-4 p-4 border border-zinc-800/80 bg-zinc-900/20 rounded-xl text-xs font-mono text-zinc-400 max-h-32 overflow-y-auto">
          <p className="text-zinc-500 mb-2 font-bold font-sans">سجل عدم التطابق الصوتي الالكتروني:</p>
          {errorLog.map((log, i) => (
            <p key={i} className="text-rose-400/90 dir-rtl mb-1">⚠ {log}</p>
          ))}
        </div>
      )}
    </div>
  );
}
