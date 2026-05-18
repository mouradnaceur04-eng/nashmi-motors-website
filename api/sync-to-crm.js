/**
 * Nashmi Motors — Inventory Sync to Dealer CRM (Vercel)
 *
 * Called by pg_cron every 5 minutes via pg_net HTTP POST.
 * Fetches DealerCenter XML feed and upserts vehicles into the CRM Supabase DB.
 *
 * Required Vercel env vars:
 *   SUPABASE_URL              — e.g. https://ichzrtwdsxipljsqdvzs.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — JWT service role key (from Supabase → Settings → JWT Keys)
 */

const FEED_BASE = 'https://feeds.dealercenter.net/inventory';

function getTag(xml, name) {
  const rx = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = xml.match(rx);
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || null : null;
}

function parseIntField(raw) {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseVehicles(xml) {
  const blocks = xml.match(/<vehicle[\s\S]*?<\/vehicle>/gi) || [];
  return blocks
    .map(b => ({
      vin:     getTag(b, 'vin') || '',
      year:    parseIntField(getTag(b, 'year')),
      make:    getTag(b, 'make'),
      model:   getTag(b, 'model'),
      trim:    getTag(b, 'trim'),
      mileage: parseIntField(getTag(b, 'miles') || getTag(b, 'mileage') || getTag(b, 'odometer')),
      price:   parseIntField(getTag(b, 'price') || getTag(b, 'retail_price') || getTag(b, 'asking_price')),
    }))
    .filter(v => v.vin);
}

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ ok: false, error: 'missing env vars' });
  }

  const authHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // Fetch all dealers with a dealercenter_id
  const dealersRes = await fetch(
    `${supabaseUrl}/rest/v1/dealers?select=id,dealercenter_id&dealercenter_id=not.is.null`,
    { headers: authHeaders }
  );
  const dealers = await dealersRes.json();

  if (!Array.isArray(dealers) || !dealers.length) {
    return res.status(200).json({ ok: true, synced: 0 });
  }

  let totalSynced = 0;

  for (const dealer of dealers) {
    try {
      const feedRes = await fetch(
        `${FEED_BASE}/${dealer.dealercenter_id}/feed.xml`,
        {
          headers: { 'User-Agent': 'NashmiMotors-InventoryBot/1.0' },
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!feedRes.ok) {
        console.error(`Feed error for dealer ${dealer.id}: HTTP ${feedRes.status}`);
        continue;
      }

      const xml = await feedRes.text();
      const vehicles = parseVehicles(xml);
      if (!vehicles.length) continue;

      // Upsert in batches of 50 to stay within Supabase request limits
      for (let i = 0; i < vehicles.length; i += 50) {
        const batch = vehicles.slice(i, i + 50).map(v => ({
          ...v,
          dealer_id:   dealer.id,
          synced_from: 'dealercenter',
        }));

        await fetch(
          `${supabaseUrl}/rest/v1/vehicles?on_conflict=dealer_id,vin`,
          {
            method: 'POST',
            headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(batch),
          }
        );
      }

      totalSynced += vehicles.length;
      console.log(`Synced ${vehicles.length} vehicles for dealer ${dealer.id}`);
    } catch (err) {
      console.error(`Sync failed for dealer ${dealer.id}:`, err.message);
    }
  }

  return res.status(200).json({ ok: true, synced: totalSynced });
};
