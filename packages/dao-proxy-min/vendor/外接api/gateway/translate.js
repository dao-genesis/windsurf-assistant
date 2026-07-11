'use strict';
/**
 * translate.js · 协议翻译器
 * ─────────────────────────────────────────
 * 道生一 · 万法同源, 名异实一
 *
 * 支持三向翻译:
 *   Anthropic /v1/messages   ↔   OpenAI /v1/chat/completions
 *   OpenAI /v1/chat/completions ↔ Gemini generateContent
 *   任意格式 ↔ Ollama /api/chat
 *
 * SSE 流式事件同样双向支持。
 *
 * 核心三形:
 *   (1) Anthropic: { system, messages:[{role, content:[{type,text|image,tool_use...}]}], tools, max_tokens }
 *   (2) OpenAI:    { messages:[{role,content|tool_calls}], tools, max_tokens, stream }
 *   (3) Gemini:    { contents:[{role,parts:[{text|functionCall|functionResponse}]}], systemInstruction, tools }
 */

const crypto = require('crypto');

const randId = (prefix = 'msg') => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

// ══════════════════════════════════════════════════════════
// Anthropic → OpenAI (请求体)
// ══════════════════════════════════════════════════════════
function anthropicReqToOpenAI(body) {
  const messages = [];
  if (body.system) {
    const sys = typeof body.system === 'string'
      ? body.system
      : (Array.isArray(body.system) ? body.system.map(b => b.text || '').join('\n') : '');
    if (sys) messages.push({ role: 'system', content: sys });
  }

  for (const m of (body.messages || [])) {
    const role = m.role;
    if (typeof m.content === 'string') {
      messages.push({ role, content: m.content });
      continue;
    }
    // content 是数组 · 分类为文本 / 图像 / 工具
    const textParts = [];
    const toolCalls = [];
    const toolResults = [];
    const imageParts = [];
    for (const block of (m.content || [])) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text') textParts.push(block.text || '');
      else if (block.type === 'image') {
        const src = block.source || {};
        if (src.type === 'base64') {
          imageParts.push({
            type: 'image_url',
            image_url: { url: `data:${src.media_type || 'image/png'};base64,${src.data}` },
          });
        } else if (src.type === 'url') {
          imageParts.push({ type: 'image_url', image_url: { url: src.url } });
        }
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
        });
      } else if (block.type === 'tool_result') {
        const content = Array.isArray(block.content)
          ? block.content.map(b => b.text || '').join('')
          : (typeof block.content === 'string' ? block.content : JSON.stringify(block.content || ''));
        toolResults.push({
          role: 'tool',
          tool_call_id: block.tool_use_id,
          content,
        });
      }
    }

    // 构造 assistant/user 消息
    if (role === 'assistant') {
      const msg = { role: 'assistant' };
      const txt = textParts.join('');
      if (txt) msg.content = txt;
      if (toolCalls.length) msg.tool_calls = toolCalls;
      if (!msg.content && !msg.tool_calls) msg.content = '';
      messages.push(msg);
    } else {
      // user 先放 tool_results (multi-message), 再放 user text/images
      for (const tr of toolResults) messages.push(tr);
      const parts = [];
      const t = textParts.join('');
      if (t) parts.push({ type: 'text', text: t });
      for (const img of imageParts) parts.push(img);
      if (parts.length === 1 && parts[0].type === 'text') {
        messages.push({ role: 'user', content: parts[0].text });
      } else if (parts.length > 0) {
        messages.push({ role: 'user', content: parts });
      }
    }
  }

  const out = {
    model: body.model,
    messages,
    max_tokens: body.max_tokens,
    stream: body.stream || false,
  };
  if (body.temperature !== undefined) out.temperature = body.temperature;
  if (body.top_p !== undefined) out.top_p = body.top_p;
  if (body.stop_sequences) out.stop = body.stop_sequences;
  if (body.tools && body.tools.length) {
    out.tools = body.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema || { type: 'object', properties: {} },
      },
    }));
    if (body.tool_choice) {
      if (body.tool_choice.type === 'any') out.tool_choice = 'required';
      else if (body.tool_choice.type === 'auto') out.tool_choice = 'auto';
      else if (body.tool_choice.type === 'tool') out.tool_choice = { type: 'function', function: { name: body.tool_choice.name } };
    }
  }
  return out;
}

