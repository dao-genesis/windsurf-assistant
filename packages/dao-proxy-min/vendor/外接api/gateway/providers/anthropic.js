'use strict';
/**
 * anthropic.js · Anthropic /v1/messages 驱动
 * ─────────────────────────────────────────────
 * 透传入口 · 上游即 Anthropic 或兼容端点 (rsxermu666, OneAPI, NewAPI, 自建中转)
 */

const { request } = require('./http');

async function callAnthropic({ provider, body, stream, signal }) {
  const url = `${provider.baseUrl}/v1/messages`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': stream ? 'text/event-stream' : 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (provider.apiKey) {
    headers['x-api-key'] = provider.apiKey;
    // 许多兼容端点也接受 Bearer
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }
  // Anthropic beta features
  if (provider.extra?.anthropicBeta) headers['anthropic-beta'] = provider.extra.anthropicBeta;

  const payload = JSON.stringify(body);
  return request({ url, method: 'POST', headers, body: payload, signal, timeout: 600000 });
}

module.exports = { callAnthropic };
