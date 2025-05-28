// netlify/functions/rugby-player.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // 1) read player ID from ?id=xxxx
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, body: "Missing ?id parameter" };
  }

  // 2) build Opta URL
  const API_URL = `http://rugbyunion-api.stats.com/api/RU/playerStats/241/2025/${id}`;
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
  return {
    statusCode: 200,
    headers: {
      'Content-Type':                'application/xml',
      'Access-Control-Allow-Origin': '*',
      // cache this response for 24h at the CDN edge and in browsers:
      'Cache-Control':               'public, max-age=86400'
    },
    body: xml
  };
};