// ══════════════════════════════════════════════════════════
// OpenAI → Anthropic (非流式响应)
// ══════════════════════════════════════════════════════════
function openAIRespToAnthropic(resp, model) {
  const choice = (resp.choices || [])[0] || {};
  const msg = choice.message || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      let input = {};
      try { input = JSON.parse(tc.function?.arguments || '{}'); } catch {}
      content.push({
        type: 'tool_use',
        id: tc.id || randId('toolu'),
        name: tc.function?.name,
        input,
      });
    }
  }
  if (!content.length) content.push({ type: 'text', text: '' });

  const stopReason = mapFinishReasonOA(choice.finish_reason);

  return {
    id: resp.id || randId('msg'),
    type: 'message',
    role: 'assistant',
    model: model || resp.model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: resp.usage?.prompt_tokens || 0,
      output_tokens: resp.usage?.completion_tokens || 0,
    },
  };
}

function mapFinishReasonOA(r) {
  if (r === 'stop') return 'end_turn';
  if (r === 'length') return 'max_tokens';
  if (r === 'tool_calls' || r === 'function_call') return 'tool_use';
  if (r === 'content_filter') return 'stop_sequence';
  return r || 'end_turn';
}

// ══════════════════════════════════════════════════════════
// OpenAI SSE → Anthropic SSE (状态机)
// ══════════════════════════════════════════════════════════
class OpenAIToAnthropicStream {
  constructor(model) {
    this.model = model;
    this.msgId = randId('msg');
    this.started = false;
    this.textOpen = false;
    this.blockIndex = 0;
    this.toolBlocks = new Map();  // tool_call_index → { blockIdx, id, name }
    this.usage = { input: 0, output: 0 };
    this.stopReason = 'end_turn';
  }

  * handleOA(chunk) {
    // 首次: message_start
    if (!this.started) {
      this.started = true;
      yield sseEvent('message_start', {
        type: 'message_start',
        message: {
          id: this.msgId, type: 'message', role: 'assistant',
          model: this.model, content: [], stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });
      yield sseEvent('ping', { type: 'ping' });
    }

    const choice = chunk.choices?.[0];
    if (!choice) {
      if (chunk.usage) {
        this.usage.input = chunk.usage.prompt_tokens || this.usage.input;
        this.usage.output = chunk.usage.completion_tokens || this.usage.output;
      }
      return;
    }

    const delta = choice.delta || {};

    // 文本增量
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      if (!this.textOpen) {
        this.textOpen = true;
        this.textBlockIndex = this.blockIndex++;
        yield sseEvent('content_block_start', {
          type: 'content_block_start',
          index: this.textBlockIndex,
          content_block: { type: 'text', text: '' },
        });
      }
      yield sseEvent('content_block_delta', {
        type: 'content_block_delta',
        index: this.textBlockIndex,
        delta: { type: 'text_delta', text: delta.content },
      });
    }

    // 工具调用增量 (OpenAI 累进式)
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const key = tc.index ?? tc.id ?? 0;
        let rec = this.toolBlocks.get(key);
        if (!rec) {
          // 关掉 text block (若开)
          if (this.textOpen) {
            this.textOpen = false;
            yield sseEvent('content_block_stop', { type: 'content_block_stop', index: this.textBlockIndex });
          }
          const blockIdx = this.blockIndex++;
          rec = {
            blockIdx,
            id: tc.id || randId('toolu'),
            name: tc.function?.name || '',
            argsBuf: '',
            started: false,
          };
          this.toolBlocks.set(key, rec);
        }
        if (tc.function?.name && !rec.name) rec.name = tc.function.name;
        if (tc.id && rec.id !== tc.id) rec.id = tc.id;

        if (!rec.started && rec.name) {
          rec.started = true;
          yield sseEvent('content_block_start', {
            type: 'content_block_start',
            index: rec.blockIdx,
            content_block: { type: 'tool_use', id: rec.id, name: rec.name, input: {} },
          });
        }
        if (rec.started && typeof tc.function?.arguments === 'string' && tc.function.arguments.length > 0) {
          rec.argsBuf += tc.function.arguments;
          yield sseEvent('content_block_delta', {
            type: 'content_block_delta',
            index: rec.blockIdx,
            delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
          });
        }
      }
    }

    // finish_reason → 结束
    if (choice.finish_reason) {
      this.stopReason = mapFinishReasonOA(choice.finish_reason);
    }
  }

  * finalize() {
    // 关所有 open block
    if (this.textOpen) {
      this.textOpen = false;
      yield sseEvent('content_block_stop', { type: 'content_block_stop', index: this.textBlockIndex });
    }
    for (const rec of this.toolBlocks.values()) {
      if (rec.started) {
        yield sseEvent('content_block_stop', { type: 'content_block_stop', index: rec.blockIdx });
      }
    }
    yield sseEvent('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: this.stopReason, stop_sequence: null },
      usage: { output_tokens: this.usage.output },
    });
    yield sseEvent('message_stop', { type: 'message_stop' });
  }
}

