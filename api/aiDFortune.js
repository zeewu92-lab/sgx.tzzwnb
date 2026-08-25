// 收下前端傳來的 { system, message }，
// 代為呼叫 Anthropic API，把結果整理成 { text: "..." } 回傳給前端。

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { system, message } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing message' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: typeof system === 'string' ? system : undefined,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: 'Upstream error', detail: errText });
      return;
    }

    const data = await upstream.json();
    const text = (data.content || [])
      .map((c) => c.text || '')
      .join('\n')
      .trim();

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
