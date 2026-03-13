import { useEffect, useState } from 'react';
import { api } from './useApi';

// Module-level cache — survives re-renders and remounts
let folkCache: Record<string, string> | null = null;
let folkPromise: Promise<Record<string, string>> | null = null;

// Normalize: lowercase, strip accents (ø→o, å→a, é→e etc.)
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'a');
}

// Build a lookup map: normalized player name → image URL
// Tries full name match first, then first+last, then first name only
function buildLookup(raw: Record<string, string>): Record<string, string> {
  const normalized: { norm: string; parts: string[]; url: string; original: string }[] = [];

  for (const [name, url] of Object.entries(raw)) {
    const norm = normalize(name);
    normalized.push({ norm, parts: norm.split(/\s+/), url, original: name });
  }

  // Return a resolver: given a player name, find best match
  const lookup: Record<string, string> = {};

  // Pre-index by full normalized name for O(1) exact matches
  for (const entry of normalized) {
    lookup[entry.original] = entry.url;
    // Also index by normalized full name
    lookup[`__norm__${entry.norm}`] = entry.url;
  }

  // Store the entries list for fuzzy matching
  (lookup as any).__entries = normalized;

  return lookup;
}

function resolveAvatar(lookup: Record<string, string>, playerName: string): string | undefined {
  // 1. Exact match
  if (lookup[playerName]) return lookup[playerName];

  // 2. Normalized full match
  const norm = normalize(playerName);
  if (lookup[`__norm__${norm}`]) return lookup[`__norm__${norm}`];

  // 3. Fuzzy: first + last name match, then first name only
  const entries = (lookup as any).__entries as { norm: string; parts: string[]; url: string }[];
  if (!entries) return undefined;

  const playerParts = norm.split(/\s+/);
  const playerFirst = playerParts[0];
  const playerLast = playerParts[playerParts.length - 1];

  // Try first + last match
  if (playerParts.length >= 2) {
    const match = entries.find(
      (e) => e.parts[0] === playerFirst && e.parts[e.parts.length - 1] === playerLast
    );
    if (match) return match.url;
  }

  // Try first name only (if unique)
  const firstMatches = entries.filter((e) => e.parts[0] === playerFirst);
  if (firstMatches.length === 1) return firstMatches[0].url;

  return undefined;
}

/**
 * Returns a resolver function: playerName → imageUrl | undefined
 * Fetches folk data once, caches in memory for the session.
 */
export function useFolk(): Record<string, string> & { resolve?: (name: string) => string | undefined } {
  const [lookup, setLookup] = useState<Record<string, string>>(folkCache ? buildLookup(folkCache) : {});

  useEffect(() => {
    if (folkCache) return;

    if (!folkPromise) {
      folkPromise = api('/api/folk').catch((err) => {
        console.error('Failed to fetch folk:', err);
        folkPromise = null;
        return {};
      });
    }

    folkPromise.then((data) => {
      folkCache = data;
      setLookup(buildLookup(data));
    });
  }, []);

  // Return a proxy that resolves names on property access
  return new Proxy(lookup, {
    get(target, prop: string) {
      if (prop === '__entries' || prop.startsWith('__')) return undefined;
      return resolveAvatar(target, prop);
    },
  }) as any;
}
