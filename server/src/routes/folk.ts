import { Router } from 'express';

const router = Router();

// In-memory cache: { data, fetchedAt }
let cache: { data: Record<string, string>; fetchedAt: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function scrapeFolk(): Promise<Record<string, string>> {
  const res = await fetch('https://scelto.no/folk');
  if (!res.ok) throw new Error(`scelto.no returned ${res.status}`);
  const html = await res.text();

  // Parse <li> blocks containing <img src="..."> and <h3>Name</h3>
  const folkMap: Record<string, string> = {};
  const pattern = /<img[^>]+src="(https:\/\/images\.squarespace-cdn\.com\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const imageUrl = match[1];
    const name = match[2].trim();
    if (name && imageUrl) {
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
