'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const NevioSSE = require('../sse-parser.js');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.parentNode = null;
    this.scrollTop = 0;
    this.scrollHeight = 100;
    this.removed = false;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    this.removed = true;
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
  }

  querySelector() {
    return null;
  }
}

function inlineScript() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.lastIndexOf('<script>') + '<script>'.length;
  const end = html.lastIndexOf('</script>');
  return html.slice(start, end);
}

function streamingResponse(chunks) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
  });
}

function createFrontendContext(fetchImpl) {
  const chat = new FakeElement('div');
  const loadingText = new FakeElement('span');
  const loading = new FakeElement('div');
  loading.querySelector = selector => selector === '.loading-text' ? loadingText : null;

  const elements = new Map([
    ['chatMessages', chat],
    ['loading-test', loading]
  ]);
  loading.remove = () => {
    loading.removed = true;
    elements.delete('loading-test');
  };

  const document = {
    addEventListener() {},
    createElement: tag => new FakeElement(tag),
    getElementById: id => elements.get(id) || null,
    querySelectorAll: () => []
  };

  const context = {
    console,
    document,
    fetch: fetchImpl,
    Headers,
    Response,
    ReadableStream,
    TextDecoder,
    TextEncoder,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    NevioSSE
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(inlineScript(), context, { filename: 'index-inline.js' });
  return { context, chat, loading, loadingText };
}

test('frontend assembles a fragmented OpenRouter stream into visible text', async () => {
  let capturedRequest;
  const chunks = [
    ': OPENROUTER PROCESSING\n\n',
    'data: {"choices":[{"delta":{"content":"При',
    'вет"}}]}\n',
    '\ndata: {"choices":[{"delta":{"content":"!"}}]}\n\n',
    'data: [DONE]\n\n'
  ];
  const ui = createFrontendContext(async (url, options) => {
    capturedRequest = { url, body: JSON.parse(options.body) };
    return streamingResponse(chunks);
  });

  const result = await vm.runInContext(`
    state.role = 'student';
    callAIWithStream([{ role:'user', content:'Скажи привет' }], 'loading-test');
  `, ui.context);

  assert.equal(result, 'Привет!');
  assert.equal(capturedRequest.url, '/api/chat');
  assert.equal(capturedRequest.body.stream, true);
  assert.equal(ui.loading.removed, true);
  assert.equal(ui.chat.children.length, 1);
  const messageBubble = ui.chat.children[0].children[1];
  assert.match(messageBubble.innerHTML, /Привет!/);
  assert.doesNotMatch(messageBubble.innerHTML, /streaming-cursor/);
});

test('frontend surfaces an in-stream error instead of waiting forever', async () => {
  const ui = createFrontendContext(async () => streamingResponse([
    'data: {"error":{"code":429,"message":"busy"},"choices":[{"delta":{},"finish_reason":"error"}]}\n\n'
  ]));

  await assert.rejects(
    vm.runInContext(`
      state.role = 'student';
      callAIWithStream([{ role:'user', content:'Вопрос' }], 'loading-test');
    `, ui.context),
    /перегружена/
  );

  assert.equal(ui.loading.removed, true);
  assert.equal(ui.chat.children.length, 0, 'empty streaming bubble must be removed after an error');
});

test('frontend does not treat a truncated stream as a complete answer', async () => {
  const ui = createFrontendContext(async () => streamingResponse([
    'data: {"choices":[{"delta":{"content":"Незаконченный ответ"}}]}\n\n'
  ]));

  await assert.rejects(
    vm.runInContext(`
      state.role = 'student';
      callAIWithStream([{ role:'user', content:'Вопрос' }], 'loading-test');
    `, ui.context),
    /до завершения ответа/
  );

  assert.equal(ui.chat.children.length, 1, 'received partial text should remain visible');
  const messageBubble = ui.chat.children[0].children[1];
  assert.match(messageBubble.innerHTML, /Ответ прервался/);
});
