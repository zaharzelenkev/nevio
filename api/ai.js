export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, mode } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server API key is not configured' });
    }

    const systemPrefix = mode === 'teacher'
      ? 'Ты профессиональный помощник для учителя. Пиши структурно, педагогично, точно.'
      : mode === 'student'
      ? 'Ты доброжелательный и сильный наставник для ученика. Объясняй понятно, пошагово, без лишней воды.'
      : 'Ты полезный образовательный AI-помощник.';

    const fullPrompt = `${systemPrefix}\n\n${prompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: fullPrompt }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini request failed'
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Пустой ответ от модели';

    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
