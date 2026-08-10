'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createParser } = require('../sse-parser.js');

test('SSE parser preserves events split across arbitrary network chunks', () => {
  const events = [];
  const comments = [];
  const parser = createParser({
    onEvent: data => events.push(data),
    onComment: comment => comments.push(comment)
  });

  parser.feed(': OPENROUTER PRO');
  parser.feed('CESSING\r');
  parser.feed('\ndata: {"choices":[{"delta":{"con');
  parser.feed('tent":"При');
  parser.feed('вет"}}]}\r\n');
  parser.feed('\r');
  parser.feed('\ndata: [DO');
  parser.feed('NE]\n\n');
  parser.end();

  assert.deepEqual(comments, ['OPENROUTER PROCESSING']);
  assert.deepEqual(events, [
    '{"choices":[{"delta":{"content":"Привет"}}]}',
    '[DONE]'
  ]);
});

test('SSE parser joins multiple data lines and dispatches final unterminated event', () => {
  const events = [];
  const parser = createParser({ onEvent: data => events.push(data) });

  parser.feed('event: message\ndata: first\ndata: second\n\n');
  parser.feed('data: final');
  parser.end();

  assert.deepEqual(events, ['first\nsecond', 'final']);
});
