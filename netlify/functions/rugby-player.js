// netlify/functions/rugby-player.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // CORS preflight
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

  // required: player id
  const params = event.queryStringParameters || {};
  const id   = params.id;
  const comp = params.comp || '241';      // ← comp=241 (TOP14) or comp=292 (EPCR)

  if (!id) {
    return { statusCode: 400, body: "Missing ?id parameter" };
  }

  // build the API URL dynamically
  const API_URL = `http://rugbyunion-api.stats.com/api/RU/playerStats/${comp}/2026/${id}`;
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
      'Content-Type':                 'application/xml',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Cache-Control':                'public, max-age=86400'
    },
    body: xml
  };
};