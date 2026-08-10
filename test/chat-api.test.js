'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const handler = require('../api/chat.js');

class MockRequest extends EventEmitter {
  constructor(method, body) {
    super();
    this.method = method;
    this.body = body;
  }
}

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = new Map();
    this.chunks = [];
    this.writableEnded = false;
    this.headersSent = false;
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), String(value));
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }

  flushHeaders() {
    this.headersSent = true;
  }

  write(chunk) {
    this.headersSent = true;
    this.chunks.push(Buffer.from(chunk));
    return true;
  }

  end(chunk) {
    if (chunk != null) this.chunks.push(Buffer.from(chunk));
    this.headersSent = true;
    this.writableEnded = true;
  }

  text() {
    return Buffer.concat(this.chunks).toString('utf8');
  }

  json() {
    return JSON.parse(this.text());
  }
}

function validBody(overrides = {}) {
  return {
    messages: [{ role: 'user', content: 'Привет' }],
    temperature: 0.6,
    max_tokens: 100,
    stream: true,
    ...overrides
  };
}

async function withEnvironment(values, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('GET health check never exposes the API key', { concurrency: false }, async () => {
  await withEnvironment({ OPENROUTER_API_KEY: 'super-secret' }, async () => {
    const req = new MockRequest('GET');
    const res = new MockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), {
      status: 'ok',
      service: 'NEVIO AI proxy',
      configured: true
    });
    assert.equal(res.text().includes('super-secret'), false);
  });
});

test('POST returns a clear configuration error when key is missing', { concurrency: false }, async () => {
  await withEnvironment({ OPENROUTER_API_KEY: null }, async () => {
    const req = new MockRequest('POST', validBody());
    const res = new MockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, 'AI_NOT_CONFIGURED');
  });
});

test('POST validates messages before contacting OpenRouter', { concurrency: false }, async () => {
  await withEnvironment({ OPENROUTER_API_KEY: 'test-key' }, async () => {
    const originalFetch = global.fetch;
    let called = false;
    global.fetch = async () => {
      called = true;
      throw new Error('must not be called');
    };

    try {
      const req = new MockRequest('POST', { messages: [], stream: true });
      const res = new MockResponse();
      await handler(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, 'INVALID_MESSAGES');
      assert.equal(called, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('POST keeps the secret server-side and relays an SSE response', { concurrency: false }, async () => {
  await withEnvironment({ OPENROUTER_API_KEY: 'server-only-key', OPENROUTER_MODEL: null }, async () => {
    const originalFetch = global.fetch;
    let captured;
    global.fetch = async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return new Response(
        'data: {"choices":[{"delta":{"content":"Привет!"}}]}\n\ndata: [DONE]\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    };

    try {
      const req = new MockRequest('POST', validBody({ model: 'attacker/choice' }));
      const res = new MockResponse();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.match(res.getHeader('content-type'), /text\/event-stream/);
      assert.match(res.text(), /Привет!/);
      assert.equal(captured.url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(captured.options.headers.Authorization, 'Bearer server-only-key');
      assert.equal(captured.body.model, 'openrouter/free');
      assert.equal(captured.body.stream, true);
      assert.equal(res.text().includes('server-only-key'), false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('proxy retries a temporary 429 before streaming', { concurrency: false }, async () => {
  await withEnvironment({ OPENROUTER_API_KEY: 'test-key' }, async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('{"error":{"message":"busy"}}', {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '0.001' }
        });
      }
      return new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    };

    try {
      const req = new MockRequest('POST', validBody());
      const res = new MockResponse();
      await handler(req, res);

      assert.equal(calls, 2);
      assert.equal(res.statusCode, 200);
      assert.equal(res.text(), 'data: [DONE]\n\n');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
