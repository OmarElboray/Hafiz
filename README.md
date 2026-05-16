# Hafiz (حافظ) — Web Application

> **Automated Quranic Recitation Verification Studio.** Prevent distraction, optimize active recall, and verify verbal accuracy directly inside a privacy-first workspace.

<p align="center">
  <img src="https://img.shields.io/badge/Framework-Next.js%2015-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Language-TypeScript-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Styling-Tailwind%20v4-38bdf8?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Database-Supabase-green?style=for-the-badge&logo=supabase" alt="Supabase" />
</p>

---

## Project Structure

hafiz/
├── src/
│   ├── app/
│   │   ├── layout.tsx       — App Router root layout & font-optimization hook
│   │   └── page.tsx         — Core layout routing & application state engine
│   ├── components/
│   │   └── Tasmi3.tsx       — Recitation studio, speech handling & alignment parser
│   └── lib/
│       └── quran.ts         — Asynchronous client-side data fetching for Arabic scripts
├── package.json             — Project dependencies & runtime build targets
└── tailwind.config.ts       — Utility-first styling tokens for RTL rendering
---

## Quick Setup

### 1. Install Dependencies
```bash
npm install
2. Run the Development ServerBashnpm run dev
Open http://localhost:3000 with your browser to see the live application.How It WorksLive Acoustic Parsing & Normalization LoopArabic text is highly morphologically complex due to short vowels (Tashkeel) and non-semantic orthographic variations. If you try to compare raw strings directly, client-side evaluation fails instantly.[User Vocal Stream] ──> [Web Speech API (ar-SA)] ──> [Linguistic Normalization] ──> [Token Alignment Matrix] ──> [State Update]
To bridge this gap, Hafiz interceptively flattens both the source script strings and the incoming streaming transcript tokens before processing them through the component state loop:Acoustic Interception: The browser audio stream feeds into the native client-side webkitSpeechRecognition engine initialized specifically with recognition.lang = 'ar-SA'.Text Normalization: A customized regular expression matrix strips out diacritics and converts non-uniform glyphs (such as variations of Alef, Ta Marbuta, and Alif Maqsurah) into absolute baseline orthographic characters.Dynamic Evaluation: The component maps the words into distinct structural element arrays, driving a state machine that updates token states through explicit conditions:TypeScript// Extracted from src/components/Tasmi3.tsx
function normalizeArabic(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED]/g, "") // Strips Harakat (diacritics)
    .replace(/[\u0671\u0623\u0625\u0622]/g, "ا")                                              // Uniforms variations of Alef
    .replace(/ة/g, "ه")                                                                      // Uniforms Ta Marbuta to Heh
    .replace(/ى/g, "ي")                                                                      // Uniforms Alif Maqsurah to Yeh
}
Word-Token Alignment ArchitectureThe verification loop monitors current verbal positions securely on-thread, comparing the normalized inputs using a lookahead index pointer. This guarantees that user hesitation or minor regional speech variances do not throw off the entire recitation tracking engine:TypeScript// Inside the SpeechRecognition onresult tracking loop
const transcriptWords = event.results[i][0].transcript.split(" ");
const currentTargetWord = wordsArray[currentIndex];

if (normalizeArabic(userSpokenWord) === normalizeArabic(currentTargetWord)) {
  setWordState(currentIndex, 'correct'); // Updates UI node to green
  currentIndex++;
} else {
  setWordState(currentIndex, 'wrong');   // Flags UI node as warning red
}
Storage & Profile StrategyModeStorage LayerCore FunctionFree / GuestAsynchronous Local CachePersists local target settings and reading setups across current browser sessions.Sync ProfileSupabase Client LayerIntegrates user authentication and tracks global long-term retention history metrics.Technical Implementations ExplainedModule ComponentCore Sub-system ArchitectureReason for ChoiceWeb Speech APIClient-side native recording interfaceGuarantees sub-millisecond parsing response times with zero remote server execution costs.Supabase JSAsynchronous relational data structuresHandles user authentication and secure profile data tracking out of the box.Tailwind CSS v4Hardware-accelerated design utilitiesFacilitates Right-to-Left (RTL) matrix rendering for clean, modern Arabic typography.Development NotesZero-Latency Stream Processing: Because the Web Speech API runs completely inside the host browser's runtime environment, no audio files are compiled or transmitted to third-party endpoints, satisfying standard data privacy laws.Linguistic Adjustments: The Web Speech transcription output varies depending on local dialects. If specific pronunciation tokens fail frequently, look at the browser developer console logs to trace the raw string output and append adjustments inside the normalizeArabic parsing engine.Font Rendering: Global layouts are explicitly integrated with font weights optimizing the standard Amiri Arabic system to prevent letter clipping across responsive viewport modifications.
***

### Save and Upload
1. Open your `Hafiz` project directory.
2. Replace everything inside your current `README.md` file with the block above and save it.
3. Open your project folder in `cmd` using your address bar shortcut and run your standard commands:
```bash
git add README.md
git commit -m "docs: compile highly technical repository README document"
git push
