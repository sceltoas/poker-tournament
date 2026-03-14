import { useEffect, useState, useCallback } from 'react';
import { api } from './useApi';

// Module-level cache — survives re-renders and remounts
let folkCache: Record<string, string> | null = null;
let folkPromise: Promise<Record<string, string>> | null = null;

// Normalize: lowercase, strip accents, collapse Norwegian digraphs
// Handles both Unicode (å ø æ) and ASCII equivalents (aa, o/oe, ae)
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining marks (å→a, é→e, ć→c)
    .replace(/ø/g, 'o')               // ø → o
    .replace(/æ/g, 'ae')              // æ → ae
    .replace(/đ/g, 'd')               // đ → d (Bosnian/Croatian)
    .replace(/aa/g, 'a')              // aa (ASCII å) → a
    .replace(/oe/g, 'o');             // oe (ASCII ø) → o
}

interface FolkEntry {
  norm: string;
  parts: string[];
  url: string;
}

function buildIndex(raw: Record<string, string>): { byExact: Record<string, string>; entries: FolkEntry[] } {
  const byExact: Record<string, string> = {};
  const entries: FolkEntry[] = [];

  for (const [name, url] of Object.entries(raw)) {
    const norm = normalize(name);
    byExact[name] = url;
    byExact[norm] = url;
    entries.push({ norm, parts: norm.split(/\s+/), url });
  }

  return { byExact, entries };
}

function resolve(index: { byExact: Record<string, string>; entries: FolkEntry[] }, playerName: string): string | undefined {
  // 1. Exact match (original or normalized)
  if (index.byExact[playerName]) return index.byExact[playerName];
  const norm = normalize(playerName);
  if (index.byExact[norm]) return index.byExact[norm];

  // 2. First + last name match
  const parts = norm.split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];

  if (parts.length >= 2) {
    const match = index.entries.find(
      (e) => e.parts[0] === first && e.parts[e.parts.length - 1] === last
    );
    if (match) return match.url;
  }

  // 3. Unique first name match
  const firstMatches = index.entries.filter((e) => e.parts[0] === first);
  if (firstMatches.length === 1) return firstMatches[0].url;

  return undefined;
}

/**
 * Returns a function: (playerName) → imageUrl | undefined
 * Fetches folk data once per session, caches in module scope.
 */
export function useFolk(): (playerName: string) => string | undefined {
  const [index, setIndex] = useState<{ byExact: Record<string, string>; entries: FolkEntry[] } | null>(
    folkCache ? buildIndex(folkCache) : null
  );

  useEffect(() => {
    if (folkCache) {
      setIndex(buildIndex(folkCache));
      return;
    }

    if (!folkPromise) {
      folkPromise = api('/api/folk').catch((err) => {
        console.error('Failed to fetch folk:', err);
        folkPromise = null;
        return {};
      });
    }

    folkPromise.then((data) => {
      folkCache = data;
      setIndex(buildIndex(data));
    });
  }, []);

  return useCallback(
    (playerName: string) => (index ? resolve(index, playerName) : undefined),
    [index]
  );
}
