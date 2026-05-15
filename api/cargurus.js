// CarGurus VIN Level Stats API proxy — keeps credentials server-side
const APP_ID = '0b486895-48cb-4b56-97c4-a25847b01d66';
const TOKEN  = '68d56bf1-b4e6-42e2-ac4c-a3c3bbcff108';

export default async function handler(req, res) {
  const { vin } = req.query;
  if (!vin) return res.status(400).json({ error: 'vin required' });

  try {
    const url = `https://api.cargurus.com/cg/v1/ds/vins/${encodeURIComponent(vin)}/stats?appId=${APP_ID}&authToken=${TOKEN}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ error: 'CarGurus API error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Internal error' });
  }
}
