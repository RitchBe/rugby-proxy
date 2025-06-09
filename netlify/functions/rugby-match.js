// netlify/functions/rugby-match.js
const fetch = require('node-fetch');

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

  // 3) Fetch from StatsPerform
  const API_URL = `http://rugbyunion-api.stats.com/api/RU/matchStats/${matchId}`;
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

  // 4) Return with CORS + 24 h cache
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