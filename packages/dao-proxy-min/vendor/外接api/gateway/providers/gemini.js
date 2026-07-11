'use strict';
/**
 * gemini.js · Google Gemini 驱动
 * ─────────────────────────────────
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:{generateContent|streamGenerateContent}?key=KEY
 */

const { request } = require('./http');

async function callGemini({ provider, body, model, stream, signal }) {
  const base = provider.baseUrl.replace(/\/+$/, '');
  const op = stream ? 'streamGenerateContent' : 'generateContent';
  // Gemini 流式用 alt=sse
  const alt = stream ? '&alt=sse' : '';
  const url = `${base}/models/${encodeURIComponent(model)}:${op}?key=${encodeURIComponent(provider.apiKey)}${alt}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': stream ? 'text/event-stream' : 'application/json',
  };
  const payload = JSON.stringify(body);
  return request({ url, method: 'POST', headers, body: payload, signal, timeout: 600000 });
}

async function listModels({ provider, signal }) {
  const base = provider.baseUrl.replace(/\/+$/, '');
  const url = `${base}/models?key=${encodeURIComponent(provider.apiKey)}`;
  try {
    const resp = await request({ url, method: 'GET', headers: { 'Accept': 'application/json' }, signal, timeout: 15000 });
    if (resp.status >= 400) return [];
    const data = await resp.json();
    return (data.models || []).map(m => (m.name || '').replace(/^models\//, '')).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { callGemini, listModels };
