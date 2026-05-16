"use client";

import { useState } from "react";
import Tasmi3 from "@/components/Tasmi3";

type Mode = "hifz" | "tasmi3";

export default function Home() {
  const [mode, setMode] = useState<Mode>("tasmi3");

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 py-8 text-zinc-100 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col items-center gap-4">
          <h1 className="font-[family-name:var(--font-amiri)] text-center text-4xl font-bold tracking-[0.08em] text-emerald-400 sm:text-5xl">
            حافظ
          </h1>
          <div className="inline-flex rounded-full border border-white/10 bg-[#1a1a2e] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <button
              type="button"
              onClick={() => setMode("hifz")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                mode === "hifz"
                  ? "bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              Hifz
            </button>
            <button
              type="button"
              onClick={() => setMode("tasmi3")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                mode === "tasmi3"
                  ? "bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              Tasmi3
            </button>
          </div>
        </header>

        {mode === "tasmi3" ? (
          <Tasmi3 />
        ) : (
          <section className="rounded-2xl border border-white/10 bg-[#1a1a2e] p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <p className="font-[family-name:var(--font-amiri)] text-3xl text-white sm:text-4xl" dir="rtl">
              اختر آية وابدأ مراجعتك بهدوء
            </p>
            <p className="mt-3 text-sm text-zinc-400">Hifz mode is ready for your next flow.</p>
          </section>
        )}
      </div>
    </main>
  );
}
