// api-example/aiDFortune.js
//
// 「時光籤」AI 解籤功能的範例後端（Vercel Serverless Function）。
// 前端只會呼叫你自己的 AI_ENDPOINT（見 index.html 的 CONFIG 區塊），
// 由這支後端代為呼叫 DeepSeek API，金鑰放在後端環境變數，
// 瀏覽器永遠不會看到 DeepSeek 的 API Key。
//
// ── 部署方式（以 Vercel 為例） ──────────────────────────────
// 1. 把這個檔案放到你 Vercel 專案的 /api/aiDFortune.js
// 2. 到 Vercel 專案設定 → Environment Variables 新增：
//      DEEPSEEK_API_KEY = sk-xxxxxxxxxxxxxxxx
//    （API Key 請到 https://platform.deepseek.com/api_keys 申請）
// 3. 部署後，index.html 裡的 AI_ENDPOINT 設成 '/api/aiDFortune' 即可
//    （目前預設值就是這個路徑，不用再改前端）。
//
// ── 與 DeepSeek 官方文件對應的重點 ────────────────────────────
//   説明文件：https://api-docs.deepseek.com/zh-cn/
//   base_url：https://api.deepseek.com
//   端點     ：POST /chat/completions
//   驗證方式：Authorization: Bearer ${DEEPSEEK_API_KEY}
//   模型     ：deepseek-v4-pro（旗艦，預設用這個）
//              deepseek-v4-flash（輕量、速度快、成本低，量大時可換這個）
//   請求格式與 OpenAI Chat Completions 相容：
//   {
//     model: "deepseek-v4-pro",
//     messages: [
//       { role: "system", content: "..." },
//       { role: "user",   content: "..." }
//     ],
//     stream: false
//   }
// ──────────────────────────────────────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-pro';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY 尚未設定（請至 Vercel 環境變數新增）。' });
    return;
  }

  const { system, message } = req.body || {};
  if (!message) {
    res.status(400).json({ error: '缺少 message 欄位。' });
    return;
  }

  try {
    const deepseekRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: system || '你是一位溫暖親切的解籤師。' },
          { role: 'user', content: message }
        ],
        // 這個場景只需要一段完整回覆，不需要串流輸出。
        stream: false,
        // 解籤是輕量的對話任務，不需要開啟深度推理模式，
        // 關掉可以讓回覆更快、更省成本；有需要也可以改成 "enabled"。
        thinking: { type: 'disabled' },
        temperature: 1.0,
        max_tokens: 500
      })
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error('DeepSeek API error:', deepseekRes.status, errText);
      res.status(502).json({ error: 'DeepSeek API 呼叫失敗。' });
      return;
    }

    const data = await deepseekRes.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';

    res.status(200).json({ text });
  } catch (err) {
    console.error('aiDFortune handler error:', err);
    res.status(500).json({ error: '伺服器發生錯誤，請稍後再試。' });
  }
}
