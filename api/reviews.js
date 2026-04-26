/**
 * Nashmi Motors — Google Reviews API (Vercel)
 *
 * Fetches Place Details from Google Places API, returns clean JSON.
 * Requires env var: GOOGLE_PLACES_API_KEY
 *
 * Cache: 12 hours (reviews don't change often; saves API quota)
 */

const PLACE_ID  = 'ChIJExTu9hy_yIkRgITEvi-g1R8';
const FIELDS    = 'reviews,rating,user_ratings_total,name';
const PLACES_URL = `https://maps.googleapis.com/maps/api/place/details/json`;

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 3600)   return 'Just now';
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// Deterministic avatar colour from name (cycles through 6 brand-safe colours)
const AVATAR_COLOURS = ['#4a7c59','#2563eb','#7c3aed','#b45309','#0891b2','#be185d'];
function avatarColour(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLOURS[Math.abs(h) % AVATAR_COLOURS.length];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Cache 12 hours in browser/CDN; stale-while-revalidate means never a blank flash
  res.setHeader('Cache-Control', 'public, max-age=43200, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    // No key configured — return empty so frontend falls back to hardcoded reviews
    return res.status(200).json({ configured: false, reviews: [] });
  }

  try {
    const url = `${PLACES_URL}?place_id=${PLACE_ID}&fields=${FIELDS}&key=${apiKey}`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Google API HTTP ${r.status}`);

    const data   = await r.json();
    const result = data.result || {};

    // Filter to 5-star only, then fall back to all if fewer than 3 survive
    let reviews = (result.reviews || []);
    const fiveStars = reviews.filter(rv => rv.rating === 5);
    if (fiveStars.length >= 3) reviews = fiveStars;

    // Sort newest first (Google returns by relevance)
    reviews.sort((a, b) => (b.time || 0) - (a.time || 0));

    const clean = reviews.map(rv => ({
      name:        rv.author_name  || 'Google Reviewer',
      initials:    initials(rv.author_name),
      avatarColor: avatarColour(rv.author_name),
      rating:      rv.rating       || 5,
      text:        rv.text         || '',
      time:        relativeTime(rv.time),
      profileUrl:  rv.author_url   || null,
      photoUrl:    rv.profile_photo_url || null,
    }));

    res.status(200).json({
      configured:        true,
      businessName:      result.name            || 'Nashmi Motors',
      rating:            result.rating           || null,
      totalRatings:      result.user_ratings_total || null,
      reviews:           clean,
      updatedAt:         new Date().toISOString(),
    });

  } catch (err) {
    console.error('Reviews API error:', err.message);
    res.status(200).json({ configured: true, error: err.message, reviews: [] });
  }
};
