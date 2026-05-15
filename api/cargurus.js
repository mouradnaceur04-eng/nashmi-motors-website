// CarGurus VIN Level Stats API proxy — keeps credentials server-side
const APP_ID = '0b486895-48cb-4b56-97c4-a25847b01d66';
const TOKEN  = '68d56bf1-b4e6-42e2-ac4c-a3c3bbcff108';

export default async function handler(req, res) {
  const { vin } = req.query;
  if (!vin || typeof vin !== 'string' || vin.length > 20) {
    return res.status(400).json({ error: 'invalid vin' });
  }

  const endpoints = [
    `https://api.cargurus.com/cg/v1/ds/vins/${encodeURIComponent(vin)}/stats?appId=${APP_ID}&authToken=${TOKEN}`,
    `https://api.cargurus.com/cg/v2/ds/vins/${encodeURIComponent(vin)}?appId=${APP_ID}&authToken=${TOKEN}`,
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'NashmiMotors/1.0' },
      });
      if (r.status === 404) break; // VIN not in CarGurus — stop trying
      if (!r.ok) continue;
      const raw = await r.json();

      // Normalize field names — CarGurus may use different keys across API versions
      const priceEvaluation = raw.priceEvaluation || raw.dealEvaluation || raw.evaluation || null;
      const listingUrl      = raw.listingUrl || raw.cgUrl || raw.url || null;

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ priceEvaluation, listingUrl, vin });
    } catch (e) {
      continue;
    }
  }

  // VIN not found or API unreachable
  return res.status(404).json({ error: 'not found', priceEvaluation: null });
}
