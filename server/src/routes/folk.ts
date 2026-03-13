import { Router } from 'express';

const router = Router();

// In-memory cache: { data, fetchedAt }
let cache: { data: Record<string, string>; fetchedAt: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function scrapeFolk(): Promise<Record<string, string>> {
  const res = await fetch('https://scelto.no/folk', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`scelto.no returned ${res.status}`);
  let html = await res.text();

  // Squarespace encodes JSON data with &quot; — decode it
  html = html.replace(/&quot;/g, '"');

  // Extract "title": "Name" ... "assetUrl": "https://images.squarespace-cdn.com/..." pairs
  // from Squarespace's embedded JSON data blocks
  const folkMap: Record<string, string> = {};
  const pattern = /"title":\s*"([A-ZÀ-Ž][^"]+)"[\s\S]*?"assetUrl":\s*"(https:\/\/images\.squarespace-cdn\.com\/[^"]+)"/g;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const name = match[1].trim();
    const imageUrl = match[2];
    if (name && imageUrl && !folkMap[name]) {
      folkMap[name] = imageUrl;
    }
  }

  return folkMap;
}

// GET /api/folk — returns { "Name": "imageUrl", ... }
router.get('/', async (_req, res) => {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      return res.json(cache.data);
    }

    const data = await scrapeFolk();
    cache = { data, fetchedAt: Date.now() };
    console.log(`Folk cache refreshed: ${Object.keys(data).length} entries`);
    res.json(data);
  } catch (error) {
    console.error('Folk scrape failed:', error);
    // Return stale cache if available
    if (cache) return res.json(cache.data);
    res.status(502).json({ error: 'Could not fetch folk data' });
  }
});

export default router;
