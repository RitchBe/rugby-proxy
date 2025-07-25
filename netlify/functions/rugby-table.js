// netlify/functions/rugby-table.js
const fetch = require('node-fetch');

exports.handler = async () => {
  const API_URL = 'http://rugbyunion-api.stats.com/api/RU/OptaFeeds/RU31/241/ru31_tables.203.2026.xml';
  const USER    = process.env.STATS_USER;
  const PASS    = process.env.STATS_PASS;

  let res;
  try {
    res = await fetch(API_URL, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
        'Accept': 'application/xml'
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
      'Content-Type':               'application/xml',
      'Access-Control-Allow-Origin':'*',
      'Cache-Control':              'public, max-age=3600'  // ← cache for 1 h
    },
    body: xml
  };
};