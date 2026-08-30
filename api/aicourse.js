/**
 * 課表 AI 辨識 —— 後端代理 (timetableAI 的伺服器端實作)
 * ------------------------------------------------------------
 * 用途：
 *   前端「課表.html」不再持有 DeepSeek API Key，
 *   而是把圖片送到這支後端的 POST /api/timetable/recognize，
 *   由這裡組 prompt、呼叫 DeepSeek Vision、清理並驗證回傳的 JSON，
 *   最後把乾淨的課表 JSON 回傳給前端。
 *
 * 執行需求：
 *   Node.js 18 以上（使用內建的全域 fetch，不需要額外安裝 node-fetch）
 *
 * 使用方式：
 *   1. npm install
 *   2. 複製 .env.example 為 .env，填入你的 DeepSeek_course_API_KEY
 *   3. npm start
 *   4. 預設監聽 http://localhost:3001
 *
 * 若要換掉 AI 供應商（例如換成別家有 Vision 能力的模型），
 * 只需要修改這支檔案裡 callDeepSeekVision() 這個函式，
 * 前端與其他程式完全不用改動。
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' })); // 課表照片轉 base64 後可能不小，留一點餘裕

const PORT = process.env.PORT || 3001;
const DeepSeek_course_API_KEY = process.env.DeepSeek_course_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash-vision-exp';

const SYSTEM_PROMPT = `你是課表辨識引擎。使用者會給你一張課表圖片，你必須：
1. 找出星期、節次、科目、老師、教室
2. 合併儲存格代表連續課程，請個別列出每一節
3. 無法確定的科目名稱請在文字後面加上「?」
4. 空白格請直接省略，不要亂猜
5. 只回傳 JSON，不要任何說明文字、不要 Markdown code fence
JSON 格式：
{
  "periods":[{"id":1,"start":"08:10","end":"09:00"}],
  "monday":[{"period":1,"subject":"國文","teacher":"","room":""}],
  "tuesday":[...],
  "wednesday":[...],
  "thursday":[...],
  "friday":[...]
}`;

/**
 * 呼叫 DeepSeek Vision，回傳模型輸出的原始文字內容
 */
async function callDeepSeekVision(base64Image) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DeepSeek_course_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '請辨識這張課表圖片，只回傳 JSON。' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`DeepSeek API 錯誤 (${response.status})：${errText.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * timetableParser 的伺服器端等效：清理 Markdown code fence 並驗證 JSON 結構
 */
function parseAndValidate(raw) {
  const clean = raw
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  let json;
  try {
    json = JSON.parse(clean);
  } catch (e) {
    const err = new Error('AI 回傳的內容不是有效 JSON，請重新拍照或改用手動建立課表。');
    err.status = 502;
    throw err;
  }

  if (!json.periods || !Array.isArray(json.periods)) {
    const err = new Error('AI 回傳缺少節次時間資訊。');
    err.status = 502;
    throw err;
  }

  return json;
}

app.post('/api/timetable/recognize', async (req, res) => {
  try {
    if (!DeepSeek_course_API_KEY) {
      return res.status(500).json({ error: '伺服器尚未設定 DeepSeek_course_API_KEY，請檢查 .env 檔案。' });
    }

    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: '請求缺少圖片資料（image，需為 base64 字串）。' });
    }

    const raw = await callDeepSeekVision(image);
    const timetableJSON = parseAndValidate(raw);

    return res.json(timetableJSON);
  } catch (err) {
    console.error('[recognize] 發生錯誤：', err.message);
    return res.status(err.status || 500).json({ error: err.message || '伺服器發生未知錯誤。' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ 課表 AI 辨識後端已啟動：http://localhost:${PORT}`);
  console.log(`   辨識端點：POST http://localhost:${PORT}/api/timetable/recognize`);
});
