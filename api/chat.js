'use strict';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
const UPSTREAM_TIMEOUT_MS = 55_000;
const MAX_UPSTREAM_ATTEMPTS = 2;
const MAX_MESSAGES = 60;
const MAX_TOTAL_MESSAGE_CHARS = 160_000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

module.exports = async function chatHandler(req, res) {
  setCommonHeaders(res);

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'NEVIO AI proxy',
      configured: Boolean(getApiKey())
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Используйте POST для запроса к ИИ.');
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return sendError(
      res,
      503,
      'AI_NOT_CONFIGURED',
      'Сервис ИИ пока не настроен. Добавьте OPENROUTER_API_KEY в переменные окружения Vercel.'
    );
  }

  let payload;
  try {
    payload = await readRequestBody(req);
  } catch {
    return sendError(res, 400, 'INVALID_JSON', 'Тело запроса должно быть корректным JSON.');
  }

  const validationError = validateMessages(payload?.messages);
  if (validationError) {
    return sendError(res, 400, 'INVALID_MESSAGES', validationError);
  }

  const upstreamBody = {
    model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
    messages: payload.messages.map(message => ({
      role: message.role,
      content: message.content
    })),
    temperature: clampNumber(payload.temperature, 0, 2, 0.6),
    max_tokens: Math.round(clampNumber(payload.max_tokens, 1, 8000, 4000)),
    stream: Boolean(payload.stream)
  };

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  const cancelUpstream = () => {
    if (!res.writableEnded) controller.abort();
  };
  req.once?.('aborted', cancelUpstream);
  res.once?.('close', cancelUpstream);

  try {
    const upstream = await requestOpenRouter(upstreamBody, apiKey, controller.signal);

    if (!upstream.ok) {
      const errorPayload = await safeReadJson(upstream);
      const upstreamMessage = errorPayload?.error?.message || '';
      console.error('OpenRouter request failed', {
        status: upstream.status,
        generationId: upstream.headers.get('x-generation-id') || undefined
      });
      return sendError(
        res,
        normalizeUpstreamStatus(upstream.status),
        'UPSTREAM_' + upstream.status,
        friendlyUpstreamError(upstream.status, upstreamMessage)
      );
    }

    const generationId = upstream.headers.get('x-generation-id');
    if (generationId) res.setHeader('X-Generation-Id', generationId);

    const contentType = upstream.headers.get('content-type') || (upstreamBody.stream
      ? 'text/event-stream; charset=utf-8'
      : 'application/json; charset=utf-8');
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);

    if (upstreamBody.stream) {
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      await pipeWebStream(upstream.body, res);
      if (!res.writableEnded) res.end();
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
  } catch (error) {
    if (res.headersSent) {
      if (!res.writableEnded && !res.destroyed) {
        const message = timedOut || error?.name === 'AbortError'
          ? 'Сервис ИИ не успел завершить ответ. Попробуйте более короткий запрос.'
          : 'Соединение с моделью прервалось. Попробуйте ещё раз.';
        writeStreamError(res, timedOut ? 504 : 502, message);
        res.end();
      }
      return;
    }

    if (timedOut || error?.name === 'AbortError') {
      return sendError(res, 504, 'UPSTREAM_TIMEOUT', 'Сервис ИИ слишком долго не отвечает. Попробуйте ещё раз.');
    }

    console.error('OpenRouter connection failed', { message: error?.message || 'Unknown error' });
    return sendError(res, 502, 'UPSTREAM_CONNECTION_ERROR', 'Не удалось подключиться к сервису ИИ. Попробуйте ещё раз.');
  } finally {
    clearTimeout(timeout);
    req.removeListener?.('aborted', cancelUpstream);
    res.removeListener?.('close', cancelUpstream);
  }
};

async function requestOpenRouter(body, apiKey, signal) {
  let lastResponse;
  let lastError;

  for (let attempt = 0; attempt < MAX_UPSTREAM_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': body.stream ? 'text/event-stream' : 'application/json',
          'HTTP-Referer': process.env.PUBLIC_APP_URL?.trim() || 'https://nevio.vercel.app',
          'X-OpenRouter-Title': 'NEVIO'
        },
        body: JSON.stringify(body),
        signal
      });

      lastResponse = response;
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_UPSTREAM_ATTEMPTS - 1) {
        return response;
      }

      await response.body?.cancel().catch(() => {});
      await delay(retryDelayMs(response, attempt), signal);
    } catch (error) {
      lastError = error;
      if (signal.aborted || attempt === MAX_UPSTREAM_ATTEMPTS - 1) throw error;
      await delay(500 * (attempt + 1), signal);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('OpenRouter request failed');
}

async function pipeWebStream(stream, res) {
  if (!stream?.getReader) throw new Error('Upstream response has no readable body');

  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await waitForDrain(res);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function waitForDrain(res) {
  return new Promise((resolve, reject) => {
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error('Client disconnected'));
    };
    const cleanup = () => {
      res.removeListener?.('drain', onDrain);
      res.removeListener?.('close', onClose);
    };
    res.once('drain', onDrain);
    res.once('close', onClose);
  });
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));

  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (raw.length > 1_000_000) throw new Error('Request body too large');
  }
  return JSON.parse(raw || '{}');
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Добавьте хотя бы одно сообщение.';
  }
  if (messages.length > MAX_MESSAGES) {
    return 'Диалог слишком длинный. Начните новый запрос.';
  }

  let totalChars = 0;
  const allowedRoles = new Set(['system', 'user', 'assistant']);
  for (const message of messages) {
    if (!message || !allowedRoles.has(message.role) || typeof message.content !== 'string') {
      return 'Сообщения имеют неверный формат.';
    }
    totalChars += message.content.length;
  }

  if (totalChars > MAX_TOTAL_MESSAGE_CHARS) {
    return 'Запрос слишком длинный. Сократите текст и попробуйте ещё раз.';
  }
  return '';
}

function getApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || '';
}

function clampNumber(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 2500);
  }
  return 500 * (attempt + 1);
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

async function safeReadJson(response) {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

function normalizeUpstreamStatus(status) {
  if (status === 401 || status === 402 || status === 403 || status === 429) return status;
  if (status >= 400 && status < 500) return 400;
  return 502;
}

function friendlyUpstreamError(status, upstreamMessage) {
  if (status === 400) return upstreamMessage || 'Сервис ИИ не смог обработать запрос. Сократите его или сформулируйте иначе.';
  if (status === 401) return 'Ключ OpenRouter недействителен. Обновите OPENROUTER_API_KEY в Vercel.';
  if (status === 402) return 'На аккаунте OpenRouter закончился доступный лимит.';
  if (status === 403) return 'OpenRouter отклонил запрос или запретил доступ к модели.';
  if (status === 408 || status === 504) return 'Модель не успела ответить. Попробуйте ещё раз.';
  if (status === 429) return 'Бесплатные модели сейчас перегружены. Подождите немного и повторите запрос.';
  if (status === 502 || status === 503) return 'Сейчас нет доступной бесплатной модели. Попробуйте ещё раз через минуту.';
  return 'Сервис ИИ временно недоступен. Попробуйте ещё раз.';
}

function setCommonHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function writeStreamError(res, status, message) {
  const payload = {
    error: { code: status, message },
    choices: [{ index: 0, delta: { content: '' }, finish_reason: 'error' }]
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sendError(res, status, code, message) {
  return sendJson(res, status, { error: { code, message } });
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', String(Buffer.byteLength(body)));
  res.end(body);
}

module.exports._private = {
  validateMessages,
  friendlyUpstreamError,
  normalizeUpstreamStatus,
  requestOpenRouter
};
