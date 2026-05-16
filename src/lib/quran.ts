const ALQURAN_API_BASE = "https://api.alquran.cloud/v1";
const MP3QURAN_API_BASE = "https://mp3quran.net/api/v3";

const DEFAULT_RECITER_IDS = [137, 6, 3] as const;

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  juz?: number;
  page?: number;
}

export interface Reciter {
  id: number;
  name: string;
  language?: string;
  audioBaseUrl: string;
  availableSurahNumbers: number[];
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  ayahs: Ayah[];
  audioByReciter: Array<{
    reciter: Reciter;
    surahAudioUrl: string | null;
  }>;
}

interface AlQuranAyahResponse {
  code: number;
  status: string;
  data: {
    number: number;
    text: string;
    numberInSurah: number;
    juz?: number;
    page?: number;
    surah: {
      number: number;
      name: string;
      englishName: string;
      englishNameTranslation: string;
      revelationType: string;
    };
  };
}

interface AlQuranSurahResponse {
  code: number;
  status: string;
  data: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    ayahs: Array<{
      number: number;
      text: string;
      numberInSurah: number;
      juz?: number;
      page?: number;
    }>;
  };
}

interface Mp3QuranRecitersResponse {
  reciters: Array<{
    id: number;
    name: string;
    letter?: string;
    moshaf: Array<{
      id: number;
      name: string;
      server: string;
      surah_list: string;
    }>;
  }>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

function normalizeServerUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function buildSurahAudioFileName(surahNumber: number): string {
  return String(surahNumber).padStart(3, "0") + ".mp3";
}

export async function fetchAyahText(
  surahNumber: number,
  ayahNumber: number,
  edition = "quran-uthmani"
): Promise<Ayah> {
  const url = `${ALQURAN_API_BASE}/ayah/${surahNumber}:${ayahNumber}/${edition}`;
  const result = await fetchJson<AlQuranAyahResponse>(url);

  return {
    number: result.data.number,
    numberInSurah: result.data.numberInSurah,
    text: result.data.text,
    juz: result.data.juz,
    page: result.data.page,
  };
}

export async function fetchReciters(
  reciterIds: number[] = [...DEFAULT_RECITER_IDS]
): Promise<Reciter[]> {
  const url = `${MP3QURAN_API_BASE}/reciters?language=eng`;
  const result = await fetchJson<Mp3QuranRecitersResponse>(url);

  const recitersById = new Map<number, Mp3QuranRecitersResponse["reciters"][number]>();
  for (const reciter of result.reciters) {
    recitersById.set(reciter.id, reciter);
  }

  return reciterIds
    .map((id) => recitersById.get(id))
    .filter((reciter): reciter is Mp3QuranRecitersResponse["reciters"][number] => Boolean(reciter))
    .map((reciter) => {
      const preferredMoshaf = reciter.moshaf[0];
      const surahList = preferredMoshaf?.surah_list
        ? preferredMoshaf.surah_list
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value))
        : [];

      return {
        id: reciter.id,
        name: reciter.name,
        language: "ar",
        audioBaseUrl: preferredMoshaf ? normalizeServerUrl(preferredMoshaf.server) : "",
        availableSurahNumbers: surahList,
      };
    });
}

export async function getSurahAudioLinks(
  surahNumber: number,
  reciterIds: number[] = [...DEFAULT_RECITER_IDS]
): Promise<Array<{ reciter: Reciter; surahAudioUrl: string | null }>> {
  const reciters = await fetchReciters(reciterIds);
  const filename = buildSurahAudioFileName(surahNumber);

  return reciters.map((reciter) => {
    const hasSurah = reciter.availableSurahNumbers.includes(surahNumber);
    const surahAudioUrl = hasSurah && reciter.audioBaseUrl ? `${reciter.audioBaseUrl}${filename}` : null;

    return { reciter, surahAudioUrl };
  });
}

export async function fetchSurahWithTextAndAudio(
  surahNumber: number,
  edition = "quran-uthmani",
  reciterIds: number[] = [...DEFAULT_RECITER_IDS]
): Promise<Surah> {
  const surahUrl = `${ALQURAN_API_BASE}/surah/${surahNumber}/${edition}`;
  const [surahResponse, audioByReciter] = await Promise.all([
    fetchJson<AlQuranSurahResponse>(surahUrl),
    getSurahAudioLinks(surahNumber, reciterIds),
  ]);

  return {
    number: surahResponse.data.number,
    name: surahResponse.data.name,
    englishName: surahResponse.data.englishName,
    englishNameTranslation: surahResponse.data.englishNameTranslation,
    revelationType: surahResponse.data.revelationType,
    ayahs: surahResponse.data.ayahs.map((ayah) => ({
      number: ayah.number,
      numberInSurah: ayah.numberInSurah,
      text: ayah.text,
      juz: ayah.juz,
      page: ayah.page,
    })),
    audioByReciter,
  };
}

export async function fetchSurahTextOnly(
  surahNumber: number,
  edition = "quran-uthmani"
): Promise<Omit<Surah, "audioByReciter">> {
  const surahUrl = `${ALQURAN_API_BASE}/surah/${surahNumber}/${edition}`;
  const surahResponse = await fetchJson<AlQuranSurahResponse>(surahUrl);

  return {
    number: surahResponse.data.number,
    name: surahResponse.data.name,
    englishName: surahResponse.data.englishName,
    englishNameTranslation: surahResponse.data.englishNameTranslation,
    revelationType: surahResponse.data.revelationType,
    ayahs: surahResponse.data.ayahs.map((ayah) => ({
      number: ayah.number,
      numberInSurah: ayah.numberInSurah,
      text: ayah.text,
      juz: ayah.juz,
      page: ayah.page,
    })),
  };
}