// ══════════════════════════════════════════════════════════
// Anthropic → Anthropic (透传 · 仅模型名重写)
// ══════════════════════════════════════════════════════════
function anthropicPassthrough(body, targetModel) {
  if (!targetModel) return body;
  return { ...body, model: targetModel };
}

// ══════════════════════════════════════════════════════════
// Anthropic → Gemini (请求体)
// ══════════════════════════════════════════════════════════
function anthropicReqToGemini(body) {
  const contents = [];
  for (const m of (body.messages || [])) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const parts = [];
    if (typeof m.content === 'string') {
      if (m.content) parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type === 'text') parts.push({ text: block.text || '' });
        else if (block.type === 'image') {
          const src = block.source || {};
          if (src.type === 'base64') {
            parts.push({ inline_data: { mime_type: src.media_type || 'image/png', data: src.data } });
          }
        } else if (block.type === 'tool_use') {
          parts.push({ functionCall: { name: block.name, args: block.input || {} } });
        } else if (block.type === 'tool_result') {
          const txt = Array.isArray(block.content)
            ? block.content.map(b => b.text || '').join('')
            : (typeof block.content === 'string' ? block.content : JSON.stringify(block.content));
          let response;
          try { response = JSON.parse(txt); } catch { response = { result: txt }; }
          parts.push({ functionResponse: { name: block.tool_use_id, response } });
        }
      }
    }
    if (parts.length) contents.push({ role, parts });
  }

  const out = {
    contents,
    generationConfig: {
      maxOutputTokens: body.max_tokens,
      temperature: body.temperature,
      topP: body.top_p,
      stopSequences: body.stop_sequences,
    },
  };

  if (body.system) {
    const sys = typeof body.system === 'string'
      ? body.system
      : (Array.isArray(body.system) ? body.system.map(b => b.text || '').join('\n') : '');
    if (sys) out.systemInstruction = { role: 'system', parts: [{ text: sys }] };
  }

  if (body.tools && body.tools.length) {
    out.tools = [{
      functionDeclarations: body.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema || { type: 'object', properties: {} },
      })),
    }];
  }

  // 剔空
  for (const k of Object.keys(out.generationConfig)) {
    if (out.generationConfig[k] === undefined) delete out.generationConfig[k];
  }
  if (!Object.keys(out.generationConfig).length) delete out.generationConfig;
  return out;
}

