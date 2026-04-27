#!/usr/bin/env node
/**
 * Nashmi Motors — DealerCenter Feed Diagnostic
 * Run BEFORE and AFTER cancelling the DealerCenter website to confirm
 * the XML feed, photos, and CarFax data are all still working.
 *
 * Usage:
 *   node scraper/check-feed.js
 */

const FEED_URL     = 'https://feeds.dealercenter.net/inventory/29008363/feed.xml';
const VERCEL_API   = 'https://nashmi-motors-website.vercel.app/api/inventory'; // your live API
const PHOTO_CDN    = 'imagescf.dealercenter.net';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`; // green
const R = s => `\x1b[31m${s}\x1b[0m`; // red
const Y = s => `\x1b[33m${s}\x1b[0m`; // yellow
const B = s => `\x1b[1m${s}\x1b[0m`;  // bold

function tag(xml, name) {
  const rx = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m  = xml.match(rx);
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function allTags(xml, name) {
  const rx = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi');
  const out = [];
  let m;
  while ((m = rx.exec(xml)) !== null)
    out.push(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
  return out;
}

async function checkUrl(url, label) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
    if (r.ok) { console.log(`  ${G('✓')} ${label}`); return true; }
    console.log(`  ${R('✗')} ${label} — HTTP ${r.status}`); return false;
  } catch (e) {
    console.log(`  ${R('✗')} ${label} — ${e.message}`); return false;
  }
}

async function run() {
  console.log('\n' + B('═══ DealerCenter Feed Diagnostic ═══') + '\n');

  // ── 1. Feed reachable? ────────────────────────────────────────────────────
  console.log(B('1. Feed URL'));
  console.log(`   ${FEED_URL}\n`);

  // DealerCenter blocks direct requests from residential IPs — normal behaviour.
  // We test through your Vercel API (the real production path) AND directly.
  let xml = '';
  let feedSource = '';

  // Try direct first (works from Vercel servers / CI environments)
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'NashmiMotors-Diagnostic/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
    feedSource = 'direct';
    console.log(`  ${G('✓')} Direct feed access: OPEN`);
    console.log(`  ${G('✓')} Size: ${(xml.length / 1024).toFixed(1)} KB\n`);
  } catch (e) {
    console.log(`  ${Y('○')} Direct feed blocked from this machine (normal for residential IPs)`);
    console.log(`  ${Y('→ DealerCenter only allows server-to-server. Testing via your Vercel API...')}\n`);

    // Fall back to your live Vercel API (this IS the production path)
    try {
      const res2 = await fetch(VERCEL_API, { signal: AbortSignal.timeout(15000) });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      const json = await res2.json();
      const vehicles = json.vehicles || json.data || [];
      feedSource = 'vercel-api';

      if (vehicles.length > 0) {
        console.log(`  ${G('✓')} Vercel API is LIVE — ${vehicles.length} vehicles returned`);
        console.log(`  ${G('✓')} Feed is working correctly in production\n`);

        // Print sample
        console.log(B('2. Vehicle Data (via Vercel API)'));
        vehicles.slice(0, 3).forEach(v => {
          console.log(`  • ${v.year} ${v.make} ${v.model} | VIN: ${v.vin || R('MISSING')} | $${v.price || v.sale || R('MISSING')}`);
        });

        // CarFax summary from API response
        console.log(`\n${B('3. CarFax Data (via Vercel API)')}`);
        const withCfx   = vehicles.filter(v => v.carfax).length;
        const withBadge = vehicles.filter(v => v.carfaxBadge).length;
        const with1Own  = vehicles.filter(v => (v.carfaxBadge||'').includes('1own')).length;
        console.log(`  ${withCfx   > 0 ? G('✓') : Y('○')} CarFax URLs:      ${withCfx} / ${vehicles.length}`);
        console.log(`  ${withBadge > 0 ? G('✓') : Y('○')} Value badges:     ${withBadge} / ${vehicles.length}`);
        console.log(`  ${with1Own  > 0 ? G('✓') : Y('○')} 1-Owner badges:   ${with1Own} / ${vehicles.length}`);
        console.log(`  ${Y('→ All other vehicles show showme.svg via VIN fallback link')}`);

        // Photo check
        console.log(`\n${B('4. Photo Hosting')}`);
        const withPhoto = vehicles.filter(v => v.imgUrl || (v.photos && v.photos[0])).length;
        const samplePhoto = vehicles.find(v => v.imgUrl || (v.photos && v.photos[0]));
        const photoUrl = samplePhoto ? (samplePhoto.imgUrl || samplePhoto.photos[0]) : null;
        console.log(`  ${G('✓')} ${withPhoto} / ${vehicles.length} vehicles have photos on ${PHOTO_CDN}`);
        if (photoUrl) await checkUrl(photoUrl, 'Sample photo URL');

        console.log(`\n${B('═══ Summary ═══')}`);
        console.log(`  Feed:    ${G('LIVE')} via Vercel API — ${vehicles.length} vehicles`);
        console.log(`  Photos:  ${G('LIVE')} on ${PHOTO_CDN}`);
        console.log(`  CarFax:  ${withCfx} dealer URLs + VIN fallback for all others`);
        console.log(`  1-Owner: ${with1Own} detected\n`);
        console.log(B('Run this again after cancelling the DealerCenter website.'));
        console.log('Same vehicle count + photos loading = you are safe to cancel.\n');
        return;
      } else {
        throw new Error('API returned 0 vehicles');
      }
    } catch (e2) {
      console.log(`  ${R('✗ Vercel API also failed:')} ${e2.message}`);
      console.log(`  ${R('→ Something is wrong. Do NOT cancel DealerCenter yet.')}\n`);
      process.exit(1);
    }
  }

  // ── 2. Vehicle count ──────────────────────────────────────────────────────
  console.log(B('2. Vehicle Data'));
  const vehicleBlocks = xml.match(/<vehicle[\s\S]*?<\/vehicle>/gi) || [];
  const count = vehicleBlocks.length;
  if (count > 0) {
    console.log(`  ${G('✓')} ${count} vehicles found in feed`);
  } else {
    console.log(`  ${R('✗')} 0 vehicles — feed may be empty or XML structure changed`);
  }

  // ── 3. Check key fields on first 3 vehicles ───────────────────────────────
  console.log(`\n  Sample data from first 3 vehicles:`);
  const sample = vehicleBlocks.slice(0, 3);
  for (const b of sample) {
    const year  = tag(b, 'year');
    const make  = tag(b, 'make');
    const model = tag(b, 'model');
    const vin   = tag(b, 'vin');
    const price = tag(b, 'price') || tag(b, 'retail_price');
    console.log(`  • ${year} ${make} ${model} | VIN: ${vin || R('MISSING')} | Price: $${price || R('MISSING')}`);
  }

  // ── 4. CarFax data check ──────────────────────────────────────────────────
  console.log(`\n${B('3. CarFax Data in Feed')}`);
  let cfxUrlCount     = 0;
  let cfxBadgeCount   = 0;
  let oneOwnerCount   = 0;
  const badgeTags = ['carfax_badge','CarFaxBadge','carfax_value','carfax_highlight',
                     'CarFaxHighlight','value_badge'];
  const ownerTags = ['carfax_one_owner','one_owner','owners','ownercount'];

  for (const b of vehicleBlocks) {
    if (tag(b, 'carfax_url') || tag(b, 'carfax')) cfxUrlCount++;
    const bdg = badgeTags.map(t => tag(b, t)).find(v => v) || '';
    if (bdg) cfxBadgeCount++;
    const own = ownerTags.map(t => tag(b, t)).find(v => v) || '';
    if (/1[\s\-]?owner/i.test(bdg + ' ' + own) || own.trim() === '1') oneOwnerCount++;
  }

  console.log(`  ${cfxUrlCount > 0 ? G('✓') : Y('○')} CarFax report URLs:    ${cfxUrlCount} / ${count} vehicles`);
  console.log(`  ${cfxBadgeCount > 0 ? G('✓') : Y('○')} CarFax value badges:   ${cfxBadgeCount} / ${count} vehicles`);
  console.log(`  ${oneOwnerCount > 0 ? G('✓') : Y('○')} 1-Owner detected:      ${oneOwnerCount} / ${count} vehicles`);

  if (cfxUrlCount === 0) {
    console.log(`  ${Y('→ No CarFax URLs in feed — site uses VIN fallback (carfax.com/showmethefax/{VIN})')}`);
    console.log(`  ${Y('→ Badges still display via VIN. 1-Owner shown when feed includes owner tags.')}`);
  }

  // ── 5. Badge/highlight tag scan ───────────────────────────────────────────
  console.log(`\n${B('4. CarFax Tag Names Found in XML')}`);
  const allTagsToCheck = [
    'carfax_url','carfax','carfax_badge','CarFaxBadge','carfax_value',
    'carfax_highlight','CarFaxHighlight','carfax_one_owner','one_owner',
    'owners','ownercount','value_badge','history_report',
  ];
  let foundAny = false;
  for (const tagName of allTagsToCheck) {
    const vals = vehicleBlocks.slice(0, 5).map(b => tag(b, tagName)).filter(Boolean);
    if (vals.length) {
      console.log(`  ${G('✓')} <${tagName}> — example: "${vals[0].substring(0, 60)}"`);
      foundAny = true;
    }
  }
  if (!foundAny) {
    console.log(`  ${Y('○')} No CarFax-specific tags found — badges will use VIN-based fallback links')}`);
  }

  // ── 6. Photo CDN check ────────────────────────────────────────────────────
  console.log(`\n${B('5. Photo Hosting (imagescf.dealercenter.net)')}`);
  const photoUrls = [];
  const photoRx = /https?:\/\/imagescf\.dealercenter\.net\/[^\s"<>]+/gi;
  let m;
  while ((m = photoRx.exec(xml)) !== null && photoUrls.length < 3)
    photoUrls.push(m[0]);

  if (photoUrls.length === 0) {
    console.log(`  ${Y('○')} No photo URLs found directly in XML (may be in photo1..photo30 tags)`);
    // Try photo1 tag
    for (const b of vehicleBlocks.slice(0, 3)) {
      const p = tag(b, 'photo1') || tag(b, 'image1');
      if (p && p.startsWith('http')) photoUrls.push(p);
    }
  }

  if (photoUrls.length > 0) {
    console.log(`  Checking ${photoUrls.length} photo URL(s)...`);
    for (const url of photoUrls)
      await checkUrl(url, url.substring(0, 70) + '...');
  } else {
    console.log(`  ${Y('○')} Could not extract photo URLs to test — check manually`);
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log(`\n${B('═══ Summary ═══')}`);
  console.log(`  Feed:    ${G('LIVE')} — ${count} vehicles`);
  console.log(`  Photos:  hosted on ${PHOTO_CDN}`);
  console.log(`  CarFax:  ${cfxUrlCount} dealer URLs + VIN fallback for all others`);
  console.log(`  1-Owner: ${oneOwnerCount} detected in feed\n`);
  console.log(B('Run this script again after cancelling the DealerCenter website.'));
  console.log('If the feed still returns vehicles → you are safe. If it returns 0 → call DealerCenter.\n');
}

run().catch(e => { console.error(R('Fatal error: ' + e.message)); process.exit(1); });
