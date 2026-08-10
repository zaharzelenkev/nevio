(function initNevioSSE(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.NevioSSE = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createNevioSSE() {
  'use strict';

  /**
   * Small dependency-free Server-Sent Events parser.
   *
   * A network chunk can end in the middle of a line or a JSON value, so SSE
   * must be framed first and parsed as JSON only after the blank event
   * separator arrives. OpenRouter also sends comment heartbeats while a model
   * is preparing its answer.
   */
  function createParser(options) {
    const onEvent = typeof options?.onEvent === 'function' ? options.onEvent : function noop() {};
    const onComment = typeof options?.onComment === 'function' ? options.onComment : function noop() {};

    let buffer = '';
    let dataLines = [];

    function dispatchEvent() {
      if (dataLines.length === 0) return;
      const data = dataLines.join('\n');
      dataLines = [];
      onEvent(data);
    }

    function processLine(line) {
      if (line === '') {
        dispatchEvent();
        return;
      }

      if (line.startsWith(':')) {
        onComment(line.slice(1).replace(/^ /, ''));
        return;
      }

      const colonIndex = line.indexOf(':');
      const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
      let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'data') dataLines.push(value);
    }

    function drainLines(isFinal) {
      while (buffer.length > 0) {
        const lfIndex = buffer.indexOf('\n');
        const crIndex = buffer.indexOf('\r');
        let lineEnd = -1;

        if (lfIndex !== -1 && crIndex !== -1) lineEnd = Math.min(lfIndex, crIndex);
        else lineEnd = Math.max(lfIndex, crIndex);

        if (lineEnd === -1) break;

        // A CR may be the first half of a CRLF split between two chunks.
        if (!isFinal && buffer[lineEnd] === '\r' && lineEnd === buffer.length - 1) break;

        const line = buffer.slice(0, lineEnd);
        const separatorLength = buffer[lineEnd] === '\r' && buffer[lineEnd + 1] === '\n' ? 2 : 1;
        buffer = buffer.slice(lineEnd + separatorLength);
        processLine(line);
      }
    }

    return {
      feed(chunk) {
        if (chunk == null || chunk === '') return;
        buffer += String(chunk);
        drainLines(false);
      },

      end(chunk) {
        if (chunk != null && chunk !== '') buffer += String(chunk);
        drainLines(true);
        if (buffer.length > 0) {
          processLine(buffer);
          buffer = '';
        }
        dispatchEvent();
      }
    };
  }

  return { createParser };
});
