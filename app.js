// Nashmi Motors — app.js
// Inventory is fetched live from /api/inventory (Vercel serverless, 30-second CDN cache)
// which proxies the DealerCenter XML feed in real time.

function h(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

let inventory = [];

async function loadInventory() {
  // Try live Vercel function first (real-time DealerCenter data, 30s CDN cache)
  // Fall back to static JSON for local dev where the function isn't running
  const endpoints = [
    '/api/inventory',
    'public/inventory.json',
  ];
  for (const url of endpoints) {
    try {
      const res  = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      inventory  = data.vehicles || [];
      if (inventory.length > 0) { onInventoryLoaded(); return; }
    } catch (e) {
      // try next endpoint
    }
  }
  // Final fallback: hardcoded vehicles
  console.warn('All inventory endpoints failed, using built-in fallback.');
  inventory = FALLBACK_INVENTORY;
  onInventoryLoaded();
}

// Called once inventory is ready — each page sets this before calling loadInventory()
let onInventoryLoaded = () => {};

// ─── Render helpers ────────────────────────────────────────────────────────────

function fmtPrice(n) {
  if (!n && n !== 0) return 'Call for Price';
  return '$' + Number(n).toLocaleString();
}

function fmtMiles(n) {
  return n ? Number(n).toLocaleString() + ' mi' : 'N/A';
}

function carCard(c) {
  const displayPrice = c.sale || c.price;
  const detailUrl    = `/vehicle?vin=${encodeURIComponent(c.vin || '')}`;
  const safeImg      = safeUrl(c.imgUrl);
  const imgHtml = safeImg
    ? `<img src="${h(safeImg)}" alt="${h(c.year)} ${h(c.make)} ${h(c.model)}" loading="lazy" width="640" height="480">`
    : `<div class="car-no-photo"><span>📷</span><p>Photos Coming Soon</p></div>`;
  const saleBadge = c.sale ? `<div class="car-badge">Sale</div>` : '';
  // Show original/was price + savings on EVERY car (sale price if marked, else 12% above asking)
  const wasPrice = c.sale ? null : (c.price ? Math.round(c.price * 1.12) : null);
  const oldPrice = c.sale
    ? `<span class="car-old-price">${fmtPrice(c.price)}</span>`
    : (wasPrice ? `<span class="car-old-price">${fmtPrice(wasPrice)}</span>` : '');
  const savings = c.sale
    ? `<span class="car-savings">Save ${fmtPrice(c.price - c.sale)}</span>`
    : (wasPrice && c.price ? `<span class="car-savings">Save ${fmtPrice(wasPrice - c.price)}</span>` : '');
  // ── CarFax badges ──────────────────────────────────────────────────────────
  // carfaxBadge values from API: '1own' | '1own_great' | '1own_good' | '1own_fair'
  //                              | 'Great Value' | 'Good Value' | 'Fair Value' | null
  const CFX_CDN  = 'https://partnerstatic.carfax.com/img/valuebadge/';
  const badge    = (c.carfaxBadge || '').toLowerCase();
  const hasOwner = badge.includes('1own');

  // Effective CarFax URL: use dealer-specific URL if available,
  // otherwise generate a free VIN-based SMTC link (works for any VIN)
  const cfxUrl = safeUrl(c.carfax) || (c.vin ? `https://www.carfax.com/showmethefax/${encodeURIComponent(c.vin)}` : null);

  // Pick the most informative SVG for the "Show Me The CARFAX" button
  const smtcSvg = hasOwner && badge.includes('great') ? '1own_great.svg'
                : hasOwner && badge.includes('good')  ? '1own_good.svg'
                : hasOwner && badge.includes('fair')  ? '1own_fair.svg'
                : hasOwner                            ? '1own.svg'
                : badge.includes('great')             ? 'great.svg'
                : badge.includes('good')              ? 'good.svg'
                : badge.includes('fair')              ? 'fair.svg'
                : 'showme.svg';

  // Show SMTC badge on every vehicle that has a VIN (even without a dealer URL)
  const cfBtn = cfxUrl
    ? `<a href="${h(cfxUrl)}" target="_blank" rel="noopener" class="smtc-badge" title="Show Me The CARFAX Report" onclick="event.stopPropagation()">
        <img src="${h(CFX_CDN + smtcSvg)}" alt="Show Me The CARFAX" loading="lazy">
      </a>`
    : '';

  // CarFax value badge overlay pinned to the photo corner (only for rated vehicles)
  let cfxBadgeHtml = '';
  if (c.carfaxBadge && cfxUrl) {
    const overlaySvg = hasOwner && badge.includes('great') ? '1own_great.svg'
                     : hasOwner && badge.includes('good')  ? '1own_good.svg'
                     : hasOwner && badge.includes('fair')  ? '1own_fair.svg'
                     : hasOwner                            ? '1own.svg'
                     : badge.includes('great')             ? 'great.svg'
                     : badge.includes('good')              ? 'good.svg'
                     : badge.includes('fair')              ? 'fair.svg'
                     : null;
    if (overlaySvg) {
      const altText = h(c.carfaxBadge);
      const imgTag  = `<img src="${h(CFX_CDN + overlaySvg)}" alt="${altText}" loading="lazy" style="height:36px;display:block">`;
      cfxBadgeHtml  = `<a href="${h(cfxUrl)}" target="_blank" rel="noopener" class="cfx-badge-wrap" onclick="event.stopPropagation()" aria-label="${altText} - CarFax report">${imgTag}</a>`;
    }
  }

  return `
<div class="car-card" data-type="${h(c.type)}" data-make="${h(c.make)}" data-drive="${h(c.drive)}" data-price="${displayPrice || 0}">
  <div class="car-img-container">
    <a href="${detailUrl}" class="car-img-wrap">
      ${imgHtml}
      ${saleBadge}
    </a>
    ${cfxBadgeHtml}
  </div>
  <div class="car-info">
    <h3 class="car-title"><a href="${detailUrl}">${h(c.year)} ${h(c.make)} ${h(c.model)}</a></h3>
    <div class="car-price-row">
      <span class="car-price">${fmtPrice(displayPrice)}</span>
      ${oldPrice}
      ${savings}
    </div>
    <div class="car-meta">
      <span>${fmtMiles(c.miles)}</span>
      <span>${h(c.drive || 'N/A')}</span>
      <span>${h(c.fuel || 'Gas')}</span>
    </div>
    <div class="car-actions">
      <a href="${detailUrl}" class="btn btn-primary car-btn">View Details</a>
      ${cfBtn}
    </div>
  </div>
</div>`;
}

// ─── Search bar ────────────────────────────────────────────────────────────────

function updateModels() {
  const make = document.getElementById('s-make')?.value;
  const sel  = document.getElementById('s-model');
  if (!sel) return;
  sel.innerHTML = '<option value="">Any Model</option>';
  if (!make) return;
  const models = [...new Set(inventory.filter(c => c.make === make).map(c => c.model))].sort();
  models.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    sel.appendChild(o);
  });
}

function runSearch() {
  const make  = document.getElementById('s-make')?.value;
  const model = document.getElementById('s-model')?.value;
  const price = document.getElementById('s-price')?.value;
  const params = new URLSearchParams();
  if (make)  params.set('make', make);
  if (model) params.set('model', model);
  if (price) params.set('price', price);
  window.location.href = '/inventory' + (params.toString() ? '?' + params.toString() : '');
}

// ─── Sticky header & hamburger ────────────────────────────────────────────────

window.addEventListener('scroll', () => {
  document.getElementById('header')?.classList.toggle('scrolled', window.scrollY > 10);
});

document.getElementById('hamburger')?.addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('nav')?.classList.toggle('open');
});

// ─── Lead submission helper ───────────────────────────────────────────────────
// POSTs form data silently to /api/lead (Vercel function → Resend → DealerCenter CRM)
// Shows a success or error message inline — no email app opens.

async function submitLead(form, type, successMsg) {
  const btn = form.querySelector('button[type="submit"], input[type="submit"]');
  const data = { _type: type };
  for (const [k, v] of new FormData(form).entries()) {
    if (v?.toString().trim()) data[k] = v.toString().trim();
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const res = await fetch('/api/lead', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Server error');

    // Success — hide form, show message
    form.style.display = 'none';
    const div = document.createElement('div');
    div.style.cssText = 'margin-top:20px;padding:24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center';
    div.innerHTML = `<p style="font-size:18px;font-weight:700;color:#166534;margin:0 0 8px">✓ Sent!</p><p style="color:#166534;margin:0">${successMsg}</p>`;
    form.parentNode.insertBefore(div, form.nextSibling);
    div.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
    alert('Something went wrong. Please call us at (717) 743-5175.');
  }
}

// ─── JSON-LD schema injection ────────────────────────────────────────────────
// Helps AI assistants (ChatGPT, Claude, Perplexity, Google AI Overviews) cite
// inventory and vehicle pages with accurate make/model/year/price/VIN data.

const SITE_ORIGIN = 'https://nashmimotors.com';
const ORG_REF = { '@id': SITE_ORIGIN + '/#organization' };

function fuelTypeForSchema(f) {
  const lo = String(f || '').toLowerCase();
  if (!lo) return undefined;
  if (lo.includes('diesel')) return 'Diesel';
  if (lo.includes('electric')) return 'Electric';
  if (lo.includes('hybrid')) return 'Hybrid';
  if (lo.includes('flex')) return 'Flex Fuel';
  return 'Gasoline';
}

function driveTypeForSchema(d) {
  const lo = String(d || '').toUpperCase();
  if (lo === 'AWD') return 'AllWheelDriveConfiguration';
  if (lo === '4WD' || lo === '4X4') return 'FourWheelDriveConfiguration';
  if (lo === 'FWD' || lo === '2WD') return 'FrontWheelDriveConfiguration';
  if (lo === 'RWD') return 'RearWheelDriveConfiguration';
  return undefined;
}

function bodyTypeForSchema(t) {
  const map = {
    sedan: 'Sedan',
    suv: 'SUV',
    truck: 'Pickup Truck',
    van: 'Van',
    coupe: 'Coupe',
    hatchback: 'Hatchback',
    wagon: 'Station Wagon',
    convertible: 'Convertible',
  };
  return map[String(t || '').toLowerCase()] || undefined;
}

function vehicleSchemaFor(c) {
  const label = `${c.year} ${c.make} ${c.model}`.trim();
  const price = c.sale || c.price;
  const url   = `${SITE_ORIGIN}/vehicle?vin=${encodeURIComponent(c.vin || '')}`;
  const image = (Array.isArray(c.photos) && c.photos.length ? c.photos : [c.imgUrl]).filter(Boolean);

  const node = {
    '@type': 'Car',
    '@id': url + '#vehicle',
    name: label,
    description: `${label} for sale at Nashmi Motors in Harrisburg, PA. Used vehicle with ${c.miles ? Number(c.miles).toLocaleString() + ' miles' : 'low miles'}. Free CarFax. Financing available for all credit types.`,
    url,
    brand: { '@type': 'Brand', name: c.make },
    manufacturer: { '@type': 'Organization', name: c.make },
    model: c.model,
    vehicleModelDate: String(c.year),
    itemCondition: 'https://schema.org/UsedCondition',
  };
  if (c.vin)   node.vehicleIdentificationNumber = c.vin;
  if (image.length) node.image = image;
  if (c.miles) {
    node.mileageFromOdometer = {
      '@type': 'QuantitativeValue',
      value: Number(c.miles),
      unitCode: 'SMI',
    };
  }
  const fuel = fuelTypeForSchema(c.fuel);
  if (fuel) node.fuelType = fuel;
  const drive = driveTypeForSchema(c.drive);
  if (drive) node.driveWheelConfiguration = `https://schema.org/${drive}`;
  const body = bodyTypeForSchema(c.type);
  if (body) node.bodyType = body;

  if (price) {
    node.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: 'USD',
      price: Number(price),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: ORG_REF,
    };
  }
  return node;
}

function injectJsonLd(id, data) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const tag = document.createElement('script');
  tag.type = 'application/ld+json';
  tag.id = id;
  tag.textContent = JSON.stringify(data);
  document.head.appendChild(tag);
}

function setOrUpdateMeta(selector, attr, value) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    if (selector.includes('property=')) {
      el.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
    } else if (selector.includes('name=')) {
      el.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
    } else if (selector.includes('rel=')) {
      el.setAttribute('rel', selector.match(/rel="([^"]+)"/)[1]);
    }
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function injectVehicleSchema(c) {
  const label = `${c.year} ${c.make} ${c.model}`.trim();
  const price = c.sale || c.price;
  const priceText = price ? `$${Number(price).toLocaleString()}` : 'Call for price';
  const miles = c.miles ? `${Number(c.miles).toLocaleString()} mi` : '';
  const url = `${SITE_ORIGIN}/vehicle?vin=${encodeURIComponent(c.vin || '')}`;
  const desc = `${label} — ${priceText}${miles ? ' · ' + miles : ''}. Used ${bodyTypeForSchema(c.type) || 'vehicle'} for sale at Nashmi Motors in Harrisburg, PA. Free CarFax. Financing for all credit types.`;
  const heroImg = (Array.isArray(c.photos) && c.photos[0]) || c.imgUrl || `${SITE_ORIGIN}/logo.png`;

  setOrUpdateMeta('meta[name="description"]', 'content', desc);
  setOrUpdateMeta('meta[property="og:title"]', 'content', `${label} — Nashmi Motors`);
  setOrUpdateMeta('meta[property="og:description"]', 'content', desc);
  setOrUpdateMeta('meta[property="og:url"]', 'content', url);
  setOrUpdateMeta('meta[property="og:image"]', 'content', heroImg);
  setOrUpdateMeta('meta[name="twitter:title"]', 'content', `${label} — Nashmi Motors`);
  setOrUpdateMeta('meta[name="twitter:description"]', 'content', desc);
  setOrUpdateMeta('meta[name="twitter:image"]', 'content', heroImg);
  setOrUpdateMeta('link[rel="canonical"]', 'href', url);

  injectJsonLd('vehicle-jsonld', {
    '@context': 'https://schema.org',
    '@graph': [
      vehicleSchemaFor(c),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',      item: SITE_ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Inventory', item: SITE_ORIGIN + '/inventory' },
          { '@type': 'ListItem', position: 3, name: label,       item: url },
        ],
      },
    ],
  });
}

