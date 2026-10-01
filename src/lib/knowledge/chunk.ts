/** Split text into search-sized chunks, on paragraph boundaries where possible. Pure. */

export const CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of clean.split(/\n\n/)) {
    if (paragraph.length > size) {
      flush();
      // A paragraph longer than a chunk is cut with a little overlap so a sentence on the cut is still findable.
      for (let start = 0; start < paragraph.length; start += size - OVERLAP_CHARS) {
        chunks.push(paragraph.slice(start, start + size).trim());
        if (start + size >= paragraph.length) break;
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > size) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();
  return chunks.filter(Boolean);
}

/** Lowercase search terms for an OR query: letters and digits only, so they are safe inside to_tsquery. */
export function searchTerms(query: string, max = 12): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  return [...new Set(words)].slice(0, max);
}
