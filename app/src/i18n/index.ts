import messages from './bm.json';
export type Language = 'bm' | 'en';
export const LANGUAGE_KEY = 'sl.language';
const dictionary: Record<string, string> = Object.assign(Object.create(null), messages);
const listeners = new Set<() => void>();
function stored(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'bm';
  } catch {
    return 'bm';
  }
}
let language: Language = stored();
export function getLanguage() {
  return language;
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function updateDocument() {
  if (typeof document !== 'undefined')
    document.documentElement.lang = language === 'bm' ? 'ms' : 'en';
}
export function setLanguage(value: Language) {
  language = value;
  try {
    localStorage.setItem(LANGUAGE_KEY, value);
  } catch {
    /* Language still works when storage is unavailable. */
  }
  updateDocument();
  listeners.forEach((listener) => listener());
}
const reverse: Record<string, string> = Object.assign(
  Object.create(null),
  Object.fromEntries(Object.entries(dictionary).map(([en, bm]) => [bm, en])),
);
export function t(text: string, values: Record<string, string | number> = {}): string {
  const source = reverse[text] ?? text;
  let result = language === 'bm' ? (dictionary[source] ?? source) : source;
  // Domain validation messages remain language-independent; localize known patterns at display.
  if (language === 'bm' && !dictionary[source]) {
    const patterns: [RegExp, string][] = [
      [/^All of (.+)$/, 'Seluruh $1'],
      [/^Choose at least one district in (.+)\.$/, 'Pilih sekurang-kurangnya satu daerah di $1.'],
      [/^Check the selected districts in (.+)\.$/, 'Semak daerah pilihan di $1.'],
      [
        /^Use a full https:\/\/ (.+) link, or leave it empty\.$/,
        'Gunakan pautan penuh https:// $1 atau biarkan kosong.',
      ],
      [/^Booking accepted\.$/, 'Tempahan diterima.'],
      [/^Booking declined\.$/, 'Tempahan ditolak.'],
      [/^Booking cancelled\.$/, 'Tempahan dibatalkan.'],
      [/^Booking completed\.$/, 'Tempahan selesai.'],
    ];
    for (const [pattern, translation] of patterns)
      if (pattern.test(source)) {
        result = source.replace(pattern, translation);
        break;
      }
  }
  return result.replace(/\{(\w+)\}/g, (match, key: string) =>
    values[key] === undefined ? match : String(values[key]),
  );
}
export function locale() {
  return language === 'bm' ? 'ms-MY' : 'en-MY';
}
updateDocument();
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_KEY || event.key === null) {
      language = stored();
      updateDocument();
      listeners.forEach((listener) => listener());
    }
  });
