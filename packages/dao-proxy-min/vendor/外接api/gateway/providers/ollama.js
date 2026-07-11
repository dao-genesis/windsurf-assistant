'use strict';
/**
 * ollama.js · Ollama /api/chat 驱动
 * ─────────────────────────────────
 * 本地模型 · 零 API Key · 零网络依赖
 */

const { request } = require('./http');

async function callOllama({ provider, body, stream, signal }) {
  const base = provider.baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/chat`;
  const headers = { 'Content-Type': 'application/json' };
  const payload = JSON.stringify(body);
  return request({ url, method: 'POST', headers, body: payload, signal, timeout: 600000 });
}

async function listModels({ provider, signal }) {
  const base = provider.baseUrl.replace(/\/+$/, '');
  try {
    const resp = await request({ url: base + '/api/tags', method: 'GET', headers: {}, signal, timeout: 10000 });
    if (resp.status >= 400) return [];
    const data = await resp.json();
    return (data.models || []).map(m => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { callOllama, listModels };
