export function extractIdentifiers(text: string): string[] {
  const candidates: string[] = [];
  for (const raw of text.toUpperCase().split(/\r?\n/).slice(0, 100)) {
    const line = raw.replace(/\b(MTOP|BODY|PLATE)\b\s*(?:NO\.?|NUMBER)?\s*[:#-]?\s*/g, '').trim();
    const values = [line, ...(line.match(/[A-Z0-9]+(?:[- ][A-Z0-9]+)*/g) ?? [])];
    for (const value of values) {
      if (
        /^[A-Z0-9][A-Z0-9 -]{0,14}$/.test(value) &&
        /\d/.test(value) &&
        !candidates.includes(value)
      )
        candidates.push(value);
    }
  }
  return candidates.slice(0, 8);
}
