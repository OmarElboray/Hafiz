# Hafiz

Hafiz is a web application for Quran memorization practice. It uses active recall and live recitation feedback to help users practice passages and identify mismatched words.

## Features

- Arabic-first, right-to-left recitation workspace.
- Browser speech recognition for live practice.
- Arabic text normalization for diacritics and common letter variants.
- Word-level feedback during recitation.
- Supabase integration for authentication and persistent user data.
- Framer Motion and Tailwind CSS-based interface.

## Tech stack

- Next.js
- React and TypeScript
- Tailwind CSS
- Supabase
- Web Speech API

## Local development

### Prerequisites

- Node.js and npm
- A Supabase project for authenticated features

### Setup

```bash
git clone https://github.com/OmarElboray/Hafiz.git
cd Hafiz
npm install
npm run dev
```

Open <http://localhost:3000>.

Build and run the production bundle:

```bash
npm run build
npm start
```

## Project structure

```text
Hafiz/
├── src/app/
│   ├── layout.tsx       # Root layout and metadata
│   ├── page.tsx         # Main application page
│   └── globals.css      # Global styles
├── src/components/
│   └── Tasmi3.tsx       # Recitation and word-alignment interface
├── src/lib/
│   └── quran.ts         # Quran data access
└── public/              # Static assets
```

## Browser support and privacy

Recitation depends on browser speech-recognition support and microphone permission. Audio/transcript handling should be reviewed before production deployment; configure Supabase policies carefully and never expose service-role credentials in the client.
