function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikeMojibake(value: string): boolean {
  if (!value) return false;
  // UTF-8 bytes rendered as Latin-1 typically produce C1 controls like U+008D.
  if (/[\u0080-\u009f]/.test(value)) return true;
  return /[\u00c0-\u00ff][\u0080-\u00bf]/.test(value);
}

function mojibakeScore(value: string): number {
  let score = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x80 && cp <= 0x9f) score += 5;
    if (cp === 0xfffd) score += 8;
    if (cp === 0x00c3 || cp === 0x00c2 || cp === 0x00e2 || cp === 0x00c4 || cp === 0x00c5) score += 2;
  }
  return score;
}

function decodeUtf8FromLatin1(value: string): string {
  const bytes = Uint8Array.from(Array.from(value, (ch) => ch.charCodeAt(0) & 0xff));
  return new TextDecoder('utf-8').decode(bytes);
}

export function normalizeDisplayText(value: unknown): string {
  const input = collapseSpaces(asString(value));
  if (!input) return '';
  if (!looksLikeMojibake(input)) return input;

  try {
    const decoded = collapseSpaces(decodeUtf8FromLatin1(input));
    if (!decoded) return input;
    return mojibakeScore(decoded) < mojibakeScore(input) ? decoded : input;
  } catch {
    return input;
  }
}

export function normalizeForSearch(value: unknown): string {
  const clean = normalizeDisplayText(value);
  if (!clean) return '';
  return clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019`´]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
