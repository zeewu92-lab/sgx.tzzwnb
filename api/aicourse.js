/**
 * 課表 AI 辨識 —— 後端代理 (timetableAI 的伺服器端實作)
 * ------------------------------------------------------------
 * 用途：
 *   前端「課表.html」不再持有 DeepSeek API Key，
 *   而是把圖片送到這支後端的 POST /api/aicourse.js，
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

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const SYSTEM_PROMPT = `你是課表辨識引擎。使用者會給你一張課表圖片，你必須：
1. 找出星期、節次、科目、老師、教室
2. 合併儲存格代表連續課程，請個別列出每一節
3. 無法確定的科目名稱請在文字後面加上「?」
4. 空白格請直接省略，不要亂猜
5. "days" 欄位只列出圖片中「實際有排課」的星期（例如圖片只有一到四，就絕對不要包含 friday），不要自動假設一到五都有課，也不要自己補上圖片沒出現的星期
6. periods 裡除了正課，也要包含圖片中出現的非上課時段（例如午餐、午休、社團、自習等），並依照圖片實際顯示的名稱與時間標示為 "type":"break"；如果圖片完全沒有顯示這類時段，就不要自己編一個出來
7. periods 請按照圖片中節次標示的原始順序列出；如果圖片本身的節次時間有先後順序顛倒、起訖時間重疊等不合理狀況，仍然照圖片上的數字如實回傳，不要自己修正或調整，交給後續程式檢查
8. 只回傳 JSON，不要任何說明文字、不要 Markdown code fence

JSON 格式：
{
  "days": ["monday","tuesday","wednesday","thursday"],
  "periods": [
    {"id":1,"start":"08:10","end":"09:00","type":"class"},
    {"id":2,"start":"09:10","end":"10:00","type":"class"},
    {"id":3,"start":"12:00","end":"13:00","type":"break","name":"午餐"},
    {"id":4,"start":"13:00","end":"13:50","type":"class"}
  ],
  "monday":[{"period":1,"subject":"國文","teacher":"","room":""}],
  "tuesday":[...],
  "wednesday":[...],
  "thursday":[...]
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
 * 從辨識結果推斷「實際有排課的星期」：
 * 優先採用 AI 回傳的 days；如果沒有或格式不對，退而求其次，
 * 用哪幾天的陣列裡有資料來判斷，避免前端擅自補上一到五。
 */
function normalizeDays(json) {
  let days = Array.isArray(json.days) ? json.days.filter((d) => VALID_DAYS.includes(d)) : [];
  if (days.length === 0) {
    days = VALID_DAYS.filter((d) => Array.isArray(json[d]) && json[d].length > 0);
  }
  return days.sort((a, b) => VALID_DAYS.indexOf(a) - VALID_DAYS.indexOf(b));
}

/**
 * 檢查課節時間本身有沒有問題：
 * - 起訖時間顛倒（start >= end）
 * - 圖片標示的節次順序跟時間先後順序對不起來（可能代表時間輸入顛倒）
 * - 相鄰節次時間重疊
 * 回傳一份人看得懂的問題清單，交給前端在確認匯入畫面提醒使用者。
 */
function detectPeriodIssues(periods) {
  const issues = [];

  periods.forEach((p) => {
    if (p.start && p.end && p.start >= p.end) {
      issues.push(`「${p.name || ('第 ' + p.id + ' 節')}」的開始時間 (${p.start}) 沒有早於結束時間 (${p.end})，請確認。`);
    }
  });

  const sortedByStart = [...periods].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const originalIds = periods.map((p) => p.id);
  const sortedIds = sortedByStart.map((p) => p.id);
  const sameOrder = originalIds.every((id, idx) => id === sortedIds[idx]);
  if (!sameOrder) {
    issues.push('偵測到節次順序跟時間先後對不起來，圖片上的課節時間可能有輸入顛倒的狀況，請確認下方節次時間是否正確。');
  }

  for (let i = 0; i < sortedByStart.length - 1; i++) {
    const cur = sortedByStart[i];
    const next = sortedByStart[i + 1];
    if (cur.end && next.start && cur.end > next.start) {
      issues.push(`「${cur.name || ('第 ' + cur.id + ' 節')}」(${cur.start}-${cur.end}) 跟「${next.name || ('第 ' + next.id + ' 節')}」(${next.start}-${next.end}) 時間重疊。`);
    }
  }

  return issues;
}


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

  // 補齊 type 欄位（AI 偶爾會漏掉），並附上偵測到的星期與問題清單
  json.periods = json.periods.map((p) => ({ type: 'class', ...p }));
  json.days = normalizeDays(json);
  json.issues = detectPeriodIssues(json.periods);

  return json;
}

app.post('/api/aicourse.js', async (req, res) => {
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
  console.log(`   辨識端點：POST http://localhost:${PORT}/api/aicourse.js`);
});
