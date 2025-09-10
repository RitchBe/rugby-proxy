// netlify/functions/rugby-player.js
const fetch = require('node-fetch');

const YEAR = '2026';

exports.handler = async (event) => {
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

  const params = event.queryStringParameters || {};
  const id   = params.id;
  const comp = params.comp || '241'; // 241 (TOP14) or 292 (EPCR)

  if (!id) {
    return { statusCode: 400, body: "Missing ?id parameter" };
  }

  const API_URL = `http://rugbyunion-api.stats.com/api/RU/playerStats/${comp}/${YEAR}/${id}`;
  const USER    = process.env.STATS_USER;
  const PASS    = process.env.STATS_PASS;

  let res;
  try {
    res = await fetch(API_URL, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
        'Accept':        'application/xml'
      }
    });
  } catch (err) {
    return { statusCode: 502, body: `Upstream fetch error: ${err.message}` };
  }

  if (!res.ok) {
    return { statusCode: res.status, body: `Upstream error: ${res.statusText}` };
  }

  const xml = await res.text();

  // --- Strict season guardrails ---
  // 1) Ensure the payload references 2026 in the playerSeasonStats tag (common attributes: season, seasonID, seasonYear).
  const hasSeason2026 =
    /<playerSeasonStats\b[^>]*\b(?:season|seasonID|seasonYear)\s*=\s*["']?2026["']?/i.test(xml);

  // 2) Try to detect zero/absent appearances (common attribute: appearances)
  //    If appearances is explicitly "0" or missing entirely, consider it non-usable.
  const appearancesMatch = xml.match(/<playerSeasonStats\b[^>]*\bappearances\s*=\s*["']?(\d+)["']?/i);
  const appearances = appearancesMatch ? parseInt(appearancesMatch[1], 10) : 0;

  if (!hasSeason2026 || appearances === 0) {
    // No valid 2026 data for this player — treat as not found
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control':                'public, max-age=300'
      },
      body: `No ${YEAR} data for player ${id} (comp ${comp}).`
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type':                 'application/xml',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Cache-Control':                'public, max-age=86400'
    },
    body: xml
  };
};