function injectInventoryListSchema(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const list = items.slice(0, 50).map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: vehicleSchemaFor(c),
  }));
  injectJsonLd('inventory-jsonld', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': SITE_ORIGIN + '/inventory#page',
        url: SITE_ORIGIN + '/inventory',
        name: 'Used Car Inventory — Nashmi Motors',
        description: 'Live inventory of quality used cars, SUVs, trucks, and vans at Nashmi Motors in Harrisburg, PA. Updated daily. Free CarFax on every vehicle. Financing for all credit types.',
        isPartOf: { '@id': SITE_ORIGIN + '/#website' },
        about: ORG_REF,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: list,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',      item: SITE_ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Inventory', item: SITE_ORIGIN + '/inventory' },
        ],
      },
    ],
  });
}

// ─── Fallback inventory (shown if JSON fetch fails) ───────────────────────────
// This is the last-known inventory — keeps the site working even if the scraper is down.

const FALLBACK_INVENTORY = [
  { vin:"1FAFP55284A197003", year:2004, make:"FORD",     model:"TAURUS",               type:"sedan", price:null,  sale:null,  miles:68431,  drive:"FWD", fuel:"Flex",     img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/ford/taurus/tw3/",                     carfax:null },
  { vin:"1FMYU03152KD52361", year:2002, make:"FORD",     model:"ESCAPE",               type:"suv",   price:4995,  sale:null,  miles:150695, drive:"2WD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/ford/escape/a1033/",                   carfax:"https://www.carfax.com/vehiclehistory/ar20/MOa9z0iTa64nkDNsN-VnMKdY3qRUq0b1F-iB9YyeWe--6i1qqRDrBDoxztVpDXfKdce8u9USpRtYqQ2yVte3iajX3vGUZSDLer0" },
  { vin:"JN8AS5MV7CW394605", year:2012, make:"NISSAN",   model:"ROGUE",                type:"suv",   price:5995,  sale:null,  miles:146441, drive:"AWD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/nissan/rogue/a1038/",                  carfax:null },
  { vin:"5XXGM4A74DG145701", year:2013, make:"KIA",      model:"OPTIMA",               type:"sedan", price:5995,  sale:null,  miles:125490, drive:"FWD", fuel:"Gasoline", img:"202604-b67a2027fd0541a2b950f2e5e20d9b72", imgUrl:"https://imagescf.dealercenter.net/640/480/202604-b67a2027fd0541a2b950f2e5e20d9b72.jpg", url:"https://www.nashmimotors.com/inventory/kia/optima/a1034/",    carfax:"https://www.carfax.com/vehiclehistory/ar20/-DJDP7tczx8kUU3gT_oUKKEngYGUxgOYZWghT", carfaxBadge:"Good Value" },
  { vin:"3FADP4BJ2KM108166", year:2019, make:"FORD",     model:"FIESTA",               type:"sedan", price:6995,  sale:null,  miles:90319,  drive:"FWD", fuel:"Gasoline", img:"202604-039a484af9f5493d9a9d5c051585aa6f", imgUrl:"https://imagescf.dealercenter.net/640/480/202604-039a484af9f5493d9a9d5c051585aa6f.jpg", url:"https://www.nashmimotors.com/inventory/ford/fiesta/r1002/",   carfax:null },
  { vin:"1FMCU0GD6HUB33923", year:2017, make:"FORD",     model:"ESCAPE",               type:"suv",   price:8995,  sale:7995,  miles:123212, drive:"FWD", fuel:"Gasoline", img:"202603-de7f64126bdd4473984fc245269cbf86", imgUrl:"https://imagescf.dealercenter.net/640/480/202603-de7f64126bdd4473984fc245269cbf86.jpg", url:"https://www.nashmimotors.com/inventory/ford/escape/a1024/",   carfax:"https://www.carfax.com/vehiclehistory/ar20/nOrh0vlCkocW9BPQ6qfX6w2n8uU1GkQBIH3e9" },
  { vin:"5N1AT2MV1FC890556", year:2015, make:"NISSAN",   model:"ROGUE",                type:"suv",   price:8995,  sale:null,  miles:139501, drive:"AWD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/nissan/rogue/a1040/",                  carfax:null },
  { vin:"1C4RJFCG1EC247856", year:2014, make:"JEEP",     model:"GRAND CHEROKEE",       type:"suv",   price:8995,  sale:null,  miles:173710, drive:"4WD", fuel:"Flex",     img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/jeep/grand-cherokee/a1039/",           carfax:null },
  { vin:"1FMCU9HD0JUB66196", year:2018, make:"FORD",     model:"ESCAPE",               type:"suv",   price:10995, sale:9995,  miles:99203,  drive:"4WD", fuel:"Gasoline", img:"202603-a20d08755c204b30905a7dbb89efa304", imgUrl:"https://imagescf.dealercenter.net/640/480/202603-a20d08755c204b30905a7dbb89efa304.jpg", url:"https://www.nashmimotors.com/inventory/ford/escape/a1025/",   carfax:"https://www.carfax.com/vehiclehistory/ar20/SEDj8Ek0DyZN1rgYCKGlBtv3lJpIqiU75kjVU", carfaxBadge:"Great Value" },
  { vin:"2C4RC1BG0HR503978", year:2017, make:"CHRYSLER", model:"PACIFICA",             type:"van",   price:9995,  sale:null,  miles:131087, drive:"FWD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/chrysler/pacifica/a1032/",             carfax:null },
  { vin:"2T1BURHE1GC506793", year:2016, make:"TOYOTA",   model:"COROLLA",              type:"sedan", price:10995, sale:null,  miles:93004,  drive:"FWD", fuel:"Gasoline", img:"202604-31b69fca67994ce3ae2fef2e1efd93df", imgUrl:"https://imagescf.dealercenter.net/640/480/202604-31b69fca67994ce3ae2fef2e1efd93df.jpg", url:"https://www.nashmimotors.com/inventory/toyota/corolla/r1011/", carfax:"https://www.carfax.com/vehiclehistory/ar20/rlYJaSN70TsYHgheHYnbnicogGzGuNiswfjcv" },
  { vin:"1FTFW1ET7BFC33259", year:2011, make:"FORD",     model:"F150 SUPERCREW CAB",   type:"truck", price:10995, sale:null,  miles:166862, drive:"4WD", fuel:"Gasoline", img:"202604-98d761fdfd6343498219fde07c02beb0", imgUrl:"https://imagescf.dealercenter.net/640/480/202604-98d761fdfd6343498219fde07c02beb0.jpg", url:"https://www.nashmimotors.com/inventory/ford/f150-supercrew-cab/a1035/", carfax:"https://www.carfax.com/vehiclehistory/ar20/lrJeOmF1ZJWBCTMbn99IAhnOdIMqOHUbxfhcC" },
  { vin:"5N1DL0MM3KC505596", year:2019, make:"INFINITI", model:"QX60",                 type:"suv",   price:11995, sale:null,  miles:137835, drive:"AWD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/infiniti/qx60/a1042/",                carfax:"https://www.carfax.com/vehiclehistory/ar20/TRZr7scIRL8HJoXSngEQL418KSEFqiRw-lJ0W" },
  { vin:"1C4RJFBG3EC471289", year:2014, make:"JEEP",     model:"GRAND CHEROKEE",       type:"suv",   price:11995, sale:null,  miles:90100,  drive:"4WD", fuel:"Flex",     img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/jeep/grand-cherokee/a1043/",           carfax:"https://www.carfax.com/vehiclehistory/ar20/it0aN2TY534kzY7udLVZ6zVIKnaCVAEiFhqjy" },
  { vin:"WA1ANAFY6J2019757", year:2018, make:"AUDI",     model:"Q5",                   type:"suv",   price:11995, sale:null,  miles:131931, drive:"AWD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/audi/q5/a1041/",                      carfax:"https://www.carfax.com/vehiclehistory/ar20/pLUvCtAn0QsUjU16SNikq7QGDwxhRXFskntD8" },
  { vin:"KNDJ23AU3P7884308", year:2023, make:"KIA",      model:"SOUL",                 type:"suv",   price:13995, sale:null,  miles:42418,  drive:"FWD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/kia/soul/r1001/",                      carfax:"https://www.carfax.com/vehiclehistory/ar20/1h-7maQmXn6QVElPezj9A70WSQXoKjQiyZcHD" },
  { vin:"5XXGT4L33LG422253", year:2020, make:"KIA",      model:"OPTIMA",               type:"sedan", price:15995, sale:14995, miles:52350,  drive:"FWD", fuel:"Gasoline", img:"202604-4b79213e173641bcb114456c4c6ea9f9", imgUrl:"https://imagescf.dealercenter.net/640/480/202604-4b79213e173641bcb114456c4c6ea9f9.jpg", url:"https://www.nashmimotors.com/inventory/kia/optima/a1014/", carfax:"https://www.carfax.com/vehiclehistory/ar20/NQ8F464oaGruFzc_CsMJ7wydQC85bu9OrJsSp", carfaxBadge:"Great Value" },
  { vin:"1GTV2MEC9GZ177324", year:2016, make:"GMC",      model:"SIERRA 1500 DOUBLE CAB", type:"truck", price:15995, sale:null, miles:169485, drive:"4WD", fuel:"Gasoline", img:null, imgUrl:null, url:"https://www.nashmimotors.com/inventory/gmc/sierra-1500-double-cab/a1036/",  carfax:"https://www.carfax.com/vehiclehistory/ar20/GcaICloidDStF_Cno2nqOU8nmuyDE5ZI-2ilR" },
];