// Gemini 非流式响应 → Anthropic
function geminiRespToAnthropic(resp, model) {
  const cand = (resp.candidates || [])[0] || {};
  const content = [];
  for (const part of (cand.content?.parts || [])) {
    if (part.text) content.push({ type: 'text', text: part.text });
    if (part.functionCall) {
      content.push({
        type: 'tool_use',
        id: randId('toolu'),
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  const stopReason = mapFinishReasonGem(cand.finishReason);
  return {
    id: randId('msg'), type: 'message', role: 'assistant', model,
    content, stop_reason: stopReason, stop_sequence: null,
    usage: {
      input_tokens: resp.usageMetadata?.promptTokenCount || 0,
      output_tokens: resp.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

function mapFinishReasonGem(r) {
  if (r === 'STOP') return 'end_turn';
  if (r === 'MAX_TOKENS') return 'max_tokens';
  if (r === 'SAFETY' || r === 'RECITATION') return 'stop_sequence';
  return 'end_turn';
}

class GeminiToAnthropicStream {
  constructor(model) {
    this.model = model;
    this.msgId = randId('msg');
    this.started = false;
    this.textOpen = false;
    this.blockIndex = 0;
    this.stopReason = 'end_turn';
    this.usage = { input: 0, output: 0 };
  }

  * handleGem(chunk) {
    if (!this.started) {
      this.started = true;
      yield sseEvent('message_start', {
        type: 'message_start',
        message: {
          id: this.msgId, type: 'message', role: 'assistant',
          model: this.model, content: [], stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });
      yield sseEvent('ping', { type: 'ping' });
    }
    if (chunk.usageMetadata) {
      this.usage.input = chunk.usageMetadata.promptTokenCount || this.usage.input;
      this.usage.output = chunk.usageMetadata.candidatesTokenCount || this.usage.output;
    }
    const cand = (chunk.candidates || [])[0];
    if (!cand) return;
    for (const part of (cand.content?.parts || [])) {
      if (part.text) {
        if (!this.textOpen) {
          this.textOpen = true;
          this.textBlockIndex = this.blockIndex++;
          yield sseEvent('content_block_start', {
            type: 'content_block_start',
            index: this.textBlockIndex,
            content_block: { type: 'text', text: '' },
          });
        }
        yield sseEvent('content_block_delta', {
          type: 'content_block_delta',
          index: this.textBlockIndex,
          delta: { type: 'text_delta', text: part.text },
        });
      } else if (part.functionCall) {
        if (this.textOpen) {
          this.textOpen = false;
          yield sseEvent('content_block_stop', { type: 'content_block_stop', index: this.textBlockIndex });
        }
        const idx = this.blockIndex++;
        const id = randId('toolu');
        yield sseEvent('content_block_start', {
          type: 'content_block_start',
          index: idx,
          content_block: { type: 'tool_use', id, name: part.functionCall.name, input: {} },
        });
        const argsJson = JSON.stringify(part.functionCall.args || {});
        yield sseEvent('content_block_delta', {
          type: 'content_block_delta',
          index: idx,
          delta: { type: 'input_json_delta', partial_json: argsJson },
        });
        yield sseEvent('content_block_stop', { type: 'content_block_stop', index: idx });
      }
    }
    if (cand.finishReason) this.stopReason = mapFinishReasonGem(cand.finishReason);
  }

  * finalize() {
    if (this.textOpen) {
      this.textOpen = false;
      yield sseEvent('content_block_stop', { type: 'content_block_stop', index: this.textBlockIndex });
    }
    yield sseEvent('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: this.stopReason, stop_sequence: null },
      usage: { output_tokens: this.usage.output },
    });
    yield sseEvent('message_stop', { type: 'message_stop' });
  }
}

// ══════════════════════════════════════════════════════════
// Anthropic → Ollama /api/chat
// ══════════════════════════════════════════════════════════
function anthropicReqToOllama(body) {
  const messages = [];
  if (body.system) {
    const sys = typeof body.system === 'string' ? body.system : (Array.isArray(body.system) ? body.system.map(b => b.text || '').join('\n') : '');
    if (sys) messages.push({ role: 'system', content: sys });
  }
  for (const m of (body.messages || [])) {
    if (typeof m.content === 'string') {
      messages.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content)) {
      const txt = m.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const imgs = m.content.filter(b => b.type === 'image' && b.source?.type === 'base64').map(b => b.source.data);
      const mm = { role: m.role === 'assistant' ? 'assistant' : 'user', content: txt };
      if (imgs.length) mm.images = imgs;
      messages.push(mm);
    }
  }
  const out = {
    model: body.model,
    messages,
    stream: body.stream || false,
    options: {},
  };
  if (body.temperature !== undefined) out.options.temperature = body.temperature;
  if (body.top_p !== undefined) out.options.top_p = body.top_p;
  if (body.max_tokens !== undefined) out.options.num_predict = body.max_tokens;
  if (!Object.keys(out.options).length) delete out.options;
  return out;
}

function ollamaRespToAnthropic(resp, model) {
  return {
    id: randId('msg'), type: 'message', role: 'assistant', model,
    content: [{ type: 'text', text: resp.message?.content || '' }],
    stop_reason: resp.done ? 'end_turn' : null,
    stop_sequence: null,
    usage: {
      input_tokens: resp.prompt_eval_count || 0,
      output_tokens: resp.eval_count || 0,
    },
  };
}

class OllamaToAnthropicStream {
  constructor(model) {
    this.model = model;
    this.msgId = randId('msg');
    this.started = false;
    this.textOpen = false;
    this.usage = { input: 0, output: 0 };
    this.stopReason = 'end_turn';
  }
  * handleOllama(chunk) {
    if (!this.started) {
      this.started = true;
      yield sseEvent('message_start', {
        type: 'message_start',
        message: {
          id: this.msgId, type: 'message', role: 'assistant',
          model: this.model, content: [], stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      });
      yield sseEvent('ping', { type: 'ping' });
    }
    if (chunk.message?.content) {
      if (!this.textOpen) {
        this.textOpen = true;
        yield sseEvent('content_block_start', {
          type: 'content_block_start', index: 0,
          content_block: { type: 'text', text: '' },
        });
      }
      yield sseEvent('content_block_delta', {
        type: 'content_block_delta', index: 0,
        delta: { type: 'text_delta', text: chunk.message.content },
      });
    }
    if (chunk.prompt_eval_count) this.usage.input = chunk.prompt_eval_count;
    if (chunk.eval_count) this.usage.output = chunk.eval_count;
    if (chunk.done === true) this.stopReason = 'end_turn';
  }
  * finalize() {
    if (this.textOpen) {
      yield sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 });
    }
    yield sseEvent('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: this.stopReason, stop_sequence: null },
      usage: { output_tokens: this.usage.output },
    });
    yield sseEvent('message_stop', { type: 'message_stop' });
  }
}

// ══════════════════════════════════════════════════════════
// Anthropic 响应 → OpenAI 响应 (反向 · 给 OpenAI 格式客户端用)
// ══════════════════════════════════════════════════════════
function anthropicRespToOpenAI(resp, model) {
  let text = '';
  const toolCalls = [];
  for (const b of (resp.content || [])) {
    if (b.type === 'text') text += b.text || '';
    else if (b.type === 'tool_use') {
      toolCalls.push({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      });
    }
  }
  const msg = { role: 'assistant', content: text || null };
  if (toolCalls.length) msg.tool_calls = toolCalls;
  const finishReason = resp.stop_reason === 'tool_use' ? 'tool_calls'
    : resp.stop_reason === 'max_tokens' ? 'length'
    : 'stop';
  return {
    id: resp.id || randId('chatcmpl'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || resp.model,
    choices: [{ index: 0, message: msg, finish_reason: finishReason }],
    usage: {
      prompt_tokens: resp.usage?.input_tokens || 0,
      completion_tokens: resp.usage?.output_tokens || 0,
      total_tokens: (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0),
    },
  };
}

// Anthropic SSE → OpenAI SSE (反向)
class AnthropicToOpenAIStream {
  constructor(model) {
    this.model = model;
    this.id = randId('chatcmpl');
    this.blocks = new Map();  // blockIndex → {type, toolCallIdx, id, name}
    this.nextToolIdx = 0;
    this.finishReason = 'stop';
  }
  * handleAnth(evt) {
    if (evt.type === 'content_block_start') {
      const cb = evt.content_block;
      if (cb.type === 'text') {
        this.blocks.set(evt.index, { type: 'text' });
      } else if (cb.type === 'tool_use') {
        const idx = this.nextToolIdx++;
        this.blocks.set(evt.index, { type: 'tool', idx, id: cb.id, name: cb.name });
        yield oaChunk(this.id, this.model, {
          tool_calls: [{
            index: idx, id: cb.id, type: 'function',
            function: { name: cb.name, arguments: '' },
          }],
        });
      }
    } else if (evt.type === 'content_block_delta') {
      const b = this.blocks.get(evt.index);
      if (!b) return;
      if (b.type === 'text' && evt.delta?.type === 'text_delta') {
        yield oaChunk(this.id, this.model, { content: evt.delta.text });
      } else if (b.type === 'tool' && evt.delta?.type === 'input_json_delta') {
        yield oaChunk(this.id, this.model, {
          tool_calls: [{ index: b.idx, function: { arguments: evt.delta.partial_json } }],
        });
      }
    } else if (evt.type === 'message_delta') {
      const r = evt.delta?.stop_reason;
      if (r === 'tool_use') this.finishReason = 'tool_calls';
      else if (r === 'max_tokens') this.finishReason = 'length';
      else if (r) this.finishReason = 'stop';
    }
  }
  * finalize() {
    yield oaChunk(this.id, this.model, {}, this.finishReason);
    yield 'data: [DONE]\n\n';
  }
}

function oaChunk(id, model, delta, finishReason = null) {
  return 'data: ' + JSON.stringify({
    id, object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }) + '\n\n';
}

// ══════════════════════════════════════════════════════════
// SSE helpers
// ══════════════════════════════════════════════════════════
function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 通用 SSE 行解析器
 * callback(event, data) · event 可能为空(OpenAI 无 event 字段)
 */
function createSSEParser(onEvent) {
  let buffer = '';
  return {
    feed(chunk) {
      buffer += chunk.toString();
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        parseBlock(block, onEvent);
      }
      // 处理单 \n 分隔 (Ollama NDJSON 也可用此函数)
    },
    flush() {
      if (buffer.trim()) {
        parseBlock(buffer, onEvent);
        buffer = '';
      }
    },
  };
}

function parseBlock(block, onEvent) {
  let event = null;
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;
  const raw = dataLines.join('\n');
  if (raw === '[DONE]') { onEvent(event || 'done', null, true); return; }
  try {
    const data = JSON.parse(raw);
    onEvent(event, data, false);
  } catch {}
}

// Ollama NDJSON 行解析 (每行一个 JSON 对象)
function createNDJSONParser(onObj) {
  let buffer = '';
  return {
    feed(chunk) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onObj(JSON.parse(line)); } catch {}
      }
    },
    flush() {
      if (buffer.trim()) {
        try { onObj(JSON.parse(buffer)); } catch {}
        buffer = '';
      }
    },
  };
}

module.exports = {
  anthropicReqToOpenAI,
  openAIRespToAnthropic,
  OpenAIToAnthropicStream,
  anthropicPassthrough,
  anthropicReqToGemini,
  geminiRespToAnthropic,
  GeminiToAnthropicStream,
  anthropicReqToOllama,
  ollamaRespToAnthropic,
  OllamaToAnthropicStream,
  anthropicRespToOpenAI,
  AnthropicToOpenAIStream,
  createSSEParser,
  createNDJSONParser,
  sseEvent,
  randId,
};
