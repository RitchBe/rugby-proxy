// netlify/functions/rugby-match.js
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
  // 1) CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  // 2) Read matchId from ?id=
  const params  = event.queryStringParameters || {};
  const matchId = params.id;
  if (!matchId) {
    return { statusCode: 400, body: "Missing ?id parameter" };
  }

  // 3) Fetch from StatsPerform (force revalidation upstream)
  const API_URL = `http://rugbyunion-api.stats.com/api/RU/matchStats/${matchId}`;
  const USER    = process.env.STATS_USER;
  const PASS    = process.env.STATS_PASS;

  let res;
  try {
    res = await fetch(API_URL, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
        'Accept':        'application/xml',
        // ask any intermediaries to revalidate instead of serving their stale cache
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return { statusCode: 502, body: `Upstream fetch error: ${err.message}` };
  }
  if (!res.ok) {
    return { statusCode: res.status, body: `Upstream error: ${res.statusText}` };
  }

  const xml = await res.text();

  // 4) Decide cache policy
  // Very light heuristic: if XML indicates "Final"/"Full Time", treat as final
  const lower = xml.toLowerCase();
  const isFinal =
    lower.includes('final') ||
    lower.includes('full time') ||
    lower.includes('status="finished"') ||
    lower.includes('<status>finished</status>');

  // while live or not-final: short ttl + stale-while-revalidate
  // after final: longer ttl (but still not 24h if provider lags)
  const ttlBrowser = isFinal ? 6 * 60 * 60   : 60;        // max-age: 6h final, 60s live
  const ttlCDN     = isFinal ? 12 * 60 * 60  : 5 * 60;    // s-maxage: 12h final, 5m live
  const swr        = isFinal ? 24 * 60 * 60  : 60 * 60;    // stale-while-revalidate: 24h vs 1h

  // 5) ETag support for cheap revalidation
  const etag = `"${crypto.createHash('sha1').update(xml).digest('base64')}"`;
  const reqETag = event.headers && (event.headers['if-none-match'] || event.headers['If-None-Match']);

  if (reqETag && reqETag === etag) {
    return {
      statusCode: 304,
      headers: {
        'ETag': etag,
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        // Make sure caches keep following our policy on 304s too
        'Cache-Control': `public, max-age=${ttlBrowser}, s-maxage=${ttlCDN}, stale-while-revalidate=${swr}`
      },
      body: '' // no body for 304
    };
  }

  // 6) Return with CORS + smarter cache
  return {
    statusCode: 200,
    headers: {
      'Content-Type':                 'application/xml',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      // Browsers & CDN caching with revalidation window
      'Cache-Control':                `public, max-age=${ttlBrowser}, s-maxage=${ttlCDN}, stale-while-revalidate=${swr}`,
      'ETag':                         etag
    },
    body: xml
  };
};