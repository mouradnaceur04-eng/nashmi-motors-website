# Nashmi Motors Website — Session Summary
*Transfer this to a new chat for full context*

---

## Project Overview

Custom dealership website built for **Nashmi Motors** (Harrisburg, PA) by **VoxDigital** (Mourad's agency).

- **Live URL:** nashmi-motors-website.vercel.app (DNS not yet pointed — still on DealerCenter)
- **Repo:** github.com/mouradnaceur04-eng/nashmi-motors-website
- **Stack:** Plain HTML/CSS/JS + Vercel serverless functions
- **Deployment:** Vercel (auto-deploys on git push to master)
- **DealerCenter dealer ID:** 29008363

---

## File Structure

```
nashmi-website/
├── index.html          — Homepage
├── inventory.html      — Inventory grid + filters
├── vehicle.html        — Vehicle detail page
├── apply.html          — Finance application form
├── sell.html           — We Buy Cars form
├── contact.html        — Contact form
├── about.html          — About page
├── car-finder.html     — Car finder quiz
├── privacy-policy.html
├── 404.html            — Custom branded 404 page
├── app.js              — Shared JS (inventory, carCard, submitLead, lang switcher)
├── style.css           — All styles (67KB)
├── logo.png            — Self-hosted logo (was on DealerCenter CDN)
├── favicon.svg / .png
├── sitemap.xml         — Clean URLs, no .html
├── robots.txt
├── google177b597a741278f6.html  — Google Search Console verification
├── vercel.json         — Vercel config
├── api/
│   ├── inventory.js    — Fetches DealerCenter XML feed, returns JSON
│   ├── reviews.js      — Fetches Google Places reviews
│   └── lead.js         — Receives form POSTs, sends via Resend
├── public/
│   └── inventory.json  — Static fallback inventory
└── scraper/
    ├── scrape.py       — Python inventory scraper
    └── check-feed.js   — Feed diagnostic script
```

---

## Lead Flow (Forms → DealerCenter CRM)

```
Form submit → fetch('/api/lead') → Vercel → Resend → Gmail (mouradnaceur04@gmail.com)
→ Gmail auto-forward → 29008363@leadsprod.dealercenter.net → DealerCenter CRM
```

**Temporary setup:** Resend free plan can only send to verified email (Gmail). Gmail auto-forward set up to route to DealerCenter.

**Permanent fix (when ready):** Verify `nashmimotors.com` in Resend → set `RESEND_FROM_DOMAIN=leads@nashmimotors.com` in Vercel → leads go directly to DealerCenter, bypassing Gmail.

### Vercel Environment Variables Required
| Key | Value |
|---|---|
| `RESEND_API_KEY` | From resend.com |
| `RESEND_FALLBACK_EMAIL` | mouradnaceur04@gmail.com |
| `RESEND_FROM_DOMAIN` | (leave blank until nashmimotors.com verified in Resend) |
| `GOOGLE_PLACES_API_KEY` | For live Google Reviews |

### Lead Email Format
Subject: `[Finance Application] John Smith — 2022 Toyota Camry — Nashmi Motors`
Subject: `[Test Drive Request] Jane Doe — Nashmi Motors`
Subject: `[Contact Inquiry] Mike Davis — Nashmi Motors`

---

## Forms & Submission

All forms use `submitLead()` in `app.js` — silent background POST, no email app opens.

| Page | Form | Type string |
|---|---|---|
| index.html | Test Drive | `'Test Drive Request'` |
| vehicle.html | Test Drive | `'Test Drive Request'` |
| vehicle.html | Reserve | `'Reserve Vehicle'` |
| apply.html | Finance | `'Finance Application'` |
| sell.html | Sell My Car | `'Sell My Car'` |
| contact.html | Contact | `'Contact Inquiry'` |

All forms have a **honeypot field** `<input name="_hp">` — if filled, server silently discards (bots get `200 ok` but nothing is sent).

Server-side: **rate limiting** 5 submissions/IP/hour in `api/lead.js`.

---

## Inventory API (`api/inventory.js`)

- Fetches: `https://feeds.dealercenter.net/inventory/29008363/feed.xml`
- Falls back to: `public/inventory.json`
- **Note:** Feed URL is blocked from residential IPs — only works server-to-server (Vercel functions)
- Cache: `public, max-age=30, stale-while-revalidate=30`
- CarFax badges parsed from 10+ possible XML field names
- VIN fallback CarFax URL: `https://www.carfax.com/showmethefax/${vin}` (shows on ALL vehicles)

### CarFax Badge Values
`'1own'` | `'1own_great'` | `'1own_good'` | `'1own_fair'` | `'Great Value'` | `'Good Value'` | `'Fair Value'`

---

## Clean URLs

`vercel.json` has `"cleanUrls": true` and `"trailingSlash": false`.

| Old | New |
|---|---|
| `/inventory.html` | `/inventory` |
| `/apply.html` | `/apply` |
| `/vehicle.html?vin=XXX` | `/vehicle?vin=XXX` |
| `/sell.html` | `/sell` |
| `/contact.html` | `/contact` |
| `/about.html` | `/about` |
| `/car-finder.html` | `/car-finder` |
| `/privacy-policy.html` | `/privacy-policy` |

Old `.html` URLs auto-308 redirect to clean versions (Vercel handles this automatically).

---

## Security & Performance (All Done)

### vercel.json Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### api/lead.js
- IP-based rate limiting (5/hr)
- HTML escaping on all form values (`esc()` function)
- Honeypot check (`_hp` field)

### All HTML Pages
- `fonts.gstatic.com` preconnect added
- `logo.png` self-hosted (was on DealerCenter CDN — would break when subscription cancelled)
- All canonical/OG URLs use clean paths
- Google Search Console verification file added

---

## CarFax Badges (Inventory Cards)

- **CarFax overlay badge:** top-left of image (`top: 10px, left: 10px`), 54px height desktop / 44px mobile
- **SALE badge:** bottom-right of image (`bottom: 12px, right: 12px`), red, rotated -2deg, pulsing glow animation (`badge-pop` keyframe, 1.8s infinite)
- **"Show Me The CARFAX" button:** in car actions row below image

---

## Mobile Fixes (vehicle.html)

- `viewport-fit=cover` on meta viewport
- `100dvh` on hero sections (prevents iOS browser bar jump)
- `env(safe-area-inset-bottom)` on footer
- Animation override on mobile: `#td-form-section .animate-on-scroll` forced visible (IntersectionObserver fails when element starts off-screen)
- Gallery breakout uses `calc(100% + 30px)` not `calc(100vw)` (avoids scrollbar overflow)

---

## Language Switcher

- Custom floating button (not Google Translate bar)
- 15 languages: EN, 中文, हिन्दी, ES, FR, AR, BN, PT, RU, UR, ID, DE, JA, PCM, MR
- Persists across pages via `googtrans` cookie + `localStorage('nashmi_lang')`
- Google Translate widget hidden off-screen, powers translation

---

## apply.html — Finance Form

- Phone fields: auto-format to `(717) 743-5175` as user types
- SSN field: auto-format to `123-45-6789` as user types
- Both strip non-numeric characters on input

---

## VoxDigital Branding

Every page has:
1. HTML comment line 2: `<!-- Built by VoxDigital · voxdigital.agency -->`
2. Footer: low-opacity "Site by VoxDigital" link → `https://voxdigit.mouradnaceur04.workers.dev`

---

## DealerCenter Subscription Context

**Keep:** DealerCenter DMS (inventory feed, CRM, lead email)
**Cancel:** DealerCenter Website hosting

- Inventory XML feed (`feeds.dealercenter.net`) → tied to DMS, survives cancellation ✅
- Lead email (`29008363@leadsprod.dealercenter.net`) → tied to DMS, survives cancellation ✅
- Logo/images on `dcdws.blob.core.windows.net` → tied to website, would die ✅ (already moved to `logo.png`)

---

## Pending / Next Steps

- [ ] Point `nashmimotors.com` DNS to Vercel (after cancelling DealerCenter website)
- [ ] Verify `nashmimotors.com` in Resend → set `RESEND_FROM_DOMAIN` in Vercel → leads go direct to DealerCenter (no Gmail middleman)
- [ ] Complete Google Business Profile at google.com/business
- [ ] Submit sitemap in Google Search Console: `nashmimotors.com/sitemap.xml`
- [ ] Get reviews — send customers direct Google review link
- [ ] List on Cars.com, CarGurus, Yelp, Facebook Marketplace (backlinks)
- [ ] Netlify functions (`netlify/functions/`) out of sync — no `lead.js` there. Either add one or fully commit to Vercel only.

---

## Browser Console Health Check Script

Paste in Chrome DevTools on any page:

```javascript
console.group('🔍 Nashmi Motors Health Check');
const htmlLinks = [...document.querySelectorAll('a[href]')]
  .filter(a => a.href.includes('.html') && !a.href.includes('//'))
  .map(a => a.getAttribute('href'));
htmlLinks.length ? console.warn('⚠️ .html links:', htmlLinks) : console.log('✅ No .html links');
const noAlt = [...document.querySelectorAll('img')].filter(img => !img.getAttribute('alt')?.trim());
noAlt.length ? console.warn('⚠️ Missing alt:', noAlt.map(i => i.src)) : console.log('✅ All images have alt');
console.groupEnd();
```
