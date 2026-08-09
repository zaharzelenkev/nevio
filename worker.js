/**
 * NEVIO — OpenRouter proxy worker
 *
 * WHY THIS EXISTS
 * ----------------
 * The old code called Groq directly from the browser with the API key
 * written into the JS. Anyone using the app could open dev tools, copy
 * the key, and use it themselves — on your bill, with your rate limits.
 * A key inside client-side code is a PUBLIC key, no matter how it's
 * formatted or hidden in a variable name.
 *
 * This worker sits between your app and OpenRouter. The key lives here,
 * on Cloudflare's servers, and is never sent to the browser. The app now
 * calls YOUR worker URL instead of openrouter.ai directly.
 *
 * DEPLOY (5 minutes, free tier is enough for this):
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker
 * 2. Paste this file's contents in, replacing the default code
 * 3. Go to Settings -> Variables -> add an encrypted secret:
 *      name: OPENROUTER_API_KEY
 *      value: <your OpenRouter key>
 *    (Get a key at https://openrouter.ai/keys — free :free models
 *    don't need a payment card; they have per-day request limits.)
 * 4. Deploy. You'll get a URL like https://nevio-proxy.<you>.workers.dev
 * 5. Put that URL into API_PROXY_URL in the app's script (see index.html)
 *
 * This also gives you a place to add rate-limiting per Telegram user
 * later, which you have none of right now — anyone can hammer this
 * endpoint and run up your OpenRouter usage.
 */

const ALLOWED_ORIGIN = '*'; // tighten to your actual site/Mini App origin once deployed

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // Only forward the fields we expect — don't let a client inject
    // arbitrary OpenRouter API parameters.
    const { messages, temperature, max_tokens, stream } = payload;
    if (!Array.isArray(messages)) {
      return json({ error: 'messages array required' }, 400);
    }

    const body = {
      model: 'meta-llama/llama-3.3-70b-instruct:free', // стабильная бесплатная модель OpenRouter (суффикс :free)
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.6,
      max_tokens: Math.min(typeof max_tokens === 'number' ? max_tokens : 4000, 8000),
      stream: !!stream,
    };

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    // Stream straight through for stream:true requests, otherwise
    // pass the JSON back as-is.
    const headers = corsHeaders();
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

function corsHeaders() {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return h;
}

function json(obj, status = 200) {
  const h = corsHeaders();
  h.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(obj), { status, headers: h });
}
