import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronDown, ChevronLeft, ChevronRight, X, MapPin, Check, Clock, Globe, Sun, Pencil, User, LogOut, Mail, Eye, EyeOff, Search, SlidersHorizontal, Share2, Bell, BellOff, Settings, Images, Move, Calendar, Shield, Info, FileText, Database, RefreshCw } from 'lucide-react';
import {
  watchAuthState, signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple,
  sendMagicLink, completeEmailLinkSignInIfNeeded, signOutUser,
  getCurrentUserProviderId, changePassword, deleteAccount,
} from './lib/auth.js';
import { loadCloudData, saveCloudData } from './lib/cloudSync.js';
import FeedbackModal from './components/FeedbackModal.jsx';

const INK = 'var(--ink)';
const INK_SOFT = 'var(--ink-soft)';
// ACCENT 改成讀 CSS 變數（預設值見下方 App() 裡的 cssVars），而不是寫死的 hex。
// 這樣「關懷模式」才能只在 header／世界時鐘這兩個局部範圍內覆寫 --accent，
// 讓強調色跟著變素雅，同時完全不需要動到全域樣式或任何濾鏡。細節見 CARE_MODE_VARS。
//
// 這裡一定要帶第二個參數當 fallback（var(--accent, #6C7BE0)），不能只寫 var(--accent)：
// App 裡有幾個彈窗（新增／編輯地標表單、地標詳情、刪除確認、字體授權說明）是用
// createPortal 直接掛到 document.body，在 DOM 樹裡是最外層那個設定 cssVars 的 <div>
// 的手足、不是子孫，繼承不到 --accent。CSS 變數沒定義時 var() 不會退回瀏覽器預設，
// 而是直接判定成無效值——凡是「背景色＝ACCENT」的按鈕，背景就會整個消失。
// 帶上 fallback 之後，不管有沒有繼承到 --accent，都能拿到正確的顏色，不用特地去把
// cssVars 也複製一份掛到每個 portal 的根節點上。
const ACCENT = 'var(--accent, #6C7BE0)';

// 過去 ACCENT 是純 hex（'#6C7BE0'），程式裡不少地方直接接兩位 hex 尾碼做透明度，
// 例如 `${ACCENT}20`、`${ACCENT}55`，八位數 hex（含 alpha）瀏覽器看得懂。
// 但現在 ACCENT 是 `var(--accent, #6C7BE0)` 這種字串，接上兩位數字尾碼會變成
// `var(--accent, #6C7BE0)20` 這種不合法的顏色值——不是「透明度失效」，是整個屬性
// 直接被瀏覽器丟棄，該屬性形同沒寫。這正是「徽章只剩文字顏色（color: ACCENT 本身沒接
// 尾碼、還是合法的）、背景／邊框（接了尾碼）整個消失」的成因。
// color-mix() 能吃 CSS 變數當顏色來源、透明度改用百分比表示，效果等價，改用這個。
function accentAlpha(hexAlpha) {
  const pct = (parseInt(hexAlpha, 16) / 255) * 100;
  return `color-mix(in srgb, ${ACCENT} ${pct.toFixed(1)}%, transparent)`;
}
const DANGER = '#FF004A';
const MINT = '#3FBF9B';
const CARD_BG = 'var(--card-bg)';
const CARD_BORDER = '1px solid var(--card-border)';
const INPUT_BG = 'var(--input-bg)';

// 底部導覽列中央「時光線」分頁的品牌圖示素材路徑（預留位置）。
// 依需求：不能用現有的 /icon-512.png（那是 App 圖示本人，跟這裡要求的「另一份專門給
// Bottom Navigation 用的 Logo 素材」是兩回事），也不能自行畫一個代替。這裡只先訂好
// 檔名／路徑當作明確的引用位置，實際素材檔案請放到 public/nav-logo.png（跟
// public/icon-512.png 同一層）。BottomNavigation 元件會先嘗試載入這個路徑，
// 檔案還沒放上去之前，會自動 fallback 成一個中性的實心圓點佔位（不是刻意畫的替代 Logo，
// 純粹是「這裡以後會有東西」的視覺佔位），素材一到位就會自動換成正式的圖檔，不用再改程式碼。
const BOTTOM_NAV_LOGO_SRC = '/nav-logo.png';

// 關懷模式的視覺語言：改用「設計 token（CSS 變數）覆寫」取代舊版的
// `filter: grayscale(1)`。差別在於 filter 是對整個 DOM 子樹做像素等級的去色處理，
// 國旗 emoji 這種本來就不是靠 `color` 上色的內容也會一起被榨成灰色，
// 之前只能另外用 createPortal 把國旗獨立掛出去閃避濾鏡，才會需要一整套錨點座標同步、
// 捲動裁切、下拉選單重疊偵測的邏輯（見這個檔案更早的版本）。
// 改成覆寫 --ink／--card-bg／--card-border／--accent 這些 token 之後，
// 只有「真的用這些變數上色」的文字、背景、邊框、強調色會變素雅；
// 國旗本身從來就不吃這幾個變數，所以完全不需要特別排除、也不需要離開原本的 DOM 位置。
const CARE_MODE_VARS = {
  '--ink': '#57565C',
  '--ink-soft': 'rgba(87,86,92,0.55)',
  '--card-bg': '#F1F1F1',
  '--card-border': '#E4E4E7',
  '--accent': '#8B8B92',
};
// 時間軸上「事件卡片與卡片之間」統一的垂直間距（過去地標清單內部、過去／未來清單交界處、
// 未來地標清單內部、搜尋結果清單，全部共用同一個數值），確保不管在哪個區塊看到的間隙都一樣。
const EVENT_CARD_GAP = 24;

// 「更換數字字體」可選的字體清單：id 存進事件的 numberFont 欄位，family 是實際渲染用的 CSS font-family。
// 系統圓體／Quicksand 不需要額外載入（Quicksand 整個 App 本來就在用），其餘幾款是額外的 Google Fonts，
// 只在使用者真的打開「自訂」面板、要挑字體時才動態載入，避免拖慢一般開合視窗的速度。
const NUMBER_FONTS = [
  { id: 'inter', name: '系統圓體', family: "'Inter', sans-serif", googleFont: 'Inter:wght@900', copyright: '© 2020 The Inter Project Authors' },
  { id: 'orbitron', name: '數位科技', family: "'Orbitron', sans-serif", googleFont: 'Orbitron:wght@700', copyright: '© 2018 The Orbitron Project Authors' },
  { id: 'playfair', name: '經典襯線', family: "'Playfair Display', serif", googleFont: 'Playfair+Display:wght@700', copyright: '© 2017 The Playfair Display Project Authors' },
  { id: 'monoton', name: '純調線條', family: "'Monoton', sans-serif", googleFont: 'Monoton', copyright: '© 2011 Vernon Adams' },
  // Nabla 是可變字體，不支援一般的 wght 軸，改用它自己的 EDPT（立體深度）／EHLT（高光）軸，
  // 所以額外多帶一個 variationSettings 欄位，渲染時要一併套用，只給 font-family 是看不出立體效果的。
  { id: 'nabla', name: '立體霓虹', family: "'Nabla', system-ui", googleFont: 'Nabla', variationSettings: '"EDPT" 100, "EHLT" 12', copyright: '© 2022 The Nabla Project Authors' },
  { id: 'foldit', name: '灰色摺紙', family: "'Foldit', sans-serif", googleFont: 'Foldit:wght@700', copyright: '© 2021–2022 The Foldit Font Project Authors' },
  { id: 'bungee-shade', name: '彈跳陰影', family: "'Bungee Shade', sans-serif", googleFont: 'Bungee+Shade', copyright: '© 2008 The Bungee Project Authors' },
];
function getNumberFontFamily(fontId) {
  const found = NUMBER_FONTS.find(f => f.id === fontId);
  return found ? found.family : NUMBER_FONTS[0].family;
}
function getNumberFontVariation(fontId) {
  const found = NUMBER_FONTS.find(f => f.id === fontId);
  return (found && found.variationSettings) || 'normal';
}
// 「更換數字字體」清單裡這 7 款字體，經查目前都是 Google Fonts 提供、依 SIL Open Font License 1.1
// 授權的開源字體。OFL 允許字體被嵌入、隨軟體重新分發（包括商業軟體），條件是重新分發時
// 要保留原始的 copyright notice 與授權條款全文——這裡把完整條款存成常數，跟 App 一起打包，
// 不依賴 Google Fonts／SIL 官方網站永遠存在或網址不變；「查看原始來源」則另外提供外部連結供追溯。
const SIL_OFL_1_1_TEXT = `SIL OPEN FONT LICENSE
Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply to any
document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components
as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to
a new environment.

"Author" refers to any designer, engineer, programmer, technical writer
or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a
copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in
Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or in
the appropriate machine-readable metadata fields within text or binary
files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole, must
be distributed entirely under this license, and must not be distributed
under any other license. The requirement for fonts to remain under
this license does not apply to any document created using the Font
Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`;
// 事件卡片中央大數字的字級對照表：key 是數字的位數（不含慶祝用的 🎉），value 是對應字級（px）。
// 位數越多字級越小，避免長數字（例如 4、5 位數的倒數天數）在固定寬度的卡片裡被截斷或擠壓變形；
// 位數越少則放大填滿視覺重量，維持「中央超大數字」原本的份量感。超過表中列出的位數一律用最小字級。
const BIG_NUMBER_FONT_SIZES = { 1: 130, 2: 116, 3: 100, 4: 84, 5: 70 };
function getBigNumberFontSize(digitCount) {
  return BIG_NUMBER_FONT_SIZES[digitCount] || BIG_NUMBER_FONT_SIZES[5];
}
// 動態插入 <link> 載入 Google Font，同一款字體只會插入一次（用 module 層級的 Set 記錄），
// 避免每次打開「自訂」面板都重複插入 <link> 標籤
const _loadedFontLinks = new Set();
function ensureGoogleFontLoaded(googleFont) {
  if (!googleFont || _loadedFontLinks.has(googleFont) || typeof document === 'undefined') return;
  _loadedFontLinks.add(googleFont);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
  document.head.appendChild(link);
}

// ▼▼▼ 臨時測試版浮水印開關 ▼▼▼
// 之後要移除浮水印時，只需把下面這個常數改成 false，
// 或直接刪除本檔案中「TestVersionWatermark」這個元件與它在 return 裡的呼叫（<TestVersionWatermark />）即可，不影響其他功能。
const SHOW_TEST_WATERMARK = false;
const TEST_WATERMARK_TEXT = '測試版080207';
// ▲▲▲ 臨時測試版浮水印開關 ▲▲▲

// Apple 登入按鈕開關：目前先隱藏，因為網頁版 Apple 登入需要先在 Apple Developer
// 網站申請 Service ID / Team ID / Key ID / 私鑰，並填進 Firebase 的 Apple 提供方設定。
// 等這些都設定好之後，把下面這個常數改成 true 即可重新顯示 Apple 登入按鈕，不用改其他地方。
const SHOW_APPLE_LOGIN = false;

const LANGS = ['zh-TW', 'en', 'ja', 'ko'];
const LANG_NAMES = { 'zh-TW': '繁體中文', en: 'English', ja: '日本語', ko: '한국어' };
const LOCALE_MAP = { 'zh-TW': 'zh-TW', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };

// Firestore 不保證讀回資料時，物件（map）欄位的排列順序會跟寫入時完全一致，
// 直接用 JSON.stringify 比較「本機資料」跟「雲端讀回的資料」很容易因為欄位順序不同
// 而被誤判成「不一樣」，導致明明內容相同，每次重新打開 App 都跳出合併提示。
// 這裡改用「先把每個物件的 key 排序後再序列化」的穩定版比較，只看內容本身、不受欄位順序影響。
// ---- 匯出檔案內容加密（AES-256-GCM，金鑰固定寫在前端）----
// 注意：這不是「密碼保護」，使用者不需要輸入任何密碼，匯入時也完全無感。
// 這裡的加密純粹是讓匯出的 .tzzwnb 檔案內容變成看不懂的亂碼，避免被隨手用文字編輯器打開
// 就看到裡面完整的時區／行程資料。因為金鑰固定寫死在前端程式碼裡，任何看得到原始碼的人
// 理論上都能反推出金鑰、還原內容——這不是機密性等級的防護，只是防止「隨手一瞥」。
const BACKUP_FILE_MAGIC = 'TZZWNB1:'; // 檔案內容前綴，用來分辨「新版加密格式」跟「舊版明文 JSON」
const BACKUP_KEY_MATERIAL = 'timezhaoziwu-backup-v1-8f3c1a9e'; // 固定金鑰來源字串，之後要換金鑰只需改這裡

let backupCryptoKeyPromise = null;
function getBackupCryptoKey() {
  if (!backupCryptoKeyPromise) {
    backupCryptoKeyPromise = (async () => {
      const rawKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(BACKUP_KEY_MATERIAL));
      return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    })();
  }
  return backupCryptoKeyPromise;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 把備份 JSON 字串加密成檔案內容：TZZWNB1: 前綴 + base64(隨機 IV + 密文)
async function encryptBackupText(jsonText) {
  const key = await getBackupCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonText));
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return BACKUP_FILE_MAGIC + bytesToBase64(combined);
}

// 解密檔案內容還原出備份 JSON 字串；格式不對或解密失敗（例如檔案被竄改）會直接 throw
async function decryptBackupText(fileText) {
  const combined = base64ToBytes(fileText.slice(BACKUP_FILE_MAGIC.length));
  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);
  const key = await getBackupCryptoKey();
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

// 驗證並解析「本機備份 .tzzwnb」的內容是否符合預期格式，回傳 parse 好的物件；格式不對、不是加密格式、
// 解密失敗、或不是合法 JSON 一律回傳 null。目前只認新版加密格式（必須是 TZZWNB1: 開頭），不再相容
// 加密功能上線前那些明文 JSON 的舊版備份檔——beta 階段只有內部使用者，沒有相容包袱需要背。
// 這個函式同時給「匯入備份」按鈕（AuthModal 裡的 parseAndImport）與 File Handling API（作業系統「以 App 開啟」
// .tzzwnb 檔時觸發的 launchQueue consumer）共用，避免兩邊各寫一份驗證邏輯、之後改格式時容易漏改其中一處。
async function parseBackupPayload(fileText) {
  try {
    if (typeof fileText !== 'string' || !fileText.startsWith(BACKUP_FILE_MAGIC)) return null;
    const jsonText = await decryptBackupText(fileText);
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object' || (!Array.isArray(data.clocks) && !Array.isArray(data.events))) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
// 判斷目前使用者是否「很可能」位於中國大陸——這裡完全沒有後端／IP 查詢服務可用，
// 只能靠瀏覽器本身透露的兩個線索做推測，準確度有限（例如使用 VPN 就會失準），
// 但作為「登入頁面提示」這種輕量用途已經足夠：
//   1. 系統時區是 Asia/Shanghai 或 Asia/Urumqi（中國大陸僅使用這兩個時區）
//   2. 瀏覽器語言是 zh-CN（中國大陸用的簡體中文語言代碼；台港澳的中文語言代碼是 zh-TW / zh-HK 等，不會誤判）
// 只要符合其中一項就視為「大陸用戶」。
function isLikelyMainlandChinaUser() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Shanghai' || tz === 'Asia/Urumqi') return true;
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    if (langs.some(l => (l || '').toLowerCase() === 'zh-cn')) return true;
  } catch (err) {
    // 任何環境不支援 Intl／navigator 的例外情況，一律不擋，避免誤傷正常用戶
  }
  return false;
}

// 依「目前位置」時區（若未設定則退回系統時區）判斷早上／中午／晚上，回傳對應的文字 key 與 emoji
function getGreetingInfo(date, tz) {
  let hour;
  try {
    const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hour12: false }).format(date), 10);
  } catch (err) {
    hour = date.getHours();
  }
  if (hour >= 5 && hour < 9) return { key: 'greetMorning', emoji: '☀️' };
  if (hour >= 9 && hour < 12) return { key: 'greetForenoon', emoji: '🌤️' };
  if (hour >= 12 && hour < 14) return { key: 'greetAfternoon', emoji: '🌤️' };
  if (hour >= 14 && hour < 18) return { key: 'greetLateAfternoon', emoji: '🌇' };
  return { key: 'greetEvening', emoji: '🌙' };
}

/* ================= Beta 邀請碼驗證（Phase 1：純前端，小範圍內測） =================
 * 之後要接 Cloudflare Worker 時，只需要改寫 verifyInviteCode() 這一個函式的內容，
 * 讓它改成 fetch 你的 /redeem API，回傳一樣的 { ok, token } 格式即可，
 * InviteGate 元件與 window.storage 的儲存邏輯完全不用動。
 *
 * 開發者如何產生一組邀請碼：
 * 1. 自己想一個邀請碼字串，例如 "ZZW-BETA-8K2Q"
 * 2. 在瀏覽器 console 執行以下程式碼算出它的 SHA-256 雜湊值：
 *    (async()=>{const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ZZW-BETA-8K2Q'.trim().toUpperCase())); console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''))})()
 * 3. 把印出來的雜湊值貼到下面的 VALID_INVITE_HASHES 陣列裡（明碼絕對不要寫進程式碼）
 * 4. 把邀請碼本身私下給受邀的測試者
 */
const INVITE_KEY = 'beta-access-granted-v1';
const VALID_INVITE_HASHES = [
  // 'e3b0c44298fc1c14...',  // 範例：每個邀請碼的雜湊值佔一行
];

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text.trim().toUpperCase());
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 統一介面：往後換成 Cloudflare Worker 時，只改這個函式內部即可
async function verifyInviteCode(code) {
  if (!code || !code.trim()) return { ok: false };
  const hash = await sha256Hex(code);
  return { ok: VALID_INVITE_HASHES.includes(hash) };

  // ---- Phase 2（Cloudflare Worker）替換範例 ----
  // const res = await fetch('https://your-worker.example.workers.dev/redeem', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ code: code.trim() }),
  // });
  // if (!res.ok) return { ok: false };
  // const data = await res.json();
  // return { ok: !!data.ok, token: data.token };
}

const STRINGS = {
  'zh-TW': {
    todayIs: d => `今天是 ${d}`, greetMorning: '早上好', greetForenoon: '上午好', greetAfternoon: '中午好', greetLateAfternoon: '下午好', greetEvening: '晚上好',
    worldClock: '世界時鐘', addTimezone: '添加時區', back: '返回',
    allAdded: '已加入全部地區', emptyClocks: '尚未加入任何時區，點右上角「添加時區」開始吧。',
    selectedCount: n => `已選 ${n}`, cancel: '取消', delete: '刪除',
    longPressHint: '長按可多選，點一下確認刪除的時區', timeline: '時間軸', compact: '精簡', detailed: '詳細',
    currentLocation: '目前位置', setAsCurrent: '點一下設為目前位置', tapToUnset: '再點一下取消設定',
    sameAsCurrent: '與目前位置同時', diffHourSuffix: '小時',
    newLandmark: '新增地標', titleLabel: '標題', titlePlaceholder: '事件名稱，給這件事起個名字',
    dateLabel: '日期', datePlaceholder: '選擇日期', timeLabel: '時間（選填）', calendarLabel: '曆法參照',
    repeatLabel: '重複', every: '每', unitYear: '年', unitMonth: '個月',
    modeSelectLabel: '模式選擇',
    modeBirthday: '生日', modeCompanion: '陪伴', modeCare: '關懷', modeAnniversary: '紀念日', modeRegular: '常規',
    navSchedule: '日程', navGallery: '相冊', navProfile: '我的', myPageTitle: '我的', addSchedule: '添加日程', dailyFortuneLabel: '每日一籤',
    calendarMonthView: '月', calendarYearView: '年', calendarChooseDate: '選擇年份與月份',
    calendarPrev: '上一個', calendarNext: '下一個', calendarConfirmYear: '確定', calendarViewWholeYear: '檢視整年', calendarToggleCollapse: '收合／展開日曆',
    calendarCollapseLabel: '收合', calendarExpandLabel: '展開',
    futureOnlyLabel: '只展示未來待辦事件', scheduleShowAllLabel: '展示全部事件',
    viewModeYear: '年', viewModeMonth: '月', viewModeWeek: '週',
    emptyScheduleYear: '本年還沒有日程。', emptyScheduleMonth: '本月還沒有日程。', emptyScheduleWeek: '本週還沒有日程。',
    darkModeLabel: '深色模式', darkModeOn: '開', darkModeOff: '關', feedbackLabel: '意見回饋',
    modeCompanionHint: '設定情誼開始的日子，得到你們相伴的時長。',
    modeAnniversaryHint: '設定一個值得銘記的日子，讓時光線替你記錄一路點滴。',
    modeRegularHint: '不做修飾，只記錄時間。',
    repeatHint: '例如農曆生日、國定紀念日', lunarRepeatFixedHint: '此曆法目前僅支援每年重複一次',
    iconLabel: '圖示', colorLabel: '路標色', noteLabel: '備註（選填）', notePlaceholder: '想記住的一句話',
    addToTimeline: '加入時間軸', fillRequired: '請填寫標題與日期',
    emptyTimeline: '這條時間軸還沒有地標。', emptyTimelineSub: '新增一個吧，不論是生日、旅行，還是任何值得期待的一天。',
    pastLandmarks: n => `往日地標（${n}）`, youAreHere: '你在這裡',
    searchPlaceholder: '搜尋地標標題…', noSearchResults: '找不到符合的地標',
    countdown: '倒數 Countdown', countup: '正數 Countup', today: '就是今天',
    yearlyBadge: n => (n === 1 ? '每年' : `每${n}年`), monthlyBadge: n => (n === 1 ? '每月' : `每${n}個月`),
    tomorrow: '明天', yesterday: '昨天', lunarPrefix: '農曆',
    editLandmark: '編輯地標', saveChanges: '儲存修改', edit: '編輯',
    album: '相冊', newAlbumPlaceholder: '新相冊名稱', createAlbum: '建立', newAlbumBtn: '新相冊', newPhotoLabel: '新相片',
    noAlbumsYet: '尚未建立相冊，先建立一個吧', noPhotosYet: '這個相冊還沒有相片，點一下新增',
    addPhoto: '新增相片', deleteAlbum: '刪除相冊', deletePhoto: '刪除相片', confirmRename: '確認更名', moveTo: '移到',
    albumPhotoUploadError: '相片上傳失敗，請換一張再試一次', renameAlbum: '重新命名相冊', syncErrorHint: '最近一次儲存失敗，資料可能量太大，請稍後再試',
    createAlbumBtn: '＋ 建立相冊', albumFilterAll: '全部', albumFilterLinked: '事件相冊', albumFilterUnlinked: '未關聯',
    albumHomeEmpty: '尚未建立相冊，先建立第一本，保存你的回憶吧', albumPhotoCount: n => `${n} 張照片`,
    linkedEventBadge: e => `⌁ ${e}`, selectPhotosStepTitle: '選擇照片', selectPhotosHint: '從裝置圖片庫選擇一張或多張照片開始',
    selectedPhotosCount: n => `已選擇 ${n} 張照片`, nextStep: '下一步', createAlbumStepTitle: '建立相冊',
    albumNameLabel: '相冊名稱', linkEventLabel: '關聯事件', noLinkEvent: '不關聯事件', linkOptionNew: '從這裡建立新事件',
    eventPickerTitle: '選擇事件', moreActions: '更多操作', back: '返回', quickEventTitle: '建立新事件',
    deleteLandmarkConfirmTitle: '刪除這個地標？', deleteLandmarkConfirmDesc: title => `如您未進行本機備份，此動作無法復原，確定要刪除「${title}」嗎？`, confirmDeleteLandmark: '確認刪除', cancelDeleteLandmark: '取消操作',
    notifyButtonLabel: '倒數日提醒', notifyPanelTitle: '倒數日提醒設定',
    notifyEnableLabel: '啟用系統通知', notifyEnableHint: '需要保持這個網頁／App 開著（背景分頁也可以）才能收到通知',
    notifyDaysBeforeLabel: '提前幾天提醒我', notifyDaysBeforeUnit: '天',
    notifyPermissionDenied: '瀏覽器通知權限被拒絕，請到瀏覽器設定裡手動開啟後再試一次',
    notifyUnsupported: '這個瀏覽器不支援系統通知',
    notifyTitle: title => `倒數提醒：${title}`,
    notifyBody: days => `還有 ${days} 天`,
    birthdayLabel: '生日模式', birthdayHint: '以此日期為出生日，自動計算下一次的生日歲數',
    careLabel: '關懷模式', careHint: '將圖示與顏色改為素雅的紀念樣式。我們與您一同記住逝去的靈魂',
    ageBadge: n => `${n} 歲生日`, anniversaryBadge: n => `${n} 週年`, companionDays: n => `已經 ${n} 天`, cycleLabel: '循環',
    birthdayCelebrationText: '生日快樂！',
    allGoodText: '一切順利！',
    inviteTitle: 'Beta 內測邀請碼', inviteSubtitle: '這是尚未公開的測試版本，請輸入開發者提供的邀請碼。',
    invitePlaceholder: '輸入邀請碼', inviteSubmit: '進入', inviteChecking: '驗證中…',
    inviteInvalid: '邀請碼不正確，請確認後再試一次。',
    customIconLabel: '自訂圖示', customIconPlaceholder: '貼上想用的 emoji', customIconAdd: '新增',
    customIconLimit: '自訂圖示數量已達上限（30 個），請先刪除一些再新增。',
    account: '帳號', loginToSync: '登入以同步', loggedInAs: e => `已登入：${e}`,
    mainlandCnBlocked: '此功能暫不向中國大陸地區開放，請聯絡開發者。',
    backupSectionTitle: '本機備份', backupHint: '無法使用雲端同步時，可以匯出備份檔案自行保存，需要時再匯入還原。',
    backupExportBtn: '匯出備份', backupImportBtn: '匯入備份',
    backupImportSuccess: '已還原備份資料。', backupImportError: '備份檔案格式不正確，請確認檔案內容。',
    backupExportSuccess: '已成功存儲備份資料。',
    albumBackupReminder: '「本機備份」可完整保存您上傳的照片及相關數據。為降低數據遺失風險，添加照片後請及時使用「本機備份」保存，並建議另行使用可靠的雲端儲存服務進行備份。',
    addPhotoHintTitle: '新增相片前的提醒', abandonAdd: '放棄添加', gotItLabel: '我已知悉', gotItLabelCountdown: n => `我已知悉（${n}）`,
    deleteSelectedAlbumsConfirmTitle: '刪除已選取的相冊？', deleteSelectedAlbumsConfirmDesc: n => `此動作無法復原，確定要刪除已選取的 ${n} 個相冊嗎？相冊內的相片也會一併刪除。`,
    deleteSelectedPhotosConfirmTitle: '刪除已選取的相片？', deleteSelectedPhotosConfirmDesc: n => `如您未進行本機備份，此動作無法復原，確定要刪除已選取的 ${n} 張相片嗎？`,
    backupSlowdownHint: '添加照片後，備份檔案的容量可能增加，「本機備份」的匯入與匯出速度也可能因此變慢，請耐心等待。',
    email: 'Email', password: '密碼', login: '登入', signup: '註冊',
    switchToSignup: '還沒有帳號？註冊', switchToLogin: '已有帳號？登入',
    continueWithGoogle: '使用 Google 繼續', continueWithApple: '使用 Apple 繼續',
    sendMagicLink: '寄送免密碼登入連結', magicLinkSent: '登入連結已寄出，請到信箱點擊連結完成登入。',
    orDivider: '或', logout: '登出', close: '關閉', authError: '發生錯誤，請確認帳密後再試一次。',
    authTimeout: '本功能暫不支援中國大陸地區，請聯繫開發者。App 其他功能不受影響，仍可正常使用。',
    syncing: '同步中…', synced: '已同步',
    mergeTitle: '偵測到雲端已有資料', mergeDesc: '這個帳號的雲端資料和這台裝置上的資料不一樣，要怎麼處理？',
    mergeOptionMerge: '合併兩邊的資料', mergeOptionUseCloud: '以雲端資料為主（覆蓋本機）',
    mergeOptionUseLocal: '以本機資料為主（覆蓋雲端）',
    confirmPassword: '確認密碼', passwordMismatch: '兩次輸入的密碼不一致',
    showPassword: '顯示密碼', hidePassword: '隱藏密碼',
    loginMethodLabel: '登入方式', loginMethodGoogle: 'Google', loginMethodApple: 'Apple', loginMethodEmail: 'Email 密碼',
    changePassword: '修改密碼', currentPassword: '目前密碼', newPassword: '新密碼', confirmNewPassword: '確認新密碼',
    passwordChangeSuccess: '密碼已更新', saveChangesBtn: '儲存',
    deleteAccount: '註銷帳號', deleteAccountConfirmTitle: '確定要註銷帳號嗎？',
    deleteAccountConfirmDesc: '這個動作無法復原，帳號與雲端資料都會被永久刪除。', confirmDelete: '永久刪除',
    landmarkDetail: '地標詳情', originalDate: '設定日期', markerColorLabel: '路標色',
    customBgLabel: '卡片背景', customBgUpload: '上傳圖片', customBgChange: '更換圖片', customBgRemove: '移除背景',
    customBgHint: '上傳的圖片會疊在毛玻璃質感底下當背景，不會取代原本的毛玻璃效果。',
    customBgUploading: '處理圖片中…', customBgError: '圖片讀取失敗，請換一張再試一次。',
    adjustBgOpacity: '調節遮罩透明度', dragToAdjustOpacity: '滑動以調節遮罩透明度',
    customizeLabel: '自訂', customFontLabel: '數字字體', customFontComingSoon: '更多字體樣式即將推出',
    fontLicenseIntro: '以上字體均為 Google Fonts 提供的開源字體，可免費用於個人與商業用途。',
    fontLicenseAllNote: '以上字體皆依 SIL Open Font License 1.1 授權。',
    fontLicenseViewFull: '查看授權資訊',
    fontLicenseModalTitle: '第三方字體授權',
    fontLicenseSourceLabel: '原始來源',
    fontLicenseViewSource: '查看原始來源',
    fontLicenseFullTextTitle: 'SIL Open Font License 1.1 完整條款',
    daysLeft: n => `${n} 天後`, daysAgo: n => `${n} 天前`,
    exportLabel: '匯出成圖片', exportFormatCard: '卡片', exportFormatStory: '限動 (9:16)',
    exportShareButton: '匯出並分享', exportPreparing: '圖片產生中…', exportError: '匯出失敗，請再試一次。',
    accountManageLabel: '帳戶管理', accountSecurityLabel: '帳戶安全',
    myTimeLabel: '我的時光', myTimeCaption: '你在時光線裡留下的時光',
    myTimeStats: (e, a, p) => `${e} 個事件　${a} 個相冊　${p} 張照片`,
    myTimeOverviewTitle: '資料總覽', myTimeOverviewDesc: '這裡統計你目前保存在時光線裡的內容，不會顯示詳細內容。',
    myTimeOverviewEvents: '事件', myTimeOverviewAlbums: '相冊', myTimeOverviewPhotos: '照片',
    dataGroupLabel: '資料', importExportLabel: '匯入與匯出', syncDataLabel: '同步與資料',
    notSyncedStatus: '尚未同步', syncErrorStatus: '同步發生問題',
    lastSyncedJustNow: '最後同步：剛剛', lastSyncedAgo: s => `最後同步：${s}前`,
    syncMinutesAgo: n => `${n} 分鐘`, syncHoursAgo: n => `${n} 小時`, syncDaysAgo: n => `${n} 天`,
    syncLoginHint: '登入帳戶即可啟用同步，資料將安全保存在雲端。',
    prefGroupLabel: '偏好', appearanceLabel: '外觀', notifyPrefLabel: '通知', languageLabel: '語言',
    calendarPrefLabel: '日曆', calendarPrefHint: '勾選要在「日程」頁日曆點選日期後，於底部同時顯示對應日期的曆法（可複選）。地標本身要用哪種曆法計算日期，仍在新增或編輯地標時個別設定。',
    otherGroupLabel: '其他', aboutLabel: '關於時光線', privacyLabel: '隱私權政策', termsLabel: '使用條款',
    aboutBody: `## 時光線
時光線是一款專注於時間、日程與生活記憶管理的應用程式。
我們希望透過簡潔、直覺的設計，協助您記錄重要日期、管理日程、查看世界各地時間，並將值得紀念的時刻妥善保存。
讓時間不只是被計算，也值得被記住。
---
## 服務資訊
**應用程式名稱：** 時光線
**目前版本：** 1.1.0
**官方網站：** timezzw.top
**聯絡電子郵件：** support@timezzw.top
---
## 開發與營運
本服務由個人開發者負責開發及營運。
「趙子吳工作室」為本服務所使用之工作室名稱及品牌識別。
---
## 相關文件
- [使用條款](https://timezzw.top/help/ToS)
- [隱私權政策](https://timezzw.top/help/privacypolicy)
---
## 意見回饋
如果您在使用時光線的過程中遇到問題，或對功能、介面及服務有任何建議，歡迎透過意見回饋功能或電子郵件與我們聯絡。
**電子郵件：** support@timezzw.top
我們會認真閱讀每一則回饋，並持續改善時光線。
---
© 2026 時光線`,
    legalPlaceholder: '完整內容準備中，稍後將於此提供。',
    loginPromptTitle: '登入以同步你的時光',
    appearanceModeSystem: '跟隨系統', appearanceModeLight: '淺色', appearanceModeDark: '深色',
  },
  en: {
    todayIs: d => `Today is ${d}`, greetMorning: 'Good morning', greetForenoon: 'Good morning', greetAfternoon: 'Good afternoon', greetLateAfternoon: 'Good afternoon', greetEvening: 'Good evening',
    worldClock: 'World Clock', addTimezone: 'Add Timezone', back: 'Back',
    allAdded: 'All regions added', emptyClocks: 'No timezones yet — tap "Add Timezone" to start.',
    selectedCount: n => `${n} selected`, cancel: 'Cancel', delete: 'Delete',
    longPressHint: 'Long-press to multi-select, tap to confirm removal', timeline: 'Timeline', compact: 'Compact', detailed: 'Detailed',
    currentLocation: 'Current location', setAsCurrent: 'Tap to set as current location', tapToUnset: 'Tap again to unset',
    sameAsCurrent: 'Same time as current location', diffHourSuffix: 'h',
    newLandmark: 'New Landmark', titleLabel: 'Title', titlePlaceholder: 'Event name — give it a name',
    dateLabel: 'Date', datePlaceholder: 'Select a date', timeLabel: 'Time (optional)', calendarLabel: 'Calendar system',
    repeatLabel: 'Repeat', every: 'Every', unitYear: 'year(s)', unitMonth: 'month(s)',
    modeSelectLabel: 'Mode',
    modeBirthday: 'Birthday', modeCompanion: 'Companion', modeCare: 'Care', modeAnniversary: 'Anniversary', modeRegular: 'Regular',
    navSchedule: 'Schedule', navGallery: 'Albums', navProfile: 'Profile', myPageTitle: 'Profile', addSchedule: 'Add Schedule', dailyFortuneLabel: 'Daily Fortune',
    calendarMonthView: 'Month', calendarYearView: 'Year', calendarChooseDate: 'Choose year and month',
    calendarPrev: 'Previous', calendarNext: 'Next', calendarConfirmYear: 'Done', calendarViewWholeYear: 'View whole year', calendarToggleCollapse: 'Collapse/expand calendar',
    calendarCollapseLabel: 'Collapse', calendarExpandLabel: 'Expand',
    futureOnlyLabel: 'Show upcoming events only', scheduleShowAllLabel: 'Show all events',
    viewModeYear: 'Year', viewModeMonth: 'Month', viewModeWeek: 'Week',
    emptyScheduleYear: 'No events this year yet.', emptyScheduleMonth: 'No events this month yet.', emptyScheduleWeek: 'No events this week yet.',
    darkModeLabel: 'Dark Mode', darkModeOn: 'On', darkModeOff: 'Off', feedbackLabel: 'Feedback',
    modeCompanionHint: "Set the day your bond began, and see how long you've been together.",
    modeAnniversaryHint: 'Set a day worth remembering, and let TimeLine track every moment along the way.',
    modeRegularHint: 'No embellishment — just keeping track of time.',
    repeatHint: 'e.g. lunar birthday, national holiday', lunarRepeatFixedHint: 'This calendar currently supports yearly repeat only',
    iconLabel: 'Icon', colorLabel: 'Marker color', noteLabel: 'Note (optional)', notePlaceholder: 'Something worth remembering',
    addToTimeline: 'Add to Timeline', fillRequired: 'Please fill in title and date',
    emptyTimeline: 'No landmarks on this timeline yet.', emptyTimelineSub: 'Add one — a birthday, a trip, or anything worth looking forward to.',
    pastLandmarks: n => `Past landmarks (${n})`, youAreHere: 'You are here',
    searchPlaceholder: 'Search landmarks…', noSearchResults: 'No matching landmarks found',
    countdown: 'Countdown', countup: 'Countup', today: 'Today',
    yearlyBadge: n => (n === 1 ? 'Yearly' : `Every ${n} years`), monthlyBadge: n => (n === 1 ? 'Monthly' : `Every ${n} months`),
    tomorrow: 'Tomorrow', yesterday: 'Yesterday', lunarPrefix: 'Lunar',
    editLandmark: 'Edit Landmark', saveChanges: 'Save Changes', edit: 'Edit',
    album: 'Album', newAlbumPlaceholder: 'New album name', createAlbum: 'Create', newAlbumBtn: 'New Album', newPhotoLabel: 'New Photo',
    noAlbumsYet: 'No albums yet — create one to get started', noPhotosYet: 'No photos in this album yet — tap to add one',
    addPhoto: 'Add Photo', deleteAlbum: 'Delete Album', deletePhoto: 'Delete Photo', confirmRename: 'Confirm Rename', moveTo: 'Move to',
    albumPhotoUploadError: 'Could not upload that photo — please try another one', renameAlbum: 'Rename Album', syncErrorHint: 'Last save failed — the data may be too large, please try again later',
    createAlbumBtn: '+ New Album', albumFilterAll: 'All', albumFilterLinked: 'Event Albums', albumFilterUnlinked: 'Unlinked',
    albumHomeEmpty: 'No albums yet — create your first one to save your memories', albumPhotoCount: n => `${n} photo${n === 1 ? '' : 's'}`,
    linkedEventBadge: e => `⌁ ${e}`, selectPhotosStepTitle: 'Select Photos', selectPhotosHint: 'Choose one or more photos from your device library',
    selectedPhotosCount: n => `${n} photo${n === 1 ? '' : 's'} selected`, nextStep: 'Next', createAlbumStepTitle: 'Create Album',
    albumNameLabel: 'Album Name', linkEventLabel: 'Linked Event', noLinkEvent: 'No linked event', linkOptionNew: 'Create a new event',
    eventPickerTitle: 'Choose Event', moreActions: 'More', back: 'Back', quickEventTitle: 'New Event',
    deleteLandmarkConfirmTitle: 'Delete this landmark?', deleteLandmarkConfirmDesc: title => `Unless you've made a local backup, this cannot be undone. Delete "${title}"?`, confirmDeleteLandmark: 'Confirm Delete', cancelDeleteLandmark: 'Cancel',
    notifyButtonLabel: 'Countdown reminders', notifyPanelTitle: 'Countdown reminder settings',
    notifyEnableLabel: 'Enable notifications', notifyEnableHint: 'Keep this page/app open (a background tab is fine) to receive notifications',
    notifyDaysBeforeLabel: 'Remind me this many days before', notifyDaysBeforeUnit: 'days',
    notifyPermissionDenied: 'Notification permission was denied — enable it in your browser settings and try again',
    notifyUnsupported: 'This browser does not support notifications',
    notifyTitle: title => `Reminder: ${title}`,
    notifyBody: days => `${days} day${days === 1 ? '' : 's'} left`,
    birthdayLabel: 'Birthday mode', birthdayHint: "Treat this date as the birth date and auto-calculate the age turned each time",
    careLabel: 'Memorial mode', careHint: 'Switch icons and colors to a quiet, memorial style. We remember the departed with you.',
    ageBadge: n => `Turning ${n}`,
    birthdayCelebrationText: 'Happy Birthday!',
    allGoodText: 'All is well!',
    inviteTitle: 'Beta Invite Code', inviteSubtitle: 'This is an unreleased test build — please enter the invite code provided by the developer.',
    invitePlaceholder: 'Enter invite code', inviteSubmit: 'Enter', inviteChecking: 'Checking…',
    inviteInvalid: 'Invalid invite code. Please check and try again.',
    customIconLabel: 'Custom Icons', customIconPlaceholder: 'Paste an emoji', customIconAdd: 'Add',
    customIconLimit: 'You have reached the limit of 30 custom icons — remove one before adding more.',
    account: 'Account', loginToSync: 'Log in to sync', loggedInAs: e => `Logged in as ${e}`,
    mainlandCnBlocked: 'This feature is not currently available in mainland China. Please contact the developer.',
    backupSectionTitle: 'Local Backup', backupHint: "If cloud sync isn't available, you can export a backup file and import it later to restore your data.",
    backupExportBtn: 'Export Backup', backupImportBtn: 'Import Backup',
    backupImportSuccess: 'Backup restored.', backupImportError: 'Invalid backup file. Please check the file and try again.',
    backupExportSuccess: 'Backup saved successfully.',
    albumBackupReminder: '"Local Backup" fully preserves your uploaded photos and related data. To reduce the risk of data loss, please use "Local Backup" promptly after adding photos, and we also recommend backing up separately with a reliable cloud storage service.',
    addPhotoHintTitle: 'Before you add a photo', abandonAdd: 'Cancel', gotItLabel: 'Got it', gotItLabelCountdown: n => `Got it (${n})`,
    deleteSelectedAlbumsConfirmTitle: 'Delete the selected albums?', deleteSelectedAlbumsConfirmDesc: n => `This cannot be undone. Delete the ${n} selected album${n === 1 ? '' : 's'}? Photos inside will be deleted too.`,
    deleteSelectedPhotosConfirmTitle: 'Delete the selected photos?', deleteSelectedPhotosConfirmDesc: n => `Unless you've made a local backup, this cannot be undone. Delete the ${n} selected photo${n === 1 ? '' : 's'}?`,
    backupSlowdownHint: 'As you add more photos, the backup file size may grow, which can slow down "Local Backup" import and export — please be patient.',
    email: 'Email', password: 'Password', login: 'Log in', signup: 'Sign up',
    switchToSignup: "Don't have an account? Sign up", switchToLogin: 'Already have an account? Log in',
    continueWithGoogle: 'Continue with Google', continueWithApple: 'Continue with Apple',
    sendMagicLink: 'Send sign-in link', magicLinkSent: 'A sign-in link has been sent — check your email to finish logging in.',
    orDivider: 'or', logout: 'Log out', close: 'Close', authError: 'Something went wrong — please check your details and try again.',
    authTimeout: 'This feature isn\'t currently supported in mainland China — please contact the developer. Everything else in the app still works normally.',
    syncing: 'Syncing…', synced: 'Synced',
    mergeTitle: 'Cloud data found', mergeDesc: 'This account already has cloud data that differs from what is on this device. How would you like to proceed?',
    mergeOptionMerge: 'Merge both', mergeOptionUseCloud: 'Use cloud data (overwrite this device)',
    mergeOptionUseLocal: 'Use this device (overwrite cloud)',
    confirmPassword: 'Confirm password', passwordMismatch: 'Passwords do not match',
    showPassword: 'Show password', hidePassword: 'Hide password',
    loginMethodLabel: 'Sign-in method', loginMethodGoogle: 'Google', loginMethodApple: 'Apple', loginMethodEmail: 'Email & password',
    changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password', confirmNewPassword: 'Confirm new password',
    passwordChangeSuccess: 'Password updated', saveChangesBtn: 'Save',
    deleteAccount: 'Delete account', deleteAccountConfirmTitle: 'Delete your account?',
    deleteAccountConfirmDesc: 'This cannot be undone. Your account and cloud data will be permanently deleted.', confirmDelete: 'Delete permanently',
    landmarkDetail: 'Landmark Details', originalDate: 'Set date', markerColorLabel: 'Marker color',
    customBgLabel: 'Card Background', customBgUpload: 'Upload Image', customBgChange: 'Change Image', customBgRemove: 'Remove Background',
    customBgHint: 'The uploaded photo sits behind the frosted-glass look as a backdrop — it does not replace the frosted effect.',
    customBgUploading: 'Processing image…', customBgError: 'Could not read that image. Please try another one.',
    adjustBgOpacity: 'Adjust overlay opacity', dragToAdjustOpacity: 'Slide to adjust overlay opacity',
    customizeLabel: 'Customize', customFontLabel: 'Number Font', customFontComingSoon: 'More font styles coming soon',
    fontLicenseIntro: 'These fonts are open-source fonts from Google Fonts, free to use for personal and commercial purposes.',
    fontLicenseAllNote: 'All fonts above are licensed under the SIL Open Font License 1.1.',
    fontLicenseViewFull: 'View license info',
    fontLicenseModalTitle: 'Third-Party Font Licenses',
    fontLicenseSourceLabel: 'Source',
    fontLicenseViewSource: 'View original source',
    fontLicenseFullTextTitle: 'Full text of the SIL Open Font License 1.1',
    daysLeft: n => `${n} Days Left`, daysAgo: n => `${n} Days Ago`, anniversaryBadge: n => `${n} Anniversary`, companionDays: n => `${n} days together`, cycleLabel: 'Repeat',
    exportLabel: 'Export as image', exportFormatCard: 'Card', exportFormatStory: 'Story (9:16)',
    exportShareButton: 'Export & Share', exportPreparing: 'Preparing image…', exportError: 'Export failed — please try again.',
    accountManageLabel: 'Account Management', accountSecurityLabel: 'Account Security',
    myTimeLabel: 'My Moments', myTimeCaption: 'What you have kept in 時光線',
    myTimeStats: (e, a, p) => `${e} events · ${a} albums · ${p} photos`,
    myTimeOverviewTitle: 'Overview', myTimeOverviewDesc: 'A quick summary of what you currently keep in 時光線 — no details shown here.',
    myTimeOverviewEvents: 'Events', myTimeOverviewAlbums: 'Albums', myTimeOverviewPhotos: 'Photos',
    dataGroupLabel: 'Data', importExportLabel: 'Import & Export', syncDataLabel: 'Sync & Data',
    notSyncedStatus: 'Not synced', syncErrorStatus: 'Sync issue',
    lastSyncedJustNow: 'Last synced: just now', lastSyncedAgo: s => `Last synced: ${s} ago`,
    syncMinutesAgo: n => `${n} min`, syncHoursAgo: n => `${n} hr`, syncDaysAgo: n => `${n} d`,
    syncLoginHint: 'Sign in to enable sync and keep your data safe in the cloud.',
    prefGroupLabel: 'Preferences', appearanceLabel: 'Appearance', notifyPrefLabel: 'Notifications', languageLabel: 'Language',
    calendarPrefLabel: 'Calendar', calendarPrefHint: 'Pick the calendar systems to show below the selected date on the Schedule tab (multiple allowed). Which calendar a landmark itself uses is still set individually when adding or editing it.',
    otherGroupLabel: 'More', aboutLabel: 'About 時光線', privacyLabel: 'Privacy Policy', termsLabel: 'Terms of Use',
    aboutBody: `## 時光線
時光線 is an app focused on managing your time, schedule, and life's memories.
Through a simple, intuitive design, we hope to help you record important dates, manage your schedule, check time zones around the world, and safely keep the moments worth remembering.
Time deserves to be remembered, not just counted.
---
## Service Information
**App Name:** 時光線
**Current Version:** 1.1.0
**Official Website:** timezzw.top
**Contact Email:** support@timezzw.top
---
## Development & Operations
This service is developed and operated by an independent developer.
"Zhao Ziwu Studio" is the studio name and brand identity used for this service.
---
## Related Documents
- [Terms of Use](https://timezzw.top/help/ToS)
- [Privacy Policy](https://timezzw.top/help/privacypolicy)
---
## Feedback
If you run into any issues while using 時光線, or have suggestions about its features, interface, or service, feel free to reach out through the feedback feature or by email.
**Email:** support@timezzw.top
We read every piece of feedback carefully and keep improving 時光線.
---
© 2026 時光線`,
    legalPlaceholder: 'Full content coming soon.',
    loginPromptTitle: 'Sign in to sync your moments',
    appearanceModeSystem: 'System', appearanceModeLight: 'Light', appearanceModeDark: 'Dark',
  },
  ja: {
    todayIs: d => `今日は ${d}`, greetMorning: 'おはようございます', greetForenoon: 'おはようございます', greetAfternoon: 'こんにちは', greetLateAfternoon: 'こんにちは', greetEvening: 'こんばんは',
    worldClock: '世界時計', addTimezone: 'タイムゾーンを追加', back: '戻る',
    allAdded: 'すべての地域を追加済み', emptyClocks: 'タイムゾーンがありません。右上の「タイムゾーンを追加」から始めましょう。',
    selectedCount: n => `${n}件選択`, cancel: 'キャンセル', delete: '削除',
    longPressHint: '長押しで複数選択、タップで削除を確定', timeline: 'タイムライン', compact: 'シンプル', detailed: '詳細',
    currentLocation: '現在地', setAsCurrent: 'タップして現在地に設定', tapToUnset: 'もう一度タップで解除',
    sameAsCurrent: '現在地と同じ時刻', diffHourSuffix: '時間',
    newLandmark: '新しいランドマーク', titleLabel: 'タイトル', titlePlaceholder: 'イベント名を入力してください',
    dateLabel: '日付', datePlaceholder: '日付を選択', timeLabel: '時刻（任意）', calendarLabel: '暦法',
    repeatLabel: '繰り返し', every: '毎', unitYear: '年', unitMonth: 'ヶ月',
    modeSelectLabel: 'モード選択',
    modeBirthday: '誕生日', modeCompanion: '寄り添い', modeCare: '追悼', modeAnniversary: '記念日', modeRegular: '通常',
    navSchedule: 'スケジュール', navGallery: 'アルバム', navProfile: 'マイページ', myPageTitle: 'マイページ', addSchedule: '予定を追加', dailyFortuneLabel: '今日のおみくじ',
    calendarMonthView: '月', calendarYearView: '年', calendarChooseDate: '年月を選択',
    calendarPrev: '前へ', calendarNext: '次へ', calendarConfirmYear: '決定', calendarViewWholeYear: '年間表示', calendarToggleCollapse: 'カレンダーを折りたたむ／展開',
    calendarCollapseLabel: '折りたたむ', calendarExpandLabel: '展開',
    futureOnlyLabel: '今後の予定のみ表示', scheduleShowAllLabel: '全ての予定を表示',
    viewModeYear: '年', viewModeMonth: '月', viewModeWeek: '週',
    emptyScheduleYear: '今年の予定はまだありません。', emptyScheduleMonth: '今月の予定はまだありません。', emptyScheduleWeek: '今週の予定はまだありません。',
    darkModeLabel: 'ダークモード', darkModeOn: 'オン', darkModeOff: 'オフ', feedbackLabel: 'フィードバック',
    modeCompanionHint: '絆が始まった日を設定して、二人が共に過ごした時間を確認しましょう。',
    modeAnniversaryHint: '心に刻みたい日を設定すれば、時間軸がここまでの歩みをそっと記録します。',
    modeRegularHint: '飾らず、ただ時間だけを記録します。',
    repeatHint: '例：旧暦の誕生日、記念日', lunarRepeatFixedHint: 'この暦は現在、年1回の繰り返しのみ対応しています',
    iconLabel: 'アイコン', colorLabel: 'マーカーカラー', noteLabel: 'メモ（任意）', notePlaceholder: '覚えておきたい一言',
    addToTimeline: 'タイムラインに追加', fillRequired: 'タイトルと日付を入力してください',
    emptyTimeline: 'まだランドマークがありません。', emptyTimelineSub: '誕生日、旅行など、楽しみな日を追加しましょう。',
    pastLandmarks: n => `過去のランドマーク（${n}）`, youAreHere: '現在地',
    searchPlaceholder: 'ランドマークを検索…', noSearchResults: '一致するランドマークが見つかりません',
    countdown: 'カウントダウン', countup: '経過日数', today: '今日',
    yearlyBadge: n => (n === 1 ? '毎年' : `${n}年ごと`), monthlyBadge: n => (n === 1 ? '毎月' : `${n}ヶ月ごと`),
    tomorrow: '明日', yesterday: '昨日', lunarPrefix: '旧暦',
    editLandmark: 'ランドマークを編集', saveChanges: '変更を保存', edit: '編集',
    album: 'アルバム', newAlbumPlaceholder: '新しいアルバム名', createAlbum: '作成', newAlbumBtn: '新規アルバム', newPhotoLabel: '新しい写真',
    noAlbumsYet: 'まだアルバムがありません。作成してみましょう', noPhotosYet: 'このアルバムにはまだ写真がありません。タップして追加',
    addPhoto: '写真を追加', deleteAlbum: 'アルバムを削除', deletePhoto: '写真を削除', confirmRename: '名前の変更を確定', moveTo: '移動先',
    albumPhotoUploadError: '写真のアップロードに失敗しました。別の写真で試してください', renameAlbum: 'アルバム名を変更', syncErrorHint: '直近の保存に失敗しました。データが大きすぎる可能性があります。後でもう一度お試しください',
    createAlbumBtn: '+ アルバムを作成', albumFilterAll: 'すべて', albumFilterLinked: 'イベント', albumFilterUnlinked: '未リンク',
    albumHomeEmpty: 'まだアルバムがありません。最初の1冊を作って思い出を残しましょう', albumPhotoCount: n => `${n}枚の写真`,
    linkedEventBadge: e => `⌁ ${e}`, selectPhotosStepTitle: '写真を選択', selectPhotosHint: 'デバイスのライブラリから写真を1枚以上選んでください',
    selectedPhotosCount: n => `${n}枚選択済み`, nextStep: '次へ', createAlbumStepTitle: 'アルバムを作成',
    albumNameLabel: 'アルバム名', linkEventLabel: '関連イベント', noLinkEvent: 'イベントなし', linkOptionNew: '新しいイベントを作成',
    eventPickerTitle: 'イベントを選択', moreActions: 'その他の操作', back: '戻る', quickEventTitle: '新しいイベント',
    deleteLandmarkConfirmTitle: 'このランドマークを削除しますか？', deleteLandmarkConfirmDesc: title => `ローカルバックアップを取っていない場合、この操作は取り消せません。「${title}」を削除しますか？`, confirmDeleteLandmark: '削除を確認', cancelDeleteLandmark: 'キャンセル',
    notifyButtonLabel: 'カウントダウン通知', notifyPanelTitle: 'カウントダウン通知の設定',
    notifyEnableLabel: '通知を有効にする', notifyEnableHint: '通知を受け取るには、このページ／アプリを開いたままにしてください（バックグラウンドタブでも構いません）',
    notifyDaysBeforeLabel: '何日前に通知するか', notifyDaysBeforeUnit: '日',
    notifyPermissionDenied: '通知の権限が拒否されています。ブラウザの設定で許可してからもう一度お試しください',
    notifyUnsupported: 'このブラウザは通知に対応していません',
    notifyTitle: title => `カウントダウン通知：${title}`,
    notifyBody: days => `あと${days}日`,
    birthdayLabel: '誕生日モード', birthdayHint: 'この日付を誕生日として、次に迎える歳を自動計算します',
    careLabel: '追悼モード', careHint: 'アイコンと色を落ち着いた追悼スタイルに切り替えます。旅立った魂を共に偲びます',
    ageBadge: n => `${n}歳の誕生日`,
    birthdayCelebrationText: 'お誕生日おめでとう！',
    allGoodText: '順調です！',
    inviteTitle: 'ベータ招待コード', inviteSubtitle: 'これは未公開のテスト版です。開発者から受け取った招待コードを入力してください。',
    invitePlaceholder: '招待コードを入力', inviteSubmit: '入る', inviteChecking: '確認中…',
    inviteInvalid: '招待コードが正しくありません。確認してもう一度お試しください。',
    customIconLabel: 'カスタムアイコン', customIconPlaceholder: '使いたい絵文字を貼り付け', customIconAdd: '追加',
    customIconLimit: 'カスタムアイコンは30個まで登録できます。追加する前に不要なものを削除してください。',
    account: 'アカウント', loginToSync: 'ログインして同期', loggedInAs: e => `ログイン中：${e}`,
    mainlandCnBlocked: 'この機能は現在、中国本土ではご利用いただけません。開発者までご連絡ください。',
    backupSectionTitle: 'ローカルバックアップ', backupHint: 'クラウド同期が使えない場合は、バックアップファイルを書き出して保存し、必要なときに読み込んで復元できます。',
    backupExportBtn: 'バックアップを書き出す', backupImportBtn: 'バックアップを読み込む',
    backupImportSuccess: 'バックアップを復元しました。', backupImportError: 'バックアップファイルの形式が正しくありません。内容をご確認ください。',
    backupExportSuccess: 'バックアップデータを保存しました。',
    albumBackupReminder: '「ローカルバックアップ」を使うと、アップロードした写真と関連データをまとめて保存できます。データ消失のリスクを減らすため、写真を追加したら早めに「ローカルバックアップ」で保存し、あわせて信頼できるクラウドストレージサービスでも別途バックアップすることをおすすめします。',
    addPhotoHintTitle: '写真を追加する前に', abandonAdd: '追加をやめる', gotItLabel: '理解しました', gotItLabelCountdown: n => `理解しました（${n}）`,
    deleteSelectedAlbumsConfirmTitle: '選択したアルバムを削除しますか？', deleteSelectedAlbumsConfirmDesc: n => `この操作は取り消せません。選択した${n}件のアルバムを削除しますか？アルバム内の写真も一緒に削除されます。`,
    deleteSelectedPhotosConfirmTitle: '選択した写真を削除しますか？', deleteSelectedPhotosConfirmDesc: n => `ローカルバックアップを取っていない場合、この操作は取り消せません。選択した${n}枚の写真を削除しますか？`,
    backupSlowdownHint: '写真を追加するとバックアップファイルの容量が大きくなることがあり、「ローカルバックアップ」の書き出し・読み込みが遅くなる場合があります。しばらくお待ちください。',
    email: 'メールアドレス', password: 'パスワード', login: 'ログイン', signup: '新規登録',
    switchToSignup: 'アカウントをお持ちでない方は新規登録', switchToLogin: 'アカウントをお持ちの方はログイン',
    continueWithGoogle: 'Google で続ける', continueWithApple: 'Apple で続ける',
    sendMagicLink: 'ログインリンクを送信', magicLinkSent: 'ログインリンクを送信しました。メールを確認してリンクをクリックしてください。',
    orDivider: 'または', logout: 'ログアウト', close: '閉じる', authError: 'エラーが発生しました。入力内容を確認してもう一度お試しください。',
    authTimeout: 'この機能は現在、中国本土ではご利用いただけません。開発者までお問い合わせください。他の機能は引き続き通常どおり利用できます。',
    syncing: '同期中…', synced: '同期済み',
    mergeTitle: 'クラウドに既存データがあります', mergeDesc: 'このアカウントのクラウドデータが、この端末のデータと異なります。どうしますか？',
    mergeOptionMerge: '両方をマージ', mergeOptionUseCloud: 'クラウドデータを優先（この端末を上書き）',
    mergeOptionUseLocal: 'この端末のデータを優先（クラウドを上書き）',
    confirmPassword: 'パスワード（確認）', passwordMismatch: 'パスワードが一致しません',
    showPassword: 'パスワードを表示', hidePassword: 'パスワードを隠す',
    loginMethodLabel: 'ログイン方法', loginMethodGoogle: 'Google', loginMethodApple: 'Apple', loginMethodEmail: 'メール/パスワード',
    changePassword: 'パスワードを変更', currentPassword: '現在のパスワード', newPassword: '新しいパスワード', confirmNewPassword: '新しいパスワード（確認）',
    passwordChangeSuccess: 'パスワードを更新しました', saveChangesBtn: '保存',
    deleteAccount: 'アカウントを削除', deleteAccountConfirmTitle: 'アカウントを削除しますか？',
    deleteAccountConfirmDesc: 'この操作は取り消せません。アカウントとクラウドデータは完全に削除されます。', confirmDelete: '完全に削除',
    landmarkDetail: 'ランドマークの詳細', originalDate: '設定した日付', markerColorLabel: 'マーカーカラー',
    customBgLabel: 'カード背景', customBgUpload: '画像をアップロード', customBgChange: '画像を変更', customBgRemove: '背景を削除',
    customBgHint: 'アップロードした画像はすりガラス風の質感の下に背景として重なるだけで、元の質感を置き換えるものではありません。',
    customBgUploading: '画像を処理中…', customBgError: '画像を読み込めませんでした。別の画像でもう一度お試しください。',
    adjustBgOpacity: 'オーバーレイの透明度を調整', dragToAdjustOpacity: 'スライドしてオーバーレイの透明度を調整',
    customizeLabel: 'カスタマイズ', customFontLabel: '数字のフォント', customFontComingSoon: 'より多くのフォントは近日公開予定',
    fontLicenseIntro: 'これらのフォントはGoogle Fontsが提供するオープンソースフォントで、個人利用・商用利用ともに無料でご利用いただけます。',
    fontLicenseAllNote: '上記のフォントはすべて SIL Open Font License 1.1 のもとで提供されています。',
    fontLicenseViewFull: 'ライセンス情報を見る',
    fontLicenseModalTitle: 'サードパーティフォントのライセンス',
    fontLicenseSourceLabel: '提供元',
    fontLicenseViewSource: '元のソースを見る',
    fontLicenseFullTextTitle: 'SIL Open Font License 1.1 全文',
    daysLeft: n => `あと${n}日`, daysAgo: n => `${n}日前`, anniversaryBadge: n => `${n}周年`, companionDays: n => `${n}日間`, cycleLabel: '繰り返し',
    exportLabel: '画像として書き出す', exportFormatCard: 'カード', exportFormatStory: 'ストーリー (9:16)',
    exportShareButton: '書き出して共有', exportPreparing: '画像を作成中…', exportError: '書き出しに失敗しました。もう一度お試しください。',
    accountManageLabel: 'アカウント管理', accountSecurityLabel: 'アカウントセキュリティ',
    myTimeLabel: '私の時間', myTimeCaption: '時光線に残してきた時間',
    myTimeStats: (e, a, p) => `${e} 件のイベント　${a} 件のアルバム　${p} 枚の写真`,
    myTimeOverviewTitle: 'データ概要', myTimeOverviewDesc: '現在時光線に保存している内容の概要です。詳細は表示されません。',
    myTimeOverviewEvents: 'イベント', myTimeOverviewAlbums: 'アルバム', myTimeOverviewPhotos: '写真',
    dataGroupLabel: 'データ', importExportLabel: 'インポートとエクスポート', syncDataLabel: '同期とデータ',
    notSyncedStatus: '未同期', syncErrorStatus: '同期に問題があります',
    lastSyncedJustNow: '最終同期：たった今', lastSyncedAgo: s => `最終同期：${s}前`,
    syncMinutesAgo: n => `${n}分`, syncHoursAgo: n => `${n}時間`, syncDaysAgo: n => `${n}日`,
    syncLoginHint: 'サインインすると同期が有効になり、データが安全にクラウドへ保存されます。',
    prefGroupLabel: '設定', appearanceLabel: '外観', notifyPrefLabel: '通知', languageLabel: '言語',
    calendarPrefLabel: 'カレンダー', calendarPrefHint: '「スケジュール」タブで日付を選んだときに、下部に併記する暦法を選んでください（複数選択可）。ランドマーク自体の暦法は、追加・編集時に個別に設定します。',
    otherGroupLabel: 'その他', aboutLabel: 'アプリについて', privacyLabel: 'プライバシーポリシー', termsLabel: '利用規約',
    aboutBody: `## 時光線
時光線は、時間・スケジュール・生活の記憶を管理することに特化したアプリです。
シンプルで直感的なデザインを通じて、大切な日付の記録、スケジュール管理、世界各地の時刻の確認、そして記念すべき瞬間をしっかり残すお手伝いをしたいと考えています。
時間はただ計測されるだけでなく、記憶に残る価値があるものだと考えています。
---
## サービス情報
**アプリ名：** 時光線
**現在のバージョン：** 1.1.0
**公式サイト：** timezzw.top
**お問い合わせメール：** support@timezzw.top
---
## 開発・運営
本サービスは個人開発者が開発・運営を行っています。
「趙子吳工作室（Zhao Ziwu Studio）」は本サービスで使用しているスタジオ名およびブランド名です。
---
## 関連文書
- [利用規約](https://timezzw.top/help/ToS)
- [プライバシーポリシー](https://timezzw.top/help/privacypolicy)
---
## フィードバック
時光線をご利用の際に問題が発生した場合、または機能・インターフェース・サービスについてご意見がございましたら、フィードバック機能またはメールにてお気軽にご連絡ください。
**メール：** support@timezzw.top
いただいたフィードバックは一つひとつ丁寧に確認し、時光線の改善に役立てていきます。
---
© 2026 時光線`,
    legalPlaceholder: '詳細な内容は準備中です。近日中に掲載予定です。',
    loginPromptTitle: 'サインインして時間を同期',
    appearanceModeSystem: 'システムに従う', appearanceModeLight: 'ライト', appearanceModeDark: 'ダーク',
  },
  ko: {
    todayIs: d => `오늘은 ${d}`, greetMorning: '좋은 아침이에요', greetForenoon: '좋은 아침이에요', greetAfternoon: '좋은 오후예요', greetLateAfternoon: '좋은 오후예요', greetEvening: '좋은 저녁이에요',
    worldClock: '세계 시계', addTimezone: '시간대 추가', back: '뒤로',
    allAdded: '모든 지역이 추가되었습니다', emptyClocks: '아직 추가된 시간대가 없습니다. 오른쪽 위 "시간대 추가"를 눌러보세요.',
    selectedCount: n => `${n}개 선택됨`, cancel: '취소', delete: '삭제',
    longPressHint: '길게 눌러 여러 개 선택, 탭하여 삭제 확정', timeline: '타임라인', compact: '간단히', detailed: '자세히',
    currentLocation: '현재 위치', setAsCurrent: '탭하여 현재 위치로 설정', tapToUnset: '다시 탭하면 해제',
    sameAsCurrent: '현재 위치와 같은 시간', diffHourSuffix: '시간',
    newLandmark: '새 랜드마크', titleLabel: '제목', titlePlaceholder: '이벤트 이름을 지어 주세요',
    dateLabel: '날짜', datePlaceholder: '날짜 선택', timeLabel: '시간(선택)', calendarLabel: '달력 체계',
    repeatLabel: '반복', every: '매', unitYear: '년', unitMonth: '개월',
    modeSelectLabel: '모드 선택',
    modeBirthday: '생일', modeCompanion: '동반', modeCare: '추모', modeAnniversary: '기념일', modeRegular: '일반',
    navSchedule: '일정', navGallery: '앨범', navProfile: '마이페이지', myPageTitle: '마이페이지', addSchedule: '일정 추가', dailyFortuneLabel: '오늘의 운세',
    calendarMonthView: '월', calendarYearView: '년', calendarChooseDate: '연도와 월 선택',
    calendarPrev: '이전', calendarNext: '다음', calendarConfirmYear: '확인', calendarViewWholeYear: '연간 보기', calendarToggleCollapse: '캘린더 접기/펼치기',
    calendarCollapseLabel: '접기', calendarExpandLabel: '펼치기',
    futureOnlyLabel: '앞으로의 일정만 표시', scheduleShowAllLabel: '전체 일정 표시',
    viewModeYear: '년', viewModeMonth: '월', viewModeWeek: '주',
    emptyScheduleYear: '올해 일정이 아직 없습니다.', emptyScheduleMonth: '이번 달 일정이 아직 없습니다.', emptyScheduleWeek: '이번 주 일정이 아직 없습니다.',
    darkModeLabel: '다크 모드', darkModeOn: '켜짐', darkModeOff: '꺼짐', feedbackLabel: '피드백',
    modeCompanionHint: '인연이 시작된 날을 설정하고 함께한 시간을 확인해 보세요.',
    modeAnniversaryHint: '기억하고 싶은 날을 설정하면 타임라인이 그동안의 발자취를 기록해 줍니다.',
    modeRegularHint: '꾸밈없이 시간만 기록합니다.',
    repeatHint: '예: 음력 생일, 국경일', lunarRepeatFixedHint: '이 달력은 현재 연 1회 반복만 지원합니다',
    iconLabel: '아이콘', colorLabel: '마커 색상', noteLabel: '메모(선택)', notePlaceholder: '기억하고 싶은 한마디',
    addToTimeline: '타임라인에 추가', fillRequired: '제목과 날짜를 입력해 주세요',
    emptyTimeline: '아직 타임라인에 랜드마크가 없습니다.', emptyTimelineSub: '생일, 여행 등 기대되는 날을 추가해 보세요.',
    pastLandmarks: n => `지난 랜드마크 (${n})`, youAreHere: '현재 위치',
    searchPlaceholder: '랜드마크 검색…', noSearchResults: '일치하는 랜드마크가 없습니다',
    countdown: '카운트다운', countup: '경과일', today: '오늘',
    yearlyBadge: n => (n === 1 ? '매년' : `${n}년마다`), monthlyBadge: n => (n === 1 ? '매월' : `${n}개월마다`),
    tomorrow: '내일', yesterday: '어제', lunarPrefix: '음력',
    editLandmark: '랜드마크 편집', saveChanges: '변경 사항 저장', edit: '편집',
    album: '앨범', newAlbumPlaceholder: '새 앨범 이름', createAlbum: '만들기', newAlbumBtn: '새 앨범', newPhotoLabel: '새 사진',
    noAlbumsYet: '아직 앨범이 없어요. 먼저 하나 만들어 보세요', noPhotosYet: '이 앨범에는 아직 사진이 없어요. 눌러서 추가하세요',
    addPhoto: '사진 추가', deleteAlbum: '앨범 삭제', deletePhoto: '사진 삭제', confirmRename: '이름 변경 확인', moveTo: '이동',
    albumPhotoUploadError: '사진을 업로드하지 못했어요. 다른 사진으로 다시 시도해 주세요', renameAlbum: '앨범 이름 변경', syncErrorHint: '최근 저장에 실패했어요. 데이터가 너무 클 수 있어요. 나중에 다시 시도해 주세요',
    createAlbumBtn: '+ 앨범 만들기', albumFilterAll: '전체', albumFilterLinked: '이벤트 앨범', albumFilterUnlinked: '미연결',
    albumHomeEmpty: '아직 앨범이 없어요. 첫 앨범을 만들어 추억을 저장해 보세요', albumPhotoCount: n => `사진 ${n}장`,
    linkedEventBadge: e => `⌁ ${e}`, selectPhotosStepTitle: '사진 선택', selectPhotosHint: '기기 보관함에서 사진을 한 장 이상 선택하세요',
    selectedPhotosCount: n => `${n}장 선택됨`, nextStep: '다음', createAlbumStepTitle: '앨범 만들기',
    albumNameLabel: '앨범 이름', linkEventLabel: '연결된 이벤트', noLinkEvent: '연결된 이벤트 없음', linkOptionNew: '새 이벤트 만들기',
    eventPickerTitle: '이벤트 선택', moreActions: '더 보기', back: '뒤로', quickEventTitle: '새 이벤트',
    deleteLandmarkConfirmTitle: '이 랜드마크를 삭제할까요?', deleteLandmarkConfirmDesc: title => `로컬 백업을 하지 않았다면 이 작업은 되돌릴 수 없습니다. "${title}"을(를) 삭제하시겠습니까?`, confirmDeleteLandmark: '삭제 확인', cancelDeleteLandmark: '취소',
    notifyButtonLabel: '카운트다운 알림', notifyPanelTitle: '카운트다운 알림 설정',
    notifyEnableLabel: '알림 사용', notifyEnableHint: '알림을 받으려면 이 페이지/앱을 열어 두어야 합니다（백그라운드 탭도 괜찮습니다）',
    notifyDaysBeforeLabel: '며칠 전에 알려줄까요', notifyDaysBeforeUnit: '일',
    notifyPermissionDenied: '알림 권한이 거부되었습니다. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요',
    notifyUnsupported: '이 브라우저는 알림을 지원하지 않습니다',
    notifyTitle: title => `카운트다운 알림: ${title}`,
    notifyBody: days => `${days}일 남음`,
    birthdayLabel: '생일 모드', birthdayHint: '이 날짜를 생일로 지정해 다음 생일 나이를 자동 계산합니다',
    careLabel: '추모 모드', careHint: '아이콘과 색상을 차분한 추모 스타일로 바꿉니다. 떠난 영혼을 함께 기억합니다',
    ageBadge: n => `${n}세 생일`,
    birthdayCelebrationText: '생일 축하해요!',
    allGoodText: '모두 순조로워요!',
    inviteTitle: '베타 초대 코드', inviteSubtitle: '아직 공개되지 않은 테스트 버전입니다. 개발자가 제공한 초대 코드를 입력해 주세요.',
    invitePlaceholder: '초대 코드 입력', inviteSubmit: '입장', inviteChecking: '확인 중…',
    inviteInvalid: '초대 코드가 올바르지 않습니다. 확인 후 다시 시도해 주세요.',
    customIconLabel: '커스텀 아이콘', customIconPlaceholder: '사용하고 싶은 이모지 붙여넣기', customIconAdd: '추가',
    customIconLimit: '커스텀 아이콘은 최대 30개까지 등록할 수 있습니다. 추가하기 전에 일부를 삭제해 주세요.',
    account: '계정', loginToSync: '로그인하여 동기화', loggedInAs: e => `로그인됨: ${e}`,
    mainlandCnBlocked: '이 기능은 현재 중국 본토에서 이용하실 수 없습니다. 개발자에게 문의해 주세요.',
    backupSectionTitle: '로컬 백업', backupHint: '클라우드 동기화를 사용할 수 없는 경우, 백업 파일을 내보내 보관했다가 필요할 때 가져와서 복원할 수 있습니다.',
    backupExportBtn: '백업 내보내기', backupImportBtn: '백업 가져오기',
    backupImportSuccess: '백업을 복원했습니다.', backupImportError: '백업 파일 형식이 올바르지 않습니다. 파일 내용을 확인해 주세요.',
    backupExportSuccess: '백업 데이터를 저장했습니다.',
    albumBackupReminder: '"로컬 백업"을 사용하면 업로드한 사진과 관련 데이터를 온전히 저장할 수 있습니다. 데이터 손실 위험을 줄이려면 사진을 추가한 후 바로 "로컬 백업"으로 저장하고, 신뢰할 수 있는 클라우드 저장 서비스로도 별도로 백업하는 것을 권장합니다.',
    addPhotoHintTitle: '사진을 추가하기 전에', abandonAdd: '추가 취소', gotItLabel: '확인했어요', gotItLabelCountdown: n => `확인했어요（${n}）`,
    deleteSelectedAlbumsConfirmTitle: '선택한 앨범을 삭제할까요?', deleteSelectedAlbumsConfirmDesc: n => `이 작업은 되돌릴 수 없습니다. 선택한 앨범 ${n}개를 삭제하시겠습니까? 앨범 속 사진도 함께 삭제됩니다.`,
    deleteSelectedPhotosConfirmTitle: '선택한 사진을 삭제할까요?', deleteSelectedPhotosConfirmDesc: n => `로컬 백업을 하지 않았다면 이 작업은 되돌릴 수 없습니다. 선택한 사진 ${n}장을 삭제하시겠습니까?`,
    backupSlowdownHint: '사진을 추가하면 백업 파일 용량이 커질 수 있어 "로컬 백업"의 가져오기/내보내기 속도가 느려질 수 있습니다. 잠시만 기다려 주세요.',
    email: '이메일', password: '비밀번호', login: '로그인', signup: '회원가입',
    switchToSignup: '계정이 없으신가요? 회원가입', switchToLogin: '이미 계정이 있으신가요? 로그인',
    continueWithGoogle: 'Google로 계속하기', continueWithApple: 'Apple로 계속하기',
    sendMagicLink: '로그인 링크 보내기', magicLinkSent: '로그인 링크를 보냈습니다. 이메일에서 링크를 눌러 로그인을 완료하세요.',
    orDivider: '또는', logout: '로그아웃', close: '닫기', authError: '오류가 발생했습니다. 입력 정보를 확인한 뒤 다시 시도해 주세요.',
    authTimeout: '이 기능은 현재 중국 본토에서 지원되지 않습니다. 개발자에게 문의해 주세요. 다른 기능은 정상적으로 계속 사용할 수 있습니다.',
    syncing: '동기화 중…', synced: '동기화됨',
    mergeTitle: '클라우드에 기존 데이터가 있습니다', mergeDesc: '이 계정의 클라우드 데이터가 이 기기의 데이터와 다릅니다. 어떻게 처리할까요?',
    mergeOptionMerge: '양쪽 데이터 합치기', mergeOptionUseCloud: '클라우드 데이터 사용(이 기기 덮어쓰기)',
    mergeOptionUseLocal: '이 기기 데이터 사용(클라우드 덮어쓰기)',
    confirmPassword: '비밀번호 확인', passwordMismatch: '비밀번호가 일치하지 않습니다',
    showPassword: '비밀번호 표시', hidePassword: '비밀번호 숨기기',
    loginMethodLabel: '로그인 방법', loginMethodGoogle: 'Google', loginMethodApple: 'Apple', loginMethodEmail: '이메일/비밀번호',
    changePassword: '비밀번호 변경', currentPassword: '현재 비밀번호', newPassword: '새 비밀번호', confirmNewPassword: '새 비밀번호 확인',
    passwordChangeSuccess: '비밀번호가 변경되었습니다', saveChangesBtn: '저장',
    deleteAccount: '계정 삭제', deleteAccountConfirmTitle: '계정을 삭제하시겠습니까?',
    deleteAccountConfirmDesc: '이 작업은 되돌릴 수 없습니다. 계정과 클라우드 데이터가 영구적으로 삭제됩니다.', confirmDelete: '영구 삭제',
    landmarkDetail: '랜드마크 상세정보', originalDate: '설정한 날짜', markerColorLabel: '마커 색상',
    customBgLabel: '카드 배경', customBgUpload: '이미지 업로드', customBgChange: '이미지 변경', customBgRemove: '배경 제거',
    customBgHint: '업로드한 이미지는 유리 질감 아래에 배경으로 깔릴 뿐, 원래의 유리 질감을 대체하지 않습니다.',
    customBgUploading: '이미지 처리 중…', customBgError: '이미지를 불러오지 못했습니다. 다른 이미지로 다시 시도해 주세요.',
    adjustBgOpacity: '오버레이 투명도 조절', dragToAdjustOpacity: '밀어서 오버레이 투명도 조절',
    customizeLabel: '커스터마이즈', customFontLabel: '숫자 폰트', customFontComingSoon: '더 많은 폰트 스타일이 곧 제공됩니다',
    fontLicenseIntro: '위 폰트는 Google Fonts에서 제공하는 오픈소스 폰트로, 개인 및 상업적 용도로 무료로 사용할 수 있습니다.',
    fontLicenseAllNote: '위의 모든 폰트는 SIL Open Font License 1.1에 따라 라이선스가 부여됩니다.',
    fontLicenseViewFull: '라이선스 정보 보기',
    fontLicenseModalTitle: '타사 폰트 라이선스',
    fontLicenseSourceLabel: '출처',
    fontLicenseViewSource: '원본 출처 보기',
    fontLicenseFullTextTitle: 'SIL Open Font License 1.1 전문',
    daysLeft: n => `${n}일 남음`, daysAgo: n => `${n}일 지남`, anniversaryBadge: n => `${n}주년`, companionDays: n => `${n}일 함께`, cycleLabel: '반복',
    exportLabel: '이미지로 내보내기', exportFormatCard: '카드', exportFormatStory: '스토리 (9:16)',
    exportShareButton: '내보내기 및 공유', exportPreparing: '이미지 생성 중…', exportError: '내보내기에 실패했습니다. 다시 시도해 주세요.',
    accountManageLabel: '계정 관리', accountSecurityLabel: '계정 보안',
    myTimeLabel: '나의 시간', myTimeCaption: '時光線에 남긴 시간',
    myTimeStats: (e, a, p) => `이벤트 ${e}개　앨범 ${a}개　사진 ${p}장`,
    myTimeOverviewTitle: '데이터 개요', myTimeOverviewDesc: '현재 時光線에 보관 중인 내용을 간단히 보여줍니다. 세부 내용은 표시되지 않습니다.',
    myTimeOverviewEvents: '이벤트', myTimeOverviewAlbums: '앨범', myTimeOverviewPhotos: '사진',
    dataGroupLabel: '데이터', importExportLabel: '가져오기 및 내보내기', syncDataLabel: '동기화 및 데이터',
    notSyncedStatus: '동기화 안 됨', syncErrorStatus: '동기화 문제 발생',
    lastSyncedJustNow: '마지막 동기화: 방금', lastSyncedAgo: s => `마지막 동기화: ${s} 전`,
    syncMinutesAgo: n => `${n}분`, syncHoursAgo: n => `${n}시간`, syncDaysAgo: n => `${n}일`,
    syncLoginHint: '로그인하면 동기화가 활성화되어 데이터가 클라우드에 안전하게 저장됩니다.',
    prefGroupLabel: '환경설정', appearanceLabel: '외관', notifyPrefLabel: '알림', languageLabel: '언어',
    calendarPrefLabel: '캘린더', calendarPrefHint: '"일정" 탭에서 날짜를 선택했을 때 하단에 함께 표시할 달력 체계를 선택하세요(복수 선택 가능). 랜드마크 자체에 사용할 달력은 추가·편집 시 개별적으로 설정합니다.',
    otherGroupLabel: '기타', aboutLabel: '앱 정보', privacyLabel: '개인정보 처리방침', termsLabel: '이용약관',
    aboutBody: `## 時光線
時光線은 시간, 일정, 삶의 기록을 관리하는 데 특화된 애플리케이션입니다.
간결하고 직관적인 디자인을 통해 중요한 날짜를 기록하고, 일정을 관리하고, 전 세계 시간을 확인하며, 기억할 만한 순간을 소중히 보관할 수 있도록 돕고자 합니다.
시간은 단순히 계산되는 것이 아니라, 기억될 가치가 있습니다.
---
## 서비스 정보
**앱 이름:** 時光線
**현재 버전:** 1.1.0
**공식 웹사이트:** timezzw.top
**문의 이메일:** support@timezzw.top
---
## 개발 및 운영
본 서비스는 개인 개발자가 개발 및 운영을 담당하고 있습니다.
'자오쯔우 스튜디오(趙子吳工作室)'는 본 서비스에서 사용하는 스튜디오 이름 및 브랜드입니다.
---
## 관련 문서
- [이용약관](https://timezzw.top/help/ToS)
- [개인정보 처리방침](https://timezzw.top/help/privacypolicy)
---
## 의견 보내기
時光線을 이용하시다가 문제가 발생하거나 기능, 인터페이스, 서비스에 대한 의견이 있으시면 피드백 기능이나 이메일로 언제든 연락해 주세요.
**이메일:** support@timezzw.top
보내주신 모든 의견을 소중히 읽고 지속적으로 時光線을 개선해 나가겠습니다.
---
© 2026 時光線`,
    legalPlaceholder: '전체 내용은 준비 중이며 곧 제공될 예정입니다.',
    loginPromptTitle: '로그인하여 시간을 동기화하세요',
    appearanceModeSystem: '시스템 설정 따르기', appearanceModeLight: '라이트', appearanceModeDark: '다크',
  },
};

const COLOR_TAGS = [
  { id: 'indigo', hex: '#6C7BE0' },
  { id: 'mint', hex: '#3FBF9B' },
  { id: 'amber', hex: '#F2A65A' },
  { id: 'rose', hex: '#E8779C' },
  { id: 'violet', hex: '#A66CE0' },
  { id: 'sky', hex: '#4FB4E0' },
  { id: 'sage', hex: '#7CC576' },
  { id: 'coral', hex: '#E86C5E' },
];
const ICONS = ['⭐', '❤️', '📚', '🎉', '🏅️', '🎂️', '✈️'];
// 關懷模式（追悼／紀念用途）專用的圖示與顏色：固定用蠟燭、墓碑兩個圖示，
// 其餘自訂圖示沿用原本「＋」自訂功能；顏色改成三種深淺不一的黑灰色（不用平常那些鮮豔色）
const CARE_ICONS = ['🕯️', '🪦'];
const CARE_COLOR_TAGS = [
  { id: 'care-deep', hex: '#26262B' },
  { id: 'care-mid', hex: '#5B5B63' },
  { id: 'care-light', hex: '#96969E' },
];
// 「新增地標」表單裡的「模式選擇」：取代原本「重複」區塊裡疊了兩層開關（生日模式／關懷模式）的做法，
// 改成單一、互斥的五選一模式。labelKey 對應 STRINGS 裡的翻譯字串。
// 目前只先把「生日」「關懷」接上既有的 isBirthday／isCare 邏輯（圖示與顏色自動切換、徽章顯示等）；
// 「陪伴」「紀念日」「常規」三個是新加的選項，暫時只記錄選中的模式本身，具體行為之後再補。
// 這個版本之前建立、還沒有 mode 欄位的舊資料，一律用「沒設 isBirthday／isCare 就當作常規」的規則
// 換算出對應的模式（見 startEdit 裡的 eventModeFromEv）。
const EVENT_MODES = [
  { id: 'birthday', labelKey: 'modeBirthday', hintKey: 'birthdayHint' },
  { id: 'companion', labelKey: 'modeCompanion', hintKey: 'modeCompanionHint' },
  { id: 'care', labelKey: 'modeCare', hintKey: 'careHint' },
  { id: 'anniversary', labelKey: 'modeAnniversary', hintKey: 'modeAnniversaryHint' },
  { id: 'regular', labelKey: 'modeRegular', hintKey: 'modeRegularHint' },
];
// 日程分頁「年／月／週」檢視切換滑塊用（見需求四），跟 EVENT_MODES 是同一種滑動選中膠囊
// 樣式，只是選項換成日曆的三種檢視模式。
const SCHEDULE_VIEW_MODES = [
  { id: 'year', labelKey: 'viewModeYear' },
  { id: 'month', labelKey: 'viewModeMonth' },
  { id: 'week', labelKey: 'viewModeWeek' },
];
// 舊資料（或還沒設定模式）換算成目前選中的模式 id：只看 isBirthday／isCare，兩者都沒有就是「常規」。
function eventModeFromEv(ev) {
  if (ev && ev.isBirthday) return 'birthday';
  if (ev && ev.isCare) return 'care';
  return (ev && ev.mode) || 'regular';
}
// 母菜單圖示對應的子菜單選項（點擊母菜單展開；若未在子菜單中選擇，事件圖示就用母菜單本身的 emoji）
const ICON_SUBMENUS = {
  '❤️': ['💏', '👩\u200d❤️\u200d💋\u200d👩', '👩\u200d❤️\u200d💋\u200d👨'],
  '🏅️': ['🥇', '🥈', '🥉', '🏆'],
};

const CAL_OPTIONS = [
  { id: 'gregory', label: { 'zh-TW': '西曆（不轉換）', en: 'Gregorian (no conversion)', ja: '西暦（変換なし）', ko: '양력(변환 없음)' } },
  { id: 'chinese', label: { 'zh-TW': '農曆', en: 'Lunar (Chinese)', ja: '旧暦', ko: '음력' } },
  { id: 'islamic', label: { 'zh-TW': '伊斯蘭曆', en: 'Islamic', ja: 'イスラム暦', ko: '이슬람력' } },
  { id: 'hebrew', label: { 'zh-TW': '希伯來曆', en: 'Hebrew', ja: 'ヘブライ暦', ko: '히브리력' } },
  { id: 'buddhist', label: { 'zh-TW': '佛曆', en: 'Buddhist', ja: '仏暦', ko: '불기' } },
  { id: 'japanese', label: { 'zh-TW': '日本曆', en: 'Japanese', ja: '和暦', ko: '일본력' } },
];
const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月'];

// countries grouped -- single-zone countries add directly, multi-zone (US) opens a submenu
const COUNTRIES = [
  { id: 'CN', flag: '🇨🇳', name: { 'zh-TW': '中國', en: 'China', ja: '中国', ko: '중국' }, zones: [{ tz: 'Asia/Shanghai' }] },
  { id: 'JP', flag: '🇯🇵', name: { 'zh-TW': '日本', en: 'Japan', ja: '日本', ko: '일본' }, zones: [{ tz: 'Asia/Tokyo' }] },
  { id: 'KR', flag: '🇰🇷', name: { 'zh-TW': '韓國', en: 'South Korea', ja: '韓国', ko: '대한민국' }, zones: [{ tz: 'Asia/Seoul' }] },
  { id: 'SG', flag: '🇸🇬', name: { 'zh-TW': '新加坡', en: 'Singapore', ja: 'シンガポール', ko: '싱가포르' }, zones: [{ tz: 'Asia/Singapore' }] },
  { id: 'TH', flag: '🇹🇭', name: { 'zh-TW': '泰國', en: 'Thailand', ja: 'タイ', ko: '태국' }, zones: [{ tz: 'Asia/Bangkok' }] },
  { id: 'MY', flag: '🇲🇾', name: { 'zh-TW': '馬來西亞', en: 'Malaysia', ja: 'マレーシア', ko: '말레이시아' }, zones: [{ tz: 'Asia/Kuala_Lumpur' }] },
  { id: 'PH', flag: '🇵🇭', name: { 'zh-TW': '菲律賓', en: 'Philippines', ja: 'フィリピン', ko: '필리핀' }, zones: [{ tz: 'Asia/Manila' }] },
  { id: 'VN', flag: '🇻🇳', name: { 'zh-TW': '越南', en: 'Vietnam', ja: 'ベトナム', ko: '베트남' }, zones: [{ tz: 'Asia/Ho_Chi_Minh' }] },
  { id: 'AE', flag: '🇦🇪', name: { 'zh-TW': '阿聯', en: 'UAE', ja: 'UAE', ko: 'UAE' }, zones: [{ tz: 'Asia/Dubai' }] },
  { id: 'IN', flag: '🇮🇳', name: { 'zh-TW': '印度', en: 'India', ja: 'インド', ko: '인도' }, zones: [{ tz: 'Asia/Kolkata' }] },
  { id: 'ID', flag: '🇮🇩', name: { 'zh-TW': '印尼', en: 'Indonesia', ja: 'インドネシア', ko: '인도네시아' }, zones: [{ tz: 'Asia/Jakarta' }] },
  { id: 'AU', flag: '🇦🇺', name: { 'zh-TW': '澳洲', en: 'Australia', ja: 'オーストラリア', ko: '호주' }, zones: [{ tz: 'Australia/Sydney' }] },
  { id: 'NZ', flag: '🇳🇿', name: { 'zh-TW': '紐西蘭', en: 'New Zealand', ja: 'ニュージーランド', ko: '뉴질랜드' }, zones: [{ tz: 'Pacific/Auckland' }] },
  { id: 'GB', flag: '🇬🇧', name: { 'zh-TW': '英國', en: 'United Kingdom', ja: 'イギリス', ko: '영국' }, zones: [{ tz: 'Europe/London' }] },
  { id: 'FR', flag: '🇫🇷', name: { 'zh-TW': '法國', en: 'France', ja: 'フランス', ko: '프랑스' }, zones: [{ tz: 'Europe/Paris' }] },
  { id: 'DE', flag: '🇩🇪', name: { 'zh-TW': '德國', en: 'Germany', ja: 'ドイツ', ko: '독일' }, zones: [{ tz: 'Europe/Berlin' }] },
  { id: 'IT', flag: '🇮🇹', name: { 'zh-TW': '義大利', en: 'Italy', ja: 'イタリア', ko: '이탈리아' }, zones: [{ tz: 'Europe/Rome' }] },
  { id: 'ES', flag: '🇪🇸', name: { 'zh-TW': '西班牙', en: 'Spain', ja: 'スペイン', ko: '스페인' }, zones: [{ tz: 'Europe/Madrid' }] },
  { id: 'RU', flag: '🇷🇺', name: { 'zh-TW': '俄羅斯', en: 'Russia', ja: 'ロシア', ko: '러시아' }, zones: [{ tz: 'Europe/Moscow' }] },
  { id: 'EG', flag: '🇪🇬', name: { 'zh-TW': '埃及', en: 'Egypt', ja: 'エジプト', ko: '이집트' }, zones: [{ tz: 'Africa/Cairo' }] },
  { id: 'ZA', flag: '🇿🇦', name: { 'zh-TW': '南非', en: 'South Africa', ja: '南アフリカ', ko: '남아프리카공화국' }, zones: [{ tz: 'Africa/Johannesburg' }] },
  {
    id: 'US', flag: '🇺🇸', name: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' },
    zones: [
      { tz: 'America/New_York', label: { 'zh-TW': '東岸（紐約）', en: 'Eastern (New York)', ja: '東部（ニューヨーク）', ko: '동부(뉴욕)' } },
      { tz: 'America/Chicago', label: { 'zh-TW': '中部（芝加哥）', en: 'Central (Chicago)', ja: '中部（シカゴ）', ko: '중부(시카고)' } },
      { tz: 'America/Denver', label: { 'zh-TW': '山區（丹佛）', en: 'Mountain (Denver)', ja: '山岳部（デンバー）', ko: '산악부(덴버)' } },
      { tz: 'America/Los_Angeles', label: { 'zh-TW': '西岸（洛杉磯）', en: 'Pacific (Los Angeles)', ja: '西部（ロサンゼルス）', ko: '서부(로스앤젤레스)' } },
      { tz: 'Pacific/Honolulu', label: { 'zh-TW': '夏威夷', en: 'Hawaii', ja: 'ハワイ', ko: '하와이' } },
    ],
  },
  { id: 'CA', flag: '🇨🇦', name: { 'zh-TW': '加拿大', en: 'Canada', ja: 'カナダ', ko: '캐나다' }, zones: [{ tz: 'America/Toronto' }] },
  { id: 'MX', flag: '🇲🇽', name: { 'zh-TW': '墨西哥', en: 'Mexico', ja: 'メキシコ', ko: '멕시코' }, zones: [{ tz: 'America/Mexico_City' }] },
  { id: 'BR', flag: '🇧🇷', name: { 'zh-TW': '巴西', en: 'Brazil', ja: 'ブラジル', ko: '브라질' }, zones: [{ tz: 'America/Sao_Paulo' }] },
];

function colorHex(id) { return (COLOR_TAGS.find(c => c.id === id) || CARE_COLOR_TAGS.find(c => c.id === id) || COLOR_TAGS[0]).hex; }

// 讀取使用者上傳的圖片檔案，等比縮小到最長邊不超過 maxDim（預設 1000px）並轉成 JPEG dataURL 再回傳，
// 避免直接把原始大尺寸相片（可能好幾 MB）整包存進 window.storage，讓地標資料越存越肥。
function resizeImageFile(file, maxDim = 1000, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function combineDateTime(dateStr, timeStr) { return new Date(`${dateStr}T${timeStr || '00:00'}:00`); }
// 修復：原本直接 setMonth(getMonth()+n) 是經典的 JS 日期溢位陷阱——例如 1/31 加 1 個月，
// 2 月根本沒有 31 號，JS 會自動把多出來的天數往後推，變成 3/3，日期整個被「偷偷改掉」，
// 完全沒有任何警告。這正是使用者回報的「日期自動被修改」，也是「同一事件在日程分頁
// 掃描不同月份時，算出來的落點忽前忽後、看起來像同一筆事件跑到好幾個月份」的根因——
// 每個月各自重新從原始日期起算，溢位的量在不同月份長度下不一致，換算結果就對不上。
// 改成：先把「日」暫存起來，換月之後再夾回目標月份實際擁有的最大天數（例如 1/31 加 1 個月
// 要落在 2/28 或 2/29，不是溢位到 3 月），這是「加 N 個月／N 年」在日曆型 App 裡的標準做法。
function addMonths(d, n) {
  const day = d.getDate();
  const r = new Date(d);
  r.setDate(1); // 先把日期歸零到 1 號，換月的當下才不會因為原本的日還在，觸發同一種溢位
  r.setMonth(r.getMonth() + n);
  const daysInTargetMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, daysInTargetMonth));
  return r;
}
function addYears(d, n) {
  // 同樣的溢位陷阱在「加年」也會發生，最典型的是閏年 2/29 加 1 年到平年——平年沒有 2/29，
  // 會被自動推到 3/1。修法同上：換年時先歸零到 1 號，再依目標年份「同一個月」實際天數夾回去。
  const month = d.getMonth();
  const day = d.getDate();
  const r = new Date(d);
  r.setDate(1);
  r.setFullYear(r.getFullYear() + n);
  const daysInTargetMonth = new Date(r.getFullYear(), month + 1, 0).getDate();
  r.setMonth(month, Math.min(day, daysInTargetMonth));
  return r;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getCalendarParts(date, calendarId) {
  try {
    if (calendarId === 'chinese') {
      // zh-TW-u-ca-chinese renders month as kanji ("六月") which breaks parseInt.
      // The calendar:'chinese' option (no era) returns clean numeric month/day
      // plus relatedYear (the Gregorian year the lunar year overlaps).
      const dtf = new Intl.DateTimeFormat('en-US', { calendar: 'chinese', year: 'numeric', month: 'numeric', day: 'numeric' });
      const obj = {};
      dtf.formatToParts(date).forEach(p => (obj[p.type] = p.value));
      if (obj.relatedYear && !obj.year) obj.year = obj.relatedYear;
      return obj;
    }
    const dtf = new Intl.DateTimeFormat(`zh-TW-u-ca-${calendarId}`, { year: 'numeric', month: 'numeric', day: 'numeric', era: 'short' });
    const obj = {};
    dtf.formatToParts(date).forEach(p => (obj[p.type] = p.value));
    return obj;
  } catch (e) { return null; }
}
const GANZHI_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const GANZHI_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function getGanZhi(relatedYear) {
  // 1984 = 甲子年 is the standard reference point for the 60-year sexagenary cycle.
  const stemIdx = (((relatedYear - 4) % 10) + 10) % 10;
  const branchIdx = (((relatedYear - 4) % 12) + 12) % 12;
  return GANZHI_STEMS[stemIdx] + GANZHI_BRANCHES[branchIdx];
}
function chineseDayName(day) {
  const num = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 10) return '初' + num[day];
  if (day < 20) return '十' + num[day - 10];
  return '廿' + num[day - 20];
}
// 將 Intl 傳回的長格式月份名稱（例如「六月」「閏六月」「冬月」）拆解成數字月份＋是否為閏月，
// 供非中文語系需要用數字呈現月份時使用，同時保留閏月資訊（原本用數字月份反查 LUNAR_MONTHS 的做法
// 會把「6bis」這種閏月數字直接當成一般的 6 月處理，導致閏月資訊完全遺失）。
function chineseMonthLabelToNumeric(label) {
  const isLeap = label.startsWith('閏');
  const bare = isLeap ? label.slice(1) : label;
  const idx = LUNAR_MONTHS.indexOf(bare);
  return { num: idx === -1 ? null : idx + 1, isLeap };
}
function formatAltCalendar(date, calendarId, lang, t) {
  if (!calendarId || calendarId === 'gregory') return '';
  if (calendarId === 'chinese') {
    // 直接使用 Intl 長格式月份名稱（chineseMonthInfo），而不是數字曆法欄位，
    // 這樣「正月」～「臘月」與閏月（例如「閏六月」）才能被正確辨識與顯示。
    const info = chineseMonthInfo(date);
    if (!info) return '';
    const ganzhi = getGanZhi(info.year);
    if (lang === 'zh-TW') return `${t.lunarPrefix}${ganzhi}年・${info.month}${chineseDayName(info.day)}`;
    const { num, isLeap } = chineseMonthLabelToNumeric(info.month);
    const leapMark = { ja: '閏', ko: '윤' }[lang] || 'leap ';
    const prefix = isLeap ? leapMark : '';
    if (lang === 'ja') return `${t.lunarPrefix}${ganzhi}年 ${prefix}${num}/${info.day}`;
    if (lang === 'ko') return `${t.lunarPrefix} ${ganzhi}년 ${prefix}${num}/${info.day}`;
    return `${t.lunarPrefix} ${ganzhi} Year ${prefix}${num}/${info.day}`;
  }
  const parts = getCalendarParts(date, calendarId);
  if (!parts) return '';
  const m = parseInt(parts.month), d = parseInt(parts.day);
  const calLabel = (CAL_OPTIONS.find(c => c.id === calendarId) || {}).label || {};
  return `${calLabel[lang] || calendarId} ${parts.year}/${m}/${d}`;
}
// 從 fromDate 開始逐日往未來掃描，找出「農曆／伊斯蘭曆／希伯來曆等」下一次出現指定月／日的西曆日期。
// 注意：陰曆／陰陽合曆每個月的天數不固定（例如農曆有 29 天的「小月」也有 30 天的「大月」），
// 若原始日期剛好是「大月的第 30 天」，隔年（甚至隔好幾年）同一個月份很可能只有 29 天、
// 根本不存在第 30 天——原本的寫法只認「完全吻合月＋日」，遇到這種情況會直接在 maxDays
// 範圍內找不到任何吻合日期而回傳 null，外層再退回使用「最原始的西曆日期」，導致日期永遠停在
// 過去、無法真的循環到下一次（使用者回報的「當天過後直接變成 1 天前、掉進往日地標」）。
// 這裡改成：找到「月份吻合」的第一個區間後，若區間內真的有完全吻合的那一天就直接回傳；
// 找不到就退而求其次，回傳該月份區間內最後一天（比照西曆「2 月 30 號」之類狀況，自動退到月底），
// 這樣一定會在最近一次月份出現時就找到落點，不會被少數「大月才有的日期」卡住好幾年。
function findNextCalendarMatch(calendarId, targetMonth, targetDay, fromDate, maxDays = 400) {
  let lastDayOfTargetMonth = null;
  let enteredTargetMonth = false;
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(fromDate, i);
    const parts = getCalendarParts(d, calendarId);
    if (!parts) continue;
    const month = parseInt(parts.month);
    if (month !== targetMonth) {
      if (enteredTargetMonth) return lastDayOfTargetMonth; // 剛離開目標月份區間：用該月最後一天頂替找不到的日期
      continue;
    }
    enteredTargetMonth = true;
    if (parseInt(parts.day) === targetDay) return d; // 完全吻合，直接採用
    lastDayOfTargetMonth = d; // 持續記錄目標月份內看到的最後一天，供上面找不到時頂替使用
  }
  return lastDayOfTargetMonth;
}

// 取得某西曆日期對應的農曆「年／月（數字）／是否閏月／日」，供農曆專用的循環邏輯使用。
// 直接複用 getCalendarParts 已經處理好的 'calendar: chinese' 數字欄位（月份為 "6" 或 "6bis"），
// 避免另外呼叫一次 Intl，也跟 formatAltCalendar／chineseMonthInfo 用同一套資料來源。
function getChineseDateInfo(date) {
  const parts = getCalendarParts(date, 'chinese');
  if (!parts) return null;
  const { num, isLeap } = parseChineseNumericMonth(parts.month || '');
  if (num == null) return null;
  return { year: parseInt(parts.relatedYear || parts.year), month: num, isLeap, day: parseInt(parts.day) };
}

// 農曆專用的「下一次重複日期」查找，在 findNextCalendarMatch 既有的「三十撞小月，退到二十九」規則之外，
// 額外處理農曆獨有的「閏月」情況，總共三種狀況：
// 1) 一般月份「三十」撞小月：目標月份當年實際只有 29 天，退到該月最後一天（二十九）——沿用既有規則。
// 2) 閏月：原始日期落在某個閏月（例如閏八月初一），優先尋找同一個農曆年是否也有「閏八月」；
//    若當年沒有這個閏月，改用「八月（正月，非閏月）同一天」。
// 3) 「三十」撞上「閏月」：最複雜的情況，例如閏七月三十——
//    若當年確實有閏七月但只有 29 天，退到閏七月二十九；
//    若當年根本沒有閏七月，直接退到（非閏）七月的最後一天（通常是二十九）。
// 實作方式：逐日往未來掃描，把連續同一個「月份＋是否閏月」的區間視為一個區塊；
// 農曆裡「閏 X 月」永遠緊接在「X 月（正月）」之後、下一個「X+1 月」之前，
// 所以只要在正月區塊結束的當下看一眼「緊接著的下一個區塊是不是同編號的閏月」，
// 就能立刻判斷「這個農曆年到底有沒有這個閏月」，不需要多掃好幾年。
function findNextChineseMatch(targetMonth, targetDay, targetIsLeap, fromDate, maxDays = 400) {
  const isTargetPlainBlock = (info) => info.month === targetMonth && !info.isLeap;
  const isTargetLeapBlock = (info) => info.month === targetMonth && info.isLeap;
  const isSameBlock = (a, b) => a && b && a.month === b.month && a.isLeap === b.isLeap;

  let prevInfo = null;      // 前一天所在區塊的簽章：{ month, isLeap }
  let blockLastDay = null;  // 目前區塊已經掃到的最後一天（區塊天數不足、找不到目標日時的頂替候選）
  let blockExactDay = null; // 目前區塊裡若已出現目標日（day === targetDay），記下那一天
  let plainFallback = null; // 事件本身是閏月時，最近一次「正月（非閏）目標月份」區塊結束的候選日期，
                             // 用來在確定「這個農曆年沒有對應閏月」時立刻頂替回傳。

  for (let i = 0; i < maxDays; i++) {
    const d = addDays(fromDate, i);
    const info = getChineseDateInfo(d);
    if (!info) continue;

    if (!isSameBlock(prevInfo, info)) {
      // 換到新月份區塊之前，先「結算」剛剛結束的那個區塊
      if (prevInfo && isTargetPlainBlock(prevInfo)) {
        if (!targetIsLeap) {
          // 非閏月事件：正月區塊掃完卻沒吻合到目標日 → 目標日是「三十」但該月是小月，退到最後一天
          return blockExactDay || blockLastDay;
        }
        // 閏月事件：先記下這個正月區塊的候選日期，暫不回傳，等看看緊接著是不是同編號的閏月
        plainFallback = blockExactDay || blockLastDay;
      } else if (prevInfo && isTargetLeapBlock(prevInfo) && targetIsLeap) {
        // 閏月事件，剛結束的正是目標閏月區塊，但整段掃完都沒吻合到目標日（閏月本身「三十」撞小月）
        return blockExactDay || blockLastDay;
      }
      // 閏月事件、剛結算完正月區塊、且緊接著的新區塊不是同編號的閏月 → 這個農曆年沒有這個閏月，
      // 直接用剛剛正月區塊的候選日期頂替（「閏八月初一」→「八月初一」／「閏七月三十」→「七月二十九」）
      if (plainFallback && targetIsLeap && !isTargetLeapBlock(info)) {
        return plainFallback;
      }
      blockLastDay = null;
      blockExactDay = null;
    }

    if (isTargetPlainBlock(info) || isTargetLeapBlock(info)) {
      blockLastDay = d;
      if (info.day === targetDay) {
        blockExactDay = d;
        if (!targetIsLeap && isTargetPlainBlock(info)) return d; // 非閏月事件，完全吻合
        if (targetIsLeap && isTargetLeapBlock(info)) return d;   // 閏月事件，完全吻合同一個閏月
      }
    }
    prevInfo = info;
  }
  // 掃描範圍內都沒找到：閏月事件若曾記錄過正月候選就用它頂替，否則回傳 null，外層會退回原始日期
  return plainFallback;
}

/* ================= 曆法反向換算（曆法日期 → 西曆日期） =================
 * 用途：讓使用者「先選曆法，再選該曆法對應的日期」，而不是只能先選西曆日期再轉換。
 * 技術作法：瀏覽器的 Intl API 只提供「西曆 → 各曆法」的單向換算（forward-only），
 * 沒有內建「各曆法 → 西曆」的反向函式。伊斯蘭曆、希伯來曆、農曆都是陰曆／陰陽合曆，
 * 月份長度不固定（29 或 30 天），也沒有簡單公式可以直接反推，
 * 所以這裡採用「估算起點 + 逐日掃描比對」的方式：先用平均曆年長度估出一個大概的西曆起點，
 * 再一天一天呼叫 Intl 的正向換算比對，直到找到完全吻合年／月／日為止。
 * 佛曆、日本曆的月、日結構其實跟西曆完全相同（只有年份／年號不同），所以不需要掃描，直接位移年份即可。
 */
function calNumericParts(date, calendarId) {
  try {
    const dtf = new Intl.DateTimeFormat('zh-TW-u-ca-' + calendarId, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const o = {};
    dtf.formatToParts(date).forEach(p => (o[p.type] = p.value));
    return { year: parseInt(o.year), month: parseInt(o.month), day: parseInt(o.day) };
  } catch (e) { return null; }
}
// 中曆的月份名稱（「正月」～「臘月」），閏月則在對應月份名稱前加「閏」字。
// 農曆月份數字化＋是否為閏月：瀏覽器對 zh-TW-u-ca-chinese「長格式」月份名稱（原本應該直接輸出「正月」「閏六月」這類傳統名稱）
// 的 ICU 資料支援度不一，某些瀏覽器／作業系統版本只會退化輸出「M06」這種通用格式代號，不是真正的中文月份名稱。
// 為了不受瀏覽器支援度影響，改成一律用「數字曆法欄位」（calendar:'chinese', month:'numeric'）取得月份數字，
// 閏月時該欄位的值會多帶一個「bis」字尾（例如「6bis」），再靠這個數字＋閏月旗標自己對照 LUNAR_MONTHS 組出月份名稱。
function parseChineseNumericMonth(monthStr) {
  const isLeap = /bis$/i.test(monthStr);
  const num = parseInt(monthStr, 10);
  return { num: Number.isNaN(num) ? null : num, isLeap };
}
function chineseMonthLabel(monthNum, isLeap) {
  const base = LUNAR_MONTHS[monthNum - 1] || `${monthNum}月`;
  return isLeap ? `閏${base}` : base;
}
function chineseMonthInfo(date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { calendar: 'chinese', year: 'numeric', month: 'numeric', day: 'numeric' });
    const o = {};
    dtf.formatToParts(date).forEach(p => (o[p.type] = p.value));
    const { num, isLeap } = parseChineseNumericMonth(o.month || '');
    if (num == null) return null;
    return { year: parseInt(o.relatedYear || o.year), month: chineseMonthLabel(num, isLeap), day: parseInt(o.day) };
  } catch (e) { return null; }
}
// 列出某個農曆年份中，依時間順序排列的所有月份（含閏月），每個月附上西曆起始日與該月天數
function buildChineseYearMonths(lunarYear) {
  let d = new Date(lunarYear - 1, 10, 1); // 從前一年 11 月初開始掃描，確保涵蓋農曆新年最早／最晚的可能日期與最長的閏年天數
  const months = [];
  let started = false;
  for (let i = 0; i < 480; i++) {
    const info = chineseMonthInfo(d);
    if (info && info.year === lunarYear) {
      started = true;
      const last = months[months.length - 1];
      if (!last || last.label !== info.month) months.push({ label: info.month, start: new Date(d), days: 1 });
      else last.days += 1;
    } else if (started) {
      break;
    }
    d = addDays(d, 1);
  }
  return months;
}
function chineseCalendarToGregorian(lunarYear, monthLabel, day) {
  const months = buildChineseYearMonths(lunarYear);
  const m = months.find(x => x.label === monthLabel);
  if (!m) return null;
  return addDays(m.start, Math.min(Math.max(day, 1), m.days) - 1);
}
// 伊斯蘭曆、希伯來曆：用平均曆年長度粗估搜尋起點，再逐日掃描比對
const CAL_EPOCH_GUESS = {
  islamic: (y) => Math.floor(622 + ((y - 1) * 354.36667) / 365.2425),
  hebrew: (y) => y - 3760,
};
function calendarDateToGregorian(calendarId, year, month, day) {
  if (calendarId === 'buddhist') return new Date(year - 543, month - 1, day); // 佛曆：純粹年份位移 543 年，月、日結構與西曆相同
  if (calendarId === 'japanese') return new Date(year, month - 1, day); // 月、日結構與西曆相同，年份由呼叫端先轉換成西曆年再傳入
  if (calendarId === 'chinese') return null; // 農曆請改用 chineseCalendarToGregorian
  const guessFn = CAL_EPOCH_GUESS[calendarId];
  if (!guessFn) return null;
  let d = new Date(guessFn(year), 0, 1);
  d = addDays(d, -60);
  for (let i = 0; i < 800; i++) {
    const p = calNumericParts(d, calendarId);
    if (p && p.year === year && p.month === month && p.day === day) return d;
    d = addDays(d, 1);
  }
  return null;
}
function getCalendarMonthCount(calendarId, year) {
  if (calendarId === 'hebrew') return calendarDateToGregorian('hebrew', year, 13, 1) ? 13 : 12;
  return 12;
}
function getCalendarMonthDays(calendarId, year, month) {
  if (calendarId === 'buddhist' || calendarId === 'japanese') {
    const gYear = calendarId === 'buddhist' ? year - 543 : year;
    return new Date(gYear, month, 0).getDate();
  }
  const start = calendarDateToGregorian(calendarId, year, month, 1);
  if (!start) return 30;
  for (let len = 25; len <= 31; len++) {
    const p = calNumericParts(addDays(start, len), calendarId);
    if (!p || p.month !== month || p.year !== year) return len;
  }
  return 30;
}
// 日本曆年號對照表（現代五個年號）；較早的年號因數量龐大且邊界日期換算複雜，暫不支援，
// 選擇年號時一律視為由 1 月 1 日開始，年號交替當年的極少數邊界日期換算可能會有些微誤差。
const JP_ERAS = [
  { id: 'meiji', label: '明治', startYear: 1868 },
  { id: 'taisho', label: '大正', startYear: 1912 },
  { id: 'showa', label: '昭和', startYear: 1926 },
  { id: 'heisei', label: '平成', startYear: 1989 },
  { id: 'reiwa', label: '令和', startYear: 2019 },
];
function japaneseEraToGregorianYear(eraId, year) {
  const e = JP_ERAS.find(x => x.id === eraId) || JP_ERAS[JP_ERAS.length - 1];
  return e.startYear + year - 1;
}
function getJapaneseEra(date) {
  try {
    const dtf = new Intl.DateTimeFormat('zh-TW-u-ca-japanese', { year: 'numeric', era: 'short' });
    const o = {};
    dtf.formatToParts(date).forEach(p => (o[p.type] = p.value));
    const found = JP_ERAS.find(x => x.label === o.era) || JP_ERAS[JP_ERAS.length - 1];
    return { id: found.id, year: parseInt(o.year) || 1 };
  } catch (e) { return { id: 'reiwa', year: 1 }; }
}
function japaneseEraYearMax(eraId) {
  const idx = JP_ERAS.findIndex(e => e.id === eraId);
  if (idx === -1) return 60;
  if (idx === JP_ERAS.length - 1) return new Date().getFullYear() - JP_ERAS[idx].startYear + 15;
  return JP_ERAS[idx + 1].startYear - JP_ERAS[idx].startYear + 1;
}
function isoDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// 判斷 cand 這個日期是否還沒到「今天」——只比較年/月/日本身，忽略時分秒。
// 原本直接用 cand.getTime() < now.getTime() 整個時間戳記比較，若事件沒特別設定時間
// （預設 00:00），只要現在時刻不是剛好 00:00:00，「今天」這個候選日期一定會被判定成
// 「已經過了」，於是迴圈多跳一輪，把當天的週期誤判成下一輪（月重複多跳 1 個月、
// 年重複多跳 1 年，也就是使用者回報的「當天卻顯示 365 天後」）。改成只比較日期本身，
// 「今天」永遠不會被當成已經過去，才會正確停在當天這一輪。
function isDateBeforeToday(d, now) {
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return dOnly < nowOnly;
}
function getEffectiveDate(ev, now) {
  const orig = combineDateTime(ev.date, ev.time);
  if (!ev.repeat) return orig;
  const lunarLocked = ev.repeatUnit === 'year' && ev.calendar && ev.calendar !== 'gregory';
  const n = lunarLocked ? 1 : Math.max(1, ev.repeatInterval || 1);

  if (ev.repeatUnit === 'month') {
    let cand = new Date(orig);
    while (isDateBeforeToday(cand, now)) cand = addMonths(cand, n);
    return cand;
  }
  if (!ev.calendar || ev.calendar === 'gregory') {
    let cand = new Date(orig);
    while (isDateBeforeToday(cand, now)) cand = addYears(cand, n);
    return cand;
  }
  if (ev.calendar === 'chinese') {
    // 農曆另外走專用的比對邏輯，才能正確處理「閏月」與「三十撞閏月」這些一般月份比對沒有的情況
    // （見 findNextChineseMatch 開頭註解）；原本這裡直接用 parseInt(parts.month) 會把 "6bis"
    // 這種閏月數字直接讀成 6，閏月旗標整個遺失，導致閏月事件永遠被當成一般月份處理。
    const info = getChineseDateInfo(orig);
    if (!info) return orig;
    const found = findNextChineseMatch(info.month, info.day, info.isLeap, now, 400);
    if (!found) return orig;
    found.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    return found;
  }
  const parts = getCalendarParts(orig, ev.calendar);
  if (!parts) return orig;
  const found = findNextCalendarMatch(ev.calendar, parseInt(parts.month), parseInt(parts.day), now, 400);
  if (!found) return orig;
  found.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
  return found;
}
// 修復「同一個年重複事件（尤其生日模式的農曆生日）會同時出現在連續兩個月份，多出來的
// 那個卡在月底」這個 bug：日程分頁在「整年檢視」逐月掃描時，原本對每個月各自組一個
// ref＝那個月 1 號，分別呼叫 getEffectiveDate(ev, ref) 判斷「這個月有沒有落上這個事件」。
// 這對西曆固定重複（addMonths／addYears 逐年比較）沒問題，但對農曆／伊斯蘭曆／希伯來曆
// 這類「要往未來逐日掃描、找下一個符合月＋日的區塊」的曆法來說是錯的：如果某個月的 ref
// （該月 1 號）剛好落在目標區塊「中途」——也就是這個事件在該農曆月份的實際西曆日期，
// 已經在這個月 1 號之前就發生過了——find...Match 系列函式找不到「今天以後」還吻合的
// 那一天，就會誤判成「今年這個月份根本沒有這個日期」，退而返回區塊最後一天頂替，而那個
// 頂替出來的日期常常已經跨進下一個西曆月份，造成同一個年度事件被算成分別出現在兩個
// 連續月份（其中一個是錯的、卡在月底）。
// 修法：年重複（含不循環的固定日期）事件一年最多只會發生一次，不需要對 12 個月各自重算
// 一次，只要用「目標年份的 1 月 1 號」當基準點，往未來掃描一次，保證這個基準點
// 一定落在任何可能的目標發生日「之前」（不會是中途），得到的結果就是這個事件在目標年份
// 唯一、正確的那一次發生日，用它落在哪個月份就好，不再有「多算出一個月」的問題。
// 只有「每 N 個月」重複（repeatUnit==='month'，只有西曆才會這樣設定）才可能一年出現
// 好幾次，那個不受這個 bug 影響（西曆逐月比較是精確的日期比大小，不需要「找不到就退而
// 求其次」這種容易誤判的區塊掃描），繼續維持原本逐月重算即可。
function getYearlyOccurrenceInYear(ev, targetYear) {
  // 這裡原本用固定的「某個月 1 號」（先是前一年 12 月 1 號，後來改成目標年份 1 月 1 號）
  // 當基準，兩種寫法都建立在一個錯誤假設上：以為「1 月 1 號」一定落在任何農曆月份區塊
  // 之外。事實不是這樣——農曆冬月（11 月）幾乎每年都橫跨西曆跨年那一刻（冬月本身就是以
  // 冬至為準去定位，天生就貼著年底），例如 2025 年的農曆冬月是西曆 12/20～隔年 1/18，
  // 完整跨過 1 月 1 號。如果事件的農曆生日剛好落在冬月初三（西曆 12/22），拿「目標年份
  // 1 月 1 號」當基準往未來掃描，會發現自己已經身處在冬月這個區塊「中途」（今年的初三
  // 已經在 1 月 1 號之前就過了），找不到「今天以後」還吻合的那一天，於是誤判成「這個月
  // 沒有這個日期」、退而返回區塊最後一天頂替——初三就這樣被錯改成三十（這正是使用者
  // 實測回報的「冬月初三自動變冬月三十」）。臘月（12 月）也有同樣的風險。
  // 換句話說：任何「隨便選一個月初／年初」當基準的做法，都可能剛好卡在某個事件自己的
  // 農曆月份區塊中途，這不是換一個固定基準點就能徹底避開的（因為到底哪個基準點安全，
  // 取決於「這個事件」的農曆月份幾號落在哪裡，不同事件答案不同）。
  // 真正安全的基準點只有一種：一定精準吻合過的那一天本身——也就是事件的原始日期 orig，
  // 或是「上一次已經確認精準吻合」的發生日。所以西曆固定重複維持原本「目標年份 1 月 1 號」
  // 當基準就好（addYears 逐年比較是精確的日期大小比較，不會有「区块搜尋」這種誤判可能）；
  // 農曆／伊斯蘭曆／希伯來曆等需要「往未來逐日掃描找符合區塊」的曆法，改成從 orig 本身
  // 出發，每次找到下一次吻合的日期後，用「這一次日期 + 300 天」當下一次搜尋的起點繼續找
  // ——同一個農曆月份／日期兩次之間至少間隔約 353 天，+300 天保證還沒追上下一次，但已經
  // 遠遠離開了這一次所在的區塊，起點永遠落在區塊之外，不會再有「卡在中途」的問題。
  // 為了不用真的從幾十年前的原始日期逐年搜尋到目標年份（那樣要跑太多次），先用簡單的
  // 日期加法（不呼叫任何曆法轉換，純數字運算很快）粗略跳到目標年份前兩年附近，只是抓
  // 大概位置；就算粗跳的落點剛好卡進某個區塊中途也沒關係——那一輪找到的日期只是用來
  // 算下一個安全起點（+300 天），不會被當成最終答案，迴圈會在真正落進目標年份時才停止、
  // 回傳當下那一次算出來的日期。
  const orig = combineDateTime(ev.date, ev.time);
  if (!ev.repeat) return orig;
  if (!ev.calendar || ev.calendar === 'gregory') {
    return getEffectiveDate(ev, new Date(targetYear, 0, 1));
  }
  const roughYears = targetYear - orig.getFullYear();
  let cursor = roughYears > 2 ? addDays(orig, Math.round((roughYears - 2) * 365.25)) : orig;
  let found = orig;
  for (let i = 0; i < 8; i++) {
    found = getEffectiveDate(ev, cursor);
    if (found.getFullYear() >= targetYear) break;
    cursor = addDays(found, 300);
  }
  return found;
}
// 給「週檢視」用的通用版本：找出一批事件裡，有哪些的發生日落在 [rangeStart, rangeEnd]
// 這個西曆日期區間內（含頭尾兩端，忽略時分秒）。週檢視最多橫跨兩個西曆月份／兩個西曆年份
// （例如週三橫跨月底、或跨年那一週），所以不能只套用「單一年份」或「單一月份」的算法，
// 改成把區間橫跨到的每個「年-月」（月重複事件）或「年」（不循環／年重複事件）都各自算一次，
// 再用實際日期是否落在區間內做最後篩選——這跟 rangedEvents／eventsByDay 用的月份／年份
// 邏輯是同一套「不循環或年重複只算一次、月重複才逐月算」的原則，只是改成用日期區間比對，
// 不再限定要剛好落在某個西曆月份或西曆年份裡。
function getEventOccurrencesInRange(events, rangeStart, rangeEnd) {
  const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
  const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime();
  const results = [];
  events.forEach(ev => {
    if (ev.repeat && ev.repeatUnit === 'month') {
      const monthKeys = new Set();
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const endCursor = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (cursor <= endCursor) {
        monthKeys.add(`${cursor.getFullYear()}-${cursor.getMonth()}`);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      monthKeys.forEach(key => {
        const [y, m] = key.split('-').map(Number);
        const ref = new Date(y, m, 1);
        const occ = getEffectiveDate(ev, ref);
        if (occ.getFullYear() !== y || occ.getMonth() !== m) return;
        const occTime = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
        if (occTime >= startTime && occTime <= endTime) results.push({ ev, occ });
      });
    } else {
      const years = new Set();
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) years.add(y);
      years.forEach(y => {
        const occ = getYearlyOccurrenceInYear(ev, y);
        if (occ.getFullYear() !== y) return;
        const occTime = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
        if (occTime >= startTime && occTime <= endTime) results.push({ ev, occ });
      });
    }
  });
  return results;
}
// 日曆左右滑動輪播（見需求：改成拖曳跟手、放開自動定位到新月份，不要一放手就瞬間跳過去）
// 用到的純函式：不依賴任何 hook／元件狀態，只吃「年、月」算出那個月的日期格子，讓 AnniversaryCalendar
// 可以同時幫「上一個／目前／下一個」三個月份各自算一次，用來鋪成三個並排的滑動面板。
function buildMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: daysInPrevMonth - startWeekday + 1 + i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
  let trailing = 1;
  while (cells.length % 7 !== 0) cells.push({ day: trailing++, inMonth: false });
  return cells;
}
// 同一個月份格子搭配的事件對照表，邏輯跟原本 AnniversaryCalendar 內部的 eventsByDay 一樣，
// 抽成純函式才能對「上一個／下一個」月份也各自算一次（原本只有目前這個月會算）。
function computeEventsByDayForMonth(events, year, month) {
  const map = {};
  const firstOfMonth = new Date(year, month, 1);
  events.forEach(ev => {
    const occ = ev.repeat && ev.repeatUnit === 'month'
      ? getEffectiveDate(ev, firstOfMonth)
      : getYearlyOccurrenceInYear(ev, year);
    if (occ.getFullYear() === year && occ.getMonth() === month) {
      const d = occ.getDate();
      (map[d] = map[d] || []).push(ev);
    }
  });
  return map;
}
// 上一個／下一個月份的（年,月）：跨年份時要正確進位／借位，抽出來給月檢視跟月份格子共用。
function shiftMonth(year, month, delta) {
  let m = month + delta;
  let y = year;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  return { y, m };
}
// 週檢視也要比照月檢視做「上一個／目前／下一個」三面板真跟手拖曳滑動（見需求：年、週跟月
// 用同一套滑動切換效果），這裡抽出跟月檢視同樣形狀的純函式：給定「這一週裡任一天」算出
// 這一週實際的 7 個日期，以及對應的事件對照表。
function buildWeekDates(weekAnchor) {
  const start = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate());
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
function computeWeekEventsByDateKey(events, weekDates) {
  const map = {};
  if (!weekDates.length) return map;
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];
  getEventOccurrencesInRange(events, weekStart, weekEnd).forEach(({ ev, occ }) => {
    const key = `${occ.getFullYear()}-${occ.getMonth()}-${occ.getDate()}`;
    (map[key] = map[key] || []).push(ev);
  });
  return map;
}
// 年檢視也要比照月檢視做三面板滑動：給定年份，算出 12 個月各自「有沒有事件」，邏輯跟
// AnniversaryCalendar 內部原本的 monthsHaveEvents 一樣，抽成純函式才能對「上一年／下一年」
// 也各自算一次。
function computeMonthsHaveEvents(events, year) {
  const monthlyRepeatEvents = events.filter(ev => ev.repeat && ev.repeatUnit === 'month');
  const yearlyOrFixedOccurrences = events
    .filter(ev => !(ev.repeat && ev.repeatUnit === 'month'))
    .map(ev => getYearlyOccurrenceInYear(ev, year))
    .filter(occ => occ.getFullYear() === year);
  return Array.from({ length: 12 }, (_, m) => {
    if (yearlyOrFixedOccurrences.some(occ => occ.getMonth() === m)) return true;
    const ref = new Date(year, m, 1);
    return monthlyRepeatEvents.some(ev => {
      const occ = getEffectiveDate(ev, ref);
      return occ.getFullYear() === year && occ.getMonth() === m;
    });
  });
}
// 拖曳滑動的共用邏輯：不分月／週／年檢視都是同一套「跟手拖曳、放開判斷要不要換頁、換頁後
// 用 onTransitionEnd 在動畫結束的瞬間把資料换成新的一頁、同時把位移瞬間歸零」，抽成一個
// 共用的 hook，三種檢視各自只要提供「換到上一頁／下一頁」時要做的事（onCommit）。
function useSwipeCarousel(onCommit) {
  const containerRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);
  const startRef = useRef(null);
  const axisRef = useRef(null);
  const widthRef = useRef(320);
  const pendingRef = useRef(null);
  const dragXRef = useRef(0);
  function onTouchStart(e) {
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
    axisRef.current = null;
    widthRef.current = (containerRef.current && containerRef.current.offsetWidth) || 320;
    setTransitionOn(false);
  }
  function onTouchMove(e) {
    if (!startRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    if (axisRef.current == null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // 移動還太小，先不判斷方向
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axisRef.current !== 'x') return; // 判斷成上下捲動，這次手勢整段都不介入橫向位移
    const w = widthRef.current;
    const clamped = Math.max(-w, Math.min(w, dx));
    dragXRef.current = clamped;
    setDragX(clamped);
  }
  function onTouchEnd() {
    if (!startRef.current) return;
    startRef.current = null;
    if (axisRef.current !== 'x') { axisRef.current = null; return; }
    axisRef.current = null;
    const w = widthRef.current;
    const threshold = Math.max(48, w * 0.22);
    setTransitionOn(true);
    if (dragXRef.current <= -threshold) {
      pendingRef.current = 'next';
      setDragX(-w);
    } else if (dragXRef.current >= threshold) {
      pendingRef.current = 'prev';
      setDragX(w);
    } else {
      pendingRef.current = null;
      setDragX(0);
    }
  }
  function handleTransitionEnd(e) {
    if (e.target !== e.currentTarget) return; // 只認外層那個真正在位移的容器觸發的事件
    const dir = pendingRef.current;
    pendingRef.current = null;
    setTransitionOn(false);
    dragXRef.current = 0;
    setDragX(0);
    if (dir) onCommit(dir);
  }
  return { containerRef, dragX, transitionOn, onTouchStart, onTouchMove, onTouchEnd, handleTransitionEnd };
}
const SELECT_STYLE = { border: CARD_BORDER, background: INPUT_BG, color: INK };
const SELECT_CLASS = 'px-2 py-2 rounded-lg text-sm outline-none flex-1 min-w-0';
/* 「先選曆法、再選對應日期」的日期選擇器：依所選曆法顯示年／月／日下拉選單（日本曆額外顯示年號），
 * 選擇結果會即時換算成西曆日期字串回傳給上層（外部仍以西曆 yyyy-mm-dd 儲存事件日期，其餘功能不受影響）。 */
function CalendarDatePicker({ calendarId, isoDate, onChange, syncKey, lang, t }) {
  const [era, setEra] = useState('reiwa');
  const [year, setYear] = useState(null);
  const [yearText, setYearText] = useState(''); // 年份輸入框的顯示文字，與 year 分開管理，讓使用者可以把數字整個刪空後再重新輸入
  const [month, setMonth] = useState(null); // 農曆為月份名稱字串，其餘曆法為數字
  const [day, setDay] = useState(null);
  const ready = useRef(false);
  const yearDebounceRef = useRef(null); // 伊斯蘭曆／希伯來曆／農曆換算年份時需要逐日掃描比對，運算量較大，
  // 若每打一個數字就立即觸發換算會造成打字卡頓，所以改成停止輸入一小段時間後才真正換算

  useEffect(() => () => { if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current); }, []);

  // year 由外部（切換曆法、切換年號、點選快速選單）變動時，同步更新輸入框顯示文字，這些地方會各自明確呼叫 setYearText；
  // 手動輸入時則完全交給輸入框自己的 onChange 管理文字，兩邊不會互相搶著更新，才不會讓打字時卡頓、跳字

  // 切換曆法或重新開啟表單時，依目前的西曆日期（或今天）反推曆法年月日，作為選單初始值
  useEffect(() => {
    ready.current = false;
    if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
    const base = isoDate ? new Date(isoDate + 'T00:00:00') : new Date();
    if (calendarId === 'chinese') {
      const info = chineseMonthInfo(base);
      if (info) { setYear(info.year); setYearText(String(info.year)); setMonth(info.month); setDay(info.day); }
    } else if (calendarId === 'japanese') {
      const p = calNumericParts(base, 'japanese');
      const e = getJapaneseEra(base);
      if (p && e) { setEra(e.id); setYear(e.year); setYearText(String(e.year)); setMonth(p.month); setDay(p.day); }
    } else {
      const p = calNumericParts(base, calendarId);
      if (p) { setYear(p.year); setYearText(String(p.year)); setMonth(p.month); setDay(p.day); }
    }
    requestAnimationFrame(() => { ready.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId, syncKey]);

  // 年、月、日任一項變動時，換算成西曆日期回傳給上層（跳過初始化那一輪，避免多餘的更新）
  useEffect(() => {
    if (!ready.current || year == null || month == null || day == null) return;
    let g = null;
    if (calendarId === 'chinese') g = chineseCalendarToGregorian(year, month, day);
    else if (calendarId === 'japanese') g = calendarDateToGregorian('japanese', japaneseEraToGregorianYear(era, year), month, day);
    else g = calendarDateToGregorian(calendarId, year, month, day);
    if (g) onChange(isoDateStr(g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, era, month, day]);

  if (year == null || month == null || day == null) return null;

  const isChinese = calendarId === 'chinese';
  const chineseMonths = isChinese ? buildChineseYearMonths(year) : null;
  const gYearForDays = calendarId === 'japanese' ? japaneseEraToGregorianYear(era, year) : year;
  const monthCount = calendarId === 'hebrew' ? getCalendarMonthCount('hebrew', year) : 12;
  const dayCount = isChinese
    ? ((chineseMonths.find(m => m.label === month) || {}).days || 30)
    : getCalendarMonthDays(calendarId, gYearForDays, month);
  const yearBase = isChinese ? year : (calNumericParts(new Date(), calendarId) || { year }).year;
  const yearRangeMin = calendarId === 'japanese' ? 1 : (yearBase - 100);
  const yearRangeMax = calendarId === 'japanese' ? japaneseEraYearMax(era) : (yearBase + 30);
  const yearOptionsSet = new Set();
  for (let y = yearRangeMax; y >= yearRangeMin; y--) yearOptionsSet.add(y);
  yearOptionsSet.add(year); // 確保目前的年份一定在清單中，避免使用者手動輸入超出常見範圍的年份時，選單定位不到目前的值
  const yearOptions = Array.from(yearOptionsSet).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {calendarId === 'japanese' && (
          <select
            value={era}
            onChange={e => {
              const nextEra = e.target.value;
              const maxY = japaneseEraYearMax(nextEra);
              const clamped = Math.min(year || 1, maxY);
              if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
              setEra(nextEra);
              setYear(clamped);
              setYearText(String(clamped));
            }}
            className={SELECT_CLASS} style={SELECT_STYLE}
          >
            {JP_ERAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        )}
        <input
          type="number"
          inputMode="numeric"
          value={yearText}
          onChange={e => {
            const raw = e.target.value;
            setYearText(raw); // 只更新輸入框自己的顯示文字，不會被其他地方的同步邏輯覆蓋，打字/刪除不會卡頓
            if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current);
            if (raw === '' || raw === '-') return; // 使用者正在清空輸入框或準備輸入負數，先不換算，避免中途被當成 NaN
            const v = parseInt(raw, 10);
            if (Number.isNaN(v)) return;
            // 日本曆的「年」是年號內的年份，範圍有限；其餘曆法的年份原則上不特別限制，讓使用者可直接手動鍵入任何年份
            const clamped = calendarId === 'japanese' ? Math.min(Math.max(v, 1), japaneseEraYearMax(era)) : v;
            // 伊斯蘭曆／希伯來曆／農曆的換算需要逐日掃描比對，延遲一小段時間再真正觸發，避免每敲一個數字就卡一下
            yearDebounceRef.current = setTimeout(() => setYear(clamped), 220);
          }}
          onBlur={() => {
            if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
            // 使用者把輸入框留空或輸入無效內容就離開時，還原成目前生效中的年份，避免留下空白欄位
            if (yearText === '' || Number.isNaN(parseInt(yearText, 10))) { setYearText(String(year)); return; }
            // 離開欄位時立即把還沒套用的數值套用，不用等延遲時間跑完
            const v = parseInt(yearText, 10);
            setYear(calendarId === 'japanese' ? Math.min(Math.max(v, 1), japaneseEraYearMax(era)) : v);
          }}
          className={SELECT_CLASS} style={SELECT_STYLE}
        />
        {/* 快速選單：跟月份／日期選單一樣是普通原生 <select>，一定會顯示出瀏覽器原生的下拉箭頭，不會有箭頭消失的問題。
            為了不要跟左邊的輸入框重複顯示同一組數字，這裡把「目前被選中的那個年份」的選項文字故意留空，
            所以收合狀態只會看到一個空白按鈕＋原生箭頭；點開清單時，其餘年份仍會正常顯示數字可以選。 */}
        <select
          value={year}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (Number.isNaN(v)) return;
            const clamped = calendarId === 'japanese' ? Math.min(Math.max(v, 1), japaneseEraYearMax(era)) : v;
            if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
            setYear(clamped);
            setYearText(String(clamped));
          }}
          aria-label={t.yearPickerLabel || (lang === 'en' ? 'Pick year' : '選擇年份')}
          className="flex-shrink-0 w-8 py-2 rounded-lg text-sm outline-none text-center"
          style={SELECT_STYLE}
        >
          {yearOptions.map(y => <option key={y} value={y}>{y === year ? '' : y}</option>)}
        </select>
        <select
          value={month}
          onChange={e => {
            const val = isChinese ? e.target.value : parseInt(e.target.value);
            setMonth(val);
            setDay(1);
          }}
          className={SELECT_CLASS} style={SELECT_STYLE}
        >
          {isChinese
            ? chineseMonths.map(m => <option key={m.label} value={m.label}>{m.label}</option>)
            : Array.from({ length: monthCount }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={day}
          onChange={e => setDay(parseInt(e.target.value))}
          className={SELECT_CLASS} style={SELECT_STYLE}
        >
          {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{isChinese ? chineseDayName(d) : d}</option>
          ))}
        </select>
      </div>
      {isoDate && (
        <p className="text-xs px-1" style={{ color: ACCENT }}>
          → {new Date(isoDate + 'T00:00:00').toLocaleDateString(LOCALE_MAP[lang] || 'zh-TW')}
        </p>
      )}
    </div>
  );
}
function glass(extra = {}) { return { background: CARD_BG, border: CARD_BORDER, boxShadow: '0 2px 10px rgba(35,39,51,0.05)', ...extra }; }
// 新增地標表單「選擇事件圖示」的選中提示：統一改成方形毛玻璃質感的背景，
// 不論一般模式或關懷模式都套用同一種樣式（關懷模式原本另外在右下角疊一個打勾徽章，一併移除）。
const ICON_SELECTED_GLASS = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(12px) saturate(180%)',
  WebkitBackdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 2px 8px rgba(31,38,135,0.12)',
};
function iconPickStyle(selected, extra = {}) {
  return selected ? { ...ICON_SELECTED_GLASS, ...extra } : { background: 'transparent', border: '1px solid transparent', ...extra };
}
function getUtcOffset(tz, now) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const part = dtf.formatToParts(now).find(p => p.type === 'timeZoneName');
    if (!part) return '';
    return part.value.replace('GMT', 'UTC').replace(/UTC$/, 'UTC+00:00');
  } catch (e) { return ''; }
}
function getOffsetMinutes(tz, now) {
  const offsetStr = getUtcOffset(tz, now);
  const m = offsetStr.match(/UTC([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}
function formatOffsetDiff(diffMinutes) {
  const sign = diffMinutes > 0 ? '+' : '−';
  const abs = Math.abs(diffMinutes);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
}

/* ---------------- Language switcher ---------------- */
// 全域下拉選單互斥機制：「切換語言」「提醒設定」「添加時區」這三個下拉選單
// 各自有自己的開關 state，彼此預設互不相干。沒有這層協調的話，使用者可以同時
// 打開兩個選單，畫面上會疊出兩片選單面板，觀感上很雜亂。
// 做法很單純：用一個 DOM 自訂事件廣播「目前是哪個選單被打開」，
// 每個下拉選單訂閱這個事件，收到不是自己的 id 時就把自己關掉，
// 這樣同一時間只會有一個選單是打開的。
const DROPDOWN_CLOSE_EVENT = 'app:dropdown-open';
function openDropdownExclusive(id) {
  window.dispatchEvent(new CustomEvent(DROPDOWN_CLOSE_EVENT, { detail: id }));
}
function useExclusiveDropdown(id, isOpen, close) {
  useEffect(() => {
    function handler(e) {
      if (e.detail !== id) close();
    }
    window.addEventListener(DROPDOWN_CLOSE_EVENT, handler);
    return () => window.removeEventListener(DROPDOWN_CLOSE_EVENT, handler);
  }, [id, close]);
}

// 折叠屏展开、平板、桌面等大屏的判斷：用 matchMedia 監聽視窗寬度是否達到分欄門檻。
// 折疊手機展開後的可視寬度通常落在 700～900px 之間，這裡取 760px 作為門檻——
// 略高於手機直向寬度（一般 <480px），也低於多數折疊機展開寬度，桌面瀏覽器視窗更是輕鬆超過。
// 用 matchMedia 而非單純 window.innerWidth，是因為它能訂閱變化事件，使用者拖曳視窗大小、
// 或折疊手機展開/闔上時，畫面能即時響應切換版面，不需要額外綁 resize 事件自己節流。
const LARGE_SCREEN_BREAKPOINT = 760;
function useIsLargeScreen(breakpoint = LARGE_SCREEN_BREAKPOINT) {
  const [isLarge, setIsLarge] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = () => setIsLarge(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isLarge;
}

// ---- 視窗（彈窗／詳情頁）用手機返回手勢／瀏覽器返回鍵、或鍵盤 Esc 鍵關閉 ----
// 原本任何彈窗（時鐘詳情、地標詳情、新增／編輯表單、登入視窗……）打開時，手機上滑動返回手勢
// 或按返回鍵，瀏覽器沒有多餘的歷史紀錄可退，就會直接把整個 App 關掉／導覽離開；鍵盤 Esc 鍵則完全沒有作用。
// 這裡用「開窗時推入一筆歷史佔位紀錄」的常見作法：使用者觸發返回手勢/鍵，會先觸發瀏覽器的
// popstate 事件把這筆佔位紀錄退掉，攔截下來後改成呼叫視窗原本「點背景／按 X」在用的同一個關閉函式
// （沿用同一套關閉動畫，行為與手動關閉完全一致），而不是真的離開頁面；Esc 鍵同理，額外多呼叫一次
// history.back() 把剛剛推入的那筆佔位紀錄一併消耗掉，避免使用者之後真的想返回時還要多按一次。
// modalStack／__pendingProgrammaticBacks 是 module 層級（不是 React state）的簡易堆疊：
// 多層視窗疊在一起時（例如地標詳情裡再彈出刪除確認），只有「最上層」那個會回應返回／Esc，
// 一次只關掉最上面那一層，不會整疊一次全部關掉；__pendingProgrammaticBacks 用來標記「這次
// history.back() 是我們自己為了消耗佔位紀錄而觸發的」，讓其他還開著的視窗知道這不是使用者
// 真正的返回操作，不用跟著誤判關閉。
const __modalBackStack = [];
let __pendingProgrammaticBacks = 0;
function useModalBackClose(active, onRequestClose) {
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const entry = {};
    __modalBackStack.push(entry);
    window.history.pushState({ __modal: true }, '');
    let consumed = false;
    const isTop = () => __modalBackStack[__modalBackStack.length - 1] === entry;
    function handlePopState() {
      if (__pendingProgrammaticBacks > 0) { __pendingProgrammaticBacks--; return; }
      consumed = true;
      if (isTop()) closeRef.current();
    }
    function handleKeyDown(e) {
      if ((e.key !== 'Escape' && e.key !== 'Esc') || !isTop()) return;
      e.preventDefault();
      closeRef.current();
      if (!consumed) {
        consumed = true;
        __pendingProgrammaticBacks++;
        window.history.back();
      }
    }
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      const idx = __modalBackStack.indexOf(entry);
      if (idx !== -1) __modalBackStack.splice(idx, 1);
      if (!consumed) {
        consumed = true;
        __pendingProgrammaticBacks++;
        window.history.back();
      }
    };
  }, [active]);
}

// 兩層字體授權相關視窗（卡片浮層／完整條款彈窗）共用的「掛載＋淡入淡出」小 hook：
// active 由 true 變 false 時不立刻卸載，而是先把 shown 撥回 false 讓 CSS transition 播完
// 退場動畫，過了 duration 才真正卸載（mounted 變 false），讓「浮層淡出的同時彈窗淡入」
// 這種替換動作看起來是連貫的交叉淡出/淡入，而不是兩個視窗生硬地互相跳接。
function useOverlayTransition(active, duration = 180) {
  const [mounted, setMounted] = useState(active);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let raf, timer;
    if (active) {
      setMounted(true);
      raf = requestAnimationFrame(() => setShown(true));
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), duration);
    }
    return () => { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [active, duration]);
  return [mounted, shown];
}

function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('lang', open, () => setOpen(false));

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => {
          const next = !v;
          if (next) openDropdownExclusive('lang');
          return next;
        })}
        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full"
        style={glass({ color: INK })}
      >
        <Globe size={14} /> {LANG_NAMES[lang]}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 rounded-xl overflow-hidden z-20" style={{ ...glass(), width: 140, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm"
              style={{ color: l === lang ? ACCENT : INK, background: l === lang ? 'var(--card-border)' : 'transparent' }}
            >
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 倒數日提醒設定 ---------------- */
// 跟 LangSwitcher 用同一套下拉面板骨架（點按鈕展開、點外面關閉、跟其他下拉選單互斥），
// 只是內容換成「啟用通知」開關 + 「提前幾天提醒」數字輸入。
// 實際的排程／檢查邏輯（Notification 權限、定時檢查、避免重複通知）都在 App 那一層，
// 這裡純粹是設定介面，不碰任何排程細節。
function NotifySettingsButton({ enabled, onToggle, daysBefore, setDaysBefore, permission, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('notify', open, () => setOpen(false));

  const unsupported = permission === 'unsupported';

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => {
          const next = !v;
          if (next) openDropdownExclusive('notify');
          return next;
        })}
        aria-label={t.notifyButtonLabel}
        title={t.notifyButtonLabel}
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ ...glass(), width: '2.125rem', height: '2.125rem', color: enabled ? ACCENT : INK }}
      >
        {enabled ? <Bell size={16} /> : <BellOff size={16} />}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl overflow-hidden z-20 p-4 flex flex-col gap-3"
          style={{ ...glass(), width: 250, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-sm font-bold" style={{ color: INK }}>{t.notifyPanelTitle}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: INK }}>{t.notifyEnableLabel}</span>
            <button
              onClick={() => onToggle(!enabled)}
              className="relative flex-shrink-0"
              style={{ width: 40, height: 24, borderRadius: 12, background: enabled ? ACCENT : 'var(--card-border)', transition: 'background 0.2s ease' }}
            >
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 18, height: 18, top: 3, left: enabled ? 19 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              />
            </button>
          </div>
          <p className="text-xs" style={{ color: INK_SOFT }}>{t.notifyEnableHint}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: INK }}>{t.notifyDaysBeforeLabel}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="number"
                min={0}
                max={365}
                value={daysBefore}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  setDaysBefore(Number.isFinite(v) ? Math.max(0, Math.min(365, v)) : 0);
                }}
                className="text-sm text-center rounded-lg px-2 py-1"
                style={{ width: 52, background: 'var(--card-border)', color: INK, border: 'none' }}
              />
              <span className="text-xs" style={{ color: INK_SOFT }}>{t.notifyDaysBeforeUnit}</span>
            </div>
          </div>

          {unsupported && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyUnsupported}</p>}
          {permission === 'denied' && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyPermissionDenied}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- World Clock ---------------- */
// 國旗渲染：直接原地渲染 emoji，不再需要任何 portal。
// 舊版因為關懷模式對世界時鐘整個區塊套用 `filter: grayscale(1)`，而 CSS 的 filter
// 沒辦法讓子元素自己「跳出」祖先的濾鏡，才需要把國旗用 createPortal 另外掛到
// document.body、再靠 getBoundingClientRect／requestAnimationFrame 把它疊回原本位置——
// 這連帶需要處理捲動裁切、下拉選單重疊等一整套座標同步問題。
// 現在關懷模式改成覆寫 --ink／--card-bg／--card-border／--accent 這些 CSS 變數
// （見 CARE_MODE_VARS），而不是套用濾鏡；國旗 emoji 本來就不是靠這些變數上色，
// 不管祖先層級套了什麼 token，都不會被影響到，所以國旗只要當一個普通的 <span> 留在
// 原本的 DOM 位置即可，天然保留原色，不需要任何特殊處理。
function Flag({ flag, className, style }) {
  return <span className={className} style={style}>{flag}</span>;
}

function ClockRow({ clock, now, selectMode, selected, onLongPress, onTap, lang, t, compact, isHome, homeTz, hero }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const LONG_PRESS_MOVE_THRESHOLD = 10; // px：手指/滑鼠移動超過這個距離就視為在捲動或拖曳，不算「按住不動」
  const start = (e) => {
    firedRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    startPosRef.current = { x: point.clientX, y: point.clientY };
    timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress(clock.id); }, 500);
  };
  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; };
  // 長按觸發前若偵測到手指/滑鼠移動超過門檻（例如在捲動時區清單），就取消這次長按判定，
  // 避免「長按=進入多選刪除模式」在使用者其實只是想捲動畫面時被誤觸發
  const move = (e) => {
    if (!timerRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPosRef.current.x;
    const dy = point.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) clear();
  };
  // 原本「目前位置」卡片（hero）雙擊會另外開一個時鐘詳情彈窗，這個互動已經移除——
  // 該視窗的內容現在直接常駐顯示在「世界時鐘」分頁裡（見 App() 裡 activeTab === 'clock'
  // 那段），不需要再靠雙擊才看得到，所以這裡跟其他時鐘列一樣，單擊一律直接呼叫 onTap
  // （hero 卡片的 onTap＝設為/取消目前位置）。
  const handleClick = () => {
    if (firedRef.current) { firedRef.current = false; return; }
    onTap(clock.id);
  };

  const country = COUNTRIES.find(c => c.id === clock.countryId);
  const zone = country ? country.zones.find(z => z.tz === clock.tz) : null;
  const nameLabel = country ? country.name[lang] : clock.tz;
  const subLabel = country && country.zones.length > 1 && zone && zone.label ? zone.label[lang] : null;

  const timeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: clock.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  const offsetStr = getUtcOffset(clock.tz, now);
  const localDay = now.getDate();
  const tzDay = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: clock.tz, day: 'numeric' }).format(now));
  const dayOffset = tzDay === localDay ? '' : tzDay > localDay ? t.tomorrow : t.yesterday;

  // 與目前位置的時差（僅在有設定目前位置，且這不是目前位置本身時顯示）
  let diffLabel = null;
  if (homeTz && !isHome) {
    const diffMinutes = getOffsetMinutes(clock.tz, now) - getOffsetMinutes(homeTz, now);
    diffLabel = diffMinutes === 0 ? t.sameAsCurrent : `${formatOffsetDiff(diffMinutes)}${t.diffHourSuffix}`;
  }

  const rowBg = selected ? 'rgba(255,0,74,0.10)' : isHome ? 'rgba(108,123,224,0.08)' : CARD_BG;
  const rowBorder = selected ? `1.5px solid ${DANGER}` : isHome ? `1.5px solid ${ACCENT}` : CARD_BORDER;

  if (hero) {
    return (
      <button
        onMouseDown={start} onMouseUp={clear} onMouseLeave={clear}
        onMouseMove={move} onTouchMove={move}
        onTouchStart={start} onTouchEnd={clear}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && e.shiftKey) || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            onLongPress(clock.id);
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl relative"
        style={{ background: selected ? 'rgba(255,0,74,0.10)' : 'rgba(108,123,224,0.08)', border: selected ? `1.5px solid ${DANGER}` : `1.5px solid ${ACCENT}`, userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {selectMode && (
          <span className="absolute flex items-center justify-center rounded" style={{ width: 17, height: 17, top: 6, left: 6, border: `1px solid ${selected ? DANGER : INK_SOFT}`, background: selected ? DANGER : 'rgba(255,255,255,0.9)', zIndex: 1 }}>
            {selected && <Check size={11} color="#fff" />}
          </span>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <Flag
            flag={country ? country.flag : '🌐'}
            className="text-3xl flex-shrink-0 leading-none flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: CARD_BG, border: CARD_BORDER }}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs font-bold truncate" style={{ color: ACCENT }}>📍{t.currentLocation}</span>
            <span className="font-bold text-base truncate" style={{ color: INK }}>{nameLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 pl-3">
          <span className="font-bold tabular-nums whitespace-nowrap leading-none" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 28, color: selected ? DANGER : INK }}>{timeStr}</span>
          <span className="text-xs font-medium whitespace-nowrap mt-1" style={{ color: INK_SOFT }}>{offsetStr}{dayOffset ? `・${dayOffset}` : ''}</span>
        </div>
      </button>
    );
  }

  if (compact) {
    return (
      <button
        onMouseDown={start} onMouseUp={clear} onMouseLeave={clear}
        onMouseMove={move} onTouchMove={move}
        onTouchStart={start} onTouchEnd={clear}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && e.shiftKey) || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            onLongPress(clock.id);
          }
        }}
        className="flex items-center justify-between px-2.5 py-2 rounded-2xl w-full min-w-0 relative"
        style={{ background: rowBg, border: rowBorder, userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {selectMode && (
          <span className="absolute flex items-center justify-center rounded" style={{ width: 14, height: 14, top: 4, left: 4, border: `1px solid ${selected ? DANGER : INK_SOFT}`, background: selected ? DANGER : 'rgba(255,255,255,0.9)', zIndex: 1 }}>
            {selected && <Check size={9} color="#fff" />}
          </span>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag flag={country ? country.flag : '🌐'} className="text-lg flex-shrink-0 leading-none" />
          <div className="flex flex-col items-start min-w-0">
            <span className="font-bold text-xs truncate" style={{ color: INK, maxWidth: 62 }}>{nameLabel}</span>
            {isHome ? (
              <span className="text-[9px] font-bold truncate" style={{ color: ACCENT, maxWidth: 62 }}>📍{t.currentLocation}</span>
            ) : subLabel && (
              <span className="text-[9px] truncate" style={{ color: INK, maxWidth: 62 }}>{subLabel}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 pl-1.5">
          <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 15, color: selected ? DANGER : INK }}>{timeStr}</span>
          <span className="text-[9px] whitespace-nowrap" style={{ color: INK_SOFT }}>{offsetStr}{dayOffset ? `・${dayOffset}` : ''}</span>
          {diffLabel && <span className="text-[9px] font-bold whitespace-nowrap" style={{ color: ACCENT }}>{diffLabel}</span>}
        </div>
      </button>
    );
  }

  return (
    <button
      onMouseDown={start} onMouseUp={clear} onMouseLeave={clear}
      onMouseMove={move} onTouchMove={move}
      onTouchStart={start} onTouchEnd={clear}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' && e.shiftKey) || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          onLongPress(clock.id);
        }
      }}
      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl relative"
      style={{ background: rowBg, border: rowBorder, userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {selectMode && (
        <span className="absolute flex items-center justify-center rounded" style={{ width: 17, height: 17, top: 6, left: 6, border: `1px solid ${selected ? DANGER : INK_SOFT}`, background: selected ? DANGER : 'rgba(255,255,255,0.9)', zIndex: 1 }}>
          {selected && <Check size={11} color="#fff" />}
        </span>
      )}
      <div className="flex items-center gap-2.5 min-w-0">
        <Flag flag={country ? country.flag : '🌐'} className="text-2xl flex-shrink-0 leading-none" />
        <div className="flex flex-col items-start min-w-0">
          <span className="font-bold text-sm truncate" style={{ color: INK }}>{nameLabel}</span>
          {isHome ? (
            <span className="text-xs font-bold truncate" style={{ color: ACCENT }}>📍{t.currentLocation}</span>
          ) : subLabel && (
            <span className="text-xs truncate" style={{ color: INK }}>{subLabel}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 pl-3">
        <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 20, color: selected ? DANGER : INK }}>{timeStr}</span>
        <span className="text-xs whitespace-nowrap" style={{ color: INK_SOFT }}>{offsetStr}{dayOffset ? `・${dayOffset}` : ''}</span>
        {diffLabel && <span className="text-xs font-bold whitespace-nowrap" style={{ color: ACCENT }}>{diffLabel}</span>}
      </div>
    </button>
  );
}

// 取得指定時區在指定時間點的時／分／秒（含毫秒，讓錶針可以平滑轉動而不是一秒跳一格）
function getTimeHMS(date, tz) {
  try {
    const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    }).formatToParts(date);
    const obj = {};
    parts.forEach(p => { if (p.type !== 'literal') obj[p.type] = parseInt(p.value, 10); });
    return { h: obj.hour % 24, m: obj.minute, s: obj.second, ms: date.getMilliseconds() };
  } catch (err) {
    return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), ms: date.getMilliseconds() };
  }
}

/* ---------------- 類比時鐘（analog clock）：用於「目前位置」雙擊彈出的時鐘視窗 ---------------- */
function AnalogClock({ tz, now, size = 220 }) {
  const { h, m, s, ms } = getTimeHMS(now, tz);
  const secDeg = (s + ms / 1000) * 6;
  const minDeg = (m + s / 60) * 6;
  const hourDeg = ((h % 12) + m / 60) * 30;

  const R = 100; // viewBox 半徑
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const deg = i * 6;
    const major = i % 5 === 0;
    const r1 = major ? 78 : 84;
    const r2 = 92;
    const rad = (deg * Math.PI) / 180;
    const x1 = 100 + r1 * Math.sin(rad), y1 = 100 - r1 * Math.cos(rad);
    const x2 = 100 + r2 * Math.sin(rad), y2 = 100 - r2 * Math.cos(rad);
    ticks.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={INK} strokeOpacity={major ? 0.55 : 0.25} strokeWidth={major ? 2.2 : 1} strokeLinecap="round" />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
      <circle cx="100" cy="100" r="98" fill={CARD_BG} stroke={CARD_BORDER === '1px solid var(--card-border)' ? 'var(--card-border)' : CARD_BORDER} strokeWidth="1" />
      {ticks}
      <text x="100" y="38" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">12</text>
      <text x="168" y="106" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">3</text>
      <text x="100" y="172" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">6</text>
      <text x="32" y="106" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">9</text>
      {/* 時針 */}
      <line x1="100" y1="100" x2="100" y2="58" stroke={INK} strokeWidth="5" strokeLinecap="round"
        transform={`rotate(${hourDeg} 100 100)`} />
      {/* 分針 */}
      <line x1="100" y1="100" x2="100" y2="34" stroke={INK} strokeWidth="3.5" strokeLinecap="round"
        transform={`rotate(${minDeg} 100 100)`} />
      {/* 秒針 */}
      <line x1="100" y1="112" x2="100" y2="24" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"
        transform={`rotate(${secDeg} 100 100)`} />
      <circle cx="100" cy="100" r="5" fill={ACCENT} />
    </svg>
  );
}

/* ---------------- 「目前位置」雙擊彈出的時鐘視窗 ----------------
 * 上半部：目前位置的類比時鐘（比一般彈窗置中位置再往下移一點，避免緊貼視窗頂端）
 * 下半部：世界時鐘列表中其他已加入的時區（唯讀列表，僅供查看，不觸發選取/刪除等互動） */
function CurrentLocationClockModal({ clock, now, restClocks, lang, t, onClose, dock = false, closing = false }) {
  const country = COUNTRIES.find(c => c.id === clock.countryId);
  const nameLabel = country ? country.name[lang] : clock.tz;
  const timeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: clock.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  const offsetStr = getUtcOffset(clock.tz, now);

  // 呼出／關閉動畫：'enter' 是剛掛載、尚未套用「顯示中」樣式的那一幀，下一個 rAF
  // 立刻切到 'shown' 觸發 CSS transition 由小變大、淡入；使用者關閉時先切到 'closing'
  // 讓 transition 反向播放，等動畫播完（與 CLOSE_DURATION 對齊）才真的呼叫 onClose 卸載，
  // 而不是直接把整個視窗從畫面上瞬間移除。
  const [phase, setPhase] = useState('enter');
  const CLOSE_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  // dock 模式下，App 那層要換成別的卡片時，會透過這個外部的 closing 訊號告訴這裡「該播放關閉動畫了」，
  // 跟使用者自己按 X／點背景關閉的差別是：這裡只負責把「正在關閉」的視覺效果播出來，不會自己呼叫
  // onClose 去卸載自己——真正的內容替換（卸載這張、換上新的一張）時機由 App 那層統一控制，
  // 兩邊動畫接起來才會有「自動關閉舊卡片、彈出新卡片」的絲滑感，而不是內容瞬間跳掉
  useEffect(() => {
    if (closing) setPhase('closing');
  }, [closing]);
  function handleClose() {
    setPhase('closing');
    setTimeout(onClose, CLOSE_DURATION);
  }
  // dock 模式是常駐在頁面上的內容，不是彈窗，不該劫持返回鍵——不然按返回鍵只會讓這塊內容
  // 自己播一次「關閉動畫」卻沒有東西真的關掉（onClose 在 dock 模式下通常是空函式），
  // 使用者會覺得畫面卡住。只有真正的彈窗模式才需要返回鍵＝關閉這個行為。
  useModalBackClose(!dock, handleClose);
  const shown = phase === 'shown';

  return (
    <div
      className={dock ? 'relative h-full w-full' : 'fixed inset-0 flex items-center justify-center px-6'}
      style={dock ? undefined : {
        zIndex: 200,
        background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: `background ${CLOSE_DURATION}ms ease`,
      }}
      onClick={dock ? undefined : handleClose}
    >
      <div
        className={dock ? 'w-full h-full overflow-y-auto rounded-3xl p-5 flex flex-col items-center' : 'w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl p-5 flex flex-col items-center'}
        style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          // dock（分欄右側面板）模式下改成從右邊帶點彈性地「彈射」滑入，
          // 呼應它在大屏分欄版面裡本來就位於右側的方位；非 dock（手機置中彈窗）維持原本由下往上彈出的效果
          transform: shown
            ? 'scale(1) translateX(0px) translateY(0px)'
            : dock ? 'scale(0.94) translateX(28px) translateY(0px)' : 'scale(0.92) translateX(0px) translateY(14px)',
          transition: `opacity ${CLOSE_DURATION}ms ease, transform ${CLOSE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: ACCENT }}>
            📍{t.currentLocation}
          </span>
          {/* dock 模式＝常駐在頁面上的內容，不是可以關掉的彈窗，這裡就不需要叉叉關閉按鈕了 */}
          {!dock && (
            <button onClick={handleClose} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Flag flag={country ? country.flag : '🌐'} className="text-2xl leading-none" />
          <span className="font-bold text-lg" style={{ color: INK }}>{nameLabel}</span>
        </div>

        {/* 時鐘本體：比一般置中位置再往下推一點 */}
        <div className="mt-6">
          <AnalogClock tz={clock.tz} now={now} size={220} />
        </div>

        <div className="flex flex-col items-center mt-4 mb-5">
          <span className="font-bold tabular-nums" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 22, color: INK }}>{timeStr}</span>
          <span className="text-xs mt-0.5" style={{ color: INK_SOFT }}>{offsetStr}</span>
        </div>

        {/* 其他已加入的時區列表（唯讀） */}
        <div className="w-full flex flex-col gap-2">
          {restClocks.map(c => {
            const rc = COUNTRIES.find(x => x.id === c.countryId);
            const rZone = rc ? rc.zones.find(z => z.tz === c.tz) : null;
            const rName = rc ? rc.name[lang] : c.tz;
            const rSubLabel = rc && rc.zones.length > 1 && rZone && rZone.label ? rZone.label[lang] : null;
            const rTimeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
            const rOffsetStr = getUtcOffset(c.tz, now);
            return (
              <div key={c.id} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: CARD_BG, border: CARD_BORDER }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Flag flag={rc ? rc.flag : '🌐'} className="text-xl flex-shrink-0 leading-none" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-bold text-sm truncate" style={{ color: INK }}>{rName}</span>
                    {rSubLabel && <span className="text-xs truncate" style={{ color: INK_SOFT }}>{rSubLabel}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 pl-3">
                  <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 16, color: INK }}>{rTimeStr}</span>
                  <span className="text-xs whitespace-nowrap" style={{ color: INK_SOFT }}>{rOffsetStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorldClockSection({ clocks, setClocks, lang, t, onHomeTzChange, homeTzId, setHomeTzId, part2Ref, part2Height, isDraggingWorldClock, isLargeScreen = false, unlimitedHeight = false }) {
  const [now, setNow] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);
  const [submenuCountry, setSubmenuCountry] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  // 雙欄不再由使用者手動切換，改成加入的時區數量達到 3 個（含）以上時自動切成雙欄，方便一次看到更多時區
  const columns = clocks.length >= 3 ? 2 : 1;
  // 「目前位置」設定的是哪一筆時鐘（id）：改由上層 App 提供／持久化（見 HOME_TZ_ID_KEY），
  // 這個元件重新掛載（例如整頁重新整理）後才不會回復成沒設定的原狀
  //
  // 「目前位置時鐘詳情」（原本雙擊 hero 卡片才會跳出的視窗）已經不再由這個元件負責開關，
  // 那個視窗的內容現在直接常駐顯示在「世界時鐘」分頁本身（見 App() 裡 activeTab === 'clock'
  // 那段，用 CurrentLocationClockModal 的 dock 模式渲染），這裡不用再持有任何開關狀態。
  const menuRef = useRef(null);

  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setSubmenuCountry(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('timezone', showMenu, () => { setShowMenu(false); setSubmenuCountry(null); });

  const addedTz = new Set(clocks.map(c => c.tz));
  const homeClock = clocks.find(c => c.id === homeTzId) || null;

  // 將「目前位置」的時區回報給上層 App，讓頂部標題列能依此判斷早上好／中午好／晚上好
  useEffect(() => { onHomeTzChange && onHomeTzChange(homeClock ? homeClock.tz : null); }, [homeClock, onHomeTzChange]);

  function addZone(country, tz) {
    setClocks(prev => [...prev, { id: Date.now().toString(), tz, countryId: country.id }]);
    setShowMenu(false);
    setSubmenuCountry(null);
  }
  function handleCountryClick(country) {
    if (country.zones.length === 1) addZone(country, country.zones[0].tz);
    else setSubmenuCountry(country);
  }
  function longPress(id) { setSelectMode(true); setSelected(prev => (prev.includes(id) ? prev : [...prev, id])); }
  function tap(id) {
    if (selectMode) {
      setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
      return;
    }
    // 單獨點一下：設為目前位置，再點一下取消
    setHomeTzId(prev => (prev === id ? null : id));
  }
  function confirmDelete() {
    setClocks(prev => prev.filter(c => !selected.includes(c.id)));
    if (selected.includes(homeTzId)) setHomeTzId(null);
    setSelectMode(false);
    setSelected([]);
  }
  function cancelSelect() { setSelectMode(false); setSelected([]); }

  const rootOptions = COUNTRIES.filter(c => !c.zones.every(z => addedTz.has(z.tz)));
  const subOptions = submenuCountry ? submenuCountry.zones.filter(z => !addedTz.has(z.tz)) : [];

  // Part 2 只顯示「非目前位置」的時區；目前位置改成在 Part 1 置頂區塊常駐顯示
  const restClocks = clocks.filter(c => c.id !== homeTzId);

  return (
    <div className="mb-2">
      {/* Part 1：標題列＋控制列＋目前位置卡片。整個 WorldClockSection 現在都位於畫面上方
          不捲動的固定區域，不再需要自己 sticky／量測高度 */}
      <div className="pb-1.5">
        <div className="flex items-center justify-between mb-1.5 pt-1">
          <div className="flex items-center gap-2">
            <Clock size="1.125rem" style={{ color: ACCENT }} />
            <h2 className="font-bold" style={{ color: INK, fontSize: '1.125rem' }}>{t.worldClock}</h2>
          </div>

          {selectMode ? (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: INK_SOFT }}>{t.selectedCount(selected.length)}</span>
              <button onClick={cancelSelect} className="text-sm px-2 py-1 rounded-lg" style={{ color: INK_SOFT }}>{t.cancel}</button>
              <button onClick={confirmDelete} disabled={selected.length === 0}
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg font-medium"
                style={{ background: DANGER, color: '#fff', opacity: selected.length === 0 ? 0.4 : 1 }}>
                <Trash2 size={13} /> {t.delete}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative" ref={menuRef}>
                <button onClick={() => { setShowMenu(v => { const next = !v; if (next) openDropdownExclusive('timezone'); return next; }); setSubmenuCountry(null); }}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: ACCENT, color: '#fff' }}>
                  <Plus size={14} /> {t.addTimezone}
                </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 rounded-xl overflow-y-auto z-10" style={{ ...glass(), width: 220, maxHeight: 280, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
                  {!submenuCountry ? (
                    rootOptions.length === 0 ? (
                      <div className="px-3 py-3 text-sm" style={{ color: INK_SOFT }}>{t.allAdded}</div>
                    ) : (
                      rootOptions.map(c => (
                        <button key={c.id} onClick={() => handleCountryClick(c)}
                          className="w-full flex items-center justify-between text-left px-3 py-2 text-sm"
                          style={{ color: INK }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span className="flex items-center gap-1.5">
                            <Flag flag={c.flag} style={{ display: 'inline-block', lineHeight: 1 }} />
                            {c.name[lang]}
                          </span>
                          {c.zones.length > 1 && <ChevronDown size={14} style={{ transform: 'rotate(-90deg)', color: INK_SOFT }} />}
                        </button>
                      ))
                    )
                  ) : (
                    <div>
                      <button onClick={() => setSubmenuCountry(null)} className="w-full flex items-center gap-1 text-left px-3 py-2 text-sm font-medium" style={{ color: ACCENT, borderBottom: CARD_BORDER }}>
                        <ChevronLeft size={14} /> {t.back}
                      </button>
                      {subOptions.length === 0 ? (
                        <div className="px-3 py-3 text-sm" style={{ color: INK_SOFT }}>{t.allAdded}</div>
                      ) : (
                        subOptions.map(z => (
                          <button key={z.tz} onClick={() => addZone(submenuCountry, z.tz)}
                                                      className="w-full text-left px-3 py-2 text-sm"
                            style={{ color: INK }} 
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')} 
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {z.label ? z.label[lang] : z.tz}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          )}
        </div>

        {homeClock && (
          <ClockRow
            key={homeClock.id} clock={homeClock} now={now}
            selectMode={selectMode} selected={selected.includes(homeClock.id)}
            onLongPress={longPress} onTap={tap} lang={lang} t={t}
            hero isHome homeTz={homeClock.tz}
          />
        )}
      </div>

      {/* Part 2：其餘時區列表（以及尚未設定「目前位置」時的提示文字）。高度預設有上限（依畫面高度換算），
          時區加再多也不會把下面的時間軸推出畫面——超過上限的部份改成在這個範圍內自行上下捲動查看。
          收合／展開只能靠「時間軸」標題列手動往上拖曳（詳見上層的 handleWorldClockDragStart／Move／End）；
          原本清單自己捲到底/頂也會連動收合展開的功能已依需求移除，避免捲動清單時不小心誤觸收合。
          最高只能收到這裡完全消失（高度 0），不會蓋到上面 Part 1 的「目前位置」卡片或世界時鐘標題列——
          「點一下設為目前位置」這句提示原本放在 Part 1（固定不動），現在改放進這裡，
          這樣往上拖曳收合時也會一起被蓋住，而不是永遠浮在畫面上。
          大屏分欄且時間軸在右側（unlimitedHeight）時，世界時鐘自己獨占整個左欄，
          底下沒有時間軸要搶空間，這個高度上限就沒有意義了，直接取消、讓清單自然展開到底 */}
      <div
        ref={part2Ref}
        style={unlimitedHeight ? {
          maxHeight: 'none',
          overflowY: 'visible',
        } : {
          maxHeight: `${Math.max(0, part2Height)}px`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          transition: isDraggingWorldClock ? 'none' : 'max-height 0.25s ease',
        }}
      >
        {clocks.length > 0 && !homeTzId && !selectMode && (
          <p className="text-xs pt-2 px-1" style={{ color: INK_SOFT }}>{t.setAsCurrent}</p>
        )}
        <div className={(columns === 2 ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2") + " pt-1 pb-6"}>
          {clocks.length === 0 ? (
            <div className="text-sm px-2 py-4 col-span-2" style={{ color: INK_SOFT }}>{t.emptyClocks}</div>
          ) : restClocks.length === 0 ? null : (
            restClocks.map(c => (
              <ClockRow 
                key={c.id} clock={c} now={now} 
                selectMode={selectMode} selected={selected.includes(c.id)} 
                onLongPress={longPress} onTap={tap} lang={lang} t={t} 
                compact={columns === 2}
                isHome={false}
                homeTz={homeClock ? homeClock.tz : null}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Timeline & Landmark Logic ---------------- */

/* ---------------- 地標卡片匯出成圖片：純 Canvas 手繪 ----------------
 * 完全用 Canvas 2D API 重新畫一次卡片內容（背景圖模糊、文字、徽章、品牌浮水印），
 * 不依賴 DOM 截圖或 backdrop-filter（不同瀏覽器／裝置對截圖與濾鏡的支援度差異很大），
 * 所以匯出結果在任何裝置上都長得一樣。支援兩種輸出比例，讓使用者自選：
 *   'card'  —— 貼近原本卡片的直式比例，適合單張分享（例如發群組、聊天室）
 *   'story' —— 1080×1920（IG／FB 限時動態常用尺寸），卡片置中，背景用同一張圖延伸模糊鋪滿全畫面
 * 右下角固定加上「時光線」品牌浮水印（App 小圖示＋名稱），純用 Canvas 向量畫出來，不需要額外圖檔。
 */
const EXPORT_W = 1080;
const EXPORT_PAD = 64;
const EXPORT_RADIUS = 56;
const STORY_W = 1080;
const STORY_H = 1920;

// App 真正的圖示檔案路徑（public/icon-512.png，已確認）。
// 載入失敗時會自動 fallback 成下面手繪的簡易徽章，不會讓匯出功能整個壞掉。
const APP_ICON_SRC = '/icon-512.png';
let _appIconPromise = null;
function loadAppIconOnce() {
  if (!_appIconPromise) {
    _appIconPromise = loadImageAsync(APP_ICON_SRC).catch(() => null);
  }
  return _appIconPromise;
}

// Canvas 2D 完全不認得 CSS 的 var()，ctx.fillStyle 收到 'var(--accent, ...)' 這種字串會直接
// 被判定成無效值、悄悄忽略掉（不會報錯），畫出來的顏色就會不對或整塊消失。
// 匯出圖片用 Canvas 畫的強調色（生日／農曆日期徽章底色文字）不能用上面那個給 DOM／JSX
// 用的 ACCENT，得用這個純 hex 字串。兩者的顏色值要保持一致（都對應 --accent 的預設值）。
const ACCENT_CANVAS_HEX = '#6C7BE0';

function exportColors(isDark) {
  return isDark
    ? { ink: '#F2F3F6', inkSoft: 'rgba(242,243,246,0.65)', cardBg: '#1D2029', cardBorder: '#2B2F3A', pageBg: '#121419' }
    : { ink: '#232733', inkSoft: 'rgba(35,39,51,0.6)', cardBg: '#F7F8FA', cardBorder: '#ECEDF1', pageBg: '#FFFFFF' };
}

function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 判斷一張已載入的圖片是偏亮還是偏暗：縮到很小的尺寸畫進 canvas，取像素平均「感知亮度」
// （ITU-R BT.601 加權公式，比單純三色平均更貼近人眼對亮度的感受），低於門檻視為暗色圖片。
// 只需要抓一個概略趨勢，不追求精準，所以縮到 24x24 已經足夠且很快。
// 卡片預覽（DOM／CSS）跟匯出圖片（Canvas）共用同一個函式，兩邊判斷結果才會完全一致。
function isImageDark(img) {
  try {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    return total / (data.length / 4) < 130;
  } catch (err) {
    return false; // 讀取像素失敗（例如圖片來源受跨網域限制）一律當作亮色處理，不強制變白字
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 把圖片以「cover」方式（填滿並裁切多餘部分，不變形）畫進指定矩形範圍
function drawImageCover(ctx, img, x, y, w, h) {
  const srcRatio = img.width / img.height;
  const dstRatio = w / h;
  let sx, sy, sw, sh;
  if (srcRatio > dstRatio) {
    sh = img.height;
    sw = sh * dstRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dstRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// 簡單的文字自動換行（給標題用），超過 maxLines 就在最後一行截斷加上「…」
function wrapCanvasText(ctx, text, maxWidth, maxLines) {
  const chars = Array.from(text);
  const lines = [];
  let line = '';
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = chars[i];
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    const consumedChars = lines.slice(0, maxLines - 1).reduce((n, l) => n + l.length, 0) + last.length;
    if (consumedChars < chars.length) last += '…';
    lines[maxLines - 1] = last;
  }
  return lines;
}

// 徽章/膠囊：量文字寬度後畫一個貼合內容的圓角色塊，回傳畫完後的寬度（方便橫向排列）
function drawPill(ctx, text, x, y, { font, textColor, bgColor, padX = 24, height = 64 }) {
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const w = textW + padX * 2;
  roundRectPath(ctx, x, y, w, height, height / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + height / 2 + 2);
  return w;
}

// 品牌浮水印：優先畫「真正的 App 圖示」（appIcon 有載入成功的話），失敗或還沒設定好圖示路徑
// 品牌浮水印：只使用真正的 App 圖示（icon-512.png），不再有手繪版本。
// 萬一圖示載入失敗（例如路徑或網路問題），就只畫「時光線」文字，不畫方塊圖示，
// 確保匯出功能本身不會壞掉，但也不會出現手繪版本混用的情況。
// 注意：inkColor 傳的是這張卡片實際算出的 cardInk（會因自訂背景圖片偏暗而翻成白色），
// 不是固定的主題色，才能讓「時光線」字樣跟卡片其他文字一樣，疊在深色背景圖上時自動翻轉成看得清楚的顏色。
function drawBrandWatermark(ctx, rightX, bottomY, inkColor, appIcon) {
  const label = '時光線';
  ctx.font = '600 30px "Noto Sans TC", "PingFang TC", sans-serif';
  const textW = ctx.measureText(label).width;
  const logoSize = 44;
  const gap = 14;
  const totalW = appIcon ? logoSize + gap + textW : textW;
  const x0 = rightX - totalW;
  const topY = bottomY - logoSize;

  if (appIcon) {
    // 真正的 App 圖示：圓角方形裁切＋cover 方式塞滿
    ctx.save();
    const radius = logoSize * 0.28;
    roundRectPath(ctx, x0, topY, logoSize, logoSize, radius);
    ctx.clip();
    drawImageCover(ctx, appIcon, x0, topY, logoSize, logoSize);
    ctx.restore();
  }

  ctx.fillStyle = inkColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, appIcon ? x0 + logoSize + gap : x0, topY + logoSize / 2 + 1);
}

// 單行文字截斷（標題、日期小字現在改成單行 truncate，比照現在卡片樣式，不再是多行換行）
function truncateSingleLine(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  let line = '';
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i] + '…';
    if (ctx.measureText(test).width > maxWidth) break;
    line += chars[i];
  }
  return line + '…';
}

// 畫出卡片本體（背景圖模糊＋毛玻璃疊層＋所有文字內容＋品牌浮水印），回傳畫好的 canvas。
// 這個 canvas 本身就是「card」格式的輸出；「story」格式會再把它貼到一張更大的背景上。
// 版面對照現在「地標詳情」卡片的實際樣式：icon＋標題＋年齡徽章同一行、下方一行小字日期，
// 徽章（路標色／生日或關懷／重複頻率／曆法）獨立一排，中央是放大＋下移過的漸層大數字，
// 生日模式時不畫「每年」重複頻率徽章（跟生日徽章語意重複），原始日期只在使用者開啟時才畫一個小方塊。
async function buildEventCardCanvas(ev, lang, t, isDark) {
  const colors = exportColors(isDark);
  const w = EXPORT_W;
  const contentX = EXPORT_PAD;
  const contentW = w - EXPORT_PAD * 2;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');

  const iconBoxSize = 96;
  const titleFont = '700 56px "Noto Sans TC", "PingFang TC", sans-serif';
  const ageFont = '700 30px "Noto Sans TC", "PingFang TC", sans-serif';
  const dateFont = '400 30px "Noto Sans TC", "PingFang TC", sans-serif';
  const showRepeatBadge = !!ev.repeat && !ev.isBirthday && !ev.isCare && ev.mode !== 'companion'; // 生日／關懷固定每年重複，陪伴不循環
  const showAltCalendarBadge = ev.calendar && ev.calendar !== 'gregory' && ev.altCalendarStr;

  // 標題／年齡徽章同一行的寬度分配：先量年齡徽章寬度，剩下的空間才是標題可用寬度（標題單行截斷，比照現在樣式）
  mctx.font = ageFont;
  const ageBadgeText = ev.age !== null && ev.age !== undefined ? (ev.isCare ? t.anniversaryBadge(ev.age) : t.ageBadge(ev.age)) : '';
  const ageBadgeW = ageBadgeText ? mctx.measureText(ageBadgeText).width + 40 : 0; // +40 = 左右內距
  const titleGap = 20;
  const iconGap = 24;
  mctx.font = titleFont;
  const titleMaxWidth = contentW - iconBoxSize - iconGap - (ageBadgeText ? ageBadgeW + titleGap : 0);
  const titleLine = truncateSingleLine(mctx, ev.title || '', Math.max(60, titleMaxWidth));

  const headerBlockH = 56 + 12 + 38; // 標題行高 + 間距 + 日期小字行高
  const headerH = Math.max(iconBoxSize, headerBlockH);

  const badgeRowH = 64;
  const numberFont = `500 300px ${ev.numberFontFamily || "'Inter', sans-serif"}`;
  const numberH = 300 * 1.02;
  const numberLabelH = 46;

  let origDateBoxH = 0;
  if (ev.showOrigDate) origDateBoxH = 88;

  let h = EXPORT_PAD + headerH + 32 + badgeRowH + 46 + numberH + 16 + numberLabelH + 40;
  if (origDateBoxH) h += origDateBoxH + 24;
  h += EXPORT_PAD + 60; // 底部留給品牌浮水印
  h = Math.round(h);

  const canvas = document.createElement('canvas');
  const scale = 2; // 匯出用高解析度，避免分享到社媒被壓縮後模糊
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // ---- 背景：卡片本身的圓角剪裁範圍 ----
  roundRectPath(ctx, 0, 0, w, h, EXPORT_RADIUS);
  ctx.save();
  ctx.clip();

  // 跟卡片預覽同一套規則：背景圖片偏暗時，直接蓋在照片上、自己沒有另一層實色底色的文字
  // （標題／日期／路標色標籤／天數說明）改用白色，其餘本來就畫在實色徽章／方塊上的文字不受影響。
  let cardInk = colors.ink;
  let cardInkSoft = colors.inkSoft;

  const glassCleared = ev.bgOverlayOpacity === -1;
  // 跟卡片預覽（EventDetailModal 裡的 bgOpacity／overlaySliderValue）用同一套公式，
  // 這樣「遮罩透明度 <= 35」的判斷門檻在預覽跟匯出圖片之間才會完全一致。
  const exportBgOpacity = glassCleared ? 0 : Math.max(0, Math.min(1, ev.bgOverlayOpacity != null ? ev.bgOverlayOpacity : 0));
  const exportOverlaySliderValue = Math.round((1 - exportBgOpacity) * 100);
  // 遮罩顏色跟著 isDark 走（下面 fillStyle：淺色主題白色、深色主題深色 rgba(20,22,28,...)），
  // 跟卡片預覽現在的行為一致。遮罩不透明度夠高（<=35）時取消跟著原始照片亮度翻轉，改成固定
  // 顏色，但固定顏色也要跟著遮罩本身的顏色走：白色遮罩固定用黑字，深色遮罩固定用白字，
  // 不然會變成「黑字疊在幾乎全暗的遮罩上」完全看不見。
  const overlayNearOpaque = ev.bgImage && !glassCleared && exportOverlaySliderValue <= 35;

  if (ev.bgImage) {
    try {
      const img = await loadImageAsync(ev.bgImage);
      if (overlayNearOpaque) {
        cardInk = isDark ? '#fff' : '#000';
        cardInkSoft = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.78)';
      } else if (isImageDark(img)) {
        cardInk = '#fff';
        cardInkSoft = 'rgba(255,255,255,0.78)';
      }
      ctx.filter = glassCleared ? 'none' : 'blur(18px)';
      // 稍微放大再畫，避免模糊造成邊緣露出裁切外的透明像素
      drawImageCover(ctx, img, glassCleared ? 0 : -20, glassCleared ? 0 : -20, glassCleared ? w : w + 40, glassCleared ? h : h + 40);
      ctx.filter = 'none';
    } catch (err) {
      ctx.fillStyle = colors.cardBg;
      ctx.fillRect(0, 0, w, h);
    }
    if (!glassCleared) {
      ctx.fillStyle = isDark ? `rgba(20,22,28,${exportBgOpacity})` : `rgba(255,255,255,${exportBgOpacity})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      // 「原圖模式」：取消 Canvas 模糊與遮罩，直接保留原始圖片。
      ctx.filter = 'none';
    }
  } else {
    ctx.fillStyle = colors.cardBg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  // 卡片邊框
  roundRectPath(ctx, 1, 1, w - 2, h - 2, EXPORT_RADIUS);
  ctx.strokeStyle = colors.cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ---- 內容 ----
  let cursorY = EXPORT_PAD;

  // 圖示方塊（帶事件顏色的淡色底），比照現在卡片左上角的圓角色塊
  roundRectPath(ctx, contentX, cursorY, iconBoxSize, iconBoxSize, 26);
  ctx.fillStyle = `${colorHex(ev.colorId)}1c`;
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = '46px "Noto Color Emoji", "Apple Color Emoji", sans-serif';
  // 部分瀏覽器（尤其 Android Chrome）辨識不到彩色 emoji 字型時，會 fallback 成單色符號並沿用
  // 目前的 fillStyle——如果不重設，就會直接繼承上面圖示方塊背景那個極淡的顏色，變成「褪色」的樣子，
  // 所以畫 emoji 之前一定要明確重設成不透明的顏色
  ctx.fillStyle = colors.ink;
  ctx.fillText(ev.icon || '📌', contentX + iconBoxSize / 2, cursorY + iconBoxSize / 2 + 2);

  // 標題（單行截斷）＋ 年齡徽章同一行，垂直置中對齊圖示方塊上緣附近（比照現在卡片標題貼齊 icon 上緣的排法）
  const textBlockX = contentX + iconBoxSize + iconGap;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = titleFont;
  ctx.fillStyle = cardInk;
  ctx.fillText(titleLine, textBlockX, cursorY + 46);
  if (ageBadgeText) {
    const titleW = ctx.measureText(titleLine).width;
    drawPill(ctx, ageBadgeText, textBlockX + titleW + titleGap, cursorY + 12, {
      font: ageFont, textColor: colorHex(ev.colorId), bgColor: `${colorHex(ev.colorId)}20`, padX: 20, height: 48,
    });
  }
  // 日期小字（單行截斷），貼在標題正下方
  ctx.font = dateFont;
  ctx.fillStyle = cardInkSoft;
  const dateLine = truncateSingleLine(ctx, ev.dateStr || '', contentW - iconBoxSize - iconGap);
  ctx.fillText(dateLine, textBlockX, cursorY + 46 + 44);

  cursorY += headerH + 32;

  // 徽章排：路標色 → 生日／關懷 → 重複頻率（生日模式不畫）→ 曆法
  let badgeX = contentX;
  ctx.font = '700 28px "Noto Sans TC", "PingFang TC", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.beginPath();
  ctx.arc(badgeX + 12, cursorY + badgeRowH / 2 - 2, 11, 0, Math.PI * 2);
  ctx.fillStyle = colorHex(ev.colorId);
  ctx.fill();
  ctx.fillStyle = cardInkSoft;
  ctx.textAlign = 'left';
  ctx.fillText(t.markerColorLabel, badgeX + 32, cursorY + badgeRowH / 2);
  badgeX += 32 + ctx.measureText(t.markerColorLabel).width + 24;

  const pillFontSmall = '700 28px "Noto Sans TC", "PingFang TC", sans-serif';
  if (ev.isBirthday) {
    badgeX += drawPill(ctx, t.birthdayLabel, badgeX, cursorY, { font: pillFontSmall, textColor: ACCENT_CANVAS_HEX, bgColor: `${ACCENT_CANVAS_HEX}20`, padX: 20, height: badgeRowH }) + 16;
  } else if (ev.isCare) {
    badgeX += drawPill(ctx, t.careLabel, badgeX, cursorY, { font: pillFontSmall, textColor: colors.inkSoft, bgColor: colors.cardBorder, padX: 20, height: badgeRowH }) + 16;
  }
  if (showRepeatBadge) {
    const repeatLabel = ev.repeatUnit === 'month' ? t.monthlyBadge(ev.repeatInterval) : t.yearlyBadge(ev.repeatInterval);
    badgeX += drawPill(ctx, repeatLabel, badgeX, cursorY, { font: pillFontSmall, textColor: colors.inkSoft, bgColor: colors.cardBorder, padX: 20, height: badgeRowH }) + 16;
  }
  if (showAltCalendarBadge) {
    badgeX += drawPill(ctx, ev.altCalendarStr, badgeX, cursorY, { font: pillFontSmall, textColor: ACCENT_CANVAS_HEX, bgColor: `${ACCENT_CANVAS_HEX}20`, padX: 20, height: badgeRowH }) + 16;
  }
  cursorY += badgeRowH + 46;

  // 中央大數字：漸層填色，字體套用使用者目前選的數字字體（Canvas 2D 不支援 font-variation-settings，
  // 所以像 Nabla／Foldit 這類靠自訂軸或可變粗細呈現效果的字體，匯出時只會用該字體的預設樣式呈現）
  // 當天改顯示文字（漸層色）：生日模式顯示「生日快樂！」，其餘模式（關懷／紀念日／常規）顯示「一切順利！」。
  // 中文／英文在 canvas 放大字級；日文／韓文字級維持原本大小。
  const isTodayTextMessage = ev.mode !== 'companion' && ev.diffDays === 0;
  const isZh = lang === 'zh-TW';
  const numberText = ev.mode === 'companion'
    ? String(Math.max(0, ev.elapsedDays ?? 0))
    : ev.diffDays === 0 ? (ev.isBirthday ? t.birthdayCelebrationText : t.allGoodText) : String(Math.abs(ev.diffDays));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (isTodayTextMessage) {
    const todayFontFamily = '"Noto Sans TC", "PingFang TC", sans-serif';
    const todayFontSize = isZh || lang === 'en' ? 132 : 100; // 中文／英文在 canvas 放大，日文／韓文維持原本大小
    ctx.font = `700 ${todayFontSize}px ${todayFontFamily}`;
    const textW = ctx.measureText(numberText).width;
    const grad = ctx.createLinearGradient(w / 2 - textW / 2, cursorY, w / 2 + textW / 2, cursorY + 260);
    grad.addColorStop(0, colorHex(ev.colorId));
    grad.addColorStop(1, `${colorHex(ev.colorId)}aa`);
    ctx.fillStyle = grad;
    ctx.fillText(numberText, w / 2, cursorY + 240);
  } else {
    ctx.font = numberFont;
    const numW = ctx.measureText(numberText).width;
    const grad = ctx.createLinearGradient(w / 2 - numW / 2, cursorY, w / 2 + numW / 2, cursorY + 260);
    grad.addColorStop(0, colorHex(ev.colorId));
    grad.addColorStop(1, `${colorHex(ev.colorId)}aa`);
    ctx.fillStyle = grad;
    ctx.fillText(numberText, w / 2, cursorY + 240);
  }
  cursorY += numberH + 16;

  // 數字下方：兩側分隔線 ＋ 「還有／已過 N 天」文字，比照現在卡片樣式
  const daysLabel = ev.mode === 'companion' ? t.companionDays(Math.max(0, ev.elapsedDays ?? 0)) : ev.diffDays === 0 ? t.today : ev.diffDays > 0 ? t.daysLeft(ev.diffDays) : t.daysAgo(Math.abs(ev.diffDays));
  ctx.font = '500 30px "Noto Sans TC", "PingFang TC", sans-serif';
  const labelW = ctx.measureText(daysLabel).width;
  const dividerW = 46;
  const dividerGap = 24;
  const totalLabelW = dividerW * 2 + dividerGap * 2 + labelW;
  const labelStartX = w / 2 - totalLabelW / 2;
  ctx.strokeStyle = colors.cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(labelStartX, cursorY + numberLabelH / 2);
  ctx.lineTo(labelStartX + dividerW, cursorY + numberLabelH / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(labelStartX + totalLabelW - dividerW, cursorY + numberLabelH / 2);
  ctx.lineTo(labelStartX + totalLabelW, cursorY + numberLabelH / 2);
  ctx.stroke();
  ctx.fillStyle = cardInkSoft;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(daysLabel, labelStartX + dividerW + dividerGap, cursorY + numberLabelH / 2 + 1);
  cursorY += numberLabelH + 40;

  // 原始日期小方塊：只有使用者開啟「顯示原始日期」時才畫，比照現在卡片的呈現方式
  if (origDateBoxH) {
    roundRectPath(ctx, contentX, cursorY, contentW, origDateBoxH, 20);
    ctx.fillStyle = colors.cardBg;
    ctx.fill();
    ctx.strokeStyle = colors.cardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '400 28px "Noto Sans TC", "PingFang TC", sans-serif';
    ctx.fillStyle = colors.inkSoft;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${t.originalDate}：${ev.origDateStr}`, contentX + 28, cursorY + origDateBoxH / 2 + 1);
    cursorY += origDateBoxH + 24;
  }

  // 品牌浮水印：先嘗試載入真正的 App 圖示，載入失敗（或還沒設定正確路徑）就自動用手繪版本；
  // 文字顏色傳 cardInk（已依背景圖片深淺翻轉過），跟卡片其他文字一致，不會被深色背景圖蓋到看不見。
  const appIcon = await loadAppIconOnce();
  drawBrandWatermark(ctx, w - EXPORT_PAD, h - EXPORT_PAD + 12, cardInk, appIcon);

  return canvas;
}

// 'story' 格式：把卡片貼在 1080×1920 的全螢幕背景上（背景用同一張圖延伸模糊鋪滿，沒有自訂圖就用漸層）
async function buildStoryCanvas(cardCanvas, ev, isDark) {
  const colors = exportColors(isDark);
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');

  if (ev.bgImage) {
    try {
      const img = await loadImageAsync(ev.bgImage);
      ctx.filter = 'blur(36px)';
      drawImageCover(ctx, img, -40, -40, STORY_W + 80, STORY_H + 80);
      ctx.filter = 'none';
      ctx.fillStyle = isDark ? 'rgba(10,11,15,0.45)' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, 0, STORY_W, STORY_H);
    } catch (err) {
      ctx.fillStyle = colors.pageBg;
      ctx.fillRect(0, 0, STORY_W, STORY_H);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, STORY_H);
    if (isDark) { grad.addColorStop(0, '#1D2029'); grad.addColorStop(1, '#121419'); }
    else { grad.addColorStop(0, '#EFF1FE'); grad.addColorStop(1, '#FFFFFF'); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  const scale = Math.min(1, (STORY_W - 100) / (cardCanvas.width / 2));
  const cw = (cardCanvas.width / 2) * scale;
  const ch = (cardCanvas.height / 2) * scale;
  const cx = (STORY_W - cw) / 2;
  const cy = (STORY_H - ch) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  ctx.drawImage(cardCanvas, cx, cy, cw, ch);
  ctx.restore();

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

async function exportEventCardImage(ev, lang, t, isDark, format) {
  const cardCanvas = await buildEventCardCanvas(ev, lang, t, isDark);
  const finalCanvas = format === 'story' ? await buildStoryCanvas(cardCanvas, ev, isDark) : cardCanvas;
  const blob = await canvasToBlob(finalCanvas);
  const safeTitle = (ev.title || 'event').replace(/[\\/:*?"<>|]/g, '').slice(0, 24);
  const filename = `時光線_${safeTitle}_${format === 'story' ? 'story' : 'card'}.png`;
  return { blob, filename };
}

async function shareOrDownloadImage(blob, filename, t) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // 使用者自己取消分享，不算失敗
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- 地標詳情視窗：點一下時間軸卡片（非編輯／刪除按鈕）開啟 ----------------
 * 完整呈現這個地標的所有資訊（日期、對照曆法、重複週期、生日歲數、關懷模式等），
 * 並提供「上傳圖片當卡片背景」的功能：圖片是獨立疊在毛玻璃卡片「下面」的一層，
 * 卡片本身的 backdropFilter 模糊＋泛白效果會直接套用在這張圖片上，
 * 呈現「毛玻璃蓋在照片上」的效果，而不是把毛玻璃質感整個換掉。 */
function LandmarkDetailModal({ ev, lang, t, isDark, onClose, onSetBgImage, onSetBgOpacity, onSetNumberFont, dock = false, closing = false }) {
  const [phase, setPhase] = useState('enter'); // 'enter' -> 'shown' -> 'closing'，動畫節奏同世界時鐘的視窗
  const CLOSE_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  // dock 模式下，App 那層换成別的卡片時會透過 closing 這個外部訊號要求播放關閉動畫，
  // 這裡只負責視覺效果，不會自己呼叫 onClose——卸載／換上新卡片的時機統一由 App 控制
  useEffect(() => {
    if (closing) setPhase('closing');
  }, [closing]);
  function handleClose() {
    setPhase('closing');
    setTimeout(onClose, CLOSE_DURATION);
  }
  useModalBackClose(true, handleClose);
  const shown = phase === 'shown';

  // 視窗開著時鎖住背後頁面的捲動：非 dock（手機置中彈窗）模式下，視窗本身雖然是 fixed 定位，
  // 但如果背後的頁面還能被手指滑動，視覺上會讓人覺得「整張卡片被拖走」了（如截圖所示，
  // 卡片跟著背後時間軸一起位移）。這裡在視窗掛載期間把 body 捲動鎖住，卸載時還原，
  // dock（分欄嵌入右側面板）模式不受影響，因為它本來就不是蓋在整頁上面的彈窗。
  useEffect(() => {
    if (dock) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [dock]);

  // 自動判斷背景圖是偏亮還是偏暗，跟匯出圖片共用同一套判斷邏輯（見 isImageDark）。
  const [bgIsDark, setBgIsDark] = useState(false);
  useEffect(() => {
    if (!ev.bgImage) { setBgIsDark(false); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setBgIsDark(isImageDark(img)); };
    img.onerror = () => setBgIsDark(false);
    img.src = ev.bgImage;
    return () => { cancelled = true; };
  }, [ev.bgImage]);

  // 「調節遮罩透明度」面板要用到的幾個數值，搬到 cardInk 判斷之前，因為下面的黑／白字邏輯
  // 現在也需要用到 overlaySliderValue（遮罩透明度滑桿數值，0～100）。
  // bgOverlayOpacity 0～1 代表遮罩本身的不透明度；-1 是一個保留值，代表「清除玻璃效果（原圖模式）」。
  // 這樣可以在不新增資料欄位的前提下保存「原圖模式」，也能兼容既有事件資料。
  // 預設（使用者從未調整過）的遮罩不透明度是 0.75，對應滑桿數值 25（=「25% 透明」）。
  const glassCleared = ev.bgOverlayOpacity === -1;
  // 遮罩預設值：使用者剛上傳圖片、還沒自己調整過時，滑桿數值預設是 100（遮罩幾乎完全透明，直接看到照片）。
  const DEFAULT_BG_OPACITY = 0;
  // 卡片沒有自訂背景圖片時，卡片本身的毛玻璃底色透明度固定是 25（即 75% 不透明）。
  const NO_IMAGE_CARD_OPACITY = 0.75;
  const bgOpacity = glassCleared ? 0 : Math.max(0, Math.min(1, ev.bgOverlayOpacity != null ? ev.bgOverlayOpacity : DEFAULT_BG_OPACITY));
  const SLIDER_MAX = 100;
  // 滑桿數值＝「透明度」，0～100：0 是遮罩完全不透明，100 是遮罩完全消失（等同看到原圖）。
  const overlaySliderValue = Math.round((1 - bgOpacity) * SLIDER_MAX);

  // 只有「直接蓋在背景圖片上、自己沒有另外一層實色底色」的文字／圖示，才需要在背景偏暗時
  // 換成白色，否則像素卡片背景、標籤徽章這些本來就有自己實色底色的元素，字色反而不該跟著換
  // （不然背景偏亮時的白底配白字、或背景偏暗時深色底配深色字，都會變得完全看不見）。
  // 但遮罩透明度（overlaySliderValue）小於等於 35 時，遮罩本身已經蓋得相當不透明，畫面幾乎
  // 被遮罩蓋掉、看不太出原始照片深淺，這時候還照原始照片亮度翻轉，反而常常看不清楚。
  // 這種情況直接取消翻轉，改用固定顏色——但遮罩顏色現在跟著 App 深色／淺色模式走（見下面
  // 遮罩那層 div：淺色模式白色、深色模式改用跟匯出圖片一致的深色 rgba(20,22,28,...)），
  // 所以固定顏色也要跟著遮罩本身的顏色走：遮罩是白色（淺色模式）時固定用黑色，遮罩是深色
  // （深色模式）時固定用白色，才不會變成「黑字疊在幾乎全暗的遮罩上」完全看不見。
  const overlayNearOpaque = ev.bgImage && !glassCleared && overlaySliderValue <= 35;
  const cardInk = overlayNearOpaque ? (isDark ? '#fff' : '#000') : (ev.bgImage && bgIsDark ? '#fff' : INK);
  const cardInkSoft = overlayNearOpaque ? (isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.78)') : (ev.bgImage && bgIsDark ? 'rgba(255,255,255,0.78)' : INK_SOFT);

  const [uploading, setUploading] = useState(false);
  const [bgError, setBgError] = useState('');
  const fileInputRef = useRef(null);
  // 「調節遮罩透明度」面板的展開狀態：只有設定過自訂背景圖片時才有意義。
  // bgOverlayOpacity 始終代表「遮罩本身」的不透明度；毛玻璃 blur 效果固定，不由此滑桿控制。
  const [showOpacityAdjust, setShowOpacityAdjust] = useState(false);
  const originalImageLabel = lang === 'zh-TW' ? '原圖' : lang === 'ja' ? '原画像' : lang === 'ko' ? '원본' : 'Original';
  // 「原圖」改成滑桿右側一顆獨立的長條按鈕：記住切換到原圖模式之前的透明度，
  // 這樣再次點擊取消原圖模式時，可以還原回使用者原本調整的數值，而不是每次都跳回預設值。
  const lastOpacityRef = useRef(bgOpacity);
  useEffect(() => {
    if (!glassCleared) lastOpacityRef.current = bgOpacity;
  }, [bgOpacity, glassCleared]);
  function toggleOriginalImage() {
    if (glassCleared) {
      onSetBgOpacity(lastOpacityRef.current != null ? lastOpacityRef.current : DEFAULT_BG_OPACITY);
    } else {
      onSetBgOpacity(-1);
    }
  }
  // 拖動滑桿時即時顯示目前的透明度數值：mousedown/touchstart 開始顯示，
  // 放開（可能是放在滑桿以外的地方）時透過 window 上的事件監聽收起，避免手指滑出滑桿範圍後數值提示卡住不消失。
  const [sliderDragging, setSliderDragging] = useState(false);
  useEffect(() => {
    if (!sliderDragging) return;
    const stop = () => setSliderDragging(false);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
    };
  }, [sliderDragging]);
  // 滑塊本身顯示的數值：平常跟著 overlaySliderValue（來自已提交的 bgOpacity）走，
  // 但拖動當下改成完全由本地 state 即時驅動，不等父層那份被節流過的 state，
  // 這樣滑塊視覺位置永遠跟手指同步，一放開才把「當下本地值」跟外部已提交值重新對齊。
  const [localSliderValue, setLocalSliderValue] = useState(overlaySliderValue);
  useEffect(() => {
    if (!sliderDragging) setLocalSliderValue(overlaySliderValue);
  }, [overlaySliderValue, sliderDragging]);
  // 白色遮罩實際顯示用的不透明度：拖動當下直接由 localSliderValue（零延遲的本地 state）換算，
  // 不要再等 bgOpacity——bgOpacity 來自父層的 ev.bgOverlayOpacity，是透過 onSetBgOpacity 用
  // requestAnimationFrame 節流、且會觸發整個視窗（甚至更外層）重新渲染的「已提交」值，實際更新
  // 速度天生就會落後於滑塊本身的移動，造成「滑桿滑得很順、但遮罩變化明顯慢半拍」的落差感。
  // 拖動結束後 sliderDragging 變 false，就自動切回吃已提交的 bgOpacity，行為完全不變。
  const displayBgOpacity = sliderDragging ? Math.max(0, Math.min(1, 1 - localSliderValue / SLIDER_MAX)) : bgOpacity;
  // 拖動滑桿時，用 requestAnimationFrame 把「實際送去改變 bgOpacity（觸發整個視窗重新渲染）」
  // 的次數節流到最多每畫格一次；但滑塊本身要跟手指完全零延遲，所以另外用一份本地 state
  // 直接綁在 input 的 value 上，每個原生事件都立即更新，不受節流影響——節流只延遲「連動效果」
  // （白色遮罩、拖動數值氣泡背後真正送出的資料），不會延遲「手指拖著滑塊移動」這個動作本身。
  const sliderRafRef = useRef(null);
  useEffect(() => () => { if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current); }, []);
  // 「自訂」二級面板：把卡片背景／數字字體這些比較次要的設定收在齒輪按鈕後面，
  // 預設收合，點擊後視窗才會縱向加長展開，避免一打開詳情視窗就塞滿一堆按鈕
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  // 「數字字體」標題旁的 ⓘ：預設收合，點一下才展開字體相關的補充說明。
  // 這顆按鈕刻意放在字體橫向捲動清單「外面」（同一列但不在 overflow-x-auto 容器內），
  // 所以捲動字體清單時 ⓘ 固定在標題右側不會跟著跑，比原本可能被捲動帶走的做法穩定。
  const [showFontInfo, setShowFontInfo] = useState(false);
  // 「查看授權資訊」再往下一層的完整條款彈窗：預設收合，避免一長串 OFL 全文一開卡片就佔滿畫面
  const [showFontLicenseModal, setShowFontLicenseModal] = useState(false);
  // 這兩層都掛進同一套「Esc／手機返回」堆疊：兩層目前設計上互斥（開條款彈窗時會同時關掉浮層），
  // 但仍各自掛勾是為了在堆疊裡佔到正確的「上層」位置——按一次 Esc 只關最上面那層，不會兩層一起關掉。
  useModalBackClose(showFontInfo, () => setShowFontInfo(false));
  useModalBackClose(showFontLicenseModal, () => setShowFontLicenseModal(false));
  // 掛載＋淡入淡出動畫狀態，見 useOverlayTransition 定義處的說明
  const [fontInfoMounted, fontInfoShown] = useOverlayTransition(showFontInfo, 120);
  const [fontLicenseMounted, fontLicenseShown] = useOverlayTransition(showFontLicenseModal, 130);
  const numberFontId = ev.numberFont || 'inter';
  const numberFontFamily = getNumberFontFamily(numberFontId);
  const numberFontVariation = getNumberFontVariation(numberFontId);
  // 中央大數字實際顯示的內容與位數：當天（diffDays === 0）改顯示文字訊息——生日模式顯示「生日快樂！」，
  // 其餘模式（關懷／紀念日／常規）顯示「一切順利！」，不走位數對照表（見下方 isTodayTextMessage 分支）；
  // 其餘情況一律取絕對值（不顯示正負號），位數依字串長度動態決定字級，見 getBigNumberFontSize。
  const isCompanionMode = ev.mode === 'companion';
  const isTodayTextMessage = !isCompanionMode && ev.diffDays === 0;
  const isZh = lang === 'zh-TW';
  const bigNumberDisplay = isCompanionMode
    ? String(Math.max(0, ev.elapsedDays ?? 0))
    : ev.diffDays === 0 ? (ev.isBirthday ? t.birthdayCelebrationText : t.allGoodText) : String(Math.abs(ev.diffDays));
  // 「生日快樂！」／「一切順利！」是一整句文字，不是數字位數，用固定字級（比照 4～5 位數的縮小級距）避免撐爆卡片寬度。
  // 中文版卡片內字級比其他語言再放大一些；其他語言字級維持原本大小
  // （英文只在下面 canvas 匯出時放大，詳情卡片本身不放大）。
  const bigNumberFontSize = isTodayTextMessage
    ? (isZh ? 70 : 52)
    : getBigNumberFontSize(bigNumberDisplay.length);
  const todayTextFontFamily = numberFontFamily;
  // 卡片一渲染就先載入「目前選中的」這款字體（若不是預設的系統圓體，例如使用者曾選過其他字體），
  // 不等使用者打開自訂面板才載入，否則字體檔案還沒到位、瀏覽器會先 fallback 成系統字體。
  // 系統圓體本身已經在 App 啟動時全域載入過了，這裡主要是補載「非預設」的字體。
  useEffect(() => {
    const current = NUMBER_FONTS.find(f => f.id === numberFontId);
    if (current) ensureGoogleFontLoaded(current.googleFont);
  }, [numberFontId]);
  // 面板打開後再把「其餘」字體也載入，方便使用者切換時預覽（系統圓體／Quicksand 不需要，其餘幾款才需要）
  useEffect(() => {
    if (!showCustomizePanel) return;
    NUMBER_FONTS.forEach(f => ensureGoogleFontLoaded(f.googleFont));
  }, [showCustomizePanel]);

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 清空，允許之後重新選同一個檔案也能觸發 onChange
    if (!file) return;
    setUploading(true);
    setBgError('');
    try {
      const dataUrl = await resizeImageFile(file);
      onSetBgImage(dataUrl);
    } catch (err) {
      setBgError(t.customBgError);
    } finally {
      setUploading(false);
    }
  }

  const dateStr = ev.targetDate.toLocaleDateString(LOCALE_MAP[lang], { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const origDateStr = ev.date ? new Date(`${ev.date}T00:00:00`).toLocaleDateString(LOCALE_MAP[lang]) : '';
  const showOrigDate = !!ev.repeat && origDateStr && origDateStr !== dateStr;
  const altCalendarStr = ev.calendar && ev.calendar !== 'gregory' ? formatAltCalendar(ev.targetDate, ev.calendar, lang, t) : '';

  // 匯出成圖片：使用者先選格式（卡片 / 限動），再實際產生 PNG 並分享或下載
  const [exportFormat, setExportFormat] = useState('card'); // 'card' | 'story'
  const [showExportPanel, setShowExportPanel] = useState(false); // 「匯出成圖片」收合面板，跟「更換圖片」同一排的 icon 按鈕觸發
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const exportEv = { ...ev, dateStr, origDateStr, showOrigDate, altCalendarStr, numberFontFamily, numberFontVariation };
      const { blob, filename } = await exportEventCardImage(exportEv, lang, t, isDark, exportFormat);
      await shareOrDownloadImage(blob, filename, t);
    } catch (err) {
      setExportError(t.exportError);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
    <div
      className={dock ? 'relative h-full w-full' : 'fixed inset-0 flex items-center justify-center px-6'}
      style={dock ? undefined : { zIndex: 200, background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: `background ${CLOSE_DURATION}ms ease`, touchAction: 'none' }}
      onClick={dock ? undefined : handleClose}
      onTouchMove={dock ? undefined : (e => { if (e.target === e.currentTarget) e.preventDefault(); })}
    >
      {/* 極簡透明度滑桿：細軌道＋小圓形滑塊，與卡片 UI 保持一致。
          滑桿只代表「遮罩顯隱程度」，不會改變 backdrop-filter 的模糊強度。 */}
      <style>{`
        .premium-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 24px;
          margin: 0;
          padding: 0;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
          background: transparent;
        }
        .premium-range::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 999px;
          background: transparent;
        }
        .premium-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          margin-top: -9.5px;
          border: 1px solid rgba(255,255,255,0.88);
          border-radius: 50%;
          background: rgba(255,255,255,0.96);
          box-shadow: 0 1px 5px rgba(0,0,0,0.2);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .premium-range::-webkit-slider-thumb:active {
          transform: scale(1.08);
          box-shadow: 0 1px 6px rgba(0,0,0,0.24), 0 0 0 5px rgba(108,123,224,0.14);
        }
        .premium-range::-moz-range-track {
          height: 3px;
          border-radius: 999px;
          background: transparent;
        }
        .premium-range::-moz-range-progress {
          height: 3px;
          border-radius: 999px;
          background: ${colorHex(ev.colorId)};
        }
        .premium-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border: 1px solid rgba(255,255,255,0.88);
          border-radius: 50%;
          background: rgba(255,255,255,0.96);
          box-shadow: 0 1px 5px rgba(0,0,0,0.2);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .premium-range::-moz-range-thumb:active {
          transform: scale(1.08);
        }
        .premium-range:focus-visible {
          outline: 2px solid ${accentAlpha('55')};
          outline-offset: 3px;
        }
        /* 匯出格式滑塊開關：卡片／限動(9:16) 兩個選項用會滑動的膠囊背景表示目前選中哪一個 */
        .export-format-toggle {
          position: relative;
          display: flex;
          padding: 3px;
          border-radius: 999px;
          background: var(--card-border);
        }
        .export-format-toggle .toggle-thumb {
          position: absolute;
          top: 3px;
          bottom: 3px;
          border-radius: 999px;
          background: ${ACCENT};
          box-shadow: 0 2px 8px rgba(108,123,224,0.35);
          transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .export-format-toggle button {
          position: relative;
          z-index: 1;
          flex: 1;
          background: transparent;
          transition: color 0.2s ease;
        }
        /* 數字字體橫向捲動選單：隱藏卷軸但保留可捲動手感（webkit／Firefox 都處理） */
        .font-scroll::-webkit-scrollbar { display: none; }
        .font-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        /* 背景圖片深淺判定完成、cardInk／cardInkSoft 切換深色或白色文字時，
           讓顏色本身平滑過渡，而不是瞬間跳色；只影響 color（文字／icon），不影響背景或版面。 */
        .card-ink-fade, .card-ink-fade * {
          transition: color 260ms ease;
        }
      `}</style>
      <div
        className={dock ? 'relative w-full h-full rounded-3xl' : 'relative w-full max-w-sm max-h-[85vh] rounded-3xl'}
        style={{
          opacity: shown ? 1 : 0,
          // dock（分欄右側面板）模式下改成從右邊帶點彈性地「彈射」滑入；非 dock（手機置中彈窗）維持原本由下往上彈出的效果
          transform: shown
            ? 'scale(1) translateX(0px) translateY(0px)'
            : dock ? 'scale(0.94) translateX(28px) translateY(0px)' : 'scale(0.92) translateX(0px) translateY(14px)',
          transition: `opacity ${CLOSE_DURATION}ms ease, transform ${CLOSE_DURATION}ms cubic-bezier(0.34, 1.28, 0.64, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 自訂背景圖片：最底層。圖片本身完全不跟著滑桿改變透明度。 */}
        {ev.bgImage && (
          <img
            src={ev.bgImage}
            alt=""
            className="absolute inset-0 w-full h-full rounded-3xl"
            style={{
              objectFit: 'cover',
              zIndex: 0,
              display: 'block',
            }}
          />
        )}

        {/* 玻璃效果層：正常模式固定輕度模糊；點擊「原圖」按鈕進入原圖模式後，整層完全移除。 */}
        {ev.bgImage && !glassCleared && (
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              zIndex: 1,
              backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)',
            }}
          />
        )}

        {/* 唯一受滑桿控制的遮罩：滑桿數值 0～100 對應遮罩從完全不透明到完全消失。
            遮罩顏色跟著 App 的深色／淺色模式走（淺色模式白色、深色模式改用跟匯出圖片
            buildEventCardCanvas 同一個深色 rgba(20,22,28,...)）——原本這裡固定寫死白色，
            深色模式切換對這個預覽視窗完全沒有視覺差異，只有匯出的圖片才看得出深色遮罩，
            兩邊不一致。現在預覽跟匯出用同一組顏色，深色模式下也能在這裡直接看到遮罩變化。
            拖動滑桿當下不套用 transition，讓遮罩即時跟著手指變化，不會因為每個畫格都在追
            前一個還沒播完的 90ms 轉場而看起來delay／卡頓；放開手指、或透過按鈕（例如「原圖」）
            觸發的變化才套用平滑轉場。 */}
        {ev.bgImage && !glassCleared && (
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              zIndex: 2,
              background: isDark ? `rgba(20,22,28,${displayBgOpacity})` : `rgba(255,255,255,${displayBgOpacity})`,
              transition: sliderDragging ? 'none' : 'background 90ms linear',
            }}
          />
        )}

        {/* 沒有背景圖片時的毛玻璃底色：獨立成一層「不隨內容捲動」的絕對定位圖層，
            不要把 backdrop-filter 直接加在下面那個會捲動、又處於父層開合動畫 transform 之下
            的內容層上——這個組合在手機瀏覽器上，手指拖動（捲動）當下很容易讓模糊層跟丟、
            看起來像整塊內容瞬間跑位。獨立成一層之後，捲動只會捲動內容本身，這層毛玻璃底色
            固定不動，就不會再跟著跑位。 */}
        {!ev.bgImage && (
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              zIndex: 2,
              background: `rgba(255,255,255,${NO_IMAGE_CARD_OPACITY})`,
              backdropFilter: AUTH_GLASS.backdropFilter,
              WebkitBackdropFilter: AUTH_GLASS.WebkitBackdropFilter,
            }}
          />
        )}

        <div className={(dock ? 'relative w-full h-full overflow-y-auto rounded-3xl p-5 flex flex-col' : 'relative w-full max-h-[85vh] overflow-y-auto rounded-3xl p-5 flex flex-col') + ' card-ink-fade'} style={{
          ...AUTH_GLASS,
          // 內容層本身永遠保持透明、不帶 backdrop-filter；不管有沒有背景圖片，
          // 毛玻璃／模糊效果一律交給上面各自獨立的靜態圖層負責，內容層只負責捲動。
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          zIndex: 3,
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          // 拖動透明度滑桿時暫時鎖住這層本身的捲動：手指按在滑桿上、只要有一點點垂直位移，
          // 瀏覽器原生就可能把它判讀成「捲動這層」的手勢，導致文字內容跟著滑桿一起跑位。
          // 拖動期間直接關閉捲動，放開後才恢復，滑桿操作跟文字內容就完全不會互相干擾。
          overflowY: sliderDragging ? 'hidden' : 'auto',
        }}>
          {/* 有自訂背景時不再疊加額外彩色光暈，避免遮住背景圖片；沒有背景時才保留原本的柔光。 */}
          {!ev.bgImage && (
            <>
              <div className="absolute pointer-events-none" style={{ width: '55%', aspectRatio: '1', top: '-18%', right: '-15%', background: `${colorHex(ev.colorId)}22`, filter: 'blur(50px)', borderRadius: '50%', zIndex: 0 }} />
              <div className="absolute pointer-events-none" style={{ width: '45%', aspectRatio: '1', bottom: '-12%', left: '-12%', background: `${colorHex(ev.colorId)}15`, filter: 'blur(50px)', borderRadius: '50%', zIndex: 0 }} />
            </>
          )}

          {/* 左上角：事件圖示＋標題／日期，樣式比照倒數卡片設計 */}
          <div className="w-full flex items-start justify-between gap-2 relative" style={{ zIndex: 1 }}>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex items-center justify-center flex-shrink-0 rounded-2xl"
                style={{ width: 46, height: 46, background: `${colorHex(ev.colorId)}1c`, fontSize: 22, boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6)' }}
              >
                {ev.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold truncate" style={{ color: cardInk, fontSize: 17, letterSpacing: '-0.01em' }}>{ev.title}</h3>
                  {/* 生日徽章：XX歲生日，緊跟在事件名稱後面 */}
                  {ev.age !== null && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${colorHex(ev.colorId)}20`, color: colorHex(ev.colorId) }}>
                      {ev.isCare ? t.anniversaryBadge(ev.age) : t.ageBadge(ev.age)}
                    </span>
                  )}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: cardInkSoft }}>{dateStr}</p>
              </div>
            </div>
            <button onClick={handleClose} aria-label={t.close} style={{ color: cardInkSoft, flexShrink: 0 }}><X size={18} /></button>
          </div>

          {/* 次要標籤：顏色標記／生日／關懷／農曆日期，統一做成徽章樣式；年齡與週年只保留在標題旁。 */}
          <div className="flex items-center gap-2 flex-wrap mt-2 relative" style={{ zIndex: 1 }}>
            <span className="inline-flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: cardInkSoft }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorHex(ev.colorId) }} />
              {t.markerColorLabel}
            </span>
            {ev.isBirthday ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0" style={{ background: accentAlpha('20'), color: ACCENT, border: `1px solid ${accentAlpha('22')}` }}>{t.birthdayLabel}</span>
            ) : ev.isCare ? (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                style={{
                  background: `${colorHex(ev.colorId)}18`,
                  color: colorHex(ev.colorId),
                  border: `1px solid ${colorHex(ev.colorId)}22`,
                }}
              >
                {t.careLabel}
              </span>
            ) : null}
            {/* 年齡／週年徽章只保留在事件名稱右側，避免詳情卡片重複顯示。 */}
            {/* 開啟循環後，詳情卡片不再額外顯示「每年／每月」頻率文字；循環本身已由模式／事件資訊表達。 */}
            {altCalendarStr && (
              // 關懷模式的事件：曆法徽章改用事件本身的顏色（呼應「關懷」徽章與圖示色塊），
              // 不再套用強調色 ACCENT；其餘模式維持原本的 ACCENT 樣式不變。
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: ev.isCare ? `${colorHex(ev.colorId)}20` : accentAlpha('20'),
                  color: ev.isCare ? colorHex(ev.colorId) : ACCENT,
                }}
              >
                {altCalendarStr}
              </span>
            )}
          </div>

          {/* 中央超大剩餘天數，樣式比照倒數卡片設計：大數字＋兩側分隔線的說明文字（數字再放大一階）。
              不透明度固定 100%（漸層兩端改用同一個全不透明顏色，純粹做出角度光澤感，不再讓文字本身透出底色）；
              字級則依數字位數動態縮放——位數越多，單一數字就越小，確保長數字不會被卡片寬度截斷或擠壓變形。 */}
          <div className="flex flex-col items-center justify-center relative" style={{ zIndex: 1, padding: '38px 0 26px' }}>
            <div
              style={{
                fontSize: bigNumberFontSize,
                lineHeight: 0.85,
                fontWeight: 500,
                letterSpacing: '-0.04em',
                fontFamily: isTodayTextMessage ? todayTextFontFamily : numberFontFamily,
                fontVariationSettings: isTodayTextMessage && isZh ? 'normal' : numberFontVariation,
                background: `linear-gradient(135deg, ${colorHex(ev.colorId)}, ${colorHex(ev.colorId)})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                opacity: 1,
                filter: `drop-shadow(0 8px 20px ${colorHex(ev.colorId)}33)`,
                transition: 'font-family 0.15s ease, font-size 0.15s ease',
              }}
            >
              {bigNumberDisplay}
            </div>
            <div className="flex items-center gap-4 mt-3" style={{ color: cardInkSoft, fontSize: 14, fontWeight: 500 }}>
              <span style={{ width: 30, height: 1, background: 'var(--card-border)' }} />
              <span>{isCompanionMode
                ? t.companionDays(Math.max(0, ev.elapsedDays ?? 0))
                : ev.diffDays === 0 ? t.today : ev.diffDays > 0 ? t.daysLeft(ev.diffDays) : t.daysAgo(Math.abs(ev.diffDays))}</span>
              <span style={{ width: 30, height: 1, background: 'var(--card-border)' }} />
            </div>
          </div>

          {showOrigDate && (
            <div className="p-3 rounded-xl relative" style={{ background: CARD_BG, border: CARD_BORDER, zIndex: 1 }}>
              <div className="text-xs" style={{ color: INK_SOFT }}>{t.originalDate}：{origDateStr}</div>
            </div>
          )}

          {/* 二級功能列：「自訂」（齒輪＋文字）收合卡片背景／數字字體等次要設定；
              「分享」icon 按鈕維持在同一排、獨立展開匯出面板 */}
          <div className="mt-5 pt-4 flex items-center gap-2 relative" style={{ borderTop: CARD_BORDER, zIndex: 1 }}>
            <button
              onClick={() => setShowCustomizePanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold flex-shrink-0"
              style={{ background: showCustomizePanel ? ACCENT : 'var(--card-border)', color: showCustomizePanel ? '#fff' : cardInkSoft }}
            >
              <Settings size={15} />
              {t.customizeLabel}
            </button>
            {/* 匯出成圖片：獨立 icon 按鈕，點了展開下方的格式選擇＋分享面板 */}
            <button
              onClick={() => setShowExportPanel(v => !v)}
              aria-label={t.exportLabel}
              title={t.exportLabel}
              className="p-2 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto"
              style={{ background: showExportPanel ? ACCENT : 'var(--card-border)', color: showExportPanel ? '#fff' : cardInkSoft, width: '2.25rem', height: '2.25rem' }}
            >
              <Share2 size={15} />
            </button>
          </div>

          {/* 「自訂」二級面板：預設收合，點擊齒輪按鈕後視窗縱向加長展開，
              裡面包含「更換卡片背景」與「更換數字字體」兩個欄目 */}
          <div
            className="relative"
            style={{
              zIndex: 1,
              maxHeight: showCustomizePanel ? 640 : 0,
              opacity: showCustomizePanel ? 1 : 0,
              marginTop: showCustomizePanel ? 14 : 0,
              overflow: 'hidden',
              transition: 'max-height 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 130ms ease, margin-top 160ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* 更換卡片背景：上傳／更換／移除，圖片會先在瀏覽器端等比縮小再存起來，避免佔用太多空間 */}
            <div className="pb-4" style={{ borderBottom: CARD_BORDER }}>
              <div className="text-xs font-bold mb-2" style={{ color: cardInkSoft }}>{t.customBgLabel}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0"
                  style={{ background: MINT, color: '#fff', opacity: uploading ? 0.6 : 1 }}
                >
                  {uploading ? t.customBgUploading : ev.bgImage ? t.customBgChange : t.customBgUpload}
                </button>
                {ev.bgImage && !uploading && (
                  <>
                    <button
                      onClick={() => onSetBgImage(null)}
                      className="px-3 py-2 rounded-lg text-sm font-bold flex-shrink-0"
                      style={{ background: 'rgba(255,0,74,0.12)', color: DANGER }}
                    >
                      {t.customBgRemove}
                    </button>
                    {/* 調節按鈕：切換下方「調節透明度」面板的展開／收合 */}
                    <button
                      onClick={() => setShowOpacityAdjust(v => !v)}
                      aria-label={t.adjustBgOpacity}
                      title={t.adjustBgOpacity}
                      className="p-2 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: showOpacityAdjust ? ACCENT : 'var(--card-border)', color: showOpacityAdjust ? '#fff' : cardInkSoft, width: '2.25rem', height: '2.25rem' }}
                    >
                      <SlidersHorizontal size={15} />
                    </button>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {bgError && <p className="text-xs font-medium mt-2" style={{ color: DANGER }}>{bgError}</p>}

              {/* 調節透明遮罩面板：只有設定過自訂背景圖片時才可能展開，
                  用 max-height + opacity 過渡讓視窗高度變化看起來絲滑，而不是瞬間跳動 */}
              {ev.bgImage && (
                <div
                  style={{
                    maxHeight: showOpacityAdjust ? 92 : 0,
                    opacity: showOpacityAdjust ? 1 : 0,
                    marginTop: showOpacityAdjust ? 14 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 170ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, margin-top 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <div className="text-xs font-bold mb-2" style={{ color: cardInkSoft }}>
                    {t.dragToAdjustOpacity}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1" style={{ paddingTop: 26 }}>
                      {/* 拖動滑桿時，在滑塊正上方浮出目前的透明度數值（0～100），放開才收起；
                          顏色跟隨路標色，字級也放大一些，拖動時更容易一眼看清楚。
                          用 localSliderValue（零延遲）而不是 overlaySliderValue（被節流過），
                          數值氣泡才會跟滑塊、跟手指完全同步，不會有一瞬間的落後感。 */}
                      {sliderDragging && !glassCleared && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: `${localSliderValue}%`,
                            transform: 'translateX(-50%)',
                            top: 0,
                            fontSize: 15,
                            fontWeight: 800,
                            color: '#fff',
                            background: colorHex(ev.colorId),
                            padding: '4px 11px',
                            borderRadius: 9,
                            minWidth: 30,
                            textAlign: 'center',
                            boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >{localSliderValue}</span>
                      )}
                      <input
                        type="range"
                        min={0}
                        max={SLIDER_MAX}
                        step={1}
                        value={localSliderValue}
                        disabled={glassCleared}
                        onMouseDown={() => setSliderDragging(true)}
                        onTouchStart={() => setSliderDragging(true)}
                        onChange={e => {
                          // 滑塊視覺（value）跟數值氣泡都改用這份本地 state，每個原生事件都立即
                          // 更新，完全跟手指同步；真正觸發整個視窗重新渲染的 onSetBgOpacity 才用
                          // requestAnimationFrame 節流到最多每畫格一次，避免事件堆積、拖慢渲染。
                          const sliderValue = Number(e.target.value);
                          setLocalSliderValue(sliderValue);
                          if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
                          sliderRafRef.current = requestAnimationFrame(() => {
                            onSetBgOpacity(1 - sliderValue / SLIDER_MAX);
                          });
                        }}
                        className="w-full premium-range"
                        aria-label={t.adjustBgOpacity}
                        style={{
                          // 底色跟隨路標色：已調整部分用路標色實色，未調整部分用路標色的淺色調，
                          // 不再是跟路標色無關的固定灰色。
                          background: `linear-gradient(to right, ${colorHex(ev.colorId)} 0%, ${colorHex(ev.colorId)} ${localSliderValue}%, ${colorHex(ev.colorId)}2A ${localSliderValue}%, ${colorHex(ev.colorId)}2A 100%)`,
                          opacity: glassCleared ? 0.4 : 1,
                          // 拖動當下把整條軌道的觸控手勢鎖定成只能水平拖動，不會被瀏覽器誤判成
                          // 想要垂直捲動頁面，這樣才不會出現「明明在拖滑桿，畫面卻跟著晃」的狀況。
                          touchAction: 'none',
                        }}
                      />
                    </div>
                    {/* 「原圖」：獨立的長條形按鈕，取代原本滑桿裡 100～120 那段隱藏區間。
                        點一下切換成原圖模式（不模糊、不加遮罩）；再點一下則還原成切換前的透明度。
                        未選中時也給一層半透明毛玻璃底色＋細邊框，避免疊在照片上時存在感太弱、被忽略。 */}
                    <button
                      type="button"
                      onClick={toggleOriginalImage}
                      className="flex-shrink-0 rounded-full text-xs font-bold"
                      style={{
                        padding: '7px 14px',
                        background: glassCleared ? ACCENT : 'rgba(255,255,255,0.3)',
                        border: glassCleared ? '1px solid transparent' : '1px solid rgba(255,255,255,0.45)',
                        backdropFilter: glassCleared ? 'none' : 'blur(8px)',
                        WebkitBackdropFilter: glassCleared ? 'none' : 'blur(8px)',
                        boxShadow: glassCleared ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                        color: glassCleared ? '#fff' : cardInkSoft,
                        // 滑桿外層容器上方留了一段 paddingTop 給拖動時彈出的數值氣泡用，
                        // 用 items-center 對齊整個外層容器高度的話，這顆按鈕會偏高、對不準滑桿軌道
                        // 真正的位置，這裡往下推一點，讓按鈕的中心軸線對齊左側滑桿軌道的中心。
                        marginTop: 14,
                        transition: 'background 120ms ease, color 120ms ease',
                      }}
                    >
                      {originalImageLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 更換數字字體：橫向可捲動的字卡（方案 A＋B 合併）——每張卡直接用該字體渲染樣本數字，
                一眼看出實際效果，同時用橫向捲動不佔垂直空間，未來要加更多字體只要往 NUMBER_FONTS 加項目即可 */}
            <div className="pt-4">
              {/* 標題列跟下面「可橫向捲動」的字體清單是分開的兩個區塊：ⓘ 按鈕緊貼在「數字字體」文字右邊，
                  不在 overflow-x-auto 容器裡面，所以捲動字體清單時 ⓘ 一定固定在標題旁，不會被一起捲走 */}
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xs font-bold" style={{ color: cardInkSoft }}>{t.customFontLabel}</div>
                <button
                  type="button"
                  onClick={() => setShowFontInfo(v => !v)}
                  aria-expanded={showFontInfo}
                  className="flex-shrink-0"
                  style={{ fontSize: 14, lineHeight: 1, color: cardInkSoft, opacity: 0.5, padding: 2, background: 'transparent', border: 'none' }}
                >
                  ⓘ
                </button>
              </div>
              <div className="font-scroll flex items-center gap-2.5 overflow-x-auto pb-1">
                {NUMBER_FONTS.map(f => {
                  const active = numberFontId === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onSetNumberFont(f.id)}
                      className="relative flex flex-col items-center justify-center rounded-2xl flex-shrink-0"
                      style={{
                        width: 68, height: 68,
                        background: active ? `${colorHex(ev.colorId)}18` : CARD_BG,
                        border: active ? `1.5px solid ${colorHex(ev.colorId)}` : CARD_BORDER,
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                      }}
                    >
                      {active && (
                        <span
                          className="absolute flex items-center justify-center rounded-full"
                          style={{ top: 4, right: 4, width: 14, height: 14, background: colorHex(ev.colorId), color: '#fff', fontSize: 8, fontWeight: 900 }}
                        >
                          ✓
                        </span>
                      )}
                      <span style={{ fontFamily: f.family, fontVariationSettings: f.variationSettings || 'normal', fontSize: 22, fontWeight: 700, lineHeight: 1, color: cardInk }}>88</span>
                      <span className="mt-1.5" style={{ fontSize: 9, fontWeight: 700, color: cardInkSoft }}>{f.name}</span>
                    </button>
                  );

                })}
              </div>
            </div>
          </div>

          {/* 匯出成圖片面板：點右上角分享 icon 展開 */}
          <div
            className="relative"
            style={{
              zIndex: 1,
              maxHeight: showExportPanel ? 160 : 0,
              opacity: showExportPanel ? 1 : 0,
              marginTop: showExportPanel ? 14 : 0,
              overflow: 'hidden',
              transition: 'max-height 170ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, margin-top 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div className="text-xs font-bold mb-2" style={{ color: cardInkSoft }}>{t.exportLabel}</div>
            {/* 「卡片／限動(9:16)」格式選擇：改成會滑動的膠囊開關，一整條寬度切一半，
                選中的一側用會平滑滑動的實心背景表示，比原本兩顆各自變色的按鈕更有質感 */}
            <div className="export-format-toggle mb-3">
              <div
                className="toggle-thumb"
                style={{ left: 3, right: '50%', transform: exportFormat === 'story' ? 'translateX(100%)' : 'translateX(0%)' }}
              />
              <button
                onClick={() => setExportFormat('card')}
                className="px-3 py-2 rounded-full text-sm font-bold"
                style={{ color: exportFormat === 'card' ? '#fff' : cardInkSoft }}
              >
                {t.exportFormatCard}
              </button>
              <button
                onClick={() => setExportFormat('story')}
                className="px-3 py-2 rounded-full text-sm font-bold"
                style={{ color: exportFormat === 'story' ? '#fff' : cardInkSoft }}
              >
                {t.exportFormatStory}
              </button>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full px-3 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: ACCENT, color: '#fff', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? t.exportPreparing : t.exportShareButton}
            </button>
            {exportError && <p className="text-xs font-medium mt-2" style={{ color: DANGER }}>{exportError}</p>}
          </div>
        </div>

        {/* 字體授權補充說明：改成直接蓋在整張事件詳情卡片上的浮層，而不是把卡片內容往下撐開；
            點 ⓘ 展開、點右上角 X 或浮層外圍空白處收合。點「查看授權資訊」時關掉本浮層、
            改開下面的完整條款彈窗，兩層一次只會出現一層，不會疊在一起。 */}
        {fontInfoMounted && (
          <div
            className="absolute inset-0 rounded-3xl flex flex-col card-ink-fade"
            style={{
              zIndex: 40,
              ...AUTH_GLASS,
              background: ev.bgImage ? 'rgba(255,255,255,0.82)' : AUTH_GLASS.background,
              opacity: fontInfoShown ? 1 : 0,
              transform: fontInfoShown ? 'scale(1)' : 'scale(0.97)',
              transition: 'opacity 120ms ease, transform 120ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onClick={() => setShowFontInfo(false)}
          >
            <div
              className="w-full h-full overflow-y-auto p-5 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-sm font-black" style={{ color: INK }}>{t.customFontLabel}</h3>
                <button onClick={() => setShowFontInfo(false)} aria-label={t.close} style={{ color: INK_SOFT, flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                <p className="mb-2">{t.fontLicenseIntro}</p>
                <div className="mb-2" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {NUMBER_FONTS.map(f => (
                    <div key={f.id} className="flex items-baseline justify-between gap-3">
                      <span style={{ fontWeight: 700, color: INK, flexShrink: 0 }}>{f.name}</span>
                      <span style={{ opacity: 0.85, textAlign: 'right' }}>{f.copyright}</span>
                    </div>
                  ))}
                </div>
                <p className="mb-2">{t.fontLicenseAllNote}</p>
                <button
                  type="button"
                  onClick={() => {
                    // 不能在同一個事件處理常式裡「同時」關掉這層小面板、又打開授權彈窗：
                    // 兩層都用 useModalBackClose 管理瀏覽器返回鍵，各自靠 pushState／history.back()
                    // 模擬一層「可以按上一頁關閉」的堆疊。關閉小面板時會呼叫 history.back()，
                    // 但瀏覽器實際觸發對應的 popstate 事件是非同步的；如果在它還沒觸發前，
                    // 授權彈窗那邊的 effect 就搶先呼叫 pushState 推了一個新的紀錄上去，
                    // 等小面板那次 back() 真正生效時，瀏覽器目前所在的位置已經是「授權彈窗」推上去
                    // 的那一筆——實測在 Android Chrome 上這樣會導致授權彈窗剛打開又被那次遲來的
                    // popstate 影響、或者瀏覽器的返回堆疊跟 App 自己記錄的堆疊對不上，
                    // 使用者之後再操作（例如按返回鍵關掉彈窗）時，就可能多退了一層，
                    // 直接跳出整個網站。改成延後一個 tick 才開啟授權彈窗，
                    // 讓小面板的關閉（含它自己的 history.back()）先完全處理完，
                    // 兩邊的 push／back 就不會疊在同一輪事件迴圈裡互相搶。
                    setShowFontInfo(false);
                    setTimeout(() => setShowFontLicenseModal(true), 0);
                  }}
                  style={{ fontWeight: 700, color: colorHex(ev.colorId), background: 'transparent', border: 'none', padding: 0, textDecoration: 'underline' }}
                >
                  {t.fontLicenseViewFull} →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {/* 字體授權完整條款：獨立用 createPortal 掛到 document.body，蓋在最上層（比地標詳情視窗本身
        z-index 更高），這樣才不會被地標詳情卡片本身 overflow 影響顯示，點外部空白處即可關閉。
        background／內層卡片都各自套 opacity+transform 轉場，跟浮層淡出的時間點重疊，
        看起來像浮層被彈窗接手蓋過去，而不是兩個視窗生硬地互相跳接。 */}
    {fontLicenseMounted && createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{
          zIndex: 260,
          background: fontLicenseShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
          transition: 'background 130ms ease',
        }}
        onClick={() => setShowFontLicenseModal(false)}
      >
        <div
          className={`w-full ${dock ? 'max-w-md' : 'max-w-sm'} rounded-2xl flex flex-col`}
          style={{
            ...AUTH_GLASS,
            maxHeight: '80vh',
            opacity: fontLicenseShown ? 1 : 0,
            transform: fontLicenseShown ? 'scale(1) translateY(0px)' : 'scale(0.94) translateY(10px)',
            transition: 'opacity 130ms ease, transform 130ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <h2 className="text-base font-black" style={{ color: INK }}>{t.fontLicenseModalTitle}</h2>
            <button onClick={() => setShowFontLicenseModal(false)} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
          </div>
          <div className="px-5 pb-5 overflow-y-auto text-xs leading-relaxed" style={{ color: INK }}>
            <div className="mb-3" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {NUMBER_FONTS.map(f => (
                <div key={f.id} className="flex items-baseline justify-between gap-3">
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>{f.name}</span>
                  <span style={{ color: INK_SOFT, textAlign: 'right' }}>{f.copyright}</span>
                </div>
              ))}
            </div>
            <p className="mb-3 font-bold">{t.fontLicenseAllNote}</p>
            <h3 className="text-xs font-black mb-2">{t.fontLicenseFullTextTitle}</h3>
            <pre className="whitespace-pre-wrap mb-3" style={{ fontFamily: 'inherit', color: INK_SOFT, fontSize: 11 }}>{SIL_OFL_1_1_TEXT}</pre>
            {/* 這裡是既有的另一個小問題，跟這次移除 portal 的改動無關：INK 本來就是 CSS 變數
                （'var(--ink)'），接兩位 hex 尾碼做透明度一樣是無效的 CSS 值，分隔線會直接消失。
                順手一併修掉，改用 color-mix()。 */}
            <div className="pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${INK} 10%, transparent)` }}>
              <p className="mb-1" style={{ color: INK_SOFT }}>{t.fontLicenseSourceLabel}: Google Fonts</p>
              <a
                href="https://fonts.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, color: ACCENT, textDecoration: 'underline' }}
              >
                {t.fontLicenseViewSource} ↗
              </a>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

function PastEventsAnimatedSection({ show, events, renderEventCard }) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  // 量測內容高度：只有在「展開」狀態才把量到的高度套用回 state。
  // 修正前這裡不論目前是否展開都會呼叫 measure()，而 ResizeObserver 第一次的回呼
  // 是非同步的，常常會晚於下面「收合」那個 effect 才觸發，導致每次進入頁面（元件重新掛載、
  // events.length 改變）都被非同步地重新展開成完整高度，即使 showPast 其實是 false，
  // 也因此在畫面上「自動預留」出一大塊看不見但仍佔位的空白區域。收合時完全不採用量到的高度，
  // 就不會再發生這個問題。
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => { if (show) setHeight(el.scrollHeight); };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [events.length, show]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (show) {
      requestAnimationFrame(() => setHeight(el.scrollHeight));
    } else {
      setHeight(0);
    }
  }, [show]);

  // 圓點指示器靠負 left 位移「掛」在軸線上，最左會超出卡片本身的邊界約 25px。
  // CSS 規定只要 overflow-x／overflow-y 其中一個是 hidden、另一個是 visible，
  // visible 那一軸會被瀏覽器強制轉成 auto——而 auto 一樣會把超出範圍的內容裁掉，
  // 並不會真的「可見」，這就是圓點完全消失的原因。改成左側額外留一段 padding
  // （比圓點超出的量再寬一點）＋等量的負 margin 抵銷位置，讓圓點落在裁切框「裡面」，
  // 這樣兩軸都可以放心用同一個 overflow: hidden，圓點也不會再被裁掉。
  const DOT_SAFE_INSET = 30;

  return (
    <div
      className="relative"
      style={{
        height,
        opacity: show ? 1 : 0,
        // 展開時在區塊下方留出跟「事件卡片與卡片之間」一致的間距，銜接下方的未來地標清單；
        // 收合時完全不佔位，維持跟按鈕之間原本的間距。
        marginBottom: show ? EVENT_CARD_GAP : 0,
        marginLeft: -DOT_SAFE_INSET,
        paddingLeft: DOT_SAFE_INSET,
        transform: show ? 'translateY(0)' : 'translateY(-6px)',
        pointerEvents: show ? 'auto' : 'none',
        overflow: 'hidden',
        transition: 'height 160ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 110ms ease, transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), margin-bottom 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'height, opacity, transform',
      }}
    >
      {/* flex + gap 統一控制卡片間距，不再依賴每張卡片自己的 margin-bottom——
          margin 在「最後一張卡片」是否會被父層 scrollHeight 量進去，不同瀏覽器行為不一致，
          容易導致收合區塊跟下方未來地標之間的間隙忽大忽小；gap 不會有這個問題。 */}
      <div ref={contentRef} className="relative flex flex-col" style={{ zIndex: 0, gap: EVENT_CARD_GAP }}>
        {events.map(renderEventCard)}
      </div>
    </div>
  );
}

function TimelineSection({
  events, setEvents, lang, t, now, isDark, customIcons, setCustomIcons,
  onHeaderDragStart, onHeaderDragMove, onHeaderDragEnd,
  isLargeScreen = false, viewingId, setViewingId, onOpenAlbumForEvent,
  // layout='timeline'（預設）＝「時光線」分頁目前的樣子，完全不動：時間軸線、圓點、
  // 往日地標收合區塊全部保留。layout='cards'＝「日程」分頁用，資料/邏輯完全共用同一份
  // （events／processedEvents／新增編輯刪除相冊等等都沒有另外複製一份），只是渲染時
  // 跳過時間軸視覺（軸線／圓點／pl-6 縮排）跟「往日地標」這個區塊，改成單純的事件卡片列表。
  layout = 'timeline',
  // 以下三個 prop 只有 layout='cards'（日程分頁）會用到：
  // controlsPortalEl —「新增日程／搜尋」這排按鈕（連同展開時的搜尋輸入框）改用 createPortal
  // 掛到這個 DOM 節點底下，而不是照舊渲染在原本位置。這個節點由 App() 建立、放在日曆上方，
  // 讓按鈕實際顯示的位置能挪到日曆之上，同時按鈕本身的狀態（showForm／searchOpen／
  // searchQuery……）完全不用搬家，還是留在 TimelineSection 內部，只是渲染輸出的落點不同。
  // rangeFilter — 日曆目前顯示的時間範圍｛mode:'month'|'year', year, month?｝，由
  // AnniversaryCalendar 算出、透過 App() 往下傳，日程卡片列表依這個範圍重新計算要顯示哪些事件
  // （見下方 rangedEvents）。
  // showAll —「展示全部事件」開關目前的狀態，同樣由 App() 持有（放在按鈕列跟日曆之間，
  // 不是這個元件自己的內部狀態）。關閉（預設）＝只列出 rangeFilter 範圍內（本月／該年）的事件；
  // 開啟＝忽略日曆目前選的範圍，直接列出全部事件（跟 processedEvents 同一份排序結果）。
  controlsPortalEl = null,
  rangeFilter = null,
  showAll = false,
}) {
  const isCardsLayout = layout === 'cards';
  const [showForm, setShowForm] = useState(false);
  // 新增／編輯地標視窗的顯示階段：保留 mounted 狀態直到關閉動畫完成，
  // 這樣視窗不會在關閉瞬間消失。
  const [formPhase, setFormPhase] = useState('hidden'); // hidden -> enter -> shown -> closing
  // 原本 60ms 太短：整段伸縮動畫只夠瀏覽器畫 3～4 幀，肉眼看起來像「跳」而不是「動」。
  // 拉長到 220ms，讓 opacity／transform 有足夠的幀數可以插值，動畫才會感覺平滑。
  // 時間拉長並不會拖慢「彈出反應」——按下按鈕到動畫開始播放的延遲沒變，
  // 變長的只是動畫播放本身的時間，兩者是分開的事。
  const FORM_MODAL_DURATION = 220;
  function openForm() {
    setShowForm(true);
    setFormPhase('enter');
    requestAnimationFrame(() => setFormPhase('shown'));
  }
  function closeForm() {
    if (!showForm || formPhase === 'closing') return;
    setFormPhase('closing');
    setTimeout(() => {
      setShowForm(false);
      resetForm();
      setFormPhase('hidden');
    }, FORM_MODAL_DURATION);
  }
  useModalBackClose(showForm, closeForm);
  // 刪除地標前的二次確認：存的是「待刪除」那筆事件的 id，不是布林值，
  // 這樣彈窗裡才能顯示出具體是哪一筆（標題），跟帳號那邊「刪除帳號」用的是同一套風格
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalPhase, setDeleteModalPhase] = useState('hidden');
  const DELETE_MODAL_DURATION = 55;
  function openDeleteConfirm(id) {
    setConfirmDeleteId(id);
    setDeleteModalPhase('enter');
    requestAnimationFrame(() => setDeleteModalPhase('shown'));
  }
  function closeDeleteConfirm() {
    if (deleteModalPhase === 'closing') return;
    setDeleteModalPhase('closing');
    setTimeout(() => {
      setConfirmDeleteId(null);
      setDeleteModalPhase('hidden');
    }, DELETE_MODAL_DURATION);
  }
  useModalBackClose(!!confirmDeleteId, closeDeleteConfirm);
  // 相冊功能已經獨立成一級功能（見 AlbumsFeature／App 內的 albumRoute），這裡的「相冊」按鈕
  // 只負責呼叫 onOpenAlbumForEvent(id) 交給上層決定要開啟哪個相冊／進入建立流程，
  // 時間軸本身不再持有任何相冊/相片狀態。
  // 「新增地標」視窗的伸縮動畫改成跟「地標詳情」卡片裡的「自訂」二級面板同一套做法：
  // 不再用 JS（ResizeObserver）即時量測整份表單的實際高度、包一層算出來的像素值做 height
  // transition——量測跟 CSS 動畫是兩條不同步的時間軸，量測結果會在動畫播放途中一路變動、
  // 反覆回灌新的目標值給外層動畫追，兩邊互相打架，這才是先前伸縮看起來卡頓、抖動的根本原因。
  // 現在改成每個真正會展開/收合的區塊（模式相關的「循環」欄位、「重複」子欄位、圖示子選單、
  // 自訂圖示輸入列……）各自固定掛載、用足夠寬裕但固定的 maxHeight／opacity 做純 CSS transition，
  // 不必精準對到內容實際高度，只要蓋得住即可；外層容器本身完全不用另外做動畫，
  // 直接讓瀏覽器原生 reflow 跟著各個子區塊的 CSS 動畫自然撐開/收合，跟事件詳情卡片一樣順。
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [openIconSubmenu, setOpenIconSubmenu] = useState(null); // 目前展開子菜單的母菜單 key
  const [showCustomIconPanel, setShowCustomIconPanel] = useState(false);
  const [customIconInput, setCustomIconInput] = useState('');
  const [customIconError, setCustomIconError] = useState('');
  const [colorId, setColorId] = useState(COLOR_TAGS[0].id);
  const [calendar, setCalendar] = useState('gregory');
  const [repeat, setRepeat] = useState(false);
  const [repeatUnit, setRepeatUnit] = useState('year');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [isBirthday, setIsBirthday] = useState(false);
  const [isCare, setIsCare] = useState(false);
  // 「模式選擇」目前選中的模式 id（生日／陪伴／關懷／紀念日／常規，見 EVENT_MODES），
  // 取代原本「重複」區塊裡疊在一起的三層開關（重複／生日模式／關懷模式）。
  // isBirthday／isCare 這兩個既有 state 保留不動，繼續驅動圖示清單、顏色清單、灰階濾鏡等
  // 已經寫好的邏輯，只是現在改由 selectMode 統一設定，不再各自獨立切換。
  const [eventMode, setEventMode] = useState('regular');
  const [careCustomIcon, setCareCustomIcon] = useState(null); // 關懷模式第三格「自選」圖示，是單一一格、跟平常的自訂圖示清單分開
  // 開啟關懷模式時暫存原本選的圖示／顏色，關掉時還原，避免使用者原本選好的東西憑空消失
  const prevIconRef = useRef(ICONS[0]);
  const prevColorRef = useRef(COLOR_TAGS[0].id);
  // 切換「模式選擇」的五個選項：生日／關懷兩個模式互斥，且各自對應原本的圖示與顏色切換規則
  // （進入關懷模式換成蠟燭／墓碑等素雅組合，離開時還原成切換前的圖示與顏色）；
  // 生日模式沿用「固定每年重複一次」的既有邏輯，改成由模式直接決定 repeat／repeatUnit／repeatInterval，
  // 不用另外操作重複開關。「陪伴」「紀念日」「常規」三個新選項目前只記錄選中的模式本身、不重複，
  // 具體行為之後再依安排補上。
  function selectMode(modeId) {
    const nextIsCare = modeId === 'care';
    if (nextIsCare && !isCare) {
      prevIconRef.current = icon;
      prevColorRef.current = colorId;
      setIcon(CARE_ICONS[0]);
      setColorId(CARE_COLOR_TAGS[0].id);
    } else if (!nextIsCare && isCare) {
      setIcon(prevIconRef.current);
      setColorId(prevColorRef.current);
    }
    setIsCare(nextIsCare);
    setIsBirthday(modeId === 'birthday');
    if (modeId === 'birthday' || modeId === 'care') {
      setRepeat(true);
      setRepeatUnit('year');
      setRepeatInterval(1);
    } else if (modeId === 'companion') {
      setRepeat(false);
      setRepeatUnit('year');
      setRepeatInterval(1);
    }
    setEventMode(modeId);
  }
  const [formSession, setFormSession] = useState(0);
  const [showPast, setShowPast] = useState(false); // 過去的地標預設收合，讓最近的未來地標永遠排在第一個
  const [searchOpen, setSearchOpen] = useState(false);
  // 目前開啟「地標詳情」視窗的事件 id：改由上層 App 持有／傳入（見 App 內的 viewingId／setViewingId），
  // 而不是這裡自己 useState——大屏分欄模式下，這個視窗不再是蓋在畫面正中央的彈窗，
  // 而是要嵌進右側面板顯示，且時間軸本身也要挪到左側，這些都需要 App 知道「目前有沒有正在看哪個地標」。
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef(null); // 時間軸清單自己的捲動容器（獨立於整頁）

  // 只有在「新增地標」視窗開著、且使用者勾選了「關懷模式」時，才把畫面變成素雅樣式，
  // 用意是紀念／追悼情境下讓介面呈現素雅一點；一般情況（包含表單開著但沒開關懷模式）維持原本色彩。
  // 素雅樣式套用在 header 跟世界時鐘整個區塊（含次要時區清單、按鈕、卡片邊框等），
  // 做法是覆寫這兩個區塊的 --ink／--ink-soft／--card-bg／--card-border／--accent 這幾個
  // CSS 變數（見 CARE_MODE_VARS），而不是套用 `filter: grayscale()`。
  // 這兩種做法的差別，也是刻意不用 filter 的原因：filter 是對整個 DOM 子樹做像素等級的
  // 去色，子元素沒辦法自己「跳出」祖先的濾鏡；國旗 emoji 本來就不是靠這些 CSS 變數上色的內容，
  // 濾鏡卻會不分青紅皂白把它一起變灰。改成只覆寫 token 之後，國旗完全不受影響，
  // 停留在原本的 DOM 位置就好，不需要任何額外處理，也不需要 portal。
  // 時間軸則刻意排除在素雅範圍之外——地標本身的顏色標籤是使用者自己設定的內容，
  // 開啟關懷模式只是在「填表單」這件事上營造素雅氣氛，不應該連帶影響其他既有地標的顏色。
  // 視窗本身用 createPortal 掛在 document.body 底下，也不在這個範圍裡，所以同樣不受影響。
  useEffect(() => {
    const headerEl = document.querySelector('header');
    const worldClockEl = document.getElementById('world-clock-section-root');
    const targets = [headerEl, worldClockEl].filter(Boolean);
    const shouldCare = showForm && isCare;
    targets.forEach(el => {
      Object.entries(CARE_MODE_VARS).forEach(([key, value]) => {
        if (shouldCare) el.style.setProperty(key, value);
        else el.style.removeProperty(key);
      });
    });
    return () => {
      targets.forEach(el => {
        Object.keys(CARE_MODE_VARS).forEach(key => el.style.removeProperty(key));
      });
    };
  }, [showForm, isCare]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDate('');
    setIcon(ICONS[0]);
    setOpenIconSubmenu(null);
    setShowCustomIconPanel(false);
    setCustomIconInput('');
    setCustomIconError('');
    setColorId(COLOR_TAGS[0].id);
    setCalendar('gregory');
    setRepeat(false);
    setRepeatUnit('year');
    setRepeatInterval(1);
    setIsBirthday(false);
    setIsCare(false);
    setEventMode('regular');
    setCareCustomIcon(null);
  }

  function toggleForm() {
    if (showForm) {
      closeForm();
    } else {
      setFormSession(s => s + 1);
      openForm();
    }
  }

  // Shift+C 快速呼出「新增地標」表單：
  // 只在「目前沒有選取文字、也沒有把焦點放在輸入框／可編輯區塊」時才攔截。
  // 不再攔截 Ctrl+C / Cmd+C，避免影響系統原生複製功能。
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      const isEditable = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
      if (isEditable) return;
      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      if (selection && selection.toString().length > 0) return; // 使用者正要複製選取的文字，不攔截
      if (showForm) return; // 表單已經開著（新增或編輯中），不重複處理
      e.preventDefault();
      setFormSession(s => s + 1);
      openForm();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  function startEdit(ev) {
    setEditingId(ev.id);
    setTitle(ev.title);
    setDate(ev.date);
    setIcon(ev.icon);
    setOpenIconSubmenu(null);
    setColorId(ev.colorId);
    setCalendar(ev.calendar || 'gregory');
    setRepeat(!!ev.repeat);
    setRepeatUnit(ev.repeatUnit || 'year');
    setRepeatInterval(ev.repeatInterval || 1);
    setIsBirthday(!!ev.isBirthday);
    setIsCare(!!ev.isCare);
    // 換算目前選中的模式：優先看資料本身有沒有存 mode 欄位（新資料）；沒有的話（這一版之前建立的
    // 舊地標）就照 isBirthday／isCare 反推，兩者都沒設定就一律算「常規」。
    const mode = eventModeFromEv(ev);
    setEventMode(mode);
    if (mode === 'birthday' || mode === 'care') {
      setRepeat(true); setRepeatUnit('year'); setRepeatInterval(1);
    } else if (mode === 'companion') {
      setRepeat(false); setRepeatUnit('year'); setRepeatInterval(1);
    }
    setCareCustomIcon(ev.careCustomIcon || null);
    setFormSession(s => s + 1);
    openForm();
  }

  function handleAddCustomIcon() {
    const value = customIconInput.trim();
    if (!value) return;
    if (customIcons.includes(value)) {
      // 已存在的自訂 emoji，直接選用即可
      setIcon(value);
      setOpenIconSubmenu(null);
      setCustomIconInput('');
      setCustomIconError('');
      return;
    }
    if (customIcons.length >= 30) {
      setCustomIconError(t.customIconLimit);
      return;
    }
    setCustomIcons(prev => [...prev, value]);
    setIcon(value);
    setOpenIconSubmenu(null);
    setCustomIconInput('');
    setCustomIconError('');
  }

  // 關懷模式專用：只維護「一格」自選圖示，不像平常的自訂圖示會一直往清單裡加
  function handleSetCareCustomIcon() {
    const value = customIconInput.trim();
    if (!value) return;
    setCareCustomIcon(value);
    setIcon(value);
    setShowCustomIconPanel(false);
    setCustomIconInput('');
    setCustomIconError('');
  }

  function handleRemoveCustomIcon(value) {
    setCustomIcons(prev => prev.filter(v => v !== value));
  }

  function handleAdd() {
    if (!title || !date) {
      alert(t.fillRequired);
      return;
    }
    const eventData = {
      title,
      date,
      time: '',
      icon,
      colorId,
      calendar,
      repeat: eventMode === 'birthday' || eventMode === 'care' ? true : eventMode === 'companion' ? false : repeat,
      repeatUnit: calendar !== 'gregory' ? 'year' : repeatUnit,
      repeatInterval: eventMode === 'birthday' || eventMode === 'care' ? 1 : Math.max(1, parseInt(repeatInterval) || 1),
      isBirthday: eventMode === 'birthday',
      isCare,
      careCustomIcon: isCare ? careCustomIcon : null,
      // 「模式選擇」選中的模式 id（生日／陪伴／關懷／紀念日／常規）。isBirthday／isCare 兩個既有欄位
      // 繼續保留，讓已經寫好的圖示切換／徽章顯示等邏輯不用跟著改；mode 是額外多存一份，方便之後
      // 「陪伴」「紀念日」這兩個新模式各自要做的具體行為有地方可以掛。
      mode: eventMode,
    };
    if (editingId) {
      setEvents(prev => prev.map(e => (e.id === editingId ? { ...e, ...eventData } : e)));
    } else {
      setEvents(prev => [...prev, { id: Date.now().toString(), ...eventData }]);
    }
    closeForm();
  }

  function deleteEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (editingId === id) { closeForm(); }
  }

  // 「地標詳情」視窗裡上傳／移除自訂卡片背景，直接存進對應事件的 bgImage 欄位，
  // 沿用既有的 events -> window.storage 自動儲存機制，不用另外處理持久化
  function setEventBgImage(id, dataUrlOrNull) {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, bgImage: dataUrlOrNull } : e)));
  }

  // 「地標詳情」視窗裡調整自訂背景的透明遮罩不透明度（0～1）。
  // 注意：這裡只控制遮罩，卡片的 backdrop-filter blur 保持固定，不受滑桿影響。
  function setEventBgOpacity(id, opacity) {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, bgOverlayOpacity: opacity } : e)));
  }

  // 「地標詳情」視窗裡切換大數字的字體，存進事件的 numberFont 欄位（存字體 id，不存字型本身）
  function setEventNumberFont(id, fontId) {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, numberFont: fontId } : e)));
  }

  // 計算每個事件的有效日期與差異天數
  // 包進 useMemo：只有 events／now 真的變動時才重算，避免元件因為其他無關的 local state
  // （例如打字搜尋、開關表單）重新渲染時，跟著白白重算一次全部事件（見「日程頁操作反應慢」）。
  const processedEvents = useMemo(() => {
    return events.map(ev => {
      const targetDate = getEffectiveDate(ev, now);
      // 簡單的天數計算（忽略時分秒的精確度，以本地日期為基準）
      const targetTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
      const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));

      // 生日／關懷模式：以原始日期為起點，計算本次週年所對應的年數。
      let age = null;
      if ((ev.isBirthday || ev.isCare) && ev.repeat) {
        const origDate = combineDateTime(ev.date, ev.time);
        age = Math.max(0, targetDate.getFullYear() - origDate.getFullYear());
      }
      // 陪伴模式不循環，中央數字改為「從開始日期至今」的累積天數。
      const origDateOnly = new Date(`${ev.date}T00:00:00`);
      const elapsedDays = Math.floor((todayTime - origDateOnly.getTime()) / (1000 * 60 * 60 * 24));

      return { ...ev, targetDate, diffDays, age, elapsedDays };
    }).sort((a, b) => a.diffDays - b.diffDays);
  }, [events, now]);

  // 目前開啟「地標詳情」視窗所對應的事件（含算好的 targetDate/diffDays/age），
  // 從 processedEvents 現查而不是另外存一份快照，這樣視窗開著時倒數天數等資訊會隨 now 自然更新
  const viewingEvent = viewingId ? processedEvents.find(e => e.id === viewingId) || null : null;
  // 待刪除確認的那一筆地標（用來在確認彈窗裡顯示標題），刪除後 events 就沒有這筆了，
  // 這裡從 processedEvents 找不到時視為已不存在，順手把確認彈窗收起來即可
  const confirmDeleteEvent = confirmDeleteId ? processedEvents.find(e => e.id === confirmDeleteId) || null : null;
  // 目前開啟「相冊」視窗所對應的事件，同樣從 processedEvents 現查（拿到的是含 albums 欄位的完整事件）

  // 已經過去（diffDays < 0）的地標一律歸進上方可收合的區塊，預設收合，
  // 這樣不論未來地標有幾筆（即使只有一筆），開啟頁面時第一眼看到的永遠是它，不必再手動下滑
  // （這份 pastEvents／upcomingEvents 只給 layout='timeline'（時光線分頁）用；
  // cards 模式（日程分頁）改用下面的 rangedEvents，跟著日曆目前選的月份／年份走，見需求六）
  const pastEvents = processedEvents.filter(ev => ev.diffDays < 0);
  const upcomingEvents = processedEvents.filter(ev => ev.diffDays >= 0);

  // cards 模式（日程分頁）專用：依日曆目前選擇的時間範圍（月或年），重新算出落在該範圍內的
  // 事件發生日——這跟 processedEvents 在算的「這個事件最近一次會發生在什麼時候」不是同一件事
  // （使用者在日曆上翻到過去或未來的月份／年份時，兩者給出的日期可能不同），所以另外算一份，
  // 不去動 processedEvents 原本的邏輯與用途（時間軸分頁、編輯/刪除/相冊彈窗依然完全依賴它）。
  // 年檢視需要逐月掃描 12 次，才能抓到「每個月各自最近一次落在那個月裡的發生日」——例如每月
  // 重複的事件，一整年應該出現 12 次，不是只出現一次。
  // 「展示全部事件」開啟時（showAll），不分月份／年份，直接沿用 upcomingEvents（每個事件
  // 最近一次發生日、已經照日期排序好，只保留還沒過去的），不用再逐月掃描一次。
  // 日程分頁不論「展示全部事件」開關或選到哪個月份／年份，一律不列出已經過去（diffDays < 0）
  // 的地標本身——不只是把它們收進可收合區塊而已，是整個不出現在卡片列表裡（見使用者需求：
  // 日程分頁不要顯示「往日地標」的內容，不只是那個收合按鈕/區塊）。
  // 同樣包進 useMemo：這一份對農曆／其他曆法事件來說本來就不便宜（getEffectiveDate 內部要
  // 逐日掃描比對），年檢視還要乘以 12 個月，如果不快取，父層 App 每 30 秒跳一次「現在時間」、
  // 或是在這個分頁打字搜尋、開合新增表單，都會讓它重新整個算一次，正是先前「開啟日程頁卡頓、
  // 操作反應慢」的主因——改成只有 events／rangeFilter／showAll／now 真的變動時才重算。
  const rangedEvents = useMemo(() => {
    if (!isCardsLayout) return [];
    if (showAll) return upcomingEvents;
    if (!rangeFilter) return [];
    const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const results = [];
    // 加進 results 前共用的整理步驟（算 diffDays／age／elapsedDays、組 __occKey），
    // 三種掃描方式（逐月／一年一次／週區間）都要用到，抽出來避免重複程式碼。
    function pushOccurrence(ev, occ) {
      const targetTime = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
      const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return; // 日程分頁不列出已經過去的地標，直接跳過，不進 results
      let age = null;
      if ((ev.isBirthday || ev.isCare) && ev.repeat) {
        const origDate = combineDateTime(ev.date, ev.time);
        age = Math.max(0, occ.getFullYear() - origDate.getFullYear());
      }
      const origDateOnly = new Date(`${ev.date}T00:00:00`);
      const elapsedDays = Math.floor((todayTime - origDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      // 同一筆事件在年檢視底下可能一年出現好幾次（例如每月重複），key 不能只用 ev.id，
      // 另外帶上發生日期時間戳記做成 __occKey，渲染卡片時才不會撞 key。
      results.push({ ...ev, targetDate: occ, diffDays, age, elapsedDays, __occKey: `${ev.id}::${occ.getTime()}` });
    }
    // 週檢視：改用通用的日期區間比對（見 getEventOccurrencesInRange 開頭註解），一週最多
    // 橫跨兩個西曆月份／年份，不能沿用下面「按月份／按年份」的掃描方式。
    if (rangeFilter.mode === 'week') {
      if (rangeFilter.weekStart && rangeFilter.weekEnd) {
        getEventOccurrencesInRange(events, rangeFilter.weekStart, rangeFilter.weekEnd)
          .forEach(({ ev, occ }) => pushOccurrence(ev, occ));
      }
      results.sort((a, b) => a.targetDate - b.targetDate);
      return results;
    }
    const monthsToScan = rangeFilter.mode === 'year'
      ? Array.from({ length: 12 }, (_, m) => m)
      : [rangeFilter.month];
    events.forEach(ev => {
      // 「每 N 個月」重複（只有西曆才會這樣設定）一年可能出現好幾次，必須逐月各自算一次；
      // 西曆的月份比較是精確的日期大小比較，不會有下面「年重複」那種區塊搜尋誤判的問題，
      // 繼續維持原本逐月重算即可。
      if (ev.repeat && ev.repeatUnit === 'month') {
        monthsToScan.forEach(m => {
          const ref = new Date(rangeFilter.year, m, 1);
          const occ = getEffectiveDate(ev, ref);
          if (occ.getFullYear() !== rangeFilter.year || occ.getMonth() !== m) return;
          pushOccurrence(ev, occ);
        });
        return;
      }
      // 不循環的固定日期、或年重複（含農曆／伊斯蘭曆／希伯來曆等，以及生日／關懷模式）：
      // 一年最多只會發生一次，用「目標年份 1 月 1 號」當基準往未來掃描一次即可，
      // 不要對 12 個月各自重算——見 getYearlyOccurrenceInYear 開頭註解，這正是修復「同一個
      // 年重複事件被誤判成出現在兩個連續月份」的關鍵。
      const occ = getYearlyOccurrenceInYear(ev, rangeFilter.year);
      if (occ.getFullYear() !== rangeFilter.year) return;
      if (rangeFilter.mode === 'month' && occ.getMonth() !== rangeFilter.month) return;
      pushOccurrence(ev, occ);
    });
    results.sort((a, b) => a.targetDate - b.targetDate);
    return results;
  }, [isCardsLayout, rangeFilter, events, now, showAll, upcomingEvents]);

  // 搜尋：輸入關鍵字時，直接在全部地標（不分過去／未來）中比對標題，跳出原本的分區顯示
  const searchQueryNormalized = searchQuery.trim().toLowerCase();
  const isSearching = searchQueryNormalized.length > 0;
  const searchResults = isSearching
    ? processedEvents.filter(ev => ev.title.toLowerCase().includes(searchQueryNormalized))
    : null;

  function renderEventCard(ev) {
    const cardInner = (
      <div
        className="p-4 rounded-2xl relative group cursor-pointer"
        style={{
          ...glass(ev.id === editingId ? { border: `1.5px solid ${ACCENT}` } : {}),
          position: 'relative',
          zIndex: 1,
        }}
        onClick={() => setViewingId(ev.id)}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{ev.icon}</span>
            <h3 className="font-bold text-lg" style={{ color: INK }}>{ev.title}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={e => { e.stopPropagation(); onOpenAlbumForEvent && onOpenAlbumForEvent(ev.id); }} aria-label={t.album} title={t.album} className="p-2 rounded-lg transition-colors" style={{ color: INK_SOFT }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Images size={15} />
            </button>
            <button onClick={e => { e.stopPropagation(); startEdit(ev); }} aria-label={t.edit} className="p-2 rounded-lg transition-colors" style={{ color: INK_SOFT }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Pencil size={15} />
            </button>
            <button onClick={e => { e.stopPropagation(); openDeleteConfirm(ev.id); }} aria-label={t.delete} className="p-2 rounded-lg transition-colors" style={{ color: DANGER }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,0,74,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="text-sm font-medium mb-1 flex items-center gap-2 flex-wrap" style={{ color: INK_SOFT }}>
          <span>{ev.targetDate.toLocaleDateString(LOCALE_MAP[lang])}</span>
          {ev.repeat && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--card-border)', color: INK_SOFT }}>
              {ev.repeatUnit === 'month' ? t.monthlyBadge(ev.repeatInterval) : t.yearlyBadge(ev.repeatInterval)}
            </span>
          )}
        </div>
        {ev.calendar && ev.calendar !== 'gregory' && (
          <div className="text-xs font-medium mb-2" style={{ color: ACCENT }}>
            {formatAltCalendar(ev.targetDate, ev.calendar, lang, t)}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-block px-3 py-1 rounded-lg text-sm font-bold" style={{ background: `${colorHex(ev.colorId)}20`, color: colorHex(ev.colorId) }}>
            {ev.mode === 'companion'
              ? t.companionDays(Math.max(0, ev.elapsedDays ?? 0))
              : ev.diffDays === 0 ? t.today : ev.diffDays > 0 ? t.daysLeft(ev.diffDays) : t.daysAgo(Math.abs(ev.diffDays))}
          </div>
          {ev.age !== null && (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold" style={{ background: `${colorHex(ev.colorId)}20`, color: colorHex(ev.colorId) }}>
              {ev.isCare ? t.anniversaryBadge(ev.age) : t.ageBadge(ev.age)}
            </div>
          )}
        </div>
      </div>
    );

    // cards 模式（日程分頁）：不畫時間軸圓點跟連接線，卡片本身內容一模一樣，只是拿掉外層
    // 那個 `pl-6` + 絕對定位圓點的包裝。timeline 模式（時光線分頁）完全維持原樣。
    // key 優先用 __occKey（rangedEvents 年檢視底下，同一筆事件可能一年出現好幾次，
    // 只用 ev.id 會撞 key）；沒有 __occKey 時（例如搜尋結果，來自 processedEvents）退回用 ev.id。
    if (isCardsLayout) {
      return <div key={ev.__occKey || ev.id}>{cardInner}</div>;
    }
    return (
      <div key={ev.__occKey || ev.id} className="relative pl-6" style={{ zIndex: 10 }}>
        {/* 圓點指示器：整個事件項目建立獨立堆疊層，圓點永遠位於時間軸線與卡片之上。
            left／top 用 rem 而非寫死 px，縮放時才會跟軸線同步移動、保持對齊。
            拿掉了原本 boxShadow 最外層跟背景同色的那圈（0 0 0 2px var(--page-bg)），
            那圈視覺上太粗，看起來像把軸線整個截斷；只留 border 的 page-bg 圈（讓圓點跟
            軸線之間有一圈鏤空分隔）跟 boxShadow 內層的 card-border 細圈（輪廓）。 */}
        <div
          className="absolute w-4 h-4 rounded-full"
          style={{
            background: colorHex(ev.colorId),
            left: '-1.375rem',
            top: '0.25rem',
            border: '0.1875rem solid var(--page-bg)',
            boxShadow: '0 0 0 0.0625rem var(--card-border)',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        />
        {cardInner}
      </div>
    );
  }

  // 「新增日程／搜尋」這排按鈕（含展開時的搜尋輸入框）：timeline 模式（時光線分頁）維持原本
  // 位置，固定在清單最上方、可拖曳收合世界時鐘。cards 模式（日程分頁）改成透過 createPortal
  // 掛到 controlsPortalEl（App() 裡放在日曆上方的一個節點），視覺上讓這排按鈕出現在日曆
  // 上方，而不是這個元件實際掛載的地方（日曆下方、清單的捲動容器裡）——按鈕本身的狀態、
  // 點擊行為完全沒變，只是渲染輸出的落點不同。
  const headerControls = (
    <div className="flex-shrink-0">
      <div
        className="flex items-center justify-between select-none"
        style={{
          ...(isCardsLayout ? undefined : { cursor: 'ns-resize', touchAction: 'none' }),
          // cards 模式（日程分頁）：這排按鈕現在透過 portal 掛在日曆上方，外層的 flex 容器
          // 本身已經用 gap 在管理跟下一個元素（日曆）之間的距離，這裡不再額外加 mb-3，
          // 避免兩邊間距疊加，日程頁最上面看起來留白過多（見「頁面上部分留白過多」）。
          // 只有展開搜尋輸入框時才需要在按鈕列跟輸入框之間留一點內部間距。
          marginBottom: isCardsLayout ? (searchOpen ? 12 : 0) : 12,
        }}
        onPointerDown={e => {
          if (isCardsLayout) return; // cards 模式（日程分頁）沒有可拖曳收合的世界時鐘在上面，這個手勢用不到
          if (e.target.closest('button')) return; // 標題列右側的按鈕不應觸發拖曳
          e.currentTarget.setPointerCapture(e.pointerId);
          onHeaderDragStart && onHeaderDragStart(e.clientY);
        }}
        onPointerMove={e => { if (!isCardsLayout && e.buttons === 1) onHeaderDragMove && onHeaderDragMove(e.clientY); }}
        onPointerUp={() => !isCardsLayout && onHeaderDragEnd && onHeaderDragEnd()}
        onPointerCancel={() => !isCardsLayout && onHeaderDragEnd && onHeaderDragEnd()}
      >
        {/* cards 模式（日程分頁）不再重複顯示「時間軸」這個標題文字——頁面最上面已經有
            「日程」這個頁面標題了（見 App() 裡的頁面標題邏輯），這裡留空只保留右側的
            搜尋／新增按鈕，避免同一個畫面出現兩個標題疊在一起。 */}
        <div className="flex items-center gap-2">
          {!isCardsLayout && (
            <>
              <MapPin size="1.125rem" style={{ color: MINT }} />
              <h2 className="font-bold" style={{ color: INK, fontSize: '1.125rem' }}>{t.timeline}</h2>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(v => { const next = !v; if (!next) setSearchQuery(''); return next; })}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ ...glass(), width: '1.875rem', height: '1.875rem', color: searchOpen ? MINT : INK }}
          >
            <Search size={14} />
          </button>
          {/* 「每日一籤」：只在日程分頁（cards 模式）出現，放在搜尋跟新增日程中間，點下去
              直接跳轉到外部的每日一籤網頁。用 window.open 開新分頁而不是原地導頁，這樣使用者
              看完籤詩回來時，日程頁原本的捲動位置、搜尋關鍵字都還在，不會被導頁清空。 */}
          {isCardsLayout && (
            <button
              onClick={() => window.open('https://timezzw.top/DFortune', '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
              style={{ background: '#C23B34', color: '#fff' }}
            >
              {t.dailyFortuneLabel}
            </button>
          )}
          <button 
            onClick={toggleForm}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium" 
            style={{ background: showForm ? INK_SOFT : MINT, color: '#fff' }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? t.cancel : (isCardsLayout ? t.addSchedule : t.newLandmark)}
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className={isCardsLayout ? 'relative' : 'relative mb-3'}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: INK_SOFT, pointerEvents: 'none' }} />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div id="timeline-section-root" className="flex-1 min-h-0 flex flex-col">
      {/* timeline 模式：跟以前一樣就地渲染在清單最上方。cards 模式：只有在 App() 已經把
          portal 目標節點準備好（controlsPortalEl 不是 null）才渲染，避免節點還沒掛載前
          按鈕先短暫出現在錯的位置（日曆下方）又跳走。 */}
      {isCardsLayout
        ? (controlsPortalEl ? createPortal(headerControls, controlsPortalEl) : null)
        : headerControls}

      {/* 事件列表：獨立的捲動容器。timeline 模式（時光線分頁）維持原本的軸線＋往日地標收合區塊；
          cards 模式（日程分頁）只保留卡片本身，不畫軸線、不顯示「往日地標」這個區塊，改用
          rangedEvents（跟著日曆目前選的月份／年份、以及「只展示未來代辦事件」開關）。 */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto pb-6">
        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="py-8 pl-4">
              <p style={{ color: INK, fontWeight: 'bold' }}>{t.noSearchResults}</p>
            </div>
          ) : (
            <div
              className={isCardsLayout ? 'flex flex-col' : 'relative pl-4 border-l-2 ml-2 flex flex-col'}
              style={isCardsLayout ? { gap: EVENT_CARD_GAP } : { borderColor: '#000', zIndex: 0, gap: EVENT_CARD_GAP }}
            >
              {searchResults.map(renderEventCard)}
            </div>
          )
        ) : isCardsLayout ? (
          // cards 模式：不畫軸線、不顯示「往日地標」收合區塊，只列出目前日曆時間範圍內、
          // 符合「只展示未來代辦事件」開關設定的事件卡片（見 rangedEvents）。
          rangedEvents.length > 0 ? (
            <div className="flex flex-col" style={{ gap: EVENT_CARD_GAP }}>
              {rangedEvents.map(renderEventCard)}
            </div>
          ) : (
            <div className="py-8">
              <p style={{ color: INK, fontWeight: 'bold' }}>
                {rangeFilter && rangeFilter.mode === 'year' ? t.emptyScheduleYear
                  : rangeFilter && rangeFilter.mode === 'week' ? t.emptyScheduleWeek
                  : t.emptyScheduleMonth}
              </p>
              <p className="text-sm mt-1" style={{ color: INK_SOFT }}>{t.emptyTimelineSub}</p>
            </div>
          )
        ) : processedEvents.length === 0 ? (
          <div className="py-8 pl-4">
            <p style={{ color: INK, fontWeight: 'bold' }}>{t.emptyTimeline}</p>
            <p className="text-sm mt-1" style={{ color: INK_SOFT }}>{t.emptyTimelineSub}</p>
          </div>
        ) : (
          <div className="relative pl-4 ml-2" style={{ zIndex: 0 }}>
            {/* 單一貫穿到底的軸線：改用一條絕對定位的線條元素，從收合按鈕最上面一路畫到
                最後一筆未來地標，取代原本「收合按鈕上方沒有畫線」「過去／未來兩個區塊各自用
                border-l-2 畫一段、中間留白」的做法，避免軸線在按鈕與兩個區塊交界處斷開。 */}
            <div
              aria-hidden="true"
              className="absolute"
              style={{ left: 0, top: 0, bottom: 0, width: 2, background: '#000', pointerEvents: 'none' }}
            />
            {/* 已經過去的地標：獨立收合區塊，預設收合，永遠排在最上面，不佔用未來地標的版面 */}
            {pastEvents.length > 0 && (
              <button
                onClick={() => setShowPast(v => !v)}
                className="w-full flex items-center gap-2 px-2 py-2 mb-2 rounded-lg text-sm font-medium"
                style={{
                  color: INK_SOFT,
                  transition: 'color 120ms ease',
                }}
              >
                <ChevronDown
                  size={14}
                  style={{
                    // 收合時箭頭朝左；展開時逆時針旋轉 90°，箭頭朝下。
                    transform: showPast ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    willChange: 'transform',
                    flexShrink: 0,
                  }}
                />
                {t.pastLandmarks(pastEvents.length)}
              </button>
            )}
            {pastEvents.length > 0 && (
              <PastEventsAnimatedSection
                show={showPast}
                events={pastEvents}
                renderEventCard={renderEventCard}
              />
            )}
            {/* 未來（含今天）的地標：永遠是這個容器打開時第一眼看到的內容 */}
            {upcomingEvents.length > 0 && (
              <div className="relative flex flex-col" style={{ gap: EVENT_CARD_GAP }}>
                {upcomingEvents.map(renderEventCard)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新增／編輯地標：改成置中的窗口（毛玻璃質感，沿用帳號登入視窗同一套 AUTH_GLASS 樣式），
          不論時間軸目前捲到哪裡，開啟表單都直接疊在畫面正中央，不用再手動捲到最上方 */}
      {showForm && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 200,
            // 遮罩底色改成固定值，開合只動 opacity：先前讓 background（rgba 顏色本身）跟著
            // opacity 一起變化，等於每一幀都要重繪整個全螢幕遮罩（顏色插值不吃 GPU 合成），
            // 這是彈窗「感覺卡、慢半拍」的主因之一。改成顏色固定、只用 opacity 做淡入淡出，
            // 瀏覽器可以整層丟給合成器處理，不用逐幀重繪。
            background: 'rgba(0,0,0,0.4)',
            opacity: formPhase === 'shown' ? 1 : 0,
            transition: `opacity ${FORM_MODAL_DURATION}ms ease`,
            willChange: 'opacity',
          }}
          onClick={closeForm}
        >
          <div
            className={`w-full ${isLargeScreen ? 'max-w-md' : 'max-w-sm'} max-h-[85vh] overflow-y-auto rounded-2xl p-4`}
            style={{
              ...AUTH_GLASS,
              // 原本 0.4 的透明度太低，毛玻璃模糊再強也擋不住背景的文字色塊透出來，
              // 看起來像半張廢紙蓋在畫面上。改成 0.92（依明暗模式給對應底色），
              // 只留一點點透光感撐住「玻璃」的質地，但底下內容基本上看不穿。
              background: isDark ? 'rgba(29,32,41,0.92)' : 'rgba(255,255,255,0.92)',
              // 「伸縮」的視覺重點是 scale，這裡加回來；但這張卡片本身帶 backdropFilter 模糊，
              // scale 動畫期間若同時開著模糊，瀏覽器每一幀都要照新的尺寸重新取樣背後畫面，
              // 是動畫卡頓的主因。做法改成：只有動畫「靜止」的那一刻（formPhase 為 shown）
              // 才套用模糊，正在伸縮的過程中（enter／closing）先關掉模糊，等尺寸穩定下來
              // 模糊才出現。backdropFilter 本身不做 transition（瀏覽器對它的animate支援
              // 不穩定），切換的瞬間卡片已經接近定格，肉眼幾乎感覺不到「模糊突然出現」，
              // 卻能讓整段伸縮動畫維持在合成器就能處理的 transform／opacity，順暢很多。
              backdropFilter: formPhase === 'shown' ? AUTH_GLASS.backdropFilter : 'none',
              WebkitBackdropFilter: formPhase === 'shown' ? AUTH_GLASS.WebkitBackdropFilter : 'none',
              opacity: formPhase === 'shown' ? 1 : 0,
              transform: formPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.94)',
              transition: `opacity ${FORM_MODAL_DURATION}ms ease, transform ${FORM_MODAL_DURATION}ms cubic-bezier(0.34, 1.28, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between -mb-1">
                <div className="flex items-center gap-2">
                  {editingId ? <Pencil size={14} style={{ color: ACCENT }} /> : <Plus size={14} style={{ color: MINT }} />}
                  <span className="text-sm font-bold" style={{ color: INK }}>{editingId ? t.editLandmark : (isCardsLayout ? t.addSchedule : t.newLandmark)}</span>
                </div>
                <button onClick={toggleForm} style={{ color: INK_SOFT }}><X size={18} /></button>
              </div>
              <input 
              type="text" placeholder={t.titlePlaceholder} value={title} onChange={e => setTitle(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm w-full outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            />
            {/* 曆法：先選擇要用哪一種曆法來輸入日期 */}
            <select
              value={calendar}
              onChange={e => {
                const val = e.target.value;
                setCalendar(val);
                if (val !== 'gregory') setRepeatUnit('year');
              }}
              className="px-3 py-2 rounded-lg text-sm w-full outline-none"
              style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            >
              {CAL_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>{c.label[lang]}</option>
              ))}
            </select>

            {/* 日期：依上面選的曆法顯示對應的日期輸入方式 */}
            {calendar === 'gregory' ? (
              <div className="relative">
                <input
                  type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm w-full outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: date ? INK : 'transparent' }}
                />
                {!date && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: INK_SOFT }}>
                    {t.datePlaceholder}
                  </span>
                )}
              </div>
            ) : (
              <CalendarDatePicker
                calendarId={calendar}
                isoDate={date}
                onChange={setDate}
                syncKey={formSession}
                lang={lang}
                t={t}
              />
            )}

            <div className="flex flex-col gap-2">
              <div key={isCare ? 'care-icons' : 'normal-icons'} className="flex gap-2 flex-wrap items-center picker-fade-swap">
                {isCare ? (
                  <>
                    {CARE_ICONS.map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIcon(i)}
                        className="rounded-lg text-xl flex items-center justify-center relative"
                        style={{ ...iconPickStyle(icon === i), width: '2.25rem', height: '2.25rem' }}
                      >
                        {i}
                      </button>
                    ))}
                    {/* 「自選」：關懷模式的第三格，只有一格，點了直接改這一格的內容，不會像平常的自訂圖示一路往下加 */}
                    {careCustomIcon ? (
                      <div className="relative">
                        <button
                          onClick={() => setIcon(careCustomIcon)}
                          className="p-2 rounded-lg text-xl"
                          style={iconPickStyle(icon === careCustomIcon)}
                        >
                          {careCustomIcon}
                        </button>
                        <button
                          onClick={() => { setShowCustomIconPanel(v => !v); setCustomIconError(''); }}
                          aria-label={t.customIconLabel}
                          className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                          style={{ width: 16, height: 16, background: INK_SOFT, color: '#fff' }}
                        >
                          <Pencil size={9} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowCustomIconPanel(v => !v); setCustomIconError(''); }}
                        aria-label={t.customIconLabel}
                        className="p-2 rounded-lg text-xl flex items-center justify-center"
                        style={{ ...iconPickStyle(showCustomIconPanel, { border: CARD_BORDER }), width: '2.25rem', height: '2.25rem' }}
                      >
                        <Plus size={16} style={{ color: INK_SOFT }} />
                      </button>
                    )}
                  </>
                ) : (
                  ICONS.map(i => {
                  const hasSubmenu = !!ICON_SUBMENUS[i];
                  // 選取狀態：目前圖示就是母菜單本身，或屬於它旗下的子菜單選項
                  const isSelected = icon === i || (hasSubmenu && ICON_SUBMENUS[i].includes(icon));
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (hasSubmenu) {
                          setOpenIconSubmenu(prev => {
                            const willOpen = prev !== i;
                            // 展開子菜單的同時，先預設事件圖示為母菜單本身；
                            // 若之後不在子菜單中選擇，圖示就維持母菜單的內容
                            if (willOpen) setIcon(i);
                            return willOpen ? i : null;
                          });
                        } else {
                          setIcon(i);
                          setOpenIconSubmenu(null);
                        }
                      }}
                      className="p-2 rounded-lg text-xl"
                      style={iconPickStyle(isSelected)}
                    >
                      {i}
                    </button>
                  );
                  })
                )}

                {/* 自訂圖示：與上方的內建 emoji 放在同一區域，使用者自己輸入想用的 emoji，存起來之後可重複選用（僅一般模式；關懷模式改用上面單獨一格的「自選」） */}
                {!isCare && customIcons.map(v => (
                  <div key={v} className="relative">
                    <button
                      onClick={() => { setIcon(v); setOpenIconSubmenu(null); }}
                      className="p-2 rounded-lg text-xl"
                      style={iconPickStyle(icon === v)}
                    >
                      {v}
                    </button>
                    <button
                      onClick={() => handleRemoveCustomIcon(v)}
                      aria-label={t.delete}
                      className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, background: DANGER, color: '#fff' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {!isCare && (
                  <button
                    onClick={() => { setShowCustomIconPanel(v => !v); setCustomIconError(''); }}
                    aria-label={t.customIconLabel}
                    className="p-2 rounded-lg text-xl flex items-center justify-center"
                    style={{ ...iconPickStyle(showCustomIconPanel, { border: CARD_BORDER }), width: '2.25rem', height: '2.25rem' }}
                  >
                    <Plus size={16} style={{ color: INK_SOFT }} />
                  </button>
                )}
              </div>
              {!isCare && openIconSubmenu && ICON_SUBMENUS[openIconSubmenu] && (
                <div className="flex gap-2 flex-wrap p-2 rounded-lg" style={{ background: INPUT_BG, border: CARD_BORDER }}>
                  {ICON_SUBMENUS[openIconSubmenu].map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        setIcon(v);
                      }}
                      className="p-2 rounded-lg text-xl"
                      style={iconPickStyle(icon === v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {showCustomIconPanel && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={customIconInput}
                    onChange={e => { setCustomIconInput(e.target.value); setCustomIconError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); isCare ? handleSetCareCustomIcon() : handleAddCustomIcon(); } }}
                    placeholder={t.customIconPlaceholder}
                    maxLength={20}
                    className="px-3 py-2 rounded-lg text-lg flex-1 outline-none"
                    style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
                  />
                  <button
                    onClick={isCare ? handleSetCareCustomIcon : handleAddCustomIcon}
                    className="px-3 py-2 rounded-lg text-sm font-bold text-white flex-shrink-0"
                    style={{ background: MINT }}
                  >
                    {t.customIconAdd}
                  </button>
                </div>
              )}
              {customIconError && (
                <p className="text-xs font-medium mt-1" style={{ color: DANGER }}>{customIconError}</p>
              )}
            </div>
            <div key={isCare ? 'care-colors' : 'normal-colors'} className="flex gap-2 mb-2 flex-wrap picker-fade-swap">
              {(isCare ? CARE_COLOR_TAGS : COLOR_TAGS).map(c => (
                <button key={c.id} onClick={() => setColorId(c.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: c.hex }}>
                  {colorId === c.id && <Check size={14} color="#fff" />}
                </button>
              ))}
            </div>

            {/* 模式選擇：取代原本的「重複」區塊。五個選項互斥、一次只能選一個，預設「常規」。
                按鈕底色比照「地標詳情」卡片裡「原圖」按鈕的樣式：未選中時是一層半透明毛玻璃底色＋細邊框，
                選中時換成實色 ACCENT，質感跟卡片自訂背景那組按鈕統一。
                「生日」「關懷」沿用原本 toggleBirthday／toggleCare 的邏輯（見 selectMode）：
                選中「關懷」會自動把圖示與顏色換成素雅的紀念樣式，離開時還原成切換前的組合；
                選中「生日」則固定每年重複一次，不用另外設定重複週期。
                「陪伴」「紀念日」目前只記錄選中狀態，具體行為之後再依安排補上。 */}
            <div className="p-3 rounded-xl" style={{ border: CARD_BORDER, background: INPUT_BG }}>
              <div className="text-sm font-bold mb-2" style={{ color: INK }}>{t.modeSelectLabel}</div>
              {/* 切換動畫：滑動底色的 transform 改用略帶回彈的 cubic-bezier（先小幅過衝再回穩），
                  比原本純 ease-out 更有「跳」到定位的手感；文字標籤選中時加一個小幅 scale
                  pop，按下瞬間再用 .mode-select-btn:active 做輕微按壓回饋（inline style 沒辦法
                  寫 :active，所以額外開一個極小的 <style> 區塊）。下方提示文字改成隨 eventMode
                  換一次 key，靠 CSS keyframe 做淡入＋輕微上移的 crossfade，取代原本文字瞬間跳換。 */}
              <style>{`
                .mode-select-btn { transform: scale(1); transition: color 180ms ease, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1); }
                .mode-select-btn:active { transform: scale(0.92); }
                .mode-select-btn.is-active { transform: scale(1.04); }
                @keyframes modeHintFadeIn {
                  from { opacity: 0; transform: translateY(-3px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <div className="relative flex p-1 rounded-full" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute', top: 4, bottom: 4, left: 4,
                    width: 'calc((100% - 8px) / 5)', borderRadius: 999,
                    // 「關懷」被選中時，滑動底色改成素雅的灰（跟 CARE_MODE_VARS 裡的
                    // --accent 同一個顏色，跟關懷模式其他地方的視覺語言一致），其餘四個
                    // 模式維持原本的 ACCENT。背景色／陰影都加上 transition，切換到／離開
                    // 「關懷」時顏色會平滑地淡入淡出，而不是瞬間跳色。
                    // transform 改用帶一點回彈的 cubic-bezier，滑動到定位前會先小幅過衝再回穩，
                    // 手感比單純 ease-out 更自然、更有「跳」過去的流暢感。
                    background: eventMode === 'care' ? '#8B8B92' : ACCENT,
                    boxShadow: eventMode === 'care'
                      ? '0 2px 8px rgba(139,139,146,0.35)'
                      : '0 2px 8px rgba(108,123,224,0.35)',
                    transform: `translateX(${EVENT_MODES.findIndex(m => m.id === eventMode) * 100}%)`,
                    transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 220ms ease, box-shadow 220ms ease',
                    willChange: 'transform',
                    pointerEvents: 'none',
                  }}
                />
                {EVENT_MODES.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMode(m.id)}
                    className={'relative z-10 flex-1 min-w-0 rounded-full text-xs font-bold mode-select-btn' + (eventMode === m.id ? ' is-active' : '')}
                    style={{
                      padding: '7px 3px',
                      color: eventMode === m.id ? '#fff' : INK_SOFT,
                      background: 'transparent',
                    }}
                  >
                    {t[m.labelKey]}
                  </button>
                ))}
              </div>
              {(() => {
                const activeMode = EVENT_MODES.find(m => m.id === eventMode);
                return activeMode ? (
                  <p key={eventMode} className="text-xs mt-2" style={{ color: INK_SOFT, animation: 'modeHintFadeIn 220ms ease' }}>{t[activeMode.hintKey]}</p>
                ) : null;
              })()}
            </div>

            {/* 只有紀念日／常規模式提供可調整的循環設定。生日與關懷固定每年一次，陪伴不循環。
                改成跟「地標詳情」卡片「自訂」面板同一套做法：這個區塊永遠掛載著，只用
                maxHeight／opacity（固定、寬裕到蓋得住實際內容即可，不用精準量測）做純 CSS
                過渡；marginBottom 用來抵銷收合時外層 flex gap-3 仍會保留的那段間距，
                收合到底時才不會留下一小條看起來卡卡的空白。 */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: CARD_BORDER,
                background: INPUT_BG,
                boxShadow: '0 2px 10px rgba(35,39,51,0.04)',
                maxHeight: (eventMode === 'anniversary' || eventMode === 'regular') ? 260 : 0,
                opacity: (eventMode === 'anniversary' || eventMode === 'regular') ? 1 : 0,
                marginBottom: (eventMode === 'anniversary' || eventMode === 'regular') ? 0 : -12,
                transition: 'max-height 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 130ms ease, margin-bottom 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ minHeight: 52 }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{
                        width: 28,
                        height: 28,
                        background: repeat ? accentAlpha('16') : 'var(--card-border)',
                        color: repeat ? ACCENT : INK_SOFT,
                        transition: 'background 180ms ease, color 180ms ease',
                      }}
                    >
                      <Clock size={15} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-none" style={{ color: INK }}>{t.cycleLabel}</div>
                      <div className="text-[11px] mt-1" style={{ color: INK_SOFT }}>
                        {repeat
                          ? (repeatUnit === 'month' ? t.monthlyBadge(repeatInterval) : t.yearlyBadge(repeatInterval))
                          : '不循環'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={repeat}
                    aria-label={t.cycleLabel}
                    onClick={() => setRepeat(v => !v)}
                    className="relative flex-shrink-0 rounded-full"
                    style={{
                      width: 46,
                      height: 28,
                      padding: 3,
                      background: repeat ? ACCENT : 'rgba(120,125,135,0.22)',
                      border: repeat ? `1px solid ${ACCENT}` : '1px solid rgba(120,125,135,0.16)',
                      boxShadow: repeat ? `0 3px 10px ${accentAlpha('30')}` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
                      transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                    }}
                  >
                    <span
                      className="absolute rounded-full"
                      style={{
                        width: 20,
                        height: 20,
                        top: 3,
                        left: repeat ? 22 : 3,
                        background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                        transition: 'left 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </button>
                </div>

                {/* 重複間隔子欄位：跟外層循環面板一樣，永遠掛載、只用固定的 maxHeight／opacity
                    做純 CSS 過渡；因為外層已經移除了 ResizeObserver 量測整份表單高度的機制，
                    這裡不會再有兩層動畫互相打架、回灌不同目標值的問題，單純一次到位。 */}
                <div
                  style={{
                    maxHeight: repeat ? 96 : 0,
                    opacity: repeat ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 190ms cubic-bezier(0.22, 1, 0.36, 1), opacity 130ms ease',
                  }}
                >
                  <div className="px-4 pb-3">
                    <div
                      className="flex items-center gap-2 p-2 rounded-xl"
                      style={{
                        background: 'rgba(127,127,127,0.06)',
                        border: '1px solid rgba(127,127,127,0.08)',
                      }}
                    >
                      <span className="text-xs font-semibold flex-shrink-0" style={{ color: INK_SOFT }}>每</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={repeatInterval}
                        onChange={e => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 h-9 px-1 rounded-lg text-sm text-center font-bold outline-none"
                        style={{
                          border: CARD_BORDER,
                          background: 'var(--card-bg)',
                          color: INK,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      />
                      <select
                        value={calendar !== 'gregory' ? 'year' : repeatUnit}
                        onChange={e => setRepeatUnit(e.target.value)}
                        className="h-9 px-2 rounded-lg text-sm font-semibold outline-none flex-1 min-w-0"
                        style={{
                          border: CARD_BORDER,
                          background: 'var(--card-bg)',
                          color: INK,
                        }}
                        disabled={calendar !== 'gregory'}
                      >
                        <option value="year">{t.unitYear}</option>
                        <option value="month">{t.unitMonth}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

            <button
              onClick={handleAdd}
              className="w-full py-2.5 rounded-full font-bold text-sm"
              style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(60,64,67,0.25)',
                color: INK,
                boxShadow: '0 4px 16px rgba(31,38,135,0.12)',
              }}
            >
              {editingId ? t.saveChanges : t.addToTimeline}
            </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 「地標詳情」視窗：點一下時間軸卡片開啟，跟新增／編輯地標視窗一樣掛在 document.body 底下。
          不分手機或大屏，一律用同一種「置中彈窗＋點外部關閉」樣式，卡片大小本來就是用 max-w-sm／
          max-h-[85vh] 這種相對單位撐出來的，會自動適應螢幕大小，不需要為大屏另外做一份固定版面 */}
      {viewingEvent && createPortal(
        <LandmarkDetailModal
          ev={viewingEvent} lang={lang} t={t} isDark={isDark}
          onClose={() => setViewingId(null)}
          onSetBgImage={dataUrlOrNull => setEventBgImage(viewingEvent.id, dataUrlOrNull)}
          onSetBgOpacity={opacity => setEventBgOpacity(viewingEvent.id, opacity)}
          onSetNumberFont={fontId => setEventNumberFont(viewingEvent.id, fontId)}
        />,
        document.body
      )}

      {/* 刪除地標前的二次確認：跟帳號那邊「刪除帳號」用的是同一套風格
          （置中彈窗、AUTH_GLASS 毛玻璃卡片、標題用 DANGER 紅色），
          下面兩個按鈕並排：左邊「確認刪除」白底紅邊紅字、右邊「取消操作」紅底白字，
          不分手機或大屏都用同一種置中彈窗，不用像地標詳情那樣嵌進右側面板——這只是個短暫的二次確認，
          不需要那麼重的處理 */}
      {confirmDeleteEvent && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 205,
            background: deleteModalPhase === 'shown' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            opacity: deleteModalPhase === 'hidden' ? 0 : 1,
            transition: `background ${DELETE_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${DELETE_MODAL_DURATION}ms ease`,
          }}
          onClick={closeDeleteConfirm}
        >
          <div
            className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`}
            style={{
              ...AUTH_GLASS,
              opacity: deleteModalPhase === 'shown' ? 1 : 0,
              transform: deleteModalPhase === 'shown'
                ? 'translateY(0) scale(1)'
                : 'translateY(10px) scale(0.97)',
              transition: `opacity ${DELETE_MODAL_DURATION}ms ease, transform ${DELETE_MODAL_DURATION}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black" style={{ color: DANGER }}>{t.deleteLandmarkConfirmTitle}</h2>
              <button onClick={closeDeleteConfirm} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
            </div>
            <p className="text-sm" style={{ color: INK }}>{t.deleteLandmarkConfirmDesc(confirmDeleteEvent.title)}</p>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { deleteEvent(confirmDeleteEvent.id); closeDeleteConfirm(); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${DANGER}`, color: DANGER }}
              >
                {t.confirmDeleteLandmark}
              </button>
              <button
                onClick={closeDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: DANGER, color: '#fff' }}
              >
                {t.cancelDeleteLandmark}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

// 相片縮圖：平時點一下＝放大檢視、長按＝進入多選模式（沿用跟 AlbumChip／ClockRow 相同的長按判定），
// 多選模式下改成點一下切換勾選（打勾樣式沿用世界時鐘的做法）；非多選模式時整張皆可拖曳排序。
function PhotoThumb({ photo, selected, selectMode, draggable, onTap, onLongPress, onDragStartPhoto, onDragOverPhoto, onDragEndPhoto }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const LONG_PRESS_MOVE_THRESHOLD = 10;

  const start = e => {
    firedRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    startPosRef.current = { x: point.clientX, y: point.clientY };
    timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress(); }, 500);
  };
  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; };
  const move = e => {
    if (!timerRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPosRef.current.x;
    const dy = point.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) clear();
  };
  const handleClick = () => {
    if (firedRef.current) { firedRef.current = false; return; }
    onTap();
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStartPhoto}
      onDragOver={onDragOverPhoto}
      onDrop={e => e.preventDefault()}
      onDragEnd={onDragEndPhoto}
      onMouseDown={start} onMouseUp={clear} onMouseLeave={clear} onMouseMove={move}
      onTouchStart={start} onTouchEnd={clear} onTouchMove={move}
      onClick={handleClick}
      className="relative aspect-square rounded-xl overflow-hidden"
      style={{ cursor: draggable ? 'grab' : 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <img src={photo.dataUrl || photo.url} alt="" className="w-full h-full object-cover" draggable={false} />
      {selectMode && (
        <span
          className="absolute flex items-center justify-center rounded"
          style={{ width: 18, height: 18, top: 5, left: 5, border: `1px solid ${selected ? DANGER : '#fff'}`, background: selected ? DANGER : 'rgba(0,0,0,0.35)' }}
        >
          {selected && <Check size={11} color="#fff" />}
        </span>
      )}
    </div>
  );
}

/* ---------------- Watermark ---------------- */

/* ---------------- Watermark ---------------- */
function Watermark() {
  return (
    <div
      className="fixed bottom-2.5 right-3 select-none"
      style={{ zIndex: 9999, fontSize: 11, fontWeight: 600, letterSpacing: 0.2, color: 'rgba(120,124,138,0.4)', pointerEvents: 'none' }}
    >
      @zhaoziwuofficial
    </div>
  );
}

// 產生「本機系統時區的標準時間」字串（精確到秒），用於測試版水印顯示訪問／渲染當下的時間，
// 方便測試人員回報問題時，快速對照「當時看到的是哪個時間點的畫面」。
function formatWatermarkAccessTime(date) {
  const pad = n => String(n).padStart(2, '0');
  const y = date.getFullYear(), mo = pad(date.getMonth() + 1), d = pad(date.getDate());
  const h = pad(date.getHours()), mi = pad(date.getMinutes()), s = pad(date.getSeconds());
  let zoneSuffix = '';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMin = -date.getTimezoneOffset(); // 分鐘數，正值代表比 UTC 快
    const sign = offsetMin >= 0 ? '+' : '-';
    const oh = pad(Math.floor(Math.abs(offsetMin) / 60));
    const om = pad(Math.abs(offsetMin) % 60);
    zoneSuffix = ` ${tz} UTC${sign}${oh}:${om}`;
  } catch (e) {}
  return `${y}-${mo}-${d} ${h}:${mi}:${s}${zoneSuffix}`;
}
/* ---------------- 臨時測試版浮水印（醒目、鋪滿全頁，可隨時移除） ----------------
   移除方式：刪除本元件、上方的 SHOW_TEST_WATERMARK / TEST_WATERMARK_TEXT 常數，
   以及 App() return 裡的 {SHOW_TEST_WATERMARK && <TestVersionWatermark />} 這一行即可，
   不會動到其他任何功能。 */
function TestVersionWatermark() {
  // 只在元件第一次掛載（也就是這次訪問／渲染）時取一次時間，之後不再更新，
  // 代表「使用者這次打開／整頁重新渲染時，系統時區當下的標準時間」。
  const [accessTime] = useState(() => formatWatermarkAccessTime(new Date()));
  const watermarkText = `${TEST_WATERMARK_TEXT} ${accessTime}`;
  const rows = 10;
  const cols = 4;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <span
          key={`${r}-${c}`}
          className="select-none whitespace-nowrap"
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: 'rgba(45,45,48,0.06)' }}
        >
          {watermarkText}
        </span>
      );
    }
  }
  return (
    // zIndex 為負值：讓浮水印疊在正常文件流內容「之下」（置底），不會蓋住卡片、按鈕等 UI
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-30%',
          width: '160%',
          height: '160%',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: '110px',
          placeItems: 'center',
          transform: 'rotate(-28deg)',
        }}
      >
        {cells}
      </div>
    </div>
  );
}

const AUTH_GLASS = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.4)',
  boxShadow: '0 8px 32px rgba(31,38,135,0.18)',
};

function GoogleGIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1818l-2.9087-2.2581c-.8064.54-1.8368.8591-3.0477.8591-2.3446 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4527.3477 2.8268.9573 4.0418L3.9641 10.71z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6555 3.5795 9 3.5795z" />
    </svg>
  );
}

/* 密碼輸入框：內建「顯示／隱藏已輸入內容」切換按鈕，供登入／註冊／修改密碼等表單共用 */
function PasswordField({ inputRef, value, onChange, onKeyDown, placeholder, t, className, style }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={className}
        style={{ ...style, paddingRight: 38 }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? t.hidePassword : t.showPassword}
        className="absolute right-0 top-0 h-full flex items-center px-2.5"
        style={{ color: INK_SOFT }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* ---------------- 帳號登入 Modal ---------------- */
// 效能筆記：這支元件原本是定義在 AuthModal 裡面的巢狀函式（每次 AuthModal 重新 render，例如帳號管理
// 畫面裡打密碼欄位每敲一個字，都會重新產生一個「新」的 BackupSection 函式參照）。React 判斷元件類型
// 是不是同一個，是直接比對函式參照本身，參照變了就視為完全不同的元件類型，會把整棵子樹整個卸載再重新
// 掛載一次（不是單純重新 render）——這在打字、切換分頁等高頻互動時會讓匯出／匯入按鈕看起來頓一下、
// 甚至偶爾吃掉點擊，跟手感差很多。搬到最外層、改吃 props，函式參照固定不變，AuthModal 重新 render
// 時這裡只會單純重新 render（甚至可以被瀏覽器判斷成同一份 DOM 節點直接更新），不會整段重建。
function BackupSection({ t, handleExportBackup, importFileRef, handleImportFileChange, backupMsg }) {
  return (
    <div className="flex flex-col gap-2 pt-3 mt-1" style={{ borderTop: CARD_BORDER }}>
      <p className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.backupSectionTitle}</p>
      <p className="text-xs" style={{ color: INK_SOFT }}>{t.backupHint}</p>
      {/* 原本這裡有一段「相片會讓備份檔變大，匯入／匯出速度可能因此變慢」的提醒（backupSlowdownHint），
          已經移到「新增相片」前的提醒視窗裡，跟 albumBackupReminder 一起分兩段顯示，這裡不再重複。 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExportBackup}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        >
          {t.backupExportBtn}
        </button>
        <button
          type="button"
          onClick={() => importFileRef.current && importFileRef.current.click()}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        >
          {t.backupImportBtn}
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept=".tzzwnb"
          className="hidden"
          onChange={handleImportFileChange}
        />
      </div>

      {backupMsg && (
        <p className="text-xs font-bold" style={{ color: backupMsg.type === 'success' ? MINT : DANGER }}>
          {backupMsg.text}
        </p>
      )}
    </div>
  );
}

function AuthModal({ lang, t, user, onClose, backupData, onImportBackup }) {
  // 大屏（折叠屏展开／平板／桌面）下把視窗card稍微加寬一些，比例更接近桌面軟體的置中對話框，
  // 不像手機那樣窄窄一條；由於這裡的視窗本來就已經是「置中顯示」（fixed inset-0 + items-center），
  // 所以只需要放寬 max-width，不需要改變彈出方式或位置。
  const isLargeScreen = useIsLargeScreen();
  const [modalPhase, setModalPhase] = useState('enter');
  const AUTH_MODAL_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setModalPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  function handleClose() {
    if (modalPhase === 'closing') return;
    setModalPhase('closing');
    setTimeout(onClose, AUTH_MODAL_DURATION);
  }
  useModalBackClose(true, handleClose);
  const modalShown = modalPhase === 'shown';
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  // 是否偵測為中國大陸用戶：只在「尚未登入」的登入／註冊頁面擋下，已登入的帳號管理畫面不受影響
  const [cnBlocked] = useState(() => isLikelyMainlandChinaUser());

  // ---- 本機備份（匯出／匯入）：雲端同步在中國大陸連不上時的替代方案 ----
  // 直接把目前的 clocks／events／lang／isDark／customIcons 整包輸出，
  // 需要的時候再走同一套 applyCloudData 邏輯還原回來。
  //
  // Android 上單純觸發 <a download> 存成 .tzzwnb 檔，使用者常常找不到檔案存去哪了（下載資料夾要另外搜尋，
  // 門檻很高）。改成優先使用 Web Share API（navigator.share 帶 file），直接叫出系統原生的分享面板，
  // 使用者可以直接選「傳送給自己」「儲存到雲端硬碟」「記事本」等——不需要碰檔案總管。
  // 不支援 Web Share 的瀏覽器（多半是桌面版）才退回原本的 <a download> 下載方式。
  const importFileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState(null); // { type: 'success' | 'error', text }

  // 相片是「盡力而為」附加進備份檔：從各相冊各自的 window.storage key 收集起來，跟骨架資料一起打包。
  // 用 collectAllAlbumPhotos（跟雲端同步共用同一支函式）；匯入端也已經在共用的 applyCloudData
  // 裡處理過 albumPhotos 欄位了，所以匯入這邊完全不用另外改。
  async function buildBackupPayloadWithPhotos() {
    const albumPhotos = await collectAllAlbumPhotos(backupData.albums && backupData.albums.length ? backupData.albums : resolveAlbumsField(backupData));
    return { ...backupData, ...(Object.keys(albumPhotos).length ? { albumPhotos } : {}), exportedAt: Date.now() };
  }

  async function parseAndImport(fileText) {
    const data = await parseBackupPayload(fileText);
    if (!data) {
      setBackupMsg({ type: 'error', text: t.backupImportError });
      return false;
    }
    onImportBackup(data);
    setBackupMsg({ type: 'success', text: t.backupImportSuccess });
    return true;
  }

  async function handleExportBackup() {
    const json = JSON.stringify(await buildBackupPayloadWithPhotos(), null, 2);
    const encryptedText = await encryptBackupText(json);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `sgx-backup-${stamp}.tzzwnb`;
    const file = new File([encryptedText], filename, { type: 'application/octet-stream' });

    // 優先走系統分享面板（手機上最直覺，不用自己去下載資料夾找檔案）
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        setBackupMsg({ type: 'success', text: t.backupExportSuccess });
        return;
      } catch (err) {
        // 使用者取消分享，或裝置不支援帶檔案分享：不當成錯誤，繼續往下退回下載方式
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg({ type: 'success', text: t.backupExportSuccess });
  }

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 允許連續匯入同一個檔案時也能觸發 change
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndImport(String(reader.result));
    reader.onerror = () => setBackupMsg({ type: 'error', text: t.backupImportError });
    reader.readAsText(file);
  }

  // 已登入帳號管理：主畫面／修改密碼／註銷確認
  const [view, setView] = useState('main');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // 鍵盤操作：Enter／方向鍵向下 可以切換到下一個欄位，方向鍵向上可以回到上一個欄位，最後一欄按 Enter 直接送出
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmNewPasswordRef = useRef(null);

  function stepToNext(nextRef, onSubmit, prevRef) {
    return (e) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (nextRef && nextRef.current) nextRef.current.focus();
        else if (onSubmit) onSubmit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (prevRef && prevRef.current) prevRef.current.focus();
      }
    };
  }

  async function run(fn) {
    setBusy(true);
    setError('');
    // Firebase 的請求在部分網路環境下可能連不上、卡在內部重試／等待逾時，
    // 使用者畫面上就是「一直轉圈、不知道發生什麼事」。
    // 這裡自己加一個 8 秒的逾時，超過就先把畫面還給使用者，顯示這個功能目前無法使用、
    // 請聯繫開發者，而不是讓 Firebase 自己的（更長的）逾時機制決定使用者要等多久。
    // 注意：timedOut 要宣告在 try 區塊外面，因為 let／const 是區塊作用域，
    // 宣告在 try{} 裡面的話，下面 catch{} 區塊是完全存取不到的。
    let timedOut = false;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, 8000);
      });
      await Promise.race([fn(), timeoutPromise]);
    } catch (err) {
      setError(timedOut ? t.authTimeout : t.authError);
    }
    setBusy(false);
  }

  function handleSubmit() {
    if (mode === 'signup' && password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    run(async () => {
      if (mode === 'login') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    });
  }

  function handleChangePassword() {
    if (newPassword !== confirmNewPassword) {
      setError(t.passwordMismatch);
      return;
    }
    run(async () => {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    });
  }

  if (user) {
    const providerId = getCurrentUserProviderId();
    const methodLabel = providerId === 'google.com' ? t.loginMethodGoogle : providerId === 'apple.com' ? t.loginMethodApple : t.loginMethodEmail;

    if (view === 'changePassword') {
      return (
        <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
          <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black" style={{ color: INK }}>{t.changePassword}</h2>
              <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
            </div>
            <PasswordField
              inputRef={currentPasswordRef} t={t}
              placeholder={t.currentPassword} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              onKeyDown={stepToNext(newPasswordRef, null, null)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            />
            <PasswordField
              inputRef={newPasswordRef} t={t}
              placeholder={t.newPassword} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              onKeyDown={stepToNext(confirmNewPasswordRef, null, currentPasswordRef)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            />
            <PasswordField
              inputRef={confirmNewPasswordRef} t={t}
              placeholder={t.confirmNewPassword} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
              onKeyDown={stepToNext(null, handleChangePassword, newPasswordRef)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            />
            {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
            {pwSuccess && <p className="text-xs font-bold" style={{ color: MINT }}>{t.passwordChangeSuccess}</p>}
            <button
              onClick={handleChangePassword}
              disabled={busy || !currentPassword || !newPassword || !confirmNewPassword}
              className="py-2.5 rounded-xl font-bold text-sm"
              style={{ background: MINT, color: '#fff', opacity: busy || !currentPassword || !newPassword || !confirmNewPassword ? 0.6 : 1 }}
            >
              {t.saveChangesBtn}
            </button>
            <button
              onClick={() => { setView('main'); setError(''); setPwSuccess(false); }}
              className="text-xs font-bold"
              style={{ color: ACCENT }}
            >
              {t.back}
            </button>
          </div>
        </div>
      );
    }

    if (view === 'deleteConfirm') {
      return (
        <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
          <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black" style={{ color: DANGER }}>{t.deleteAccountConfirmTitle}</h2>
              <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
            </div>
            <p className="text-sm" style={{ color: INK }}>{t.deleteAccountConfirmDesc}</p>
            {providerId === 'password' && (
              <PasswordField
                t={t}
                placeholder={t.currentPassword} value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(async () => { await deleteAccount(deletePassword); handleClose(); }); } }}
                className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
                style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
              />
            )}
            {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
            <button
              onClick={() => run(async () => { await deleteAccount(deletePassword); handleClose(); })}
              disabled={busy || (providerId === 'password' && !deletePassword)}
              className="py-2.5 rounded-xl font-bold text-sm"
              style={{ background: DANGER, color: '#fff', opacity: busy || (providerId === 'password' && !deletePassword) ? 0.6 : 1 }}
            >
              {t.confirmDelete}
            </button>
            <button
              onClick={() => { setView('main'); setError(''); }}
              className="text-xs font-bold"
              style={{ color: ACCENT }}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
        <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-4`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black" style={{ color: INK }}>{t.account}</h2>
            <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
          </div>
          <p className="text-sm" style={{ color: INK }}>{t.loggedInAs(user.email || user.displayName || user.uid)}</p>
          <p className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.loginMethodLabel}：{methodLabel}</p>

          {providerId === 'password' && (
            <button
              onClick={() => { setView('changePassword'); setError(''); setPwSuccess(false); }}
              className="py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            >
              {t.changePassword}
            </button>
          )}

          <BackupSection t={t} handleExportBackup={handleExportBackup} importFileRef={importFileRef} handleImportFileChange={handleImportFileChange} backupMsg={backupMsg} />

          <button
            onClick={() => run(async () => { await signOutUser(); handleClose(); })}
            disabled={busy}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: DANGER, color: '#fff', opacity: busy ? 0.6 : 1 }}
          >
            <LogOut size={15} /> {t.logout}
          </button>

          <button
            onClick={() => { setView('deleteConfirm'); setError(''); setDeletePassword(''); }}
            className="text-xs font-bold"
            style={{ color: DANGER }}
          >
            {t.deleteAccount}
          </button>
        </div>
      </div>
    );
  }

  if (cnBlocked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
        <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black" style={{ color: INK }}>{t.loginToSync}</h2>
            <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
          </div>
          <p className="text-sm font-bold" style={{ color: DANGER }}>{t.mainlandCnBlocked}</p>
          <BackupSection t={t} handleExportBackup={handleExportBackup} importFileRef={importFileRef} handleImportFileChange={handleImportFileChange} backupMsg={backupMsg} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
      <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black" style={{ color: INK }}>{t.loginToSync}</h2>
          <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>

        <button
          onClick={() => run(signInWithGoogle)}
          disabled={busy}
          className="flex items-center justify-center gap-2.5 py-2.5 rounded-full font-bold text-sm"
          style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(60,64,67,0.25)', color: INK, opacity: busy ? 0.6 : 1 }}
        >
          <GoogleGIcon /> {t.continueWithGoogle}
        </button>
        {SHOW_APPLE_LOGIN && (
          <button
            onClick={() => run(signInWithApple)}
            disabled={busy}
            className="py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK, opacity: busy ? 0.6 : 1 }}
          >
            {t.continueWithApple}
          </button>
        )}

        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>{t.orDivider}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
        </div>

        <input
          ref={emailRef}
          type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={stepToNext(passwordRef, null, null)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        />
        <PasswordField
          inputRef={passwordRef} t={t}
          placeholder={t.password} value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={stepToNext(mode === 'signup' ? confirmPasswordRef : null, handleSubmit, emailRef)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        />
        {mode === 'signup' && (
          <PasswordField
            inputRef={confirmPasswordRef} t={t}
            placeholder={t.confirmPassword} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            onKeyDown={stepToNext(null, handleSubmit, passwordRef)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
            style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
          />
        )}
        {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy || !email || !password || (mode === 'signup' && !confirmPassword)}
          className="py-2.5 rounded-xl font-bold text-sm"
          style={{ background: MINT, color: '#fff', opacity: busy || !email || !password || (mode === 'signup' && !confirmPassword) ? 0.6 : 1 }}
        >
          {mode === 'login' ? t.login : t.signup}
        </button>
        <button
          onClick={() => { setMode(m => (m === 'login' ? 'signup' : 'login')); setConfirmPassword(''); setError(''); }}
          className="text-xs font-bold"
          style={{ color: ACCENT }}
        >
          {mode === 'login' ? t.switchToSignup : t.switchToLogin}
        </button>

        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>{t.orDivider}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
        </div>

        {magicSent ? (
          <p className="text-xs font-bold text-center" style={{ color: MINT }}>{t.magicLinkSent}</p>
        ) : (
          <button
            onClick={() => run(async () => { await sendMagicLink(email); setMagicSent(true); })}
            disabled={busy || !email}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK, opacity: busy || !email ? 0.6 : 1 }}
          >
            <Mail size={15} /> {t.sendMagicLink}
          </button>
        )}

        <BackupSection t={t} handleExportBackup={handleExportBackup} importFileRef={importFileRef} handleImportFileChange={handleImportFileChange} backupMsg={backupMsg} />
      </div>
    </div>
  );
}

/* ---------------- 首次登入資料合併 Dialog ---------------- */
function MergeDialog({ t, onResolve }) {
  const isLargeScreen = useIsLargeScreen();
  const [phase, setPhase] = useState('enter');
  const MERGE_MODAL_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  const shown = phase === 'shown';
  function handleResolve(result) {
    if (phase === 'closing') return;
    setPhase('closing');
    setTimeout(() => onResolve(result), MERGE_MODAL_DURATION);
  }
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{
        zIndex: 210,
        background: shown ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: `background ${MERGE_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}>
      <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: `opacity ${MERGE_MODAL_DURATION}ms ease, transform ${MERGE_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}>
        <h2 className="text-lg font-black" style={{ color: INK }}>{t.mergeTitle}</h2>
        <p className="text-sm" style={{ color: INK_SOFT }}>{t.mergeDesc}</p>
        <button onClick={() => handleResolve('merge')} className="py-2.5 rounded-xl font-bold text-sm" style={{ background: MINT, color: '#fff' }}>
          {t.mergeOptionMerge}
        </button>
        <button onClick={() => handleResolve('cloud')} className="py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}>
          {t.mergeOptionUseCloud}
        </button>
        <button onClick={() => handleResolve('local')} className="py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}>
          {t.mergeOptionUseLocal}
        </button>
      </div>
    </div>
  );
}


function InviteGate({ lang, t, onUnlocked }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setError('');
    try {
      const result = await verifyInviteCode(code);
      if (result.ok) {
        await window.storage.set(INVITE_KEY, 'true', false).catch(() => {});
        onUnlocked();
      } else {
        setError(t.inviteInvalid);
      }
    } catch (err) {
      setError(t.inviteInvalid);
    }
    setChecking(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--page-bg)', fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={handleSubmit} className="w-full max-w-xs p-6 rounded-2xl flex flex-col gap-3" style={{ background: 'var(--card-bg)', border: CARD_BORDER }}>
        <h1 className="text-lg font-black" style={{ color: INK }}>{t.inviteTitle}</h1>
        <p className="text-sm" style={{ color: INK_SOFT }}>{t.inviteSubtitle}</p>
        <input
          type="text"
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t.invitePlaceholder}
          className="px-3 py-2 rounded-lg text-sm w-full outline-none"
          style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
        />
        {error && <p className="text-xs font-medium" style={{ color: DANGER }}>{error}</p>}
        <button
          type="submit"
          disabled={checking || !code.trim()}
          className="px-3 py-2 rounded-lg text-sm font-bold text-white"
          style={{ background: MINT, opacity: checking || !code.trim() ? 0.6 : 1 }}
        >
          {checking ? t.inviteChecking : t.inviteSubmit}
        </button>
      </form>
    </div>
  );
}

const EVENTS_KEY = 'countdown-timeline-events';
const CLOCKS_KEY = 'world-clock-list';
const LANG_KEY = 'app-language';
const DARK_KEY = 'app-dark-mode';
// 「外觀」偏好：跟隨系統／淺色／深色。isDark（實際套用的布林值）維持不變，全 App 其他地方
// 完全不用改；themeMode 只多加一層「isDark 應該怎麼算出來」的邏輯，獨立存一個新 key，
// 不影響舊版 DARK_KEY 的讀寫與雲端同步欄位（同步／備份仍然只帶 isDark 這個布林值即可）。
const THEME_MODE_KEY = 'app-theme-mode';
const CUSTOM_ICONS_KEY = 'custom-icon-emojis';
const HOME_TZ_ID_KEY = 'world-clock-home-id'; // 世界時鐘「目前位置」設定的是哪一筆時鐘（存 id），修好重新整理後會回復原狀的問題
const NOTIFY_ENABLED_KEY = 'event-notify-enabled';
const NOTIFY_DAYS_BEFORE_KEY = 'event-notify-days-before';
// 記錄每個事件「上一次已經通知過的是哪一次occurrence」（存目標日期字串，不是存剩餘天數！）
// 這樣重複性事件（例如生日）明年倒數又走到同一個天數時，才不會因為存的是同一個數字而被誤判成
// 「已經通知過」，導致往後每年都收不到提醒
const NOTIFY_LOG_KEY = 'event-notify-log';
// 相冊相片本體另外存放的 key 前綴：album-photos:{albumId}，跟相冊骨架（ALBUMS_KEY）分開存，
// 避免相片跟其他所有資料擠在同一個 key 裡導致整包存失敗（單一相冊的相片量爆掉也只影響它自己）。
const ALBUM_PHOTOS_PREFIX = 'album-photos:';
// 相冊功能重新設計後，「相冊」變成獨立一級功能：骨架（{id, name, eventId, createdAt}）存在自己
// 的 window.storage key，不再寄生在事件的 albums 欄位裡——事件與相冊改成「相冊可選擇性關聯一個
// 事件」的輕量關係（eventId 可以是 null），而不是「相冊必須屬於某個事件」。
const ALBUMS_KEY = 'countdown-timeline-albums';

// 產生新相冊 id，跟相片 id 用同一種「時間戳記＋亂數」格式，方便從 id 反推大致建立時間
// （見 parseAlbumCreatedAt），不用另外多存一個 createdAt 欄位也能有排序依據；
// 但仍然明確存一份 createdAt，讓「從舊版 ev.albums 搬遷過來的相冊」也能有合理的建立時間可用。
function makeAlbumId() { return `alb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function parseAlbumCreatedAt(id) {
  const m = /^alb_(\d+)_/.exec(id || '');
  return m ? parseInt(m[1], 10) : Date.now();
}
// 讀取／寫入／刪除某個相冊的相片內容——搬出 AlbumModal 之後變成獨立的頂層函式，
// 讓相冊首頁（列出所有相冊的封面）、相冊詳細頁都能共用同一套讀寫邏輯。
async function loadAlbumPhotosGlobal(albumId) {
  try {
    const res = await window.storage.get(ALBUM_PHOTOS_PREFIX + albumId, false);
    return res && res.value ? JSON.parse(res.value) : [];
  } catch (err) {
    return [];
  }
}
async function persistAlbumPhotosGlobal(albumId, photos) {
  await window.storage.set(ALBUM_PHOTOS_PREFIX + albumId, JSON.stringify(photos), false);
}
async function deleteAlbumPhotosGlobal(albumId) {
  try { await window.storage.delete(ALBUM_PHOTOS_PREFIX + albumId, false); } catch (err) { /* 本來就沒有相片，忽略即可 */ }
}

// 「相冊 ↔ 事件」搬遷：早期版本相冊骨架存在 ev.albums[]（相冊必屬於一個事件），現在改成頂層
// 獨立清單、每個相冊自己帶一個可為 null 的 eventId。這裡從一份 events 清單反推出等效的頂層
// 相冊清單，讓舊資料（本機備份檔、雲端舊格式）第一次讀取時能自動接上新結構，不遺失任何相冊。
function deriveAlbumsFromEvents(eventsList) {
  const out = [];
  (eventsList || []).forEach(ev => {
    (ev.albums || []).forEach(a => {
      if (a && a.id != null) out.push({ id: a.id, name: a.name || '', eventId: ev.id, createdAt: parseAlbumCreatedAt(a.id) });
    });
  });
  return out;
}
// 合併多份相冊清單（依 id 去重），後面的清單覆蓋前面同 id 的內容——用來把「頂層已經存在的相冊
// 資料」跟「從 events 反推出來的舊格式相冊」合併成一份，不管資料目前是新格式、舊格式，還是新舊
// 混雜，都能得到一份完整、不重複的相冊清單。
function mergeAlbumsList(...lists) {
  const map = new Map();
  lists.forEach(list => (list || []).forEach(a => { if (a && a.id != null) map.set(a.id, { ...map.get(a.id), ...a }); }));
  return Array.from(map.values());
}
// 從一份可能是雲端或本機的資料物件（{ events, albums }）解析出「這份資料實際代表的相冊清單」：
// 明確帶著的頂層 albums 欄位（新格式）優先，再用 events 反推出的舊格式相冊補齊，確保新舊資料
// 混合時不會有任何一邊的相冊憑空消失。
function resolveAlbumsField(data) {
  return mergeAlbumsList(deriveAlbumsFromEvents(data && data.events), (data && data.albums) || []);
}

// 自我修復用的搬遷函式：早期版本可能把相片直接內嵌在 ev.albums[].photos 裡（跟事件骨架擠在同一個
// window.storage key），一旦累積夠多相片就會整包超過單一 key 的大小上限、悄悄存失敗。這裡偵測到
// 這種「內嵌相片」的舊格式時，把相片本體搬去各自的 albumPhotos:{albumId} key，events 裡只留下
// 骨架 {id, name}。單一相冊搬遷失敗就跳過那一個、留在原地下次再試，不會讓整個搬遷流程整包失敗。
async function migrateInlineAlbumPhotos(eventsList) {
  let changed = false;
  const migrated = [];
  for (const ev of eventsList) {
    const albums = ev.albums;
    if (!Array.isArray(albums) || !albums.length) { migrated.push(ev); continue; }
    const hasInlinePhotos = albums.some(a => Array.isArray(a.photos) && a.photos.length);
    if (!hasInlinePhotos) { migrated.push(ev); continue; }
    changed = true;
    const newAlbums = [];
    for (const a of albums) {
      if (Array.isArray(a.photos) && a.photos.length) {
        try { await window.storage.set(ALBUM_PHOTOS_PREFIX + a.id, JSON.stringify(a.photos), false); } catch (err) { /* 留在原地，下次再試 */ }
      }
      const { photos, ...rest } = a;
      newAlbums.push(rest);
    }
    migrated.push({ ...ev, albums: newAlbums });
  }
  return { events: migrated, changed };
}

// 收集某一份 events 清單底下所有相冊實際的相片內容（從各自的 window.storage key 讀出來），
// 回傳 { [albumId]: Photo[] }，只包含真的有相片的相冊。用在雲端同步時「盡力而為」把相片也帶上——
// 之所以是「盡力而為」而不是保證成功，是因為目前雲端這邊用的 saveCloudData/loadCloudData
// 介面細節（例如單一文件的大小上限）不在這次拿到的檔案範圍內，沒辦法事先確認上限在哪裡，
// 所以每次推送都會先「整包帶著相片試一次」，失敗了再「退回只推骨架」，確保就算相片同步不了，
// 至少事件／時鐘本身的同步不會被拖累卡住。
// 把 albumPhotos（{ [albumId]: Photo[] }）轉成一個穩定的簽章字串，只看「每個相冊底下有哪些
// 相片 id、依序排列」，不看相片內容本身——用來判斷「跟上次成功同步的狀態相比，相片有沒有真的
// 變動過」，避免沒動到相片的一般編輯（改標題、加時鐘…）也觸發重新上傳／重新整理索引。
function photoSigFromAlbumPhotos(albumPhotos) {
  return stableStringify(Object.keys(albumPhotos || {}).sort().map(id => [id, (albumPhotos[id] || []).map(p => p.id)]));
}

// 收集一份相冊清單（頂層 albums，格式 [{id,...}]）底下所有相冊實際的相片內容（從各自的
// window.storage key 讀出來），回傳 { [albumId]: Photo[] }，只包含真的有相片的相冊。
// 相冊改成獨立的頂層清單後，這裡直接吃 albums 陣列本身，不再從 events[].albums 反推 id——
// 否則沒有關聯任何事件、或關聯的事件跟舊格式無關的相冊，相片會在雲端同步時被漏掉。
async function collectAllAlbumPhotos(albumsList) {
  const uniqueIds = Array.from(new Set((albumsList || []).map(a => a && a.id).filter(id => id != null)));
  const result = {};
  await Promise.all(uniqueIds.map(async id => {
    try {
      const res = await window.storage.get(ALBUM_PHOTOS_PREFIX + id, false);
      if (res && res.value) {
        const photos = JSON.parse(res.value);
        if (Array.isArray(photos) && photos.length) result[id] = photos;
      }
    } catch (err) { /* 這個相冊還沒有相片、或讀取失敗，當作沒有即可，不影響其他相冊 */ }
  }));
  return result;
}

// 推送到雲端時的共用邏輯：先整包（含相片，如果有帶的話）試一次，失敗就自動退回只推
// 事件／時鐘等骨架資料再試一次，讓「相片同步失敗」不會連帶讓其他資料也同步不了。
// 回傳 { ok, photosSynced }：ok 表示「(至少骨架部分) 是否同步成功」；photosSynced 表示
// 「這次呼叫端要求同步的相片，是否真的也一起存上去了」——兩者分開回報，是因為 ok=true 也可能
// 只是走了退回骨架的那條路，呼叫端需要準確知道相片究竟有沒有真的同步成功，才能正確決定要不要
// 更新「上次成功同步的相片簽章」，不然萬一誤判成「已同步」，之後就再也不會重新嘗試同步那些相片了。
async function saveCloudDataBestEffort(uid, fullData) {
  try {
    await saveCloudData(uid, fullData);
    return { ok: true, photosSynced: fullData.albumPhotos !== undefined };
  } catch (err) {
    console.error(err);
    if (!fullData.albumPhotos) return { ok: false, photosSynced: false };
    try {
      const { albumPhotos, ...meta } = fullData;
      await saveCloudData(uid, meta);
      return { ok: true, photosSynced: false };
    } catch (err2) {
      console.error(err2);
      return { ok: false, photosSynced: false };
    }
  }
}

/* ---------------- 底部導覽列（手機版專用，桌面/大屏維持原本左右分欄，不套用這個） ---------------- */
// 五個分頁固定順序：世界時鐘｜日程｜時光線｜圖片庫｜我的——「時光線」放在 5 個項目的正中間
// （第 3 個），「日程」讓到第 2 個。中央「時光線」用品牌圖示
// （見 BOTTOM_NAV_LOGO_SRC 常數說明），其餘四個用 lucide-react 的簡潔線性圖示，
// 跟專案其他地方（意見反饋視窗等）用的是同一套圖示庫，風格才不會分裂成兩套。
// 「日程」原本用 Heart（紀念日語意），改版後日程頁以日曆為核心視覺，圖示也一併換成
// Calendar，跟其餘圖示同樣是線性、同樣的粗細與尺寸，純粹換圖案，文字（t.navSchedule＝
// 「日程」）完全不動。
const BOTTOM_NAV_ITEMS = [
  { id: 'clock', icon: Globe, labelKey: 'worldClock' },
  { id: 'schedule', icon: Calendar, labelKey: 'navSchedule' },
  { id: 'home', icon: null, labelKey: null }, // 中央特殊處理，見下方渲染邏輯
  { id: 'gallery', icon: Images, labelKey: 'navGallery' },
  { id: 'profile', icon: User, labelKey: 'navProfile' },
];

function BottomNavLogo({ active }) {
  // 品牌圖示素材還沒放上去之前，用一個中性的實心圓點佔位（不是刻意畫的替代 Logo），
  // 圖片載入失敗時自動切換回這個佔位，素材一到位就會自動顯示正式圖檔。
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return (
      <div
        className="rounded-full flex-shrink-0"
        style={{ width: 22, height: 22, background: active ? ACCENT : 'var(--card-border)', transition: 'background 150ms ease' }}
      />
    );
  }
  return (
    <img
      src={BOTTOM_NAV_LOGO_SRC}
      alt=""
      onError={() => setImgFailed(true)}
      className="flex-shrink-0"
      style={{ width: 24, height: 24, objectFit: 'contain', opacity: active ? 1 : 0.55, transition: 'opacity 150ms ease' }}
    />
  );
}

function BottomNavigation({ activeTab, setActiveTab, t }) {
  return (
    <nav
      className="flex-shrink-0"
      style={{
        position: 'relative',
        zIndex: 30,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: CARD_BORDER,
        // iOS Safe Area／Android 手勢導覽區：跟 Header 頂部安全區同一套做法（env() 在沒有
        // 安全區概念的環境下是 0，不影響一般網頁版），底部再固定留一點基礎間距。
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-md mx-auto w-full flex items-stretch justify-between px-2">
        {BOTTOM_NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          const isCenter = item.id === 'home';
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
              style={{ minWidth: 0 }}
            >
              {isCenter ? (
                <BottomNavLogo active={active} />
              ) : (
                <Icon size={20} style={{ color: active ? ACCENT : INK_SOFT, transition: 'color 150ms ease' }} strokeWidth={active ? 2.4 : 2} />
              )}
              <span
                className="text-[10px] truncate"
                style={{
                  color: active ? ACCENT : INK_SOFT,
                  fontWeight: active ? 700 : 500,
                  maxWidth: '100%',
                }}
              >
                {isCenter ? '時光線' : t[item.labelKey]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// 大屏／桌面版的導覽列：跟 BottomNavigation 用同一份 BOTTOM_NAV_ITEMS、同一套選中狀態顏色
// 邏輯，只是方向改成直排、放在畫面右側（見需求：大屏也要有導覽列，但放右邊，項目跟手機版
// 相同），取代原本大屏 Header 上那排帳號／通知／回饋／深色模式／語言圖示——那些功能現在
// 全部收在「我的」分頁裡（ProfilePage），跟手機版共用同一份頁面、同一套邏輯。
function SideNavigation({ activeTab, setActiveTab, t }) {
  return (
    <nav
      className="flex-shrink-0 flex flex-col items-center"
      style={{
        width: 84,
        position: 'relative',
        zIndex: 30,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderLeft: CARD_BORDER,
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        gap: 4,
      }}
    >
      {BOTTOM_NAV_ITEMS.map(item => {
        const active = activeTab === item.id;
        const isCenter = item.id === 'home';
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl"
            style={{ width: 64, flexShrink: 0 }}
          >
            {isCenter ? (
              <BottomNavLogo active={active} />
            ) : (
              <Icon size={20} style={{ color: active ? ACCENT : INK_SOFT, transition: 'color 150ms ease' }} strokeWidth={active ? 2.4 : 2} />
            )}
            <span
              className="text-[10px] truncate"
              style={{
                color: active ? ACCENT : INK_SOFT,
                fontWeight: active ? 700 : 500,
                maxWidth: '100%',
              }}
            >
              {isCenter ? '時光線' : t[item.labelKey]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------- 圖片庫（跨事件的相片聚合瀏覽，第一版：只做聚合展示＋單張放大預覽） ---------------- */
// 相片本身仍然完全存在各自事件的 albums 欄位裡（events[].albums[].photos[]），這裡
// 完全不建立、不複製任何新的照片資料，只是在畫面上把它們臨時攤平成一個陣列來顯示，
// 不會影響、也不會取代原本「紀念日 → 某個事件 → 相冊」那一套既有的管理功能。
/* ---------------- 日程分頁頂部的月曆／年曆（日曆是這個分頁的核心視覺，見需求文件二、八） ---------------- */
// 完全複用既有的 getEffectiveDate()（已經處理好農曆／各種曆法／循環規則），對每個事件算
// 「從指定參考日開始算，下一次會落在哪天」，落在目前顯示的月份（或年份，逐月掃 12 次）裡
// 才點一個標記，不用另外重新設計一套日期比對邏輯。
// 這個元件現在還多負責兩件事：① 支援直接選年份／月份跳頁，不用一直點上一月/下一月；
// ② 把目前顯示的時間範圍（月或年）透過 onRangeChange 往上回報給 App，讓下面的日程列表
// （TimelineSection layout="cards"）跟著這個範圍同步顯示，兩邊不會各自用不同的時間範圍。
// eventsByDay／monthsHaveEvents 都包進 useMemo：這兩個都要對全部事件跑 getEffectiveDate
// （農曆／其他曆法事件內部還要逐日掃描比對，不便宜），如果不做快取，父層 App 每 30 秒
// 更新一次「現在時間」就會讓這個元件重新渲染、重新整個算一次，即使使用者什麼都沒點，
// 這正是先前「開啟日程頁卡頓、操作反應慢」的主因之一，改成只有 events／year／month／
// viewMode 真的變動時才重算。
const AnniversaryCalendar = forwardRef(function AnniversaryCalendar({ events, lang, t, now, onRangeChange, viewMode, setViewMode, enabledAltCalendars }, ref) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11，viewMode==='year'／'week' 時不使用
  // viewMode（'month'＝月曆格子；'year'＝12 個月的年曆格子；'week'＝一週 7 天）改由外層 App
  // 控制（見需求四：頂部標題列跟日曆之間的年／月／週滑塊），這裡不再自己 useState。
  const [weekAnchor, setWeekAnchor] = useState(now); // 週檢視專用：這一週裡任一天，用來算出這一週的週日～週六範圍
  const [selectedDay, setSelectedDay] = useState(null); // 月檢視專用，點日期在下面秀一小段當天預覽
  const [selectedWeekDate, setSelectedWeekDate] = useState(null); // 週檢視專用，選中的完整日期（週可能橫跨兩個月，不能只存「日」這個數字）
  // 收合／展開：預設展開。收合時只留標題列（含收合鈕），下面的日期格子／年曆格子、選中日
  // 預覽整塊收合，讓下面的事件卡片能拿到更多空間——用 maxHeight+opacity
  // 做轉場，跟其他彈窗輸入框放大/收合是同一套手法。
  const [collapsed, setCollapsed] = useState(false);
  const COLLAPSE_TRANSITION_MS = 260;

  // 年份／月份選擇面板：沿用「刪除地標」確認彈窗同一套置中卡片＋淡入淡出/位移縮放動畫
  // （enter -> shown -> closing 三段式 phase），跟整個 App 目前所有彈窗是同一種呈現方式，
  // 不另外發明這個 App 裡沒出現過的「由下往上彈出」樣式。
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPhase, setPickerPhase] = useState('hidden');
  const [pickerYear, setPickerYear] = useState(year); // 面板裡暫存的年份，選定月份或年份選單確認前不影響外面的日曆
  const PICKER_DURATION = 200;

  // 年份選單：從第一層面板點目前年份彈出的第二層選單，疊在第一層之上，選好一個年份就
  // 收回第一層繼續選月份，不用先關掉整個面板。gridStart 是目前選單顯示的 12 年區間起點，
  // 開啟當下以 pickerYear 為中心，前後翻頁各自 ±12 年，一樣可以跳到很久以前或以後的年份。
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [yearMenuPhase, setYearMenuPhase] = useState('hidden');
  const [yearMenuGridStart, setYearMenuGridStart] = useState(year - 5);

  function openPicker() {
    setPickerYear(year);
    setPickerOpen(true);
    setPickerPhase('enter');
    requestAnimationFrame(() => setPickerPhase('shown'));
  }
  function closePicker() {
    if (pickerPhase === 'closing') return;
    setPickerPhase('closing');
    setTimeout(() => { setPickerOpen(false); setPickerPhase('hidden'); }, PICKER_DURATION);
  }
  useModalBackClose(pickerOpen, closePicker);

  // 年份／月份選擇面板原本是日曆自己左上角標題按鈕觸發，現在改由頂部標題列（Header）的
  // 標題文字觸發（見需求一：移除日曆左上角選擇年份月份的按鈕，改放到頂部標題列），所以
  // 用 useImperativeHandle 把開啟面板的函式透過 ref 交給外層 App，App 裡 Header 的標題
  // 文字直接呼叫 calendarRef.current.openPicker()，不用把整個面板／選單狀態都搬到 App 裡。
  useImperativeHandle(ref, () => ({ openPicker }));

  function openYearMenu() {
    setYearMenuGridStart(pickerYear - 5);
    setYearMenuOpen(true);
    setYearMenuPhase('enter');
    requestAnimationFrame(() => setYearMenuPhase('shown'));
  }
  function closeYearMenu() {
    if (yearMenuPhase === 'closing') return;
    setYearMenuPhase('closing');
    setTimeout(() => { setYearMenuOpen(false); setYearMenuPhase('hidden'); }, PICKER_DURATION);
  }
  useModalBackClose(yearMenuOpen, closeYearMenu);
  function pickYearFromMenu(y) {
    setPickerYear(y);
    closeYearMenu();
  }

  const firstOfMonth = new Date(year, month, 1);

  // 週檢視的範圍：週日～週六（跟月曆格子的星期排列一致），用 weekAnchor（這一週裡任一天）算出來。
  const weekStart = useMemo(() => {
    const d = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [weekAnchor]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);
  // 週檢視專用的事件對照表：key 是 "年-月-日"，用通用的日期區間比對（見 getEventOccurrencesInRange
  // 開頭註解），因為一週可能橫跨兩個西曆月份／年份，不能沿用月檢視「單一年月」的算法。
  const weekEventsByDateKey = useMemo(() => {
    const map = {};
    if (viewMode !== 'week') return map;
    getEventOccurrencesInRange(events, weekStart, weekEnd).forEach(({ ev, occ }) => {
      const key = `${occ.getFullYear()}-${occ.getMonth()}-${occ.getDate()}`;
      (map[key] = map[key] || []).push(ev);
    });
    return map;
  }, [events, weekStart, weekEnd, viewMode]);

  // 修復同一個 bug（見 getYearlyOccurrenceInYear 開頭註解）：月檢視原本直接用「這個月 1 號」
  // 當基準呼叫 getEffectiveDate，對農曆等需要「往未來逐日掃描找符合區塊」的曆法來說，如果
  // 事件在該農曆月份的實際西曆日期已經在這個月 1 號之前發生過，就會誤判、退而返回區塊最後
  // 一天頂替，常常跨進下個月——導致同一個農曆生日在切換月份瀏覽時，連續兩個月都被點上圓點。
  // 月重複（repeatUnit==='month'，只有西曆才會這樣設定）本來就該每個月各自出現一次，
  // 繼續用「這個月 1 號」當基準沒問題；不循環或年重複的事件改用 getYearlyOccurrenceInYear
  // （用目標年份 1 月 1 號當基準，保證一定在目標發生日之前），一年只算一次、只會落在唯一一個月份。
  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const occ = ev.repeat && ev.repeatUnit === 'month'
        ? getEffectiveDate(ev, firstOfMonth)
        : getYearlyOccurrenceInYear(ev, year);
      if (occ.getFullYear() === year && occ.getMonth() === month) {
        const d = occ.getDate();
        (map[d] = map[d] || []).push(ev);
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, year, month]);

  // 年檢視：12 個月各自算一次「這個月有沒有落上任何事件」，跟月檢視同一套邏輯（見上面
  // eventsByDay 的註解），只是逐月掃描，不會跟月檢視或下面的日程列表算出兩套不同的日期判斷結果。
  const monthsHaveEvents = useMemo(() => {
    const monthlyRepeatEvents = events.filter(ev => ev.repeat && ev.repeatUnit === 'month');
    const yearlyOrFixedOccurrences = events
      .filter(ev => !(ev.repeat && ev.repeatUnit === 'month'))
      .map(ev => getYearlyOccurrenceInYear(ev, year))
      .filter(occ => occ.getFullYear() === year);
    return Array.from({ length: 12 }, (_, m) => {
      if (yearlyOrFixedOccurrences.some(occ => occ.getMonth() === m)) return true;
      const ref = new Date(year, m, 1);
      return monthlyRepeatEvents.some(ev => {
        const occ = getEffectiveDate(ev, ref);
        return occ.getFullYear() === year && occ.getMonth() === m;
      });
    });
  }, [events, year]);

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(LOCALE_MAP[lang], { weekday: 'short' }).format(new Date(2023, 0, 1 + i))
  );
  const monthLabels = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'short' }).format(new Date(2023, m, 1))
  );

  // 日曆切換／捲動操作：月檢視是上一月/下一月，年檢視是上一年/下一年，週檢視是上一週/下一週，
  // 不再用畫面上的按鈕觸發，改成日曆格子左右滑動（見下方 JSX 的 onTouchStart/onTouchEnd）。
  function goPrev() {
    setSelectedDay(null);
    if (viewMode === 'year') { setYear(y => y - 1); return; }
    if (viewMode === 'week') { setWeekAnchor(d => addDays(d, -7)); setSelectedWeekDate(null); return; }
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else { setMonth(m => m - 1); }
  }
  function goNext() {
    setSelectedDay(null);
    if (viewMode === 'year') { setYear(y => y + 1); return; }
    if (viewMode === 'week') { setWeekAnchor(d => addDays(d, 7)); setSelectedWeekDate(null); return; }
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else { setMonth(m => m + 1); }
  }
  // 選擇面板裡點了月份宮格：立即套用選定的年份＋月份、切到月檢視並關閉面板
  function pickMonth(m) {
    setYear(pickerYear);
    setMonth(m);
    setViewMode('month');
    setSelectedDay(null);
    closePicker();
  }
  // 只選年份、不指定月份：切到年檢視
  function pickWholeYear() {
    setYear(pickerYear);
    setViewMode('year');
    setSelectedDay(null);
    closePicker();
  }

  // 日曆目前顯示的時間範圍（月／年／週）一有變動就同步給上層，下面的日程列表跟著這個範圍
  // 即時更新（見需求六：日曆與日程列表不能各自使用不同的時間範圍）。週檢視額外帶上
  // weekStart／weekEnd（真正的 Date），因為一週可能橫跨兩個西曆月份／年份，不能只用單一年月表示。
  useEffect(() => {
    if (viewMode === 'year') { onRangeChange && onRangeChange({ mode: 'year', year }); return; }
    if (viewMode === 'week') { onRangeChange && onRangeChange({ mode: 'week', year: weekStart.getFullYear(), weekStart, weekEnd }); return; }
    onRangeChange && onRangeChange({ mode: 'month', year, month });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, year, month, weekStart, weekEnd]);

  const cells = buildMonthCells(year, month);
  // 月檢視左右滑動輪播：上一個／目前／下一個月份的日期格子＋各自的事件對照表都各算一次，
  // 鋪成三個並排的滑動面板（見 useSwipeCarousel、buildMonthCells、computeEventsByDayForMonth
  // 開頭註解）。放開手勢判斷要不要換頁時直接呼叫既有的 goPrev／goNext，跟原本點按鈕是
  // 同一套換月邏輯，只是觸發方式從按鈕點擊改成滑動手勢判定完成。
  const prevMonthYM = shiftMonth(year, month, -1);
  const nextMonthYM = shiftMonth(year, month, 1);
  const monthPanelCells = useMemo(() => ({
    prev: buildMonthCells(prevMonthYM.y, prevMonthYM.m),
    next: buildMonthCells(nextMonthYM.y, nextMonthYM.m),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [year, month]);
  const monthPanelEventsByDay = useMemo(() => ({
    prev: computeEventsByDayForMonth(events, prevMonthYM.y, prevMonthYM.m),
    next: computeEventsByDayForMonth(events, nextMonthYM.y, nextMonthYM.m),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, year, month]);
  const monthCarousel = useSwipeCarousel((dir) => { if (dir === 'next') goNext(); else goPrev(); });

  // 週檢視左右滑動輪播：跟月檢視同一套「跟手拖曳、放開判斷換頁」邏輯（見 useSwipeCarousel
  // 開頭註解），上一週／下一週各自的 7 個日期＋事件對照表都各算一次，鋪成三個並排的滑動面板
  // （見需求二：年、週也要跟月一樣有真正跟手拖曳的滑動切換效果）。
  const prevWeekDates = useMemo(() => buildWeekDates(addDays(weekStart, -7)), [weekStart]);
  const nextWeekDates = useMemo(() => buildWeekDates(addDays(weekStart, 7)), [weekStart]);
  const weekPanelEventsByDateKey = useMemo(() => ({
    prev: computeWeekEventsByDateKey(events, prevWeekDates),
    next: computeWeekEventsByDateKey(events, nextWeekDates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, weekStart]);
  const weekCarousel = useSwipeCarousel((dir) => { if (dir === 'next') goNext(); else goPrev(); });

  // 年檢視左右滑動輪播：同一套邏輯，上一年／下一年各自的 12 個月「有沒有事件」各算一次。
  const monthsHaveEventsPanel = useMemo(() => ({
    prev: computeMonthsHaveEvents(events, year - 1),
    next: computeMonthsHaveEvents(events, year + 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, year]);
  const yearCarousel = useSwipeCarousel((dir) => { if (dir === 'next') goNext(); else goPrev(); });

  const isToday = (d) => d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const selectedEvents = selectedDay != null ? (eventsByDay[selectedDay] || []) : [];
  // 月檢視選中的「日」只存數字（見上面 selectedDay 的宣告註解），要換算成其他曆法對應日期
  // 得先湊回完整的 Date；週檢視的 selectedWeekDate 本來就是完整 Date，不用另外處理。
  const selectedDayDate = selectedDay != null ? new Date(year, month, selectedDay) : null;
  const isTodayDate = (d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const selectedWeekEvents = selectedWeekDate
    ? (weekEventsByDateKey[`${selectedWeekDate.getFullYear()}-${selectedWeekDate.getMonth()}-${selectedWeekDate.getDate()}`] || [])
    : [];

  // 月檢視滑動輪播裡，「上一個／目前／下一個」三個面板共用同一份格子渲染邏輯，只有中間
  // （isCurrentPanel）那一格會回應點擊、顯示選中狀態；兩側面板單純只是滑動時的視覺預覽，
  // pointerEvents:none 避免手指划到一半、還沒放開就不小心點到旁邊面板的日期。
  function renderMonthGridPanel(panelCells, panelEventsByDay, panelYear, panelMonth, isCurrentPanel) {
    return (
      <div className="grid grid-cols-7 gap-y-1 text-center" style={{ pointerEvents: isCurrentPanel ? 'auto' : 'none' }}>
        {panelCells.map((c, i) => {
          const dayEvents = c.inMonth ? (panelEventsByDay[c.day] || []) : [];
          const selected = isCurrentPanel && c.inMonth && selectedDay === c.day;
          const today = c.inMonth && c.day === now.getDate() && panelMonth === now.getMonth() && panelYear === now.getFullYear();
          return (
            <button
              key={i}
              disabled={!c.inMonth}
              onClick={() => setSelectedDay(prev => (prev === c.day ? null : c.day))}
              className="flex flex-col items-center justify-center py-1"
              style={{ opacity: c.inMonth ? 1 : 0.25 }}
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 26,
                  height: 26,
                  background: selected ? ACCENT : (today ? 'var(--card-border)' : 'transparent'),
                  color: selected ? '#fff' : INK,
                }}
              >
                {c.day}
              </span>
              <span className="flex items-center justify-center gap-0.5 mt-0.5" style={{ height: 4 }}>
                {dayEvents.slice(0, 3).map((ev, di) => (
                  <span key={di} className="rounded-full" style={{ width: 4, height: 4, background: colorHex(ev.colorId) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 週檢視滑動輪播裡「上一週／目前／下一週」三個面板共用同一份渲染邏輯，跟月檢視的
  // renderMonthGridPanel 是同一種寫法：只有 isCurrentPanel 那一格會回應點擊、顯示選中狀態，
  // 兩側面板 pointerEvents:none 純粹是滑動時的視覺預覽。
  function renderWeekGridPanel(panelDates, panelEventsByDateKey, isCurrentPanel) {
    return (
      <div className="grid grid-cols-7 gap-y-1 text-center" style={{ pointerEvents: isCurrentPanel ? 'auto' : 'none' }}>
        {panelDates.map((d, i) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayEvents = panelEventsByDateKey[key] || [];
          const selected = isCurrentPanel && selectedWeekDate && selectedWeekDate.getTime() === d.getTime();
          return (
            <button
              key={i}
              onClick={() => setSelectedWeekDate(prev => (prev && prev.getTime() === d.getTime() ? null : d))}
              className="flex flex-col items-center justify-center py-1"
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 26,
                  height: 26,
                  background: selected ? ACCENT : (isTodayDate(d) ? 'var(--card-border)' : 'transparent'),
                  color: selected ? '#fff' : INK,
                }}
              >
                {d.getDate()}
              </span>
              <span className="flex items-center justify-center gap-0.5 mt-0.5" style={{ height: 4 }}>
                {dayEvents.slice(0, 3).map((ev, di) => (
                  <span key={di} className="rounded-full" style={{ width: 4, height: 4, background: colorHex(ev.colorId) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 年檢視滑動輪播裡「上一年／目前／下一年」三個面板共用同一份渲染邏輯，同樣只有
  // isCurrentPanel 那一格能點擊切回月檢視，兩側面板 pointerEvents:none。
  function renderYearGridPanel(panelYear, panelMonthsHaveEvents, isCurrentPanel) {
    return (
      <div className="grid grid-cols-3 gap-2" style={{ pointerEvents: isCurrentPanel ? 'auto' : 'none' }}>
        {monthLabels.map((label, m) => {
          const isCurrentMonth = m === now.getMonth() && panelYear === now.getFullYear();
          return (
            <button
              key={m}
              onClick={() => { setMonth(m); setViewMode('month'); setSelectedDay(null); }}
              className="flex flex-col items-center justify-center py-3 rounded-xl"
              style={{ background: isCurrentMonth ? 'var(--card-border)' : 'transparent' }}
            >
              <span className="text-sm font-bold" style={{ color: INK }}>{label}</span>
              <span className="flex items-center justify-center mt-1" style={{ height: 4 }}>
                {panelMonthsHaveEvents[m] && <span className="rounded-full" style={{ width: 4, height: 4, background: ACCENT }} />}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 標題文字（年份／年月／週範圍）已經改由頂部標題列（Header）自己格式化顯示（見 App 內
  // Header 那段跟這裡同一套格式化邏輯），日曆本身不再需要重複算一份、也不再有標題按鈕可以顯示它。
  const pickerYearLabel = new Intl.DateTimeFormat(LOCALE_MAP[lang], { year: 'numeric' }).format(new Date(pickerYear, 0, 1));
  const yearMenuYears = Array.from({ length: 12 }, (_, i) => yearMenuGridStart + i);

  return (
    <div className="rounded-2xl p-3 flex-shrink-0" style={glass()}>
      {/* 標題列：年份／月份選擇按鈕已移除，改由頂部標題列（Header）的標題文字觸發同一個
          面板（見上方 useImperativeHandle）；這裡只剩收合鈕，連同左側「收合／展開」灰色
          小字一起靠右對齊。文字本身純粹是說明目前按下去會發生什麼事，不能點——真正可點的
          只有右邊那顆圓形按鈕，避免兩塊點擊區域疊在一起互相干擾。 */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <span className="text-xs" style={{ color: INK_SOFT }}>
          {collapsed ? t.calendarExpandLabel : t.calendarCollapseLabel}
        </span>
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={t.calendarToggleCollapse}
          className="flex items-center justify-center rounded-full"
          style={{ width: 24, height: 24, color: INK_SOFT }}
        >
          <ChevronDown
            size={16}
            style={{
              transform: collapsed ? 'rotate(-90deg)' : 'none',
              transition: `transform ${COLLAPSE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        </button>
      </div>

      <div
        style={{
          maxHeight: collapsed ? 0 : 480,
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
          transition: `max-height ${COLLAPSE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${COLLAPSE_TRANSITION_MS * 0.7}ms ease`,
        }}
      >
        {viewMode === 'month' ? (
          // 月檢視：星期標籤固定在最上面不參與滑動，下面才是「上一個／目前／下一個」三個月份
          // 並排的滑動面板（見 useSwipeCarousel 開頭註解）——手指拖曳時三個面板跟著手指一起
          // 橫向移動，日曆本身（這個外層容器）的位置完全不動，放開後才決定要停在哪一頁、
          // 用 onTransitionEnd 在動畫剛好結束的那一刻換上新月份的資料、瞬間歸零位移，
          // 銜接起來看不出破綻，不會卡頓、跳動或日期對錯位。
          <>
            <div className="grid grid-cols-7 text-center">
              {weekdayLabels.map((w, i) => (
                <span key={i} className="text-[10px] font-bold" style={{ color: INK_SOFT }}>{w}</span>
              ))}
            </div>
            <div
              ref={monthCarousel.containerRef}
              onTouchStart={monthCarousel.onTouchStart}
              onTouchMove={monthCarousel.onTouchMove}
              onTouchEnd={monthCarousel.onTouchEnd}
              style={{ overflow: 'hidden', touchAction: 'pan-y' }}
            >
              <div
                onTransitionEnd={monthCarousel.handleTransitionEnd}
                style={{
                  display: 'flex',
                  width: '300%',
                  transform: `translateX(calc(-100%/3 + ${monthCarousel.dragX}px))`,
                  transition: monthCarousel.transitionOn ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                  willChange: 'transform',
                }}
              >
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderMonthGridPanel(monthPanelCells.prev, monthPanelEventsByDay.prev, prevMonthYM.y, prevMonthYM.m, false)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderMonthGridPanel(cells, eventsByDay, year, month, true)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderMonthGridPanel(monthPanelCells.next, monthPanelEventsByDay.next, nextMonthYM.y, nextMonthYM.m, false)}
                </div>
              </div>
            </div>
          </>
        ) : viewMode === 'week' ? (
          // 週檢視：跟月檢視同一套三面板跟手拖曳滑動（見需求二），星期標籤固定不參與滑動，
          // 下面才是「上一週／目前／下一週」三個並排面板，格子改成該週實際的 7 天（可能橫跨
          // 兩個月，每格顯示「日」的數字取自該天真正的 Date，不是固定在同一個月份底下）。
          <>
            <div className="grid grid-cols-7 text-center">
              {weekdayLabels.map((w, i) => (
                <span key={i} className="text-[10px] font-bold" style={{ color: INK_SOFT }}>{w}</span>
              ))}
            </div>
            <div
              ref={weekCarousel.containerRef}
              onTouchStart={weekCarousel.onTouchStart}
              onTouchMove={weekCarousel.onTouchMove}
              onTouchEnd={weekCarousel.onTouchEnd}
              style={{ overflow: 'hidden', touchAction: 'pan-y' }}
            >
              <div
                onTransitionEnd={weekCarousel.handleTransitionEnd}
                style={{
                  display: 'flex',
                  width: '300%',
                  transform: `translateX(calc(-100%/3 + ${weekCarousel.dragX}px))`,
                  transition: weekCarousel.transitionOn ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                  willChange: 'transform',
                }}
              >
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderWeekGridPanel(prevWeekDates, weekPanelEventsByDateKey.prev, false)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderWeekGridPanel(weekDates, weekEventsByDateKey, true)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderWeekGridPanel(nextWeekDates, weekPanelEventsByDateKey.next, false)}
                </div>
              </div>
            </div>
          </>
        ) : (
          // 年檢視：跟月檢視同一套三面板跟手拖曳滑動（見需求二），12 個月排成 3x4 格子取代
          // 日格子，只標示「這個月有沒有事件」，點一個月直接切回月檢視並定位到那個月。
          <div
            ref={yearCarousel.containerRef}
            onTouchStart={yearCarousel.onTouchStart}
            onTouchMove={yearCarousel.onTouchMove}
            onTouchEnd={yearCarousel.onTouchEnd}
            style={{ overflow: 'hidden', touchAction: 'pan-y' }}
          >
            <div
              onTransitionEnd={yearCarousel.handleTransitionEnd}
              style={{
                display: 'flex',
                width: '300%',
                transform: `translateX(calc(-100%/3 + ${yearCarousel.dragX}px))`,
                transition: yearCarousel.transitionOn ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                willChange: 'transform',
              }}
            >
              <div style={{ width: '33.3333%', flexShrink: 0 }}>
                {renderYearGridPanel(year - 1, monthsHaveEventsPanel.prev, false)}
              </div>
              <div style={{ width: '33.3333%', flexShrink: 0 }}>
                {renderYearGridPanel(year, monthsHaveEvents, true)}
              </div>
              <div style={{ width: '33.3333%', flexShrink: 0 }}>
                {renderYearGridPanel(year + 1, monthsHaveEventsPanel.next, false)}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'month' && selectedDay != null && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: CARD_BORDER }}>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-center" style={{ color: INK_SOFT }}>—</p>
            ) : (
              selectedEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2">
                  <span className="text-lg">{ev.icon}</span>
                  <span className="text-sm font-bold flex-1 truncate" style={{ color: INK }}>{ev.title}</span>
                </div>
              ))
            )}
            {/* 「我的」→「日曆」裡勾選的曆法（可複選），選中日期底下各自換算顯示一行；
                跟事件列表用同一塊面板，用細分隔線隔開，沒勾任何曆法就完全不出現這一段。 */}
            {enabledAltCalendars.length > 0 && selectedDayDate && (
              <div className="flex flex-col gap-1 pt-2 mt-1" style={{ borderTop: CARD_BORDER }}>
                {enabledAltCalendars.map(calId => {
                  const text = formatAltCalendar(selectedDayDate, calId, lang, t);
                  return text ? <p key={calId} className="text-xs" style={{ color: INK_SOFT }}>{text}</p> : null;
                })}
              </div>
            )}
          </div>
        )}

        {viewMode === 'week' && selectedWeekDate != null && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: CARD_BORDER }}>
            {selectedWeekEvents.length === 0 ? (
              <p className="text-xs text-center" style={{ color: INK_SOFT }}>—</p>
            ) : (
              selectedWeekEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2">
                  <span className="text-lg">{ev.icon}</span>
                  <span className="text-sm font-bold flex-1 truncate" style={{ color: INK }}>{ev.title}</span>
                </div>
              ))
            )}
            {enabledAltCalendars.length > 0 && (
              <div className="flex flex-col gap-1 pt-2 mt-1" style={{ borderTop: CARD_BORDER }}>
                {enabledAltCalendars.map(calId => {
                  const text = formatAltCalendar(selectedWeekDate, calId, lang, t);
                  return text ? <p key={calId} className="text-xs" style={{ color: INK_SOFT }}>{text}</p> : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 年份／月份選擇面板：月份直接用 12 宮格挑（點了立即套用並關閉面板），不再用「月／年」
          分頁文字切換；面板頂端的年份數字本身就是按鈕，點下去彈出第二層年份選單（見下方），
          在裡面挑好年份後收回這一層繼續選月份。想直接檢視整年，用月份宮格下面的文字連結。 */}
      {pickerOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 205,
            background: pickerPhase === 'shown' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            opacity: pickerPhase === 'hidden' ? 0 : 1,
            transition: `background ${PICKER_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PICKER_DURATION}ms ease`,
          }}
          onClick={closePicker}
        >
          <div
            className="w-full max-w-xs p-4 rounded-2xl flex flex-col gap-3"
            style={{
              ...AUTH_GLASS,
              opacity: pickerPhase === 'shown' ? 1 : 0,
              transform: pickerPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
              transition: `opacity ${PICKER_DURATION}ms ease, transform ${PICKER_DURATION}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              {/* 目前年份：直接點下去開第二層年份選單，取代原本的「月／年」分頁切換文字 */}
              <button onClick={openYearMenu} className="flex items-center gap-1" aria-label={t.calendarChooseDate}>
                <span className="text-base font-black" style={{ color: INK }}>{pickerYearLabel}</span>
                <ChevronDown size={14} style={{ color: INK_SOFT }} />
              </button>
              <button onClick={closePicker} aria-label={t.close} style={{ color: INK_SOFT }}><X size={16} /></button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {monthLabels.map((label, m) => {
                const isCurrentSelection = viewMode === 'month' && pickerYear === year && m === month;
                return (
                  <button
                    key={m}
                    onClick={() => pickMonth(m)}
                    className="py-2 rounded-lg text-sm font-bold"
                    style={{
                      background: isCurrentSelection ? ACCENT : 'var(--card-border)',
                      color: isCurrentSelection ? '#fff' : INK,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button onClick={pickWholeYear} className="py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--card-border)', color: INK }}>
              {t.calendarViewWholeYear}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 第二層年份選單：疊在第一層面板之上，12 年一頁，用左右箭頭翻頁，選一個年份就收回
          第一層繼續選月份（見需求：點目前年份彈出二級選單選擇年份）。 */}
      {yearMenuOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 215,
            background: yearMenuPhase === 'shown' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            opacity: yearMenuPhase === 'hidden' ? 0 : 1,
            transition: `background ${PICKER_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PICKER_DURATION}ms ease`,
          }}
          onClick={closeYearMenu}
        >
          <div
            className="w-full max-w-xs p-4 rounded-2xl flex flex-col gap-3"
            style={{
              ...AUTH_GLASS,
              opacity: yearMenuPhase === 'shown' ? 1 : 0,
              transform: yearMenuPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
              transition: `opacity ${PICKER_DURATION}ms ease, transform ${PICKER_DURATION}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button onClick={() => setYearMenuGridStart(s => s - 12)} aria-label={t.calendarPrev} style={{ color: INK_SOFT }}><ChevronLeft size={18} /></button>
              <span className="text-sm font-bold" style={{ color: INK }}>{yearMenuYears[0]} - {yearMenuYears[11]}</span>
              <button onClick={() => setYearMenuGridStart(s => s + 12)} aria-label={t.calendarNext} style={{ color: INK_SOFT }}><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {yearMenuYears.map(y => (
                <button
                  key={y}
                  onClick={() => pickYearFromMenu(y)}
                  className="py-2 rounded-lg text-sm font-bold"
                  style={{
                    background: y === pickerYear ? ACCENT : 'var(--card-border)',
                    color: y === pickerYear ? '#fff' : INK,
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

/* ==================================================================================
   相冊（獨立一級功能）
   ----------------------------------------------------------------------------------
   資料關係：事件 ↔ 相冊 ↔ 照片。相冊是核心（{id, name, eventId|null, createdAt}），
   是否關聯事件是可選項——一個事件可以有多個相冊，一個相冊最多關聯一個事件，未關聯任何
   事件的相冊一樣正常可用。相冊本身、相片本身都不重新製作時間軸的視覺結構（軸線、圓點、
   事件卡片），首頁以「照片」為視覺核心（封面網格），詳細頁是沉浸式照片牆。

   AlbumsFeature 是整個功能的路由外殼：screen 分 home／create／detail 三種，route 狀態
   由上層 App 持有（見 App() 內的 albumRoute／setAlbumRoute），這樣時間軸卡片上的「相冊」
   按鈕才能直接指定要打開哪個畫面（例如某個事件已經有相冊時，直接跳進相冊詳細頁），而不是
   每次都要先回到相冊首頁再手動點進去。
   ================================================================================== */

function AlbumsFeature({ events, setEvents, albums, setAlbums, route, setRoute, lang, t, isLargeScreen, onViewEvent }) {
  function goHome() { setRoute({ screen: 'home', detailAlbumId: null, prefillEventId: null }); }
  function goCreate(prefillEventId) { setRoute({ screen: 'create', detailAlbumId: null, prefillEventId: prefillEventId || null }); }
  function goDetail(albumId) { setRoute({ screen: 'detail', detailAlbumId: albumId, prefillEventId: null }); }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {route.screen === 'home' && (
        <AlbumsHomeScreen
          events={events}
          albums={albums}
          t={t}
          onOpenAlbum={goDetail}
          onCreate={() => goCreate(null)}
        />
      )}
      {route.screen === 'create' && (
        <CreateAlbumFlow
          events={events}
          setEvents={setEvents}
          setAlbums={setAlbums}
          t={t}
          prefillEventId={route.prefillEventId}
          onCancel={goHome}
          onDone={albumId => goDetail(albumId)}
        />
      )}
      {route.screen === 'detail' && (
        <AlbumDetailScreen
          album={albums.find(a => a.id === route.detailAlbumId) || null}
          events={events}
          setEvents={setEvents}
          setAlbums={setAlbums}
          t={t}
          isLargeScreen={isLargeScreen}
          onBack={goHome}
          onViewEvent={onViewEvent}
        />
      )}
    </div>
  );
}

/* ---------------- 相冊首頁：照片封面網格，不顯示時間軸、不重新製作事件列表 ---------------- */
function AlbumsHomeScreen({ events, albums, t, onOpenAlbum, onCreate }) {
  // 「全部／事件相冊／未關聯」篩選——未關聯不是錯誤狀態，只是普通的第三種篩選條件。
  const [filter, setFilter] = useState('all');
  const [photoInfo, setPhotoInfo] = useState({}); // { [albumId]: { count, covers: [dataUrl,...] } }

  // 相冊清單一有變動（新增／刪除／改名不影響這裡，但保守起見一起重新讀取），重新讀一次
  // 每個相冊的相片數量跟前三張封面用的縮圖；相片本體仍然各自存在自己的 storage key。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const a of albums) {
        const photos = await loadAlbumPhotosGlobal(a.id);
        next[a.id] = { count: photos.length, covers: photos.slice(0, 3).map(p => p.dataUrl) };
      }
      if (!cancelled) setPhotoInfo(next);
    })();
    return () => { cancelled = true; };
  }, [albums]);

  const eventsById = {};
  events.forEach(ev => { eventsById[ev.id] = ev; });

  const visible = albums
    .filter(a => (filter === 'all' ? true : filter === 'linked' ? !!a.eventId : !a.eventId))
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        <button
          onClick={onCreate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap flex-shrink-0"
          style={{ background: ACCENT, color: '#fff' }}
        >
          <Plus size={14} /> {t.createAlbumBtn}
        </button>
        {[['all', t.albumFilterAll], ['linked', t.albumFilterLinked], ['unlinked', t.albumFilterUnlinked]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0"
            style={filter === id ? { background: 'var(--card-border)', color: INK } : { background: 'transparent', color: INK_SOFT }}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: INK_SOFT }}>{t.albumHomeEmpty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map(a => (
            <AlbumCoverCard
              key={a.id}
              album={a}
              linkedEvent={a.eventId ? eventsById[a.eventId] : null}
              photoCount={(photoInfo[a.id] && photoInfo[a.id].count) || 0}
              coverPhotos={(photoInfo[a.id] && photoInfo[a.id].covers) || []}
              onOpen={() => onOpenAlbum(a.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 相冊封面卡：照片是主體，用 2-3 張相片做出輕微的堆疊效果，讓人一眼看出這是一個照片集合，
// 而不是一張普通的資料卡片。相冊名稱／照片數量用簡潔文字覆蓋在照片下緣，如果有關聯事件，
// 用一個非常輕量的「⌁ 事件名稱」文字標示，不顯示完整事件卡片、倒數資訊或事件模式。
function AlbumCoverCard({ album, linkedEvent, photoCount, coverPhotos, onOpen, t }) {
  return (
    <button
      onClick={onOpen}
      className="relative rounded-2xl overflow-hidden text-left"
      style={{ aspectRatio: '1 / 1', background: 'var(--card-border)' }}
    >
      {coverPhotos[0] ? (
        <>
          {coverPhotos[2] && (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${coverPhotos[2]})`, backgroundSize: 'cover', backgroundPosition: 'center', transform: 'rotate(4deg) scale(0.92)', opacity: 0.55 }}
            />
          )}
          {coverPhotos[1] && (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${coverPhotos[1]})`, backgroundSize: 'cover', backgroundPosition: 'center', transform: 'rotate(-3deg) scale(0.96)', opacity: 0.75 }}
            />
          )}
          <img src={coverPhotos[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: INK_SOFT }}>
          <Images size={26} />
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 px-3 py-2.5"
        style={{ background: 'linear-gradient(to top, rgba(20,20,26,0.62), rgba(20,20,26,0))' }}
      >
        <p className="text-sm font-bold truncate" style={{ color: '#fff' }}>{album.name}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.albumPhotoCount(photoCount)}</span>
          {linkedEvent && (
            <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.linkedEventBadge(linkedEvent.title)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ---------------- 建立相冊：照片優先的兩步驟流程 ---------------- */
// 第一步「選擇照片」：跟相片本身直接綁定，不要求先想好相冊名稱或事件；
// 第二步才是「建立相冊」：填名稱、決定要不要關聯事件，預設「不關聯事件」。
function CreateAlbumFlow({ events, setEvents, setAlbums, t, prefillEventId, onCancel, onDone }) {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [eventId, setEventId] = useState(prefillEventId || null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showQuickEvent, setShowQuickEvent] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const newPhotos = [];
      for (const file of files) {
        try {
          const dataUrl = await resizeImageFile(file);
          newPhotos.push({ id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, dataUrl });
        } catch (err) {
          setError(t.albumPhotoUploadError);
        }
      }
      if (newPhotos.length) setPhotos(prev => [...prev, ...newPhotos]);
    } finally {
      setUploading(false);
    }
  }
  function removePhoto(id) { setPhotos(prev => prev.filter(p => p.id !== id)); }

  async function finishCreate() {
    const finalName = name.trim() || t.newAlbumPlaceholder;
    const id = makeAlbumId();
    try { await persistAlbumPhotosGlobal(id, photos); } catch (err) { /* 骨架仍然建立，相片留給使用者之後在詳細頁重試新增 */ }
    setAlbums(prev => [...prev, { id, name: finalName, eventId: eventId || null, createdAt: Date.now() }]);
    onDone(id);
  }

  const linkedEventTitle = eventId ? (events.find(e => e.id === eventId) || {}).title : '';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => (step === 1 ? onCancel() : setStep(1))} aria-label={t.back} style={{ color: INK }}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-base font-black flex-1 truncate" style={{ color: INK }}>
          {step === 1 ? t.selectPhotosStepTitle : t.createAlbumStepTitle}
        </h2>
      </div>

      {step === 1 ? (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
          <p className="text-xs flex-shrink-0" style={{ color: INK_SOFT }}>
            {photos.length ? t.selectedPhotosCount(photos.length) : t.selectPhotosHint}
          </p>
          {error && <p className="text-xs flex-shrink-0" style={{ color: DANGER }}>{error}</p>}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={uploading}
              aria-label={t.addPhoto}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
              style={{ border: '1.5px dashed var(--card-border)', color: INK_SOFT, background: 'transparent' }}
            >
              <Plus size={18} />
              <span className="text-[10px] font-bold">{t.newPhotoLabel}</span>
            </button>
            {photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden">
                <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute flex items-center justify-center rounded-full"
                  style={{ top: 4, right: 4, width: 20, height: 20, background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
          <div className="flex-1" />
          <button
            onClick={() => photos.length && setStep(2)}
            disabled={!photos.length}
            className="w-full py-3 rounded-xl font-bold text-sm flex-shrink-0"
            style={{ background: photos.length ? ACCENT : 'var(--card-border)', color: photos.length ? '#fff' : INK_SOFT }}
          >
            {t.nextStep}
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.albumNameLabel}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.newAlbumPlaceholder}
              className="px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            />
          </div>

          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.linkEventLabel}</label>
            <button
              onClick={() => setShowEventPicker(true)}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
              style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            >
              <span className="truncate">{eventId ? linkedEventTitle : t.noLinkEvent}</span>
              <ChevronRight size={16} style={{ color: INK_SOFT, flexShrink: 0 }} />
            </button>
          </div>

          <div className="flex-1" />
          <button onClick={finishCreate} className="w-full py-3 rounded-xl font-bold text-sm flex-shrink-0" style={{ background: ACCENT, color: '#fff' }}>
            {t.createAlbum}
          </button>
        </div>
      )}

      {showEventPicker && (
        <EventLinkPicker
          events={events}
          currentEventId={eventId}
          t={t}
          onClose={() => setShowEventPicker(false)}
          onSelectNone={() => { setEventId(null); setShowEventPicker(false); }}
          onSelectEvent={id => { setEventId(id); setShowEventPicker(false); }}
          onCreateNew={() => { setShowEventPicker(false); setShowQuickEvent(true); }}
        />
      )}
      {showQuickEvent && (
        <QuickCreateEventSheet
          t={t}
          setEvents={setEvents}
          onCancel={() => setShowQuickEvent(false)}
          onCreated={id => { setEventId(id); setShowQuickEvent(false); }}
        />
      )}
    </div>
  );
}

// 「關聯事件」選擇面板：不關聯事件／選擇事件（列出現有事件）／從這裡建立新事件——
// 輕量設定，不是相冊的核心結構，選完直接回到上一層，只顯示選中的事件名稱即可。
function EventLinkPicker({ events, currentEventId, t, onClose, onSelectNone, onSelectEvent, onCreateNew }) {
  useModalBackClose(true, onClose);
  const sorted = events.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return createPortal(
    <div
      className="fixed inset-0 flex items-end md:items-center md:justify-center"
      style={{ zIndex: 260, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm max-h-[75vh] rounded-t-3xl md:rounded-2xl p-5 flex flex-col gap-3"
        style={{ ...AUTH_GLASS }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-black" style={{ color: INK }}>{t.linkEventLabel}</h2>
          <button onClick={onClose} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
          <button
            onClick={onSelectNone}
            className="text-left px-3 py-3 rounded-xl text-sm font-bold"
            style={{ background: !currentEventId ? 'var(--card-border)' : 'transparent', color: INK }}
          >
            {t.noLinkEvent}
          </button>
          <button onClick={onCreateNew} className="text-left px-3 py-3 rounded-xl text-sm font-bold flex items-center gap-1.5" style={{ color: ACCENT }}>
            <Plus size={14} /> {t.linkOptionNew}
          </button>
          {sorted.length > 0 && <p className="text-[11px] font-bold px-3 pt-1" style={{ color: INK_SOFT }}>{t.eventPickerTitle}</p>}
          {sorted.map(ev => (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev.id)}
              className="text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between gap-2"
              style={{ background: currentEventId === ev.id ? 'var(--card-border)' : 'transparent', color: INK }}
            >
              <span className="flex items-center gap-2 min-w-0"><span className="flex-shrink-0">{ev.icon}</span><span className="truncate">{ev.title}</span></span>
              <span className="text-xs flex-shrink-0" style={{ color: INK_SOFT }}>{(ev.date || '').replace(/-/g, '.')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// 「從這裡建立新事件」的輕量快速建立表單：只問標題跟日期，其餘（圖示、顏色、模式、重複規則等）
// 用預設值，事件建立好之後仍然可以回到「日程」／「時光線」分頁用完整的編輯表單調整。
function QuickCreateEventSheet({ t, setEvents, onCancel, onCreated }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  useModalBackClose(true, onCancel);

  function submit() {
    if (!title.trim() || !date) return;
    const id = Date.now().toString();
    setEvents(prev => [...prev, {
      id, title: title.trim(), date, time: '', icon: ICONS[0], colorId: COLOR_TAGS[0].id,
      calendar: 'gregory', repeat: false, repeatUnit: 'year', repeatInterval: 1,
      isBirthday: false, isCare: false, careCustomIcon: null, mode: 'regular',
    }]);
    onCreated(id);
  }

  return createPortal(
    <div className="fixed inset-0 flex items-end md:items-center md:justify-center px-0 md:px-6" style={{ zIndex: 270, background: 'rgba(0,0,0,0.4)' }} onClick={onCancel}>
      <div
        className="w-full md:max-w-sm rounded-t-3xl md:rounded-2xl p-5 flex flex-col gap-3"
        style={{ ...AUTH_GLASS }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black" style={{ color: INK }}>{t.quickEventTitle}</h2>
          <button onClick={onCancel} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.titleLabel}</label>
          <input
            autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={t.titlePlaceholder}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.dateLabel}</label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
          />
        </div>
        <button
          onClick={submit}
          disabled={!title.trim() || !date}
          className="w-full py-2.5 rounded-xl font-bold text-sm mt-1"
          style={{ background: title.trim() && date ? ACCENT : 'var(--card-border)', color: title.trim() && date ? '#fff' : INK_SOFT }}
        >
          {t.createAlbum}
        </button>
      </div>
    </div>,
    document.body
  );
}

// 二次確認彈窗（刪除相片／刪除相冊共用同一個視覺樣式，跟「刪除地標」確認視窗一致）。
function ConfirmSheet({ isLargeScreen, title, desc, t, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 270, background: 'rgba(0,0,0,0.4)' }} onClick={onCancel}>
      <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{ ...AUTH_GLASS }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black" style={{ color: DANGER }}>{title}</h2>
          <button onClick={onCancel} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>
        <p className="text-sm" style={{ color: INK }}>{desc}</p>
        <div className="flex items-center gap-2.5">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${DANGER}`, color: DANGER }}>
            {t.confirmDeleteLandmark}
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: DANGER, color: '#fff' }}>
            {t.cancelDeleteLandmark}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 相冊詳細頁：沉浸式照片瀏覽，頂部只留返回／相冊名稱／更多操作 ---------------- */
function AlbumDetailScreen({ album, events, setEvents, setAlbums, t, isLargeScreen, onBack, onViewEvent }) {
  const [photos, setPhotos] = useState(null); // null = 尚未讀取完成
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [photoSelectMode, setPhotoSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeletePhotosConfirm, setShowDeletePhotosConfirm] = useState(false);
  const [showDeleteAlbumConfirm, setShowDeleteAlbumConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showQuickEvent, setShowQuickEvent] = useState(false);
  const dragPhotoIdRef = useRef(null);
  const albumId = album && album.id;

  useEffect(() => {
    let cancelled = false;
    setPhotos(null);
    if (!albumId) return;
    (async () => {
      const list = await loadAlbumPhotosGlobal(albumId);
      if (!cancelled) setPhotos(list);
    })();
    return () => { cancelled = true; };
  }, [albumId]);

  useModalBackClose(lightboxIndex !== null, () => setLightboxIndex(null));

  async function persist(next) {
    setPhotos(next);
    if (!albumId) return;
    try { await persistAlbumPhotosGlobal(albumId, next); setError(''); }
    catch (err) { setError(t.albumPhotoUploadError); }
  }

  function handleAddPhotoClick() { fileInputRef.current && fileInputRef.current.click(); }
  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !albumId) return;
    setUploading(true);
    setError('');
    try {
      const newPhotos = [];
      for (const file of files) {
        try {
          const dataUrl = await resizeImageFile(file);
          newPhotos.push({ id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, dataUrl });
        } catch (err) {
          setError(t.albumPhotoUploadError);
        }
      }
      if (newPhotos.length) persist([...(photos || []), ...newPhotos]);
    } finally {
      setUploading(false);
    }
  }

  function handlePhotoLongPress(id) { setPhotoSelectMode(true); setSelectedPhotoIds(prev => (prev.includes(id) ? prev : [...prev, id])); }
  function handlePhotoTap(id, idx) {
    if (photoSelectMode) { setSelectedPhotoIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])); return; }
    setLightboxIndex(idx);
  }
  function cancelPhotoSelect() { setPhotoSelectMode(false); setSelectedPhotoIds([]); }
  function performDeleteSelectedPhotos() {
    setShowDeletePhotosConfirm(false);
    persist((photos || []).filter(p => !selectedPhotoIds.includes(p.id)));
    cancelPhotoSelect();
  }
  function handlePhotoDragStart(id) { dragPhotoIdRef.current = id; }
  function handlePhotoDragOver(e, overId) {
    e.preventDefault();
    const dragId = dragPhotoIdRef.current;
    if (!dragId || dragId === overId) return;
    setPhotos(current => {
      const list = current || [];
      const fromIdx = list.findIndex(p => p.id === dragId);
      const toIdx = list.findIndex(p => p.id === overId);
      if (fromIdx === -1 || toIdx === -1) return current;
      const next = [...list];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }
  function handlePhotoDragEnd() { dragPhotoIdRef.current = null; if (albumId && photos) persistAlbumPhotosGlobal(albumId, photos).catch(() => {}); }

  function startRename() { setRenameDraft(album.name); setRenaming(true); setShowMoreMenu(false); }
  function commitRename() {
    const name = renameDraft.trim();
    if (name) setAlbums(prev => prev.map(a => (a.id === albumId ? { ...a, name } : a)));
    setRenaming(false);
  }
  function requestDeleteAlbum() { setShowMoreMenu(false); setShowDeleteAlbumConfirm(true); }
  function performDeleteAlbum() {
    setShowDeleteAlbumConfirm(false);
    setAlbums(prev => prev.filter(a => a.id !== albumId));
    deleteAlbumPhotosGlobal(albumId);
    // 保險：如果這個相冊是從舊版「事件內嵌 albums」搬遷過來的，事件物件裡可能還留著同一個 id
    // 的骨架殘影（搬遷過程刻意保留、沒有清除，見 resolveAlbumsField 的說明）。這裡刪除相冊時
    // 順手把各事件 albums 欄位裡同 id 的殘影一併清掉，避免下次重新整理／雲端同步時，
    // deriveAlbumsFromEvents 又把已經刪除的相冊「復活」回來。
    setEvents(prev => prev.map(e => (
      Array.isArray(e.albums) && e.albums.some(a => a && a.id === albumId)
        ? { ...e, albums: e.albums.filter(a => !a || a.id !== albumId) }
        : e
    )));
    onBack();
  }
  function applyLinkEvent(nextEventId) {
    setAlbums(prev => prev.map(a => (a.id === albumId ? { ...a, eventId: nextEventId } : a)));
    setShowEventPicker(false);
  }

  if (!album) return null;
  const linkedEvent = album.eventId ? events.find(e => e.id === album.eventId) : null;
  const list = photos || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-shrink-0 gap-2 min-h-[32px]">
        {renaming ? (
          <>
            <input
              autoFocus value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            />
            <button onClick={commitRename} aria-label={t.confirmRename} style={{ color: MINT }}><Check size={18} /></button>
            <button onClick={() => setRenaming(false)} aria-label={t.cancel} style={{ color: INK_SOFT }}><X size={18} /></button>
          </>
        ) : photoSelectMode ? (
          <>
            <span className="text-sm font-medium truncate" style={{ color: INK_SOFT }}>{t.selectedCount(selectedPhotoIds.length)}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={cancelPhotoSelect} className="text-sm px-2 py-1 rounded-lg" style={{ color: INK_SOFT }}>{t.cancel}</button>
              <button
                onClick={() => setShowDeletePhotosConfirm(true)}
                disabled={!selectedPhotoIds.length}
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg font-medium"
                style={{ background: DANGER, color: '#fff', opacity: selectedPhotoIds.length ? 1 : 0.4 }}
              >
                <Trash2 size={13} /> {t.delete}
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={onBack} aria-label={t.back} style={{ color: INK, flexShrink: 0 }}><ChevronLeft size={22} /></button>
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <h2 className="text-sm font-black truncate max-w-full" style={{ color: INK }}>{album.name}</h2>
              {linkedEvent && (
                <button onClick={() => onViewEvent && onViewEvent(linkedEvent.id)} className="text-[11px] truncate max-w-full" style={{ color: ACCENT }}>
                  {t.linkedEventBadge(linkedEvent.title)}
                </button>
              )}
            </div>
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowMoreMenu(v => !v)} aria-label={t.moreActions} title={t.moreActions} style={{ color: INK }}><Settings size={18} /></button>
              {showMoreMenu && (
                <div className="absolute right-0 mt-1 rounded-xl overflow-hidden z-10" style={{ ...glass(), minWidth: 168, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
                  <button onClick={startRename} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: INK }}>{t.renameAlbum}</button>
                  <button onClick={() => { setShowMoreMenu(false); setShowEventPicker(true); }} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: INK }}>{t.linkEventLabel}</button>
                  <button onClick={requestDeleteAlbum} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: DANGER }}>{t.deleteAlbum}</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between flex-shrink-0">
        <p className="text-xs" style={{ color: INK_SOFT }}>{t.albumPhotoCount(list.length)}</p>
      </div>
      {error && <p className="text-xs flex-shrink-0" style={{ color: DANGER }}>{error}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-3 gap-1.5">
          {!photoSelectMode && (
            <button
              onClick={handleAddPhotoClick}
              disabled={uploading}
              aria-label={t.addPhoto}
              title={t.addPhoto}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
              style={{ border: '1.5px dashed var(--card-border)', color: INK_SOFT, background: 'transparent' }}
            >
              <Plus size={18} />
              <span className="text-[10px] font-bold">{t.newPhotoLabel}</span>
            </button>
          )}
          {list.map((p, idx) => (
            <PhotoThumb
              key={p.id}
              photo={p}
              selected={selectedPhotoIds.includes(p.id)}
              selectMode={photoSelectMode}
              draggable={!photoSelectMode}
              onTap={() => handlePhotoTap(p.id, idx)}
              onLongPress={() => handlePhotoLongPress(p.id)}
              onDragStartPhoto={() => handlePhotoDragStart(p.id)}
              onDragOverPhoto={e => handlePhotoDragOver(e, p.id)}
              onDragEndPhoto={handlePhotoDragEnd}
            />
          ))}
        </div>
        {photos !== null && !list.length && <p className="text-xs text-center mt-4" style={{ color: INK_SOFT }}>{t.noPhotosYet}</p>}
        {list.length > 0 && <p className="text-[11px] text-center mt-4 opacity-70" style={{ color: INK_SOFT }}>{t.albumBackupReminder}</p>}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />

      {lightboxIndex !== null && list[lightboxIndex] && createPortal(
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 260, background: 'rgba(0,0,0,0.85)' }} onClick={() => setLightboxIndex(null)}>
          <button onClick={e => { e.stopPropagation(); setLightboxIndex(null); }} aria-label={t.close} className="absolute top-4 right-4" style={{ color: '#fff' }}><X size={26} /></button>
          {list.length > 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + list.length) % list.length); }} className="absolute left-2 md:left-6 p-2" style={{ color: '#fff' }}>
              <ChevronLeft size={30} />
            </button>
          )}
          <img src={list[lightboxIndex].dataUrl} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          {list.length > 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % list.length); }} className="absolute right-2 md:right-6 p-2" style={{ color: '#fff' }}>
              <ChevronRight size={30} />
            </button>
          )}
        </div>,
        document.body
      )}

      {showDeletePhotosConfirm && createPortal(
        <ConfirmSheet
          isLargeScreen={isLargeScreen} t={t}
          title={t.deleteSelectedPhotosConfirmTitle} desc={t.deleteSelectedPhotosConfirmDesc(selectedPhotoIds.length)}
          onCancel={() => setShowDeletePhotosConfirm(false)} onConfirm={performDeleteSelectedPhotos}
        />,
        document.body
      )}
      {showDeleteAlbumConfirm && createPortal(
        <ConfirmSheet
          isLargeScreen={isLargeScreen} t={t}
          title={t.deleteSelectedAlbumsConfirmTitle} desc={t.deleteSelectedAlbumsConfirmDesc(1)}
          onCancel={() => setShowDeleteAlbumConfirm(false)} onConfirm={performDeleteAlbum}
        />,
        document.body
      )}
      {showEventPicker && (
        <EventLinkPicker
          events={events}
          currentEventId={album.eventId}
          t={t}
          onClose={() => setShowEventPicker(false)}
          onSelectNone={() => applyLinkEvent(null)}
          onSelectEvent={id => applyLinkEvent(id)}
          onCreateNew={() => { setShowEventPicker(false); setShowQuickEvent(true); }}
        />
      )}
      {showQuickEvent && (
        <QuickCreateEventSheet
          t={t}
          setEvents={setEvents}
          onCancel={() => setShowQuickEvent(false)}
          onCreated={id => { applyLinkEvent(id); setShowQuickEvent(false); }}
        />
      )}
    </div>
  );
}

/* ---------------- 我的（帳戶、我的時光、資料、偏好、其他——完整的個人帳戶與 App 設定中心） ---------------- */
// 整頁分成「首頁」與「彈出視窗」兩層：
// - 首頁：帳戶卡片＋我的時光統計卡片（純展示、不可點擊）＋三個分組列表卡片（資料／偏好／其他），
//   一次性呈現，不需要點進去。
// - 彈出視窗：帳戶管理、本機備份、同步與資料、外觀、通知、語言、日曆、關於時光線，點擊對應
//   項目後統一以置中彈窗（SettingsChoiceModal）呈現，共用同一個 choiceModal state——本頁除了
//   「我的時光」統計卡片以外，所有點擊後會彈出新內容的項目都是這種視窗樣式，不再有另外
//   由下往上滑入、蓋住整個畫面的獨立子頁面。使用條款／隱私權政策已收進「關於時光線」內文的
//   「相關文件」連結，直接開對應網址，不再是「我的」頁裡的獨立選項。

// 帳戶頭像：優先顯示 Google 等登入方式提供的頭像，沒有圖片時退回顯示名稱／Email 的字首，
// 兩者都沒有才顯示預設的人形圖示，不會出現「空白圓圈」這種沒有內容的狀態。
function ProfileAvatar({ fbUser, size = 48 }) {
  const source = (fbUser && (fbUser.displayName || fbUser.email)) || '';
  const initial = source.trim().charAt(0).toUpperCase();
  return (
    <span
      className="relative flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-black"
      style={{ width: size, height: size, background: accentAlpha('22'), color: ACCENT, fontSize: Math.round(size * 0.4) }}
    >
      {fbUser && fbUser.photoURL
        ? <img src={fbUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        : (initial || <User size={Math.round(size * 0.5)} />)}
    </span>
  );
}

// 「外觀」點擊後彈出的二級選單：跟隨系統／淺色／深色，跟 LangSwitcher 用同一套下拉面板骨架
// （點按鈕展開、點外面關閉、跟其他下拉選單互斥），選好的選項直接寫回 themeMode。
// 「偏好」分組裡幾個內容單薄的設定項（外觀／通知／語言／日曆）原本是「點右側小按鈕→彈出下拉
// 面板」，但下拉面板是絕對定位掛在列表項目底下，而外層 SettingsGroupCard 的卡片有
// overflow-hidden（用來讓分組列表四角保持圓角），面板一長就會被自己的父層卡片裁切、看起來像
// 「被下面的容器蓋住」。改成點整列直接跳出一個置中的獨立視窗（用 createPortal 掛到
// document.body，不再是任何卡片的子孫），從根本解決層級被裁切的問題，視覺上沿用跟 AuthModal
// 完全一致的毛玻璃彈窗樣式（AUTH_GLASS），維持風格統一。
function SettingsChoiceModal({ title, onClose, children }) {
  const [modalPhase, setModalPhase] = useState('enter');
  const DURATION = 160;
  useEffect(() => { const id = requestAnimationFrame(() => setModalPhase('shown')); return () => cancelAnimationFrame(id); }, []);
  function handleClose() {
    if (modalPhase === 'closing') return;
    setModalPhase('closing');
    setTimeout(onClose, DURATION);
  }
  useModalBackClose(true, handleClose);
  const shown = modalPhase === 'shown';
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{
        zIndex: 300, // 高於 App 裡其他彈窗，確保一定疊在最上層
        background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: `background ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xs p-5 rounded-2xl flex flex-col gap-3"
        style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: `opacity ${DURATION}ms ease, transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-black" style={{ color: INK }}>{title}</h2>
          <button onClick={handleClose} aria-label="close" style={{ color: INK_SOFT }}><X size={16} /></button>
        </div>
        {/* 帳戶管理／本機備份等內容較多的視窗內文，這裡統一給一個上限高度＋自己捲動，
            避免內容比手機螢幕還高時把視窗撐出畫面外。 */}
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// 「外觀」視窗內容：跟隨系統／淺色／深色，選到哪個就直接關窗。
function AppearanceChoiceContent({ themeMode, setThemeMode, t, onClose }) {
  const options = [
    { id: 'system', label: t.appearanceModeSystem },
    { id: 'light', label: t.appearanceModeLight },
    { id: 'dark', label: t.appearanceModeDark },
  ];
  return (
    <div className="flex flex-col gap-1">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => { setThemeMode(o.id); onClose(); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-left"
          style={{ color: o.id === themeMode ? ACCENT : INK, background: o.id === themeMode ? accentAlpha('14') : 'transparent' }}
        >
          {o.label}
          {o.id === themeMode && <Check size={15} />}
        </button>
      ))}
    </div>
  );
}

// 「語言」視窗內容：跟 LangSwitcher 顯示同一份語言清單，選到哪個就直接關窗。
function LanguageChoiceContent({ lang, setLang, onClose }) {
  return (
    <div className="flex flex-col gap-1">
      {LANGS.map(l => (
        <button
          key={l}
          onClick={() => { setLang(l); onClose(); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-left"
          style={{ color: l === lang ? ACCENT : INK, background: l === lang ? accentAlpha('14') : 'transparent' }}
        >
          {LANG_NAMES[l]}
          {l === lang && <Check size={15} />}
        </button>
      ))}
    </div>
  );
}

// 「日曆」視窗內容：跟其餘三個偏好視窗不同，這個是複選（見需求：選好的曆法會套用到「日程」
// 頁點選日期後底部顯示的對應日期，可以同時勾多種曆法），所以點下去只是切換勾選狀態、
// 不會像單選那三個一樣選了就自動關窗，讓使用者可以連續勾好幾個曆法再自己關閉視窗。
// 選項本身直接複用新增／編輯地標時同一份 CAL_OPTIONS（排除西曆——西曆是預設基準、不需要
// 額外「轉換顯示」，所以清單裡不出現）。
function CalendarPrefChoiceContent({ enabledAltCalendars, setEnabledAltCalendars, lang, t }) {
  function toggle(id) {
    setEnabledAltCalendars(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs leading-relaxed mb-1" style={{ color: INK_SOFT }}>{t.calendarPrefHint}</p>
      {CAL_OPTIONS.filter(c => c.id !== 'gregory').map(c => {
        const active = enabledAltCalendars.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-left"
            style={{ color: active ? ACCENT : INK, background: active ? accentAlpha('14') : 'transparent' }}
          >
            {c.label[lang]}
            {active && <Check size={15} />}
          </button>
        );
      })}
    </div>
  );
}

// 「通知」視窗內容：跟原本 NotifySettingsButton 下拉面板裡的欄位完全一致（啟用開關＋提前幾天提醒），
// 只是換成置中視窗的呈現方式，排程／通知邏輯完全不動，仍然由 App 那一層負責。
function NotifyChoiceContent({ enabled, onToggle, daysBefore, setDaysBefore, permission, t }) {
  const unsupported = permission === 'unsupported';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>{t.notifyEnableLabel}</span>
        <button
          onClick={() => onToggle(!enabled)}
          className="relative flex-shrink-0"
          style={{ width: 40, height: 24, borderRadius: 12, background: enabled ? ACCENT : 'var(--card-border)', transition: 'background 0.2s ease' }}
        >
          <span
            className="absolute rounded-full bg-white"
            style={{ width: 18, height: 18, top: 3, left: enabled ? 19 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          />
        </button>
      </div>
      <p className="text-xs" style={{ color: INK_SOFT }}>{t.notifyEnableHint}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>{t.notifyDaysBeforeLabel}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number"
            min={0}
            max={365}
            value={daysBefore}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              setDaysBefore(Number.isFinite(v) ? Math.max(0, Math.min(365, v)) : 0);
            }}
            className="text-sm text-center rounded-lg px-2 py-1"
            style={{ width: 52, background: 'var(--card-border)', color: INK, border: 'none' }}
          />
          <span className="text-xs" style={{ color: INK_SOFT }}>{t.notifyDaysBeforeUnit}</span>
        </div>
      </div>

      {unsupported && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyUnsupported}</p>}
      {permission === 'denied' && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyPermissionDenied}</p>}
    </div>
  );
}

// 分組列表的單一列：整列可點擊時右側自動補上箭頭（就算同時帶了 right 提示文字／圖示也一樣顯示，
// 讓使用者清楚知道整列都可以點，而不是只有某個小按鈕能點）；不可點擊時純粹展示，不出現箭頭。
function SettingsRow({ icon, label, onClick, danger, right, isFirst }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      style={{ color: danger ? DANGER : INK, borderTop: isFirst ? 'none' : CARD_BORDER }}
    >
      <span className="flex-shrink-0" style={{ color: danger ? DANGER : INK_SOFT }}>{icon}</span>
      <span className="flex-1 text-sm font-bold truncate">{label}</span>
      {right}
      {onClick && <ChevronRight size={16} style={{ color: INK_SOFT, opacity: 0.55, flexShrink: 0 }} />}
    </Comp>
  );
}

// 一組列表用同一張毛玻璃卡片包起來、中間用細線分隔，取代「每一列各自一張卡片、彼此用空隙隔開」
// 的舊做法——同一分組視覺上更聚合，也讓「資料／偏好／其他」這幾個分組的層級關係更清楚。
function SettingsGroupCard({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <p className="px-1 text-xs font-bold" style={{ color: INK_SOFT, letterSpacing: '0.02em' }}>{title}</p>}
      <div className="rounded-2xl overflow-hidden" style={glass()}>{children}</div>
    </div>
  );
}

// 「帳戶管理」視窗內容：頭像／使用者名稱／Email／登入方式／帳戶安全（修改密碼，僅 Email 密碼
// 帳號才有）／登出／刪除帳戶。內部再切三個小視圖（主畫面／修改密碼／刪除確認），邏輯跟原本
// AuthModal 已登入時的內容完全一致，只是搬進 SettingsChoiceModal 這個共用的置中彈窗呈現。
function AccountManagementPage({ t, fbUser, onClose }) {
  const [view, setView] = useState('main'); // 'main' | 'password' | 'delete'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  if (!fbUser) return null;
  const providerId = getCurrentUserProviderId();
  const methodLabel = providerId === 'google.com' ? t.loginMethodGoogle : providerId === 'apple.com' ? t.loginMethodApple : t.loginMethodEmail;

  async function run(fn) {
    setBusy(true); setError('');
    let timedOut = false;
    try {
      const timeoutPromise = new Promise((_, reject) => { setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, 8000); });
      await Promise.race([fn(), timeoutPromise]);
    } catch (err) {
      setError(timedOut ? t.authTimeout : t.authError);
    }
    setBusy(false);
  }

  function handleChangePassword() {
    if (newPassword !== confirmNewPassword) { setError(t.passwordMismatch); return; }
    run(async () => {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    });
  }

  if (view === 'password') {
    return (
      <div className="flex flex-col gap-3">
        <PasswordField t={t} placeholder={t.currentPassword} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        <PasswordField t={t} placeholder={t.newPassword} value={newPassword} onChange={e => setNewPassword(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        <PasswordField t={t} placeholder={t.confirmNewPassword} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
        {pwSuccess && <p className="text-xs font-bold" style={{ color: MINT }}>{t.passwordChangeSuccess}</p>}
        <button
          onClick={handleChangePassword}
          disabled={busy || !currentPassword || !newPassword || !confirmNewPassword}
          className="py-2.5 rounded-xl font-bold text-sm"
          style={{ background: MINT, color: '#fff', opacity: busy || !currentPassword || !newPassword || !confirmNewPassword ? 0.6 : 1 }}
        >
          {t.saveChangesBtn}
        </button>
        <button onClick={() => { setView('main'); setError(''); setPwSuccess(false); }} className="text-xs font-bold self-start" style={{ color: ACCENT }}>{t.back}</button>
      </div>
    );
  }

  if (view === 'delete') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: INK }}>{t.deleteAccountConfirmDesc}</p>
        {providerId === 'password' && (
          <PasswordField t={t} placeholder={t.currentPassword} value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        )}
        {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
        <button
          onClick={() => run(async () => { await deleteAccount(deletePassword); onClose(); })}
          disabled={busy || (providerId === 'password' && !deletePassword)}
          className="py-2.5 rounded-xl font-bold text-sm"
          style={{ background: DANGER, color: '#fff', opacity: busy || (providerId === 'password' && !deletePassword) ? 0.6 : 1 }}
        >
          {t.confirmDelete}
        </button>
        <button onClick={() => { setView('main'); setError(''); }} className="text-xs font-bold self-start" style={{ color: ACCENT }}>{t.cancel}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <ProfileAvatar fbUser={fbUser} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-base font-black truncate" style={{ color: INK }}>{fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : t.account)}</p>
          {fbUser.email && <p className="text-xs truncate" style={{ color: INK_SOFT }}>{fbUser.email}</p>}
        </div>
      </div>

      <SettingsGroupCard title={t.accountSecurityLabel}>
        <SettingsRow isFirst icon={<Shield size={18} />} label={t.loginMethodLabel} right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{methodLabel}</span>} />
        {providerId === 'password' && (
          <SettingsRow icon={<Pencil size={18} />} label={t.changePassword} onClick={() => { setView('password'); setError(''); setPwSuccess(false); }} />
        )}
      </SettingsGroupCard>

      {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}

      <button
        onClick={() => run(async () => { await signOutUser(); onClose(); })}
        disabled={busy}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
        style={{ ...glass(), color: INK, opacity: busy ? 0.6 : 1 }}
      >
        <LogOut size={16} /> {t.logout}
      </button>

      <button onClick={() => { setView('delete'); setError(''); setDeletePassword(''); }} className="text-xs font-bold self-center" style={{ color: DANGER }}>
        {t.deleteAccount}
      </button>
    </div>
  );
}

// 「本機備份」：跟原本 AuthModal 裡的匯出／匯入邏輯完全一致，只是搬進置中彈窗呈現。
function BackupDataPage({ t, backupData, onImportBackup }) {
  const importFileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState(null);

  async function buildBackupPayloadWithPhotos() {
    const albumPhotos = await collectAllAlbumPhotos(backupData.albums && backupData.albums.length ? backupData.albums : resolveAlbumsField(backupData));
    return { ...backupData, ...(Object.keys(albumPhotos).length ? { albumPhotos } : {}), exportedAt: Date.now() };
  }

  async function parseAndImport(fileText) {
    const data = await parseBackupPayload(fileText);
    if (!data) { setBackupMsg({ type: 'error', text: t.backupImportError }); return false; }
    onImportBackup(data);
    setBackupMsg({ type: 'success', text: t.backupImportSuccess });
    return true;
  }

  async function handleExportBackup() {
    const json = JSON.stringify(await buildBackupPayloadWithPhotos(), null, 2);
    const encryptedText = await encryptBackupText(json);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `sgx-backup-${stamp}.tzzwnb`;
    const file = new File([encryptedText], filename, { type: 'application/octet-stream' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        setBackupMsg({ type: 'success', text: t.backupExportSuccess });
        return;
      } catch (err) { /* 使用者取消分享，退回下載方式 */ }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg({ type: 'success', text: t.backupExportSuccess });
  }

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndImport(String(reader.result));
    reader.onerror = () => setBackupMsg({ type: 'error', text: t.backupImportError });
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: INK_SOFT }}>{t.backupHint}</p>
      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{t.albumBackupReminder}</p>
      <div className="flex gap-2">
        <button type="button" onClick={handleExportBackup} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ ...glass(), color: INK }}>
          {t.backupExportBtn}
        </button>
        <button type="button" onClick={() => importFileRef.current && importFileRef.current.click()} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ ...glass(), color: INK }}>
          {t.backupImportBtn}
        </button>
        <input ref={importFileRef} type="file" accept=".tzzwnb" className="hidden" onChange={handleImportFileChange} />
      </div>
      {backupMsg && <p className="text-xs font-bold" style={{ color: backupMsg.type === 'success' ? MINT : DANGER }}>{backupMsg.text}</p>}
    </div>
  );
}

// 「最後同步」相對時間的簡單換算，只在本地計算、不依賴任何後端時間戳格式。
function formatRelativeSync(ts, t) {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return t.lastSyncedJustNow;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t.lastSyncedAgo(t.syncMinutesAgo(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t.lastSyncedAgo(t.syncHoursAgo(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  return t.lastSyncedAgo(t.syncDaysAgo(diffDay));
}

// 「同步與資料」視窗內容：只用「帳戶」「同步」等產品層級的語彙呈現狀態，完全不提 Firebase
// 或特定地區限制等技術細節；連線失敗時才顯示簡潔的錯誤提示，平常不主動暴露任何技術資訊。
function SyncDataPage({ t, fbUser, syncStatus, lastSyncedAt, onOpenAuth }) {
  const [, forceTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => forceTick(v => v + 1), 30000); return () => clearInterval(iv); }, []);

  let statusText = t.notSyncedStatus;
  let statusColor = INK_SOFT;
  if (fbUser) {
    if (syncStatus === 'syncing') { statusText = t.syncing; statusColor = ACCENT; }
    else if (syncStatus === 'synced') { statusText = t.synced; statusColor = MINT; }
    else if (syncStatus === 'error') { statusText = t.syncErrorStatus; statusColor = DANGER; }
  }
  const lastSyncedText = fbUser && lastSyncedAt ? formatRelativeSync(lastSyncedAt, t) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5 flex flex-col items-center gap-1.5 text-center" style={glass()}>
        <span className="text-base font-black" style={{ color: statusColor }}>{statusText}</span>
        {lastSyncedText && <span className="text-xs" style={{ color: INK_SOFT }}>{lastSyncedText}</span>}
      </div>
      {!fbUser ? (
        <>
          <p className="text-sm" style={{ color: INK_SOFT }}>{t.syncLoginHint}</p>
          <button onClick={onOpenAuth} className="py-3 rounded-xl text-sm font-bold" style={{ background: ACCENT, color: '#fff' }}>{t.login}</button>
        </>
      ) : (
        syncStatus === 'error' && <p className="text-xs font-bold" style={{ color: DANGER }}>{t.syncErrorHint}</p>
      )}
    </div>
  );
}

// 把 t.aboutBody 這種簡易 Markdown（# 標題／## 副標題／**粗體**／[文字](網址) 連結／
// ---分隔線／- 條列／一般段落）轉成排版過的 JSX，讓「關於時光線」可以有標題、分隔線、
// 粗體與可點擊連結效果，而不是整段純文字擠在一起。之後其他語言要補上一樣格式的文案時，
// 直接沿用同一套語法即可，不用再動這裡的解析邏輯。
function renderInlineBold(line, keyPrefix) {
  // 同時支援 **粗體** 與 [文字](網址) 連結語法，用同一個正則切分後依序判斷是哪一種片段。
  const parts = line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).filter((s) => s !== '');
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline underline-offset-2"
          style={{ color: ACCENT }}
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function MarkdownBody({ text, color, colorSoft }) {
  const lines = text.split('\n');
  const elements = [];
  let listBuffer = [];
  const flushList = (key) => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1">
        {listBuffer.map((item, i) => (
          <li key={`li-${key}-${i}`}>{renderInlineBold(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line === '') { flushList(idx); return; }
    if (line === '---') {
      flushList(idx);
      elements.push(<hr key={`hr-${idx}`} style={{ borderColor: colorSoft }} className="my-3 opacity-30" />);
      return;
    }
    if (line.startsWith('## ')) {
      flushList(idx);
      elements.push(<h3 key={`h3-${idx}`} className="text-base font-bold mt-1" style={{ color }}>{line.slice(3)}</h3>);
      return;
    }
    if (line.startsWith('# ')) {
      flushList(idx);
      elements.push(<h2 key={`h2-${idx}`} className="text-lg font-bold" style={{ color }}>{line.slice(2)}</h2>);
      return;
    }
    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
      return;
    }
    flushList(idx);
    elements.push(<p key={`p-${idx}`} style={{ color }}>{renderInlineBold(line, `p-${idx}`)}</p>);
  });
  flushList('end');
  return <div className="text-sm leading-relaxed space-y-2">{elements}</div>;
}

function ProfilePage({
  t, fbUser, localSaveError, syncStatus, onOpenAuth,
  notifyEnabled, onToggleNotify, notifyDaysBefore, setNotifyDaysBefore, notifyPermission,
  onOpenFeedback, isDark, themeMode, setThemeMode, lang, setLang,
  events, albums, clocks, customIcons, onImportBackup, lastSyncedAt, appVersion,
  enabledAltCalendars, setEnabledAltCalendars,
}) {
  // 「我的」頁除了「我的時光」統計卡片（純展示、不可點擊）以外，所有點擊後彈出新內容的項目
  // （帳戶管理／本機備份／同步與資料／外觀／通知／語言／日曆／關於時光線）都統一用同一個
  // 置中視窗（SettingsChoiceModal）呈現，不再另外區分「獨立滑入子頁面」與「彈出視窗」兩種樣式。
  const [choiceModal, setChoiceModal] = useState(null); // null | 'account' | 'backup' | 'sync' | 'appearance' | 'notify' | 'language' | 'calendar' | 'about'

  const [photoCount, setPhotoCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const photosMap = await collectAllAlbumPhotos(albums || []);
        if (!cancelled) setPhotoCount(Object.values(photosMap).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0));
      } catch (err) { /* 讀取失敗就維持原本的數字，不影響其他區塊 */ }
    })();
    return () => { cancelled = true; };
  }, [albums]);

  const backupData = { clocks, events, lang, isDark, customIcons, albums };
  const hasSyncIssue = localSaveError || syncStatus === 'error';
  const eventCount = events ? events.length : 0;
  const albumCount = albums ? albums.length : 0;

  let syncRightText = t.notSyncedStatus;
  if (fbUser) {
    if (syncStatus === 'syncing') syncRightText = t.syncing;
    else if (syncStatus === 'synced') syncRightText = t.synced;
    else if (syncStatus === 'error') syncRightText = t.syncErrorStatus;
  }

  const appearanceValueText = { system: t.appearanceModeSystem, light: t.appearanceModeLight, dark: t.appearanceModeDark }[themeMode] || t.appearanceModeSystem;
  const notifyValueText = notifyEnabled ? t.darkModeOn : t.darkModeOff;
  // 帳戶管理／本機備份／同步與資料／外觀／通知／語言／日曆／關於時光線，全部共用同一個
  // 置中彈窗（SettingsChoiceModal）與同一個 choiceModal state，只是切換裡面顯示的內容。
  const choiceModalTitle = {
    appearance: t.appearanceLabel, notify: t.notifyPrefLabel, language: t.languageLabel, calendar: t.calendarPrefLabel,
    about: t.aboutLabel, account: t.accountManageLabel, backup: t.backupSectionTitle, sync: t.syncDataLabel,
  }[choiceModal] || '';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col gap-5">
      {/* 一、帳戶區域：置頂、有一定視覺存在感，但不做成大型會員中心 */}
      {fbUser ? (
        <div className="rounded-3xl p-5 flex items-center gap-4" style={glass()}>
          <ProfileAvatar fbUser={fbUser} size={56} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-black truncate" style={{ color: INK }}>{fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : t.account)}</p>
            {fbUser.email && <p className="text-xs truncate" style={{ color: INK_SOFT }}>{fbUser.email}</p>}
          </div>
          <button onClick={() => setChoiceModal('account')} className="relative flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-full flex-shrink-0" style={{ background: accentAlpha('18'), color: ACCENT }}>
            {t.accountManageLabel}
            {hasSyncIssue && <span className="absolute rounded-full" style={{ width: 7, height: 7, top: -1, right: -1, background: DANGER, border: '1.5px solid var(--card-bg)' }} />}
            <ChevronRight size={13} />
          </button>
        </div>
      ) : (
        <button onClick={onOpenAuth} className="rounded-3xl p-5 flex items-center gap-4 text-left w-full" style={glass()}>
          <span className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: 56, height: 56, background: accentAlpha('18'), color: ACCENT }}>
            <User size={24} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: INK }}>{t.loginPromptTitle}</p>
            <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>{t.loginToSync}</p>
          </div>
          <ChevronRight size={16} style={{ color: INK_SOFT, flexShrink: 0 }} />
        </button>
      )}

      {/* 二、我的時光：簡潔的橫向統計，純展示、不做成可點擊的入口 */}
      <div className="rounded-2xl p-5 flex flex-col gap-3" style={glass()}>
        <span className="text-sm font-black" style={{ color: INK }}>{t.myTimeLabel}</span>
        <div className="flex items-center">
          {[[eventCount, t.myTimeOverviewEvents], [albumCount, t.myTimeOverviewAlbums], [photoCount, t.myTimeOverviewPhotos]].map(([val, label], i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-0.5" style={{ borderLeft: i === 0 ? 'none' : CARD_BORDER }}>
              <span className="text-lg font-black" style={{ color: ACCENT }}>{val}</span>
              <span className="text-[11px] font-bold" style={{ color: INK_SOFT }}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: INK_SOFT }}>{t.myTimeCaption}</p>
      </div>

      {/* 三、資料 */}
      <SettingsGroupCard title={t.dataGroupLabel}>
        <SettingsRow isFirst icon={<Database size={18} />} label={t.backupSectionTitle} onClick={() => setChoiceModal('backup')} />
        <SettingsRow
          icon={<RefreshCw size={18} />} label={t.syncDataLabel} onClick={() => setChoiceModal('sync')}
          right={<span className="text-xs font-bold" style={{ color: syncStatus === 'error' ? DANGER : INK_SOFT }}>{syncRightText}</span>}
        />
      </SettingsGroupCard>

      {/* 四、偏好 */}
      <SettingsGroupCard title={t.prefGroupLabel}>
        <SettingsRow
          isFirst icon={<Sun size={18} />} label={t.appearanceLabel} onClick={() => setChoiceModal('appearance')}
          right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{appearanceValueText}</span>}
        />
        <SettingsRow
          icon={notifyEnabled ? <Bell size={18} /> : <BellOff size={18} />} label={t.notifyPrefLabel} onClick={() => setChoiceModal('notify')}
          right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{notifyValueText}</span>}
        />
        <SettingsRow
          icon={<Globe size={18} />} label={t.languageLabel} onClick={() => setChoiceModal('language')}
          right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{LANG_NAMES[lang]}</span>}
        />
        <SettingsRow icon={<Calendar size={18} />} label={t.calendarPrefLabel} onClick={() => setChoiceModal('calendar')} />
      </SettingsGroupCard>

      {/* 五、其他：使用條款／隱私權政策已收進「關於時光線」內文的「相關文件」連結，
          這裡不再重複列出獨立選項。 */}
      <SettingsGroupCard title={t.otherGroupLabel}>
        <SettingsRow isFirst icon={<Mail size={18} />} label={t.feedbackLabel} onClick={onOpenFeedback} />
        <SettingsRow icon={<Info size={18} />} label={t.aboutLabel} onClick={() => setChoiceModal('about')} />
      </SettingsGroupCard>

      <div className="flex flex-col items-center gap-0.5 pt-2 pb-2">
        <span className="text-xs font-bold" style={{ color: INK_SOFT }}>時光線</span>
        {appVersion && <span className="text-[11px]" style={{ color: INK_SOFT, opacity: 0.7 }}>Version {appVersion}</span>}
      </div>

      {choiceModal && (
        <SettingsChoiceModal title={choiceModalTitle} onClose={() => setChoiceModal(null)}>
          {choiceModal === 'appearance' && <AppearanceChoiceContent themeMode={themeMode} setThemeMode={setThemeMode} t={t} onClose={() => setChoiceModal(null)} />}
          {choiceModal === 'notify' && (
            <NotifyChoiceContent enabled={notifyEnabled} onToggle={onToggleNotify} daysBefore={notifyDaysBefore} setDaysBefore={setNotifyDaysBefore} permission={notifyPermission} t={t} />
          )}
          {choiceModal === 'language' && <LanguageChoiceContent lang={lang} setLang={setLang} onClose={() => setChoiceModal(null)} />}
          {choiceModal === 'calendar' && (
            <CalendarPrefChoiceContent enabledAltCalendars={enabledAltCalendars} setEnabledAltCalendars={setEnabledAltCalendars} lang={lang} t={t} />
          )}
          {/* 「關於時光線」：內文已包含使用條款／隱私權政策的可點擊連結（見 t.aboutBody），
              用 max-h+overflow-y-auto 包住，避免長文字把視窗撐爆版面，會在視窗內部自己捲動。 */}
          {choiceModal === 'about' && (
            <MarkdownBody text={t.aboutBody} color={INK} colorSoft={INK_SOFT} />
          )}
          {/* 帳戶管理／本機備份／同步與資料：原本用獨立全螢幕子頁面（ProfileSubpageShell）呈現，
              現在統一改成跟外觀／通知／關於一樣的置中視窗，「我的」頁除了「我的時光」統計卡片
              （純展示、本來就不可點擊）以外，所有點擊後彈出新內容的項目都收斂成同一種視窗樣式。 */}
          {choiceModal === 'account' && <AccountManagementPage t={t} fbUser={fbUser} onClose={() => setChoiceModal(null)} />}
          {choiceModal === 'backup' && <BackupDataPage t={t} backupData={backupData} onImportBackup={onImportBackup} />}
          {choiceModal === 'sync' && <SyncDataPage t={t} fbUser={fbUser} syncStatus={syncStatus} lastSyncedAt={lastSyncedAt} onOpenAuth={onOpenAuth} />}
        </SettingsChoiceModal>
      )}
    </div>
  );
}

/* ---------------- Main App Component ---------------- */

export default function App() {
  const [lang, setLang] = useState('zh-TW');
  const [clocks, setClocks] = useState([]);
  const [events, setEvents] = useState([]);
  const [isDark, setIsDark] = useState(false);
  // 「我的」→「日曆」裡勾選的曆法清單（西曆以外，可複選）：「日程」頁的日曆點選日期後，
  // 底部要一併顯示這些曆法對應的日期，兩邊共用同一份狀態。
  const [enabledAltCalendars, setEnabledAltCalendars] = useState([]);
  // 「外觀」設定的三段選項：'system'（跟隨系統）｜'light'｜'dark'。isDark 仍然是全 App 實際拿來
  // 判斷深色／淺色的唯一布林值，themeMode 只負責「決定 isDark 應該是什麼」，兩者用下面這個
  // effect 接起來——system 模式下跟著 prefers-color-scheme 走，並監聽系統切換即時更新；
  // 選定 light／dark 則直接固定，不受系統影響。
  const [themeMode, setThemeMode] = useState('system');
  useEffect(() => {
    if (themeMode === 'light') { setIsDark(false); return; }
    if (themeMode === 'dark') { setIsDark(true); return; }
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setIsDark(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeMode]);
  const [loaded, setLoaded] = useState(false);
  // 版本更新提醒：只在 App(Capacitor 原生環境)裡，啟動時去問 GitHub 目前「已發布」的
  // 最新版本是多少（GitHub API 只回傳已發布的正式版，草稿不會出現，不用擔心把還在測試的
  // 草稿誤判成新版本），跟目前安裝的版本（來自 android/app/build.gradle 的 versionName，
  // 也就是 build workflow 裡那個 --version 輸入值）不一樣時，才顯示提醒。
  const [updateInfo, setUpdateInfo] = useState(null);
  // EVENTS_KEY（本機備份）最近一次寫入是否失敗——目前只有這個 key 有風險（事件量大＋標題很長時
  // 才可能頂到 window.storage 單一 key 的大小上限；相片已經另外拆到各自的 key，不會再拖累這裡)。
  // 供帳號按鈕顯示小紅點提示，避免存失敗卻完全沒人知道。
  const [localSaveError, setLocalSaveError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [customIcons, setCustomIcons] = useState([]);
  const [homeTz, setHomeTz] = useState(null); // 世界時鐘中設定的「目前位置」時區，用來決定頂部問候語
  // 世界時鐘「目前位置」設定的是清單裡哪一筆（存 id）。原本這個狀態只存在 WorldClockSection
  // 元件自己的 local state 裡，元件一重新掛載（例如整頁重新整理）就會回到初始值 null，
  // 使用者原本設定好的「目前位置」就憑空消失。現在提升到 App 這一層，跟 events／clocks
  // 用同一套 window.storage 讀取／自動儲存機制，重新整理後才能維持原本設定。
  const [homeTzId, setHomeTzId] = useState(null);

  // App 一啟動就先載入「系統圓體」（Inter），因為它是全 App 數字的預設字體，
  // 不能等使用者打開某張卡片的自訂面板才動態載入，否則字體檔案還沒到位、
  // 瀏覽器會先 fallback 成系統字體，看起來像沒套用成功。
  useEffect(() => {
    const defaultFont = NUMBER_FONTS.find(f => f.id === 'inter');
    if (defaultFont) ensureGoogleFontLoaded(defaultFont.googleFont);
  }, []);

  // ---- 事件倒數日通知提醒 ----
  // notifyEnabled／notifyDaysBefore 是全域統一設定（所有事件共用同一個「提前幾天提醒」的天數）；
  // notifyLog 記錄每個事件「上一次已經通知過的是哪一次occurrence」（用目標日期字串當 key，
  // 不是存剩餘天數），這樣重複性事件（生日之類）明年再走到同一個天數時才不會被誤判成已經通知過。
  // notifyPermission 反映瀏覽器的 Notification 權限狀態；'unsupported' 表示這個瀏覽器根本沒有
  // Notification API（例如某些行動瀏覽器）。
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(3);
  const [notifyLog, setNotifyLog] = useState({});
  const [notifyPermission, setNotifyPermission] = useState(
    typeof window !== 'undefined' && typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // ---- 折叠屏展开／平板／桌面等大屏的分欄版面 ----
  // isLargeScreen 決定要不要切成「世界時鐘固定左側、時間軸在右側獨立捲動」的分欄版面。
  // 版面本身固定不變，不會因為開啟詳情視窗而重排——詳情視窗（時鐘／地標）一律用置中彈窗顯示，
  // 跟手機版共用同一套元件與樣式（見 WorldClockSection／TimelineSection 內部各自的 createPortal）。
  const isLargeScreen = useIsLargeScreen();
  const [viewingId, setViewingId] = useState(null);

  // ---- 相冊（獨立一級功能） ----
  // albums 是頂層清單（跟 events／clocks 同一層級），每筆相冊 {id, name, eventId, createdAt}——
  // eventId 可以是 null（不關聯任何事件），相片本體仍然各自存在 album-photos:{id} 這個 key。
  const [albums, setAlbums] = useState([]);
  // albumRoute 決定相冊功能目前顯示哪個畫面（home／create／detail），提升到這一層而不是放在
  // AlbumsFeature 元件自己的 state 裡，是因為切到「相冊」分頁時該元件才會掛載，如果狀態
  // 放在元件內部，每次切分頁都會被重置——而時間軸卡片上的「相冊」按鈕需要能直接指定「打開哪個
  // 相冊的詳細頁」或「進入建立流程並預先帶入這個事件」，這個狀態必須跨分頁切換也不遺失。
  const [albumRoute, setAlbumRoute] = useState({ screen: 'home', detailAlbumId: null, prefillEventId: null });

  // 時間軸卡片上「相冊」按鈕的共用邏輯：這個事件目前有沒有已經關聯的相冊——
  // 完全沒有就直接進入「建立相冊」流程並預先帶入這個事件（使用者不用再選一次事件）；
  // 已經有（可能不只一個）就直接跳進最近建立的那一個相冊詳細頁，不用先回相冊首頁再手動找。
  // 大螢幕原本另外有一套全螢幕覆蓋層可以不切分頁直接預覽，現在統一改成跟手機版一樣直接
  // 切到「相冊」分頁，兩種螢幕尺寸只有一套進入相冊的路徑。
  function openAlbumsForEvent(eventId) {
    const linked = albums.filter(a => a.eventId === eventId);
    if (linked.length) {
      const target = linked.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      setAlbumRoute({ screen: 'detail', detailAlbumId: target.id, prefillEventId: null });
    } else {
      setAlbumRoute({ screen: 'create', detailAlbumId: null, prefillEventId: eventId });
    }
    setActiveTab('gallery');
  }

  // File Handling API：使用者在作業系統裡直接用「開啟檔案」／雙擊 .tzzwnb 備份檔、
  // 或對著已安裝的 App 圖示把 .tzzwnb 檔拖進去時，瀏覽器會啟動這個 PWA 並把檔案透過
  // window.launchQueue 傳進來（不會經過任何 <input type="file">）。這裡用一個小提示條
  // 顯示匯入結果，因為這種啟動方式當下不一定會打開帳號管理 Modal，使用者需要看得到回饋。
  const [fileHandlerMsg, setFileHandlerMsg] = useState(null); // { type: 'success' | 'error', text }
  const [nowTick, setNowTick] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNowTick(new Date()), 30000); return () => clearInterval(iv); }, []);

  // ---- 「世界時鐘」次要時區清單（Part2）：改成「有高度上限、可自行捲動」的區塊 ----
  // 原本這裡的高度沒有上限（只有手動拖曳時間軸標題列才會收合），
  // 時區加太多就會把下面的時間軸整個推出畫面。現在固定給一個上限（依畫面高度換算），
  // 超過上限的時區改成在這個範圍內自行上下捲動查看，時間軸的位置不再受時區數量影響。
  //
  // 「目前位置」（Part 1）維持獨立於這個區塊之外、永遠置頂常駐顯示，不受下面任何捲動／收合影響。
  //
  // 收合／展開只能透過手動拖曳「時間軸」標題列觸發；原本「清單捲到底/頂會連動收合展開」的功能
  // 依需求已移除，避免使用者在清單裡正常上下捲動時不小心誤觸收合。
  const worldClockPart2Ref = useRef(null);
  const [worldClockPart2Height, setWorldClockPart2Height] = useState(null); // null = 自動（等於下面的 cap 上限）
  const [isDraggingWorldClock, setIsDraggingWorldClock] = useState(false);
  const worldClockDragRef = useRef(null); // { startY, startHeight }

  function getWorldClockPart2Cap() {
    if (typeof window === 'undefined') return 240;
    // 大約抓畫面高度的 3 成當作可視高度上限，太高（平板／桌機）或太矮（小手機）都夾在合理範圍內
    return Math.max(160, Math.min(320, Math.round(window.innerHeight * 0.3)));
  }
  const [worldClockPart2Cap, setWorldClockPart2Cap] = useState(getWorldClockPart2Cap);
  useEffect(() => {
    function onResize() { setWorldClockPart2Cap(getWorldClockPart2Cap()); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const worldClockPart2VisibleHeight = worldClockPart2Height != null ? worldClockPart2Height : worldClockPart2Cap;

  // 「時間軸」標題列拖曳收合世界時鐘 Part2：原本每個 pointermove 都直接 setState，
  // 而 Part2 的高度變化會牽動整棵世界時鐘元件樹（含裡面的時鐘卡片、國旗 portal 等）重新渲染，
  // 手指一移動就整棵重繪一次，在效能較弱的手機上會明顯卡頓、跟不上手指。
  // 改成拖曳過程中直接改 DOM 節點的 style.maxHeight（略過 React 的 render），
  // 並用 requestAnimationFrame 把同一輪裡多次的 pointermove 事件合併成一次，
  // 讓拖曳畫面能跟上螢幕更新率；真正的 React state 只在放開手指的那一刻提交一次即可。
  const worldClockDragFrameRef = useRef(null);
  function handleWorldClockDragStart(clientY) {
    worldClockDragRef.current = { startY: clientY, startHeight: worldClockPart2VisibleHeight, pendingHeight: worldClockPart2VisibleHeight };
    setIsDraggingWorldClock(true);
  }
  function handleWorldClockDragMove(clientY) {
    if (!worldClockDragRef.current) return;
    if (worldClockDragFrameRef.current) cancelAnimationFrame(worldClockDragFrameRef.current);
    worldClockDragFrameRef.current = requestAnimationFrame(() => {
      if (!worldClockDragRef.current) return;
      const { startY, startHeight } = worldClockDragRef.current;
      const next = Math.max(0, Math.min(startHeight + (clientY - startY), worldClockPart2Cap));
      worldClockDragRef.current.pendingHeight = next;
      const el = worldClockPart2Ref.current;
      if (el) el.style.maxHeight = `${next}px`;
    });
  }
  function handleWorldClockDragEnd() {
    if (worldClockDragFrameRef.current) { cancelAnimationFrame(worldClockDragFrameRef.current); worldClockDragFrameRef.current = null; }
    const finalHeight = worldClockDragRef.current ? worldClockDragRef.current.pendingHeight : worldClockPart2VisibleHeight;
    worldClockDragRef.current = null;
    setIsDraggingWorldClock(false);
    // 如果已經拉回接近上限，改回「自動」模式，之後畫面高度變化／清單內容改變才能自動跟著調整
    setWorldClockPart2Height(finalHeight >= worldClockPart2Cap - 1 ? null : finalHeight);
  }

  // ---- 帳號登入／雲端同步 ----
  const [fbUser, setFbUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  // 底部導覽列目前所在分頁，只在手機版（!isLargeScreen）有作用；大屏維持原本左右分欄，
  // 完全不看這個 state。放在 App 這一層而不是各分頁自己的 local state，是因為分頁互相
  // 切換時（例如切去「圖片庫」再切回「時光線」）不會重新掛載 WorldClockSection／
  // TimelineSection，兩者的內部狀態（捲動位置、展開的相冊、搜尋關鍵字等）才不會被重置。
  const [activeTab, setActiveTab] = useState('home');
  // 「日程」分頁（layout='cards'）專用的狀態，放在 App 這一層而不是 AnniversaryCalendar／
  // TimelineSection 自己的 local state，理由跟 activeTab 一樣：分頁切走切回時不希望被重置，
  // 而且日曆（AnniversaryCalendar）跟事件列表（TimelineSection）是兩個獨立元件，
  // 「目前時間範圍」「要不要看全部」這兩個狀態要同時餵給兩邊，本來就得放在共同的上層。
  // scheduleRange：日曆目前顯示的時間範圍，由 AnniversaryCalendar 的 onRangeChange 回報；
  // 初始值先假設是「本月」，等 AnniversaryCalendar 掛載後的第一個 effect 就會立刻覆寫成
  // 它自己算出的正確值（月檢視預設也是本月，兩者一致，不會有畫面閃一下又跳的情況）。
  const [scheduleRange, setScheduleRange] = useState(() => ({ mode: 'month', year: nowTick.getFullYear(), month: nowTick.getMonth() }));
  // 日曆目前的檢視模式（年／月／週），改由這一層控制、往下傳給 AnniversaryCalendar 當受控
  // 屬性，這樣頂部標題列和日曆之間新增的年／月／週滑塊（見下方 JSX）才能直接切換它，
  // 不用透過日曆元件內部才能改。
  const [scheduleViewMode, setScheduleViewMode] = useState('month');
  // 日曆左上角原本的「選擇年份／月份」按鈕已移除，改由頂部標題列（Header）的標題文字
  // 觸發同一個年份／月份選擇面板（見需求一）；面板本身的狀態仍留在 AnniversaryCalendar
  // 內部，這裡只需要一個 ref 就能呼叫它的 openPicker()，不用整個搬上來。
  const scheduleCalendarRef = useRef(null);
  // 「展示全部事件」開關，預設關閉——預設只看日曆目前選的月份（本月），跟日曆同步；
  // 開啟後改成不分月份、列出全部事件（見下方 TimelineSection 的 showAll 用法）。
  const [scheduleShowAll, setScheduleShowAll] = useState(false);
  // 「新增日程／搜尋」按鈕的實際掛載點：TimelineSection（cards 模式）用 createPortal 把
  // 按鈕渲染到這個節點，讓它們在畫面上出現在日曆上方，而不是 TimelineSection 元件本身
  // 所在的位置（日曆下方）。用 useState 而不是純 useRef，是因為 ref 在節點掛載瞬間拿到的
  // 值不會觸發重新渲染，createPortal 需要拿到真正的 DOM 節點才能運作，改用 setState 當
  // callback ref，節點一掛載就會重新渲染一次，讓 TimelineSection 那次渲染能拿到非 null 的值。
  const [scheduleControlsEl, setScheduleControlsEl] = useState(null);
  const [pendingMerge, setPendingMerge] = useState(null); // { local, cloud } 需要使用者選擇時才會有值
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'synced'
  // 「我的」頁面「同步與資料」子頁面要顯示的「最後同步：X 前」——不新增一整套時間戳同步機制，
  // 單純在 syncStatus 變成 'synced' 的當下記一次本機時間即可，重新整理後歸零也沒關係
  // （沒有同步過就不顯示這行文字，不會顯示錯誤的時間）。
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  useEffect(() => { if (syncStatus === 'synced') setLastSyncedAt(Date.now()); }, [syncStatus]);
  const syncReadyRef = useRef(false); // 是否已經完成登入時的資料比對／合併，之後才開始自動推送變更
  const mergeCheckedUidRef = useRef(null); // 避免同一次登入重複檢查合併
  // 記錄「最近一次成功同步到雲端的相片內容長什麼樣子」（每個相冊底下有哪些相片 id、依序排列）。
  // 平常編輯事件標題、加時鐘、切換深色模式這些動作都會觸發自動推送，但這些改動根本沒動到相片，
  // 沒必要每次都把所有相片重新上傳一次（雖然 firebaseSync.js 那邊已經會跳過已經上傳過的相片，
  // 但仍然要重新整理索引、重新呼叫一次，量一多還是浪費）；靠這個簽章比對，只有相片真的變動過
  // （新增/刪除/搬移/排序/改相冊名不影響簽章，只有 id 的存在與順序才算）才會真的推送相片這部分。
  const lastSyncedPhotoSigRef = useRef('');

  // App 啟動時：先處理「Email 免密碼登入連結」回跳，再開始監聽登入狀態
  useEffect(() => {
    (async () => {
      try { await completeEmailLinkSignInIfNeeded(); } catch (err) {}
    })();
    const unsub = watchAuthState(u => {
      setFbUser(u);
      if (!u) { syncReadyRef.current = false; mergeCheckedUidRef.current = null; setSyncStatus(null); }
    });
    return () => unsub();
  }, []);

  // 登入後：比對本機資料與雲端資料，決定要合併、直接採用，還是跳出選項讓使用者決定
  useEffect(() => {
    if (!loaded || !fbUser) return;
    if (mergeCheckedUidRef.current === fbUser.uid) return;
    mergeCheckedUidRef.current = fbUser.uid;
    (async () => {
      // 相片是「盡力而為」附帶上去，不影響底下 sameData 的比對邏輯（見下方說明）
      const albumPhotos = await collectAllAlbumPhotos(albums);
      const localData = { clocks, events, lang, isDark, customIcons, albums, ...(Object.keys(albumPhotos).length ? { albumPhotos } : {}) };
      const hasLocalData = clocks.length > 0 || events.length > 0;
      let cloudData = null;
      try { cloudData = await loadCloudData(fbUser.uid); } catch (err) {}

      if (!cloudData) {
        const { ok, photosSynced } = await saveCloudDataBestEffort(fbUser.uid, localData);
        if (ok) {
          if (photosSynced) lastSyncedPhotoSigRef.current = photoSigFromAlbumPhotos(albumPhotos);
          syncReadyRef.current = true;
          setSyncStatus('synced');
        } else {
          // 這裡失敗代表使用者第一次登入、雲端還完全沒有備份，卻連骨架資料的首次上傳都失敗了。
          // 故意不把 syncReadyRef 設成 true——避免後續的自動推送 effect 誤以為「已經同步過」而
          // 放心地繼續疊加變動，讓下次登入的落差越滾越大；保留原樣，讓使用者看到錯誤提示後
          // 有機會先處理再重試。
          setSyncStatus('error');
        }
        return;
      }
      if (!hasLocalData) {
        applyCloudData(cloudData);
        syncReadyRef.current = true;
        setSyncStatus('synced');
        return;
      }
      // 是否跳出合併提示，只看事件／時鐘／相冊骨架是否一致——相片同不同步是「加分項」，
      // 不該讓使用者三不五時就被跳出來的合併視窗打斷。相冊用 resolveAlbumsField 統一解析，
      // 這樣不管雲端存的是新格式（頂層 albums）還是舊格式（事件內嵌 albums）都能正確比對。
      const sameData = stableStringify({ clocks: cloudData.clocks || [], events: cloudData.events || [], albums: resolveAlbumsField(cloudData) })
        === stableStringify({ clocks, events, albums });
      if (sameData) {
        syncReadyRef.current = true;
        setSyncStatus('synced');
        return;
      }
      setPendingMerge({ local: localData, cloud: cloudData });
    })();
  }, [fbUser, loaded]);

  function applyCloudData(data) {
    if (Array.isArray(data.clocks)) setClocks(data.clocks);
    if (Array.isArray(data.events)) setEvents(data.events);
    if (typeof data.lang === 'string' && LANGS.includes(data.lang)) setLang(data.lang);
    if (typeof data.isDark === 'boolean') { setIsDark(data.isDark); setThemeMode(data.isDark ? 'dark' : 'light'); }
    if (Array.isArray(data.customIcons)) setCustomIcons(data.customIcons);
    // 相冊：優先用資料裡明確帶的頂層 albums（新格式），並用 events 反推出的舊格式相冊補齊，
    // 確保不管這份資料是新版本存的還是舊版本存的，相冊都不會憑空消失。
    if (Array.isArray(data.events) || Array.isArray(data.albums)) setAlbums(resolveAlbumsField(data));
    // 相片同步是「盡力而為」：雲端資料如果帶著 albumPhotos，逐一寫回本機各自的
    // album-photos:{albumId} key；單一相冊寫入失敗就跳過那一個，不影響其他資料套用。
    if (data.albumPhotos && typeof data.albumPhotos === 'object') {
      Object.keys(data.albumPhotos).forEach(albumId => {
        const photos = data.albumPhotos[albumId];
        if (Array.isArray(photos)) {
          window.storage.set(ALBUM_PHOTOS_PREFIX + albumId, JSON.stringify(photos), false).catch(err => console.error(err));
        }
      });
    }
  }

  function resolveMerge(choice) {
    if (!pendingMerge || !fbUser) return;
    const { local, cloud } = pendingMerge;
    let final;
    if (choice === 'cloud') {
      final = cloud;
    } else if (choice === 'local') {
      // local.albumPhotos 只有「本機真的有相片」時才會被帶上（見合併檢查那邊的組裝邏輯）；
      // 這裡明確補上 {} 預設值，確保「以本機為主」在本機沒有任何相片時，也會把這個空狀態
      // 明確同步上去、蓋掉雲端原本可能有的相片索引，而不是因為欄位整個缺席，讓雲端那份
      // 索引原封不動留在那裡，跟「以本機為主」這個選擇的本意兜不起來。
      final = { ...local, albumPhotos: local.albumPhotos || {} };
    } else {
      // 「兩邊都要」：陣列型資料以 id 聯集，衝突時（同一個 id 兩邊都有）以本機版本為準——
      // 本機是使用者當下正在操作的裝置，這樣才不會讓還沒同步上雲端的最新變動被雲端舊資料蓋掉。
      // events 另外把 albums 欄位單獨聯集，確保任一邊新建的相冊都不會在合併時憑空消失。
      const mergeById = (localList, cloudList) => {
        const map = new Map();
        (cloudList || []).forEach(item => { if (item && item.id != null) map.set(item.id, item); });
        (localList || []).forEach(item => { if (item && item.id != null) map.set(item.id, item); });
        return Array.from(map.values());
      };
      const mergeEventsById = (localEvents, cloudEvents) => {
        const cloudMap = new Map();
        (cloudEvents || []).forEach(e => { if (e && e.id != null) cloudMap.set(e.id, e); });
        const seen = new Set();
        const result = (localEvents || []).filter(e => e && e.id != null).map(e => {
          seen.add(e.id);
          const cloudE = cloudMap.get(e.id);
          if (!cloudE) return e;
          const albumMap = new Map();
          (cloudE.albums || []).forEach(a => { if (a && a.id != null) albumMap.set(a.id, a); });
          (e.albums || []).forEach(a => { if (a && a.id != null) albumMap.set(a.id, a); });
          return { ...e, albums: Array.from(albumMap.values()) };
        });
        (cloudEvents || []).forEach(e => { if (e && e.id != null && !seen.has(e.id)) result.push(e); });
        return result;
      };
      // 相片同樣用 id 聯集（沿用 mergeById 的概念，這裡帶著相片陣列做兩層合併：先合出相冊 id
      // 的聯集，同一個相冊兩邊都有的話，裡面的相片再依 id 聯集一次），確保不管挑哪個相冊、
      // 不管是本機還是雲端先新增的相片，合併後都不會不見。
      const mergeAlbumPhotos = (localMap, cloudMap) => {
        const result = {};
        const ids = new Set([...Object.keys(localMap || {}), ...Object.keys(cloudMap || {})]);
        ids.forEach(id => {
          const photoMap = new Map();
          ((cloudMap && cloudMap[id]) || []).forEach(p => { if (p && p.id != null) photoMap.set(p.id, p); });
          ((localMap && localMap[id]) || []).forEach(p => { if (p && p.id != null) photoMap.set(p.id, p); });
          if (photoMap.size) result[id] = Array.from(photoMap.values());
        });
        return result;
      };
      final = {
        clocks: mergeById(local.clocks, cloud.clocks),
        events: mergeEventsById(local.events, cloud.events),
        lang: local.lang,
        isDark: local.isDark,
        customIcons: Array.from(new Set([...(local.customIcons || []), ...(cloud.customIcons || [])])),
        albums: mergeById(resolveAlbumsField(local), resolveAlbumsField(cloud)),
        albumPhotos: mergeAlbumPhotos(local.albumPhotos, cloud.albumPhotos),
      };
    }
    applyCloudData(final);
    saveCloudDataBestEffort(fbUser.uid, final)
      .then(({ ok, photosSynced }) => {
        if (photosSynced) lastSyncedPhotoSigRef.current = photoSigFromAlbumPhotos(final.albumPhotos);
        setSyncStatus(ok ? 'synced' : 'error');
      });
    setPendingMerge(null);
    syncReadyRef.current = true;
  }

  // 已登入且合併流程結束後，本機資料一有變動就（去抖動地）推送到雲端。
  // 相片實際內容存在 Firebase Storage（不再塞進 Firestore 文件），數量不太會受單一文件大小
  // 上限影響；但還是先比對簽章，只有相片真的變動過才把 albumPhotos 放進這次要送出的資料，
  // 避免像改個事件標題這種完全沒動到相片的小改動，也要重新整理一次相片索引、多跑一趟。
  // saveCloudDataBestEffort 仍然保留「整包試一次、失敗就退回只送骨架」這道保險：萬一相片上傳
  // 過程整個出錯，至少事件／時鐘等骨架資料不會被拖累卡住不同步。
  useEffect(() => {
    if (!loaded || !fbUser || !syncReadyRef.current) return;
    setSyncStatus('syncing');
    const timer = setTimeout(async () => {
      const albumPhotos = await collectAllAlbumPhotos(albums);
      const photoSig = photoSigFromAlbumPhotos(albumPhotos);
      const photosChanged = photoSig !== lastSyncedPhotoSigRef.current;
      const fullData = { clocks, events, lang, isDark, customIcons, albums, ...(photosChanged ? { albumPhotos } : {}) };
      const { ok, photosSynced } = await saveCloudDataBestEffort(fbUser.uid, fullData);
      if (photosSynced) lastSyncedPhotoSigRef.current = photoSig;
      setSyncStatus(ok ? 'synced' : 'error');
    }, 800);
    return () => clearTimeout(timer);
  }, [clocks, events, lang, isDark, customIcons, albums, fbUser, loaded]);


  useEffect(() => {
    (async () => {
      try { const g = await window.storage.get(INVITE_KEY, false); if (g && g.value === 'true') setUnlocked(true); } catch (err) {}
      let loadedEventsRaw = [];
      try { const e = await window.storage.get(EVENTS_KEY, false); if (e && e.value) { loadedEventsRaw = JSON.parse(e.value); setEvents(loadedEventsRaw); } } catch (err) {}
      try { const c = await window.storage.get(CLOCKS_KEY, false); if (c && c.value) setClocks(JSON.parse(c.value)); } catch (err) {}
      let loadedAlbumsRaw = [];
      try { const al = await window.storage.get(ALBUMS_KEY, false); if (al && al.value) loadedAlbumsRaw = JSON.parse(al.value); } catch (err) {}
      setAlbums(resolveAlbumsField({ events: loadedEventsRaw, albums: loadedAlbumsRaw }));
      try { const l = await window.storage.get(LANG_KEY, false); if (l && l.value && LANGS.includes(l.value)) setLang(l.value); } catch (err) {}
      // 外觀偏好：優先讀新的 THEME_MODE_KEY；舊版使用者只有 DARK_KEY（單純的淺色／深色布林值，
      // 沒有「跟隨系統」這個概念），第一次升級到新版時用它推回對應的 'light' / 'dark'，
      // 讓原本手動選好的主題不會因為升級就被重置成「跟隨系統」而突然變色。
      try {
        const tm = await window.storage.get(THEME_MODE_KEY, false);
        if (tm && tm.value && ['system', 'light', 'dark'].includes(tm.value)) {
          setThemeMode(tm.value);
        } else {
          const d = await window.storage.get(DARK_KEY, false);
          if (d && d.value) setThemeMode(d.value === 'true' ? 'dark' : 'light');
        }
      } catch (err) {}
      try { const ci = await window.storage.get(CUSTOM_ICONS_KEY, false); if (ci && ci.value) setCustomIcons(JSON.parse(ci.value)); } catch (err) {}
      try { const h = await window.storage.get(HOME_TZ_ID_KEY, false); if (h && h.value) setHomeTzId(h.value); } catch (err) {}
      try { const ne = await window.storage.get(NOTIFY_ENABLED_KEY, false); if (ne && ne.value) setNotifyEnabled(ne.value === 'true'); } catch (err) {}
      try { const nd = await window.storage.get(NOTIFY_DAYS_BEFORE_KEY, false); if (nd && nd.value) { const v = parseInt(nd.value, 10); if (Number.isFinite(v)) setNotifyDaysBefore(Math.max(0, Math.min(365, v))); } } catch (err) {}
      try { const nl = await window.storage.get(NOTIFY_LOG_KEY, false); if (nl && nl.value) setNotifyLog(JSON.parse(nl.value)); } catch (err) {}
      setAuthChecked(true);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) window.storage.set(EVENTS_KEY, JSON.stringify(events), false).then(() => setLocalSaveError(false)).catch(err => { console.error(err); setLocalSaveError(true); }); }, [events, loaded]);
  useEffect(() => { if (loaded) window.storage.set(ALBUMS_KEY, JSON.stringify(albums), false).catch(err => console.error(err)); }, [albums, loaded]);
  useEffect(() => { if (loaded) window.storage.set(CLOCKS_KEY, JSON.stringify(clocks), false).catch(err => console.error(err)); }, [clocks, loaded]);
  useEffect(() => { if (loaded) window.storage.set(LANG_KEY, lang, false).catch(err => console.error(err)); }, [lang, loaded]);
  useEffect(() => { if (loaded) window.storage.set(DARK_KEY, String(isDark), false).catch(err => console.error(err)); }, [isDark, loaded]);
  useEffect(() => { if (loaded) window.storage.set(THEME_MODE_KEY, themeMode, false).catch(err => console.error(err)); }, [themeMode, loaded]);
  useEffect(() => { if (loaded) window.storage.set(CUSTOM_ICONS_KEY, JSON.stringify(customIcons), false).catch(err => console.error(err)); }, [customIcons, loaded]);
  useEffect(() => { if (loaded) window.storage.set(HOME_TZ_ID_KEY, homeTzId || '', false).catch(err => console.error(err)); }, [homeTzId, loaded]);
  useEffect(() => { if (loaded) window.storage.set(NOTIFY_ENABLED_KEY, String(notifyEnabled), false).catch(err => console.error(err)); }, [notifyEnabled, loaded]);
  useEffect(() => { if (loaded) window.storage.set(NOTIFY_DAYS_BEFORE_KEY, String(notifyDaysBefore), false).catch(err => console.error(err)); }, [notifyDaysBefore, loaded]);
  useEffect(() => { if (loaded) window.storage.set(NOTIFY_LOG_KEY, JSON.stringify(notifyLog), false).catch(err => console.error(err)); }, [notifyLog, loaded]);

  // 自我修復：不管 events 是從本機載入、雲端套用還是合併結果變來的，只要偵測到還是舊格式
  // （相片直接內嵌在 albums 裡），就自動搬去各自的 albumPhotos:{albumId} key，events 只留骨架。
  // 用 ref 擋掉搬遷過程中 setEvents 觸發的重複執行。
  const migratingAlbumsRef = useRef(false);
  useEffect(() => {
    if (!loaded || migratingAlbumsRef.current) return;
    const hasInline = events.some(e => Array.isArray(e.albums) && e.albums.some(a => Array.isArray(a.photos) && a.photos.length));
    if (!hasInline) return;
    migratingAlbumsRef.current = true;
    (async () => {
      const { events: migratedEvents } = await migrateInlineAlbumPhotos(events);
      setEvents(migratedEvents);
      migratingAlbumsRef.current = false;
    })();
  }, [events, loaded]);


  // ---- 事件倒數日通知提醒：權限請求 + 定時檢查 ----
  // 開啟通知的那一刻才跟瀏覽器要權限（不會一進 App 就跳權限視窗打擾使用者）；
  // 使用者若拒絕，開關會自動彈回關閉狀態，並顯示提示文字（見 NotifySettingsButton）。
  async function handleToggleNotify(next) {
    if (next) {
      if (typeof Notification === 'undefined') { setNotifyPermission('unsupported'); setNotifyEnabled(false); return; }
      let perm = Notification.permission;
      if (perm === 'default') {
        try { perm = await Notification.requestPermission(); } catch (err) { perm = 'denied'; }
        setNotifyPermission(perm);
      }
      if (perm !== 'granted') { setNotifyEnabled(false); return; }
    }
    setNotifyEnabled(next);
  }

  // 用 ref 保存「檢查函式要用到的最新值」，這樣下面 setInterval／visibilitychange 監聽器
  // 掛載時捕捉到的 closure 才不會用到過期的資料（例如使用者切換語言、改了提前天數之後，
  // 排程仍是一小時前掛上去的那個 interval，若沒用 ref 就會一直用到當時的舊值）
  const notifyEnabledRef = useRef(notifyEnabled);
  const notifyDaysBeforeRef = useRef(notifyDaysBefore);
  const notifyLogRef = useRef(notifyLog);
  const eventsRef = useRef(events);
  const langRef = useRef(lang);
  useEffect(() => { notifyEnabledRef.current = notifyEnabled; }, [notifyEnabled]);
  useEffect(() => { notifyDaysBeforeRef.current = notifyDaysBefore; }, [notifyDaysBefore]);
  useEffect(() => { notifyLogRef.current = notifyLog; }, [notifyLog]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  // 檢查所有事件，剛好落在「提前 N 天」那一天就發系統通知。用 targetDate（實際發生日期）
  // 而不是 diffDays 數字當作「有沒有通知過」的 key，重複性事件（生日）明年走到同樣的天數
  // 才不會被誤判成已經通知過而漏發。
  function checkEventNotifications() {
    if (!notifyEnabledRef.current) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = new Date();
    const daysBefore = notifyDaysBeforeRef.current;
    const currentLog = notifyLogRef.current;
    const tt = STRINGS[langRef.current];
    let nextLog = null;
    eventsRef.current.forEach(ev => {
      const targetDate = getEffectiveDate(ev, today);
      const targetTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
      const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays !== daysBefore) return;
      const occurrenceKey = `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()}`;
      if (currentLog[ev.id] === occurrenceKey) return; // 這次occurrence已經通知過了
      try {
        new Notification(tt.notifyTitle(ev.title), { body: tt.notifyBody(daysBefore), tag: `event-${ev.id}-${occurrenceKey}` });
      } catch (err) { /* 通知失敗（例如瀏覽器限制）就靜默跳過，不影響其他事件的檢查 */ }
      if (!nextLog) nextLog = { ...currentLog };
      nextLog[ev.id] = occurrenceKey;
    });
    if (nextLog) { notifyLogRef.current = nextLog; setNotifyLog(nextLog); }
  }

  // 開啟通知後：先立刻檢查一次，之後每小時檢查一次（涵蓋跨午夜、電腦睡眠喚醒等情況），
  // 分頁從背景切回前景時也順手檢查一次，這樣不用一直開著分頁狂刷也能及時收到提醒
  useEffect(() => {
    if (!loaded || !notifyEnabled) return;
    checkEventNotifications();
    const iv = setInterval(checkEventNotifications, 60 * 60 * 1000);
    function onVisible() { if (document.visibilityState === 'visible') checkEventNotifications(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVisible); };
  }, [loaded, notifyEnabled]);

  // 新增／編輯事件、或調整了提前天數之後，也順手檢查一次——例如剛好新增一筆事件，
  // 目標日期正好落在提前天數上，不用等到下一次每小時排程才發現
  useEffect(() => {
    if (!loaded || !notifyEnabled) return;
    checkEventNotifications();
  }, [events, notifyDaysBefore]);

  // File Handling API consumer：對應 manifest.json 裡的 file_handlers。
  // 只有在已安裝的 PWA、且瀏覽器支援 window.launchQueue 時才會用得到（目前主要是桌面版 Chrome/Edge），
  // 不支援的瀏覽器（含大多數手機瀏覽器分頁模式）會直接跳過，完全不影響原本「匯入備份」按鈕那條路徑。
  // 要等資料先從 window.storage 載入完成（loaded）才處理，避免匯入的資料被隨後的初始載入覆蓋掉。
  useEffect(() => {
    if (!loaded) return;
    if (typeof window === 'undefined' || !('launchQueue' in window) || !window.launchQueue) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams || !launchParams.files || !launchParams.files.length) return;
      const msgs = STRINGS[lang];
      try {
        const file = await launchParams.files[0].getFile();
        const text = await file.text();
        const data = await parseBackupPayload(text);
        if (!data) {
          setFileHandlerMsg({ type: 'error', text: msgs.backupImportError });
          return;
        }
        applyCloudData(data);
        setFileHandlerMsg({ type: 'success', text: msgs.backupImportSuccess });
      } catch (err) {
        setFileHandlerMsg({ type: 'error', text: STRINGS[lang].backupImportError });
      }
    });
    // 沒有提供取消訂閱的方式，setConsumer 本身是冪等的（重複呼叫只是覆蓋掉上一個 consumer），
    // 所以這裡不需要、也不能回傳 cleanup function。
  }, [loaded, lang]);

  // 匯入提示條幾秒後自動消失，不需要使用者手動關閉
  useEffect(() => {
    if (!fileHandlerMsg) return;
    const timer = setTimeout(() => setFileHandlerMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [fileHandlerMsg]);
  // 頁面底色改放到 <body> 上（而非包在最外層 div），這樣「置底」的測試版水印（負 z-index）
  // 才能疊在 body 底色之上、又被 App 內容蓋住其不透明的部分，達到「鋪在最底層」的效果。
  // transition 只設定一次(不放進 isDark 的 effect 裡,避免每次切換都重複指定同一個屬性),
  // 之後每次 isDark 改變、background 值變動時,瀏覽器就會自動用這個 transition 淡入淡出,
  // 取代原本瞬間切換的生硬感。只影響 body 底色本身,不會波及其他元件各自獨立的背景設定。
  useEffect(() => { document.body.style.transition = 'background 450ms ease'; }, []);
  useEffect(() => { document.body.style.background = isDark ? '#121419' : '#FFFFFF'; }, [isDark]);

  // App(Capacitor 原生環境)想要達到跟網頁版 PWA（viewport initial-scale=0.75）相同的密度感，
  // 但 Android WebView 對 initial-scale<1 支援不穩定（先前導致內容爆版），所以改用調整根字級
  // （rem 縮放）達成相同視覺效果。Tailwind 的 padding／gap／字級絕大多數都是 rem 為單位，
  // 改根字級會讓整體排版等比例縮小。上面時間軸圓點指示器原本用寫死的 px 值定位（left: -25），
  // 沒有跟著 rem 一起縮放才會跟軸線對不齊；已經把那處改成 rem，這裡才能放心重新套用縮放。
  // 同樣道理，header 的帳號／通知／深色模式切換按鈕、icon 選擇面板、匯出面板的切換按鈕，
  // 原本也是用寫死的 width/height px 值（34、36、30），縮放後跟旁邊已經一起縮小的文字、
  // 圖示比例對不上，看起來比其他內容都大一圈——已經一併改成 rem，全部統一跟著縮放。
  // 只在 App 環境套用；網頁版／PWA 完全不受影響，繼續用自己的 viewport 設定。
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      document.documentElement.style.fontSize = '68%';
    }
  }, []);

  // 修正 App 頂部跟手機狀態列（時間、電量那排）重疊的問題。Capacitor 預設在較新版本會讓
  // WebView 畫面延伸到狀態列底下（edge-to-edge），需要用 @capacitor/status-bar 外掛明確
  // 告訴系統「畫面內容不要疊在狀態列下面」，系統會自動把整個 WebView 往下推、空出狀態列
  // 的高度，不用自己算 safe-area 的 px 值去湊 padding，跨機型也比較不會有誤差。
  // 只在 App 環境套用；網頁版不受影響。
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      const StatusBar = window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (StatusBar && StatusBar.setOverlaysWebView) {
        StatusBar.setOverlaysWebView({ overlay: false });
      }
    }
  }, []);

  // 「我的」頁面最下方顯示的實際版本號——只在原生 App 環境讀得到（App.getInfo().version，
  // 對應 android/app/build.gradle 的 versionName），刻意跟下面的 GitHub 版本更新檢查分開一個
  // effect：就算裝置離線／GitHub API 打不通，也不該連「目前版本號」都顯示不出來。
  // 網頁版（非原生殼）沒有這支 API，appVersion 會維持 null，「我的」頁面就不顯示版本這一行，
  // 不虛構一個版本號出來。
  const [appVersion, setAppVersion] = useState(null);
  useEffect(() => {
    if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
    (async () => {
      try {
        const appInfo = await window.Capacitor.Plugins.App.getInfo();
        if (appInfo && appInfo.version) setAppVersion(appInfo.version);
      } catch (err) {
        // 讀不到就維持 null，「我的」頁面版本號那一行會直接不顯示
      }
    })();
  }, []);

  // 版本更新檢查：只在 App 環境跑，透過 @capacitor/app 外掛讀出目前安裝版本（App.getInfo().version，
  // 對應 android/app/build.gradle 的 versionName），跟 GitHub「最新已發布」release 的 tag 比對。
  // window.Capacitor.Plugins.App 是 Capacitor 核心橋接自動產生的代理，不需要在原始碼裡另外
  // import '@capacitor/app'，只要 workflow 有裝這個外掛、跑過 cap sync 讓它被原生端註冊即可。
  // 版本號用 x.y.z 逐段數字比較（而非字串比較），避免 "1.0.9" 被誤判比 "1.0.10" 新。
  useEffect(() => {
    if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
    (async () => {
      try {
        const appInfo = await window.Capacitor.Plugins.App.getInfo();
        const currentVersion = appInfo.version;
        const res = await fetch('https://api.github.com/repos/zeewu92-lab/sgx.tzzwnb/releases/latest');
        if (!res.ok) return;
        const data = await res.json();
        const latestVersion = String(data.tag_name || '').replace(/^v/, '');
        if (!currentVersion || !latestVersion) return;
        const toParts = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
        const [cMajor, cMinor, cPatch] = toParts(currentVersion);
        const [lMajor, lMinor, lPatch] = toParts(latestVersion);
        const isNewer = lMajor > cMajor
          || (lMajor === cMajor && lMinor > cMinor)
          || (lMajor === cMajor && lMinor === cMinor && lPatch > cPatch);
        if (isNewer) setUpdateInfo({ latestVersion });
      } catch (err) {
        // 檢查失敗（離線、API 限流等）就靜靜放過，不影響 App 正常使用
      }
    })();
  }, []);

  const t = STRINGS[lang];
  const now = nowTick;
  const todayStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'long', day: 'numeric', weekday: 'long' }).format(now);
  const greeting = getGreetingInfo(now, homeTz);

  const cssVars = isDark ? {
    '--ink': '#F2F3F6',
    '--ink-soft': 'rgba(242,243,246,0.55)',
    '--card-bg': '#1D2029',
    '--card-border': '#2B2F3A',
    '--input-bg': '#232733',
    '--page-bg': '#121419',
    '--header-bg': 'rgba(18,20,25,0.8)',
    '--accent': '#6C7BE0',
  } : {
    '--ink': '#232733',
    '--ink-soft': 'rgba(35,39,51,0.55)',
    '--card-bg': '#F7F8FA',
    '--card-border': '#ECEDF1',
    '--input-bg': '#FFFFFF',
    '--page-bg': '#FFFFFF',
    '--header-bg': 'rgba(255,255,255,0.8)',
    '--accent': '#6C7BE0',
  };

  if (!authChecked) return null;

  // 邀請碼機制暫時停用（如需重新啟用，把下面這個 if 區塊的註解拿掉即可）
  // if (!unlocked) {
  //   return (
  //     <div style={{ ...cssVars }}>
  //       <InviteGate lang={lang} t={t} onUnlocked={() => setUnlocked(true)} />
  //     </div>
  //   );
  // }

  return (
    <>
      {/* 全域「跟手」樣式：不是針對單一元件，而是整個 App 共用的一份基礎回饋規則。
          1. touch-action: manipulation — 部分行動瀏覽器即使關掉雙指縮放，仍可能對可點擊元素保留
             ~300ms 的「等等看是不是雙擊縮放」判斷延遲；明確宣告 manipulation 讓瀏覽器跳過這個判斷，
             點下去立刻觸發，不用等。
          2. -webkit-tap-highlight-color: transparent — 拿掉 iOS/Android 內建的點擊灰色／藍色
             閃爍疊層，那層預設高亮本身也有出現與淡出的動畫時間，會讓「點擊」跟「畫面反應」中間
             多一層視覺延遲感。
          3. button/[role="button"] 統一補上 active:scale(0.96) 的立即按壓回饋（96ms 線性、不用
             ease，是所有 transition 裡最快的一種），只要手指按下去的當下就有視覺變化，不必等
             onClick 真正處理完、狀態更新完、重新 render 完才看到反應——這是「感覺跟手」最關鍵的
             一步：按壓回饋要在事件處理完成之前、瀏覽器下一幀就先畫出來。
             選擇器刻意只用最單純的 button:active／[role="button"]:active（不加 .class 或
             :not()），specificity 壓到最低，這樣個別元件自己那套更具體的 active 動畫
             （例如上面的 .mode-select-btn:active、premium-range 滑塊的 :active）才會確實蓋掉
             這裡的預設值，不會被這條全域規則反過來蓋掉。disabled 的按鈕瀏覽器原生就不會觸發
             :active，所以不需要另外寫 :not(:disabled) 排除。 */}
      <style>{`
        button, [role="button"], a, input, select, textarea, summary {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        button, [role="button"] {
          transition: transform 96ms linear;
        }
        button:active, [role="button"]:active {
          transform: scale(0.96);
        }
        /* 深色／淺色模式切換動畫：原本只有 body 背景色有淡入淡出，卡片、標題列等其他
           用 var(--card-bg)／var(--ink)／var(--card-border) 的地方是瞬間切換，
           兩者步調不一致看起來很怪。這裡把整個 App 範圍內的 background-color／color／
           border-color 都加上同樣時長的 transition，讓整個畫面的顏色一起變化。
           範圍限定在 #app-root 底下，不會影響到這個容器以外的東西（例如彈窗遮罩本身
           刻意用不同的 transition 時間，不受這裡影響）。 */
        #app-root, #app-root * {
          transition: background-color 450ms ease, border-color 450ms ease, color 450ms ease;
        }
      `}</style>
      <div id="app-root" className="flex flex-col overflow-hidden" style={{ ...cssVars, height: '100dvh', background: 'transparent', fontFamily: "'Inter', sans-serif" }}>
      {/* 縮放已經改由 index.html 的 viewport meta（initial-scale=0.75, user-scalable=no）
          統一在瀏覽器層級處理，這裡不再另外用 --ui-scale／transform 疊加一層。
          原本在這裡加的那層 JS 動態縮放，是靠 window.innerWidth 判斷裝置寬度決定要不要縮小；
          但 viewport meta 一旦設了 initial-scale，window.innerWidth 量到的就已經是「縮放過後」
          被放大的有效寬度（例如實際 360px 寬的手機，initial-scale=0.75 時量出來會是
          360/0.75=480），判斷門檻整個失真，而且等於在瀏覽器已經縮放過一次的畫面上，
          又疊加一次 CSS transform 縮放——這正是先前陸續出現「底部裁切」「整個置中留白」等
          問題的根本原因：兩層縮放互相打架。縮放只該有一層，交給 viewport meta 統一處理最乾淨、
          也最不會有計算誤差（字級、間距、留白全部由瀏覽器原生等比例一起處理）。 */}
        {/* 版本更新提醒彈窗：updateInfo 只有在偵測到 GitHub 已發布的最新版本比目前安裝版本
            新的時候才會有值（見上面的版本檢查 useEffect）。放在最外層容器最前面、蓋在所有
            內容之上，「稍後再說」單純關閉不留痕跡（下次重開 App 還是會再檢查一次），
            「立即更新」會導去 timezzw.top/download 下載頁，使用者在那頁
            點 apk 檔案連結下載安裝即可。 */}
        {updateInfo && (
          <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 500, background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full rounded-3xl p-6" style={{ maxWidth: 340, background: CARD_BG, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
              <div className="text-lg font-bold mb-2" style={{ color: INK }}>發現新版本 v{updateInfo.latestVersion}</div>
              <div className="text-sm mb-5" style={{ color: INK_SOFT }}>建議更新以取得最新功能與修正。</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setUpdateInfo(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--card-border)', color: INK }}>
                  稍後再說
                </button>
                <button
                  onClick={() => { window.location.href = 'https://timezzw.top/download'; }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: ACCENT, color: '#fff' }}>
                  立即更新
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header — 固定不動，不再需要 sticky（父層本身已不捲動）。
            這裡的 backdropFilter 會讓 header 自成一個新的堆疊環境（stacking context），
            裡面「切換語言」選單雖然設了 z-20，範圍也只在 header 自己這個環境內有效；
            header 跟下面的 <main> 是同一層的手足元素，沒有明確 z-index 時瀏覽器會照 DOM
            順序疊圖，導致排在後面的 <main>（例如世界時鐘的「添加時區」按鈕）蓋掉了 header
            展開的語言選單。加上 zIndex 讓 header 整層明確疊在 main 之上即可解決。 */}
        {/* paddingTop 用 env(safe-area-inset-top) 疊加一層保險：上面已經用 StatusBar 外掛
            告訴系統「畫面別疊到狀態列下面」，但不同機型／WebView 版本讓開的量可能還是有些
            微差異，這裡再用瀏覽器原生的安全區域變數多留一點空間。網頁版／沒有安全區域概念
            的環境下 env() 會是 0，不會多留任何空白，不影響 PWA 原本的間距。 */}
        <header className="px-6 py-6 flex items-center justify-between flex-shrink-0" style={{ background: 'var(--header-bg)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 30, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
          <div>
            {/* 問候語只在「時光線」分頁顯示（桌面版沒有分頁切換的概念，永遠視同時光線）；
                其餘分頁改顯示對應的頁面標題，不再繼續顯示「下午好」這類首頁專屬文字。 */}
            {activeTab === 'home' ? (
              <>
                <h1 className="text-2xl font-black tracking-tight" style={{ color: INK }}>{t[greeting.key]} {greeting.emoji}</h1>
                <p className="text-xs font-medium mt-1" style={{ color: INK_SOFT }}>{t.todayIs(todayStr)}</p>
              </>
            ) : activeTab === 'schedule' ? (
              // 日程分頁的標題改顯示日曆目前檢視的年份／月份（或週範圍），不再固定顯示
              // 「日程」兩個字（見需求四）：mode 分別對應 AnniversaryCalendar 回報的
              // 'year' / 'month' / 'week'。原本日曆左上角那顆「選擇年份／月份」按鈕已經移除，
              // 改由這裡的標題文字直接觸發同一個選擇面板（見需求一），透過 scheduleCalendarRef
              // 呼叫 AnniversaryCalendar 用 useImperativeHandle 開放出來的 openPicker()。
              <button
                onClick={() => scheduleCalendarRef.current && scheduleCalendarRef.current.openPicker()}
                className="flex items-center gap-1.5"
                aria-label={t.calendarChooseDate}
              >
                <h1 className="text-2xl font-black tracking-tight" style={{ color: INK }}>
                  {(() => {
                    if (!scheduleRange) return t.navSchedule;
                    if (scheduleRange.mode === 'year') {
                      return new Intl.DateTimeFormat(LOCALE_MAP[lang], { year: 'numeric' }).format(new Date(scheduleRange.year, 0, 1));
                    }
                    if (scheduleRange.mode === 'week' && scheduleRange.weekStart && scheduleRange.weekEnd) {
                      const fmt = new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'short', day: 'numeric' });
                      return `${fmt.format(scheduleRange.weekStart)} – ${fmt.format(scheduleRange.weekEnd)}`;
                    }
                    return new Intl.DateTimeFormat(LOCALE_MAP[lang], { year: 'numeric', month: 'long' }).format(new Date(scheduleRange.year, scheduleRange.month || 0, 1));
                  })()}
                </h1>
                <ChevronDown size={18} style={{ color: INK_SOFT }} />
              </button>
            ) : (
              <h1 className="text-2xl font-black tracking-tight" style={{ color: INK }}>
                {{ clock: t.worldClock, gallery: t.navGallery, profile: t.navProfile }[activeTab] || ''}
              </h1>
            )}
          </div>
          {/* 帳號／提醒／意見回饋／深色模式／語言這排圖示已經整組移除：大屏現在跟手機版一樣
              有「我的」分頁（見下面新增的 SideNavigation），這些功能全部在 ProfilePage 裡就找得到，
              不需要再重複放一份在 Header 上；相冊入口也一併移除，改由 SideNavigation 的
              「相冊」分頁直接進入，Header 精簡到只剩頁面標題。 */}
        </header>

        {/* Main Content：手機版跟大屏／桌面版現在共用同一套「五分頁」結構（見需求：大屏也要有
            跟手機版一樣的導覽列），差別只在：① 導覽列大屏放在右側直排（SideNavigation），
            手機版在底部橫排（BottomNavigation）；② 「時光線」（home）分頁裡，大屏維持原本
            左右分欄（世界時鐘固定左側、時間軸在右側獨立捲動），手機版維持原本上下堆疊＋
            可拖曳收合世界時鐘的手勢。其餘四個分頁（世界時鐘／日程／圖片庫／我的）內容完全
            共用同一份 JSX，不再各自维护一份。 */}
        {isLargeScreen ? (
          <div className="flex-1 min-h-0 flex flex-row">
            <main className="px-6 md:px-10 max-w-[1180px] mx-auto w-full flex-1 min-h-0 flex flex-col pb-4">
              <div style={{ display: activeTab === 'home' ? 'contents' : 'none' }}>
                {/* 折叠屏展開／平板／桌面等大屏：左右分欄——世界時鐘固定在左側、時間軸在右側獨立
                    捲動（類似郵件 App 左右分欄），版面本身固定不變。點卡片開啟「地標詳情」或
                    「目前位置時鐘詳情」時不再切換版面，改成跟手機版一樣的置中彈窗（見
                    WorldClockSection／TimelineSection 內部各自的 createPortal），彈窗大小用
                    max-w-sm／max-h-[85vh] 這種相對單位自動適應螢幕，點彈窗外部空白處即可關閉。 */}
                <div className="flex-1 min-h-0 flex flex-row gap-6">
                  <div id="world-clock-section-root" className="flex-shrink-0" style={{ width: 'clamp(300px, 34vw, 380px)' }}>
                    <WorldClockSection
                      clocks={clocks}
                      setClocks={setClocks}
                      lang={lang}
                      t={t}
                      onHomeTzChange={setHomeTz}
                      homeTzId={homeTzId}
                      setHomeTzId={setHomeTzId}
                      part2Ref={worldClockPart2Ref}
                      part2Height={worldClockPart2VisibleHeight}
                      isDraggingWorldClock={isDraggingWorldClock}
                      isLargeScreen
                      unlimitedHeight
                    />
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TimelineSection
                      events={events}
                      setEvents={setEvents}
                      lang={lang}
                      t={t}
                      now={now}
                      isDark={isDark}
                      customIcons={customIcons}
                      setCustomIcons={setCustomIcons}
                      isLargeScreen
                      viewingId={viewingId}
                      setViewingId={setViewingId}
                      onOpenAlbumForEvent={openAlbumsForEvent}
                    />
                  </div>
                </div>
              </div>

              {activeTab === 'clock' && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <WorldClockSection
                    clocks={clocks}
                    setClocks={setClocks}
                    lang={lang}
                    t={t}
                    onHomeTzChange={setHomeTz}
                    homeTzId={homeTzId}
                    setHomeTzId={setHomeTzId}
                    unlimitedHeight
                  />
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ display: activeTab === 'schedule' ? 'flex' : 'none' }}>
                  <div ref={setScheduleControlsEl} className="flex-shrink-0 relative" style={{ zIndex: 31, marginTop: -34 }} />

                  <div className="relative flex p-1 rounded-full flex-shrink-0" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute', top: 4, bottom: 4, left: 4,
                        width: 'calc((100% - 8px) / 3)', borderRadius: 999,
                        background: ACCENT,
                        boxShadow: '0 2px 8px rgba(108,123,224,0.35)',
                        transform: `translateX(${SCHEDULE_VIEW_MODES.findIndex(m => m.id === scheduleViewMode) * 100}%)`,
                        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 220ms ease, box-shadow 220ms ease',
                        willChange: 'transform',
                        pointerEvents: 'none',
                      }}
                    />
                    {SCHEDULE_VIEW_MODES.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setScheduleViewMode(m.id)}
                        className="relative z-10 flex-1 min-w-0 rounded-full text-xs font-bold"
                        style={{
                          padding: '7px 3px',
                          color: scheduleViewMode === m.id ? '#fff' : INK_SOFT,
                          background: 'transparent',
                          transition: 'color 180ms ease',
                        }}
                      >
                        {t[m.labelKey]}
                      </button>
                    ))}
                  </div>

                  <AnniversaryCalendar ref={scheduleCalendarRef} events={events} lang={lang} t={t} now={now} onRangeChange={setScheduleRange} viewMode={scheduleViewMode} setViewMode={setScheduleViewMode} enabledAltCalendars={enabledAltCalendars} />

                  <div className="flex items-center justify-between gap-2 flex-shrink-0 px-1">
                    <span className="text-xs" style={{ color: INK_SOFT }}>{t.futureOnlyLabel}</span>
                    <div className="rounded-2xl px-3 py-1.5 flex items-center gap-2 flex-shrink-0" style={glass()}>
                      <span className="text-xs" style={{ color: INK_SOFT }}>{t.scheduleShowAllLabel}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={scheduleShowAll}
                        aria-label={t.scheduleShowAllLabel}
                        onClick={() => setScheduleShowAll(v => !v)}
                        className="relative flex-shrink-0 rounded-full"
                        style={{
                          width: 38,
                          height: 22,
                          padding: 2,
                          background: scheduleShowAll ? ACCENT : 'rgba(120,125,135,0.22)',
                          border: scheduleShowAll ? `1px solid ${ACCENT}` : '1px solid rgba(120,125,135,0.16)',
                          boxShadow: scheduleShowAll ? `0 3px 10px ${accentAlpha('30')}` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
                          transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        }}
                      >
                        <span
                          className="absolute rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            top: 2,
                            left: scheduleShowAll ? 18 : 2,
                            background: '#fff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                            transition: 'left 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TimelineSection
                      events={events}
                      setEvents={setEvents}
                      lang={lang}
                      t={t}
                      now={now}
                      isDark={isDark}
                      customIcons={customIcons}
                      setCustomIcons={setCustomIcons}
                      viewingId={viewingId}
                      setViewingId={setViewingId}
                      onOpenAlbumForEvent={openAlbumsForEvent}
                      layout="cards"
                      controlsPortalEl={scheduleControlsEl}
                      rangeFilter={scheduleRange}
                      showAll={scheduleShowAll}
                    />
                  </div>
              </div>

              {activeTab === 'gallery' && (
                <AlbumsFeature
                  events={events}
                  setEvents={setEvents}
                  albums={albums}
                  setAlbums={setAlbums}
                  route={albumRoute}
                  setRoute={setAlbumRoute}
                  lang={lang}
                  t={t}
                  isLargeScreen={isLargeScreen}
                  onViewEvent={setViewingId}
                />
              )}

              {activeTab === 'profile' && (
                <ProfilePage
                  t={t}
                  fbUser={fbUser}
                  localSaveError={localSaveError}
                  syncStatus={syncStatus}
                  onOpenAuth={() => setShowAuthModal(true)}
                  notifyEnabled={notifyEnabled}
                  onToggleNotify={handleToggleNotify}
                  notifyDaysBefore={notifyDaysBefore}
                  setNotifyDaysBefore={setNotifyDaysBefore}
                  notifyPermission={notifyPermission}
                  onOpenFeedback={() => setShowFeedbackModal(true)}
                  isDark={isDark}
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  lang={lang}
                  setLang={setLang}
                  events={events}
                  albums={albums}
                  clocks={clocks}
                  customIcons={customIcons}
                  onImportBackup={applyCloudData}
                  lastSyncedAt={lastSyncedAt}
                  enabledAltCalendars={enabledAltCalendars}
                  setEnabledAltCalendars={setEnabledAltCalendars}
                  appVersion={appVersion}
                />
              )}
            </main>
            <SideNavigation activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
          </div>
        ) : (
          /* 手機版：五個分頁的底部導覽列架構。
             「時光線」＝原本的複合式首頁（世界時鐘＋時間軸＋拖曳調整比例），完整保留、
             一個字都沒改，只是用 display:'contents' 切換可見度，不是條件渲染整個拔除——
             這樣切去其他分頁再切回來時，裡面的捲動位置、搜尋關鍵字、拖曳調整過的高度比例
             都還在，不會被重新掛載重置掉。其餘四個分頁（世界時鐘／紀念日／圖片庫／我的）
             各自是獨立、專注單一功能的頁面，離開再回來時內部小狀態（例如捲動位置）重置是
             正常、預期中的行為，跟大部分 App 的分頁一樣，不影響任何實際資料。 */
          <>
            <main className="px-6 max-w-md mx-auto w-full flex-1 min-h-0 flex flex-col">
              <div style={{ display: activeTab === 'home' ? 'contents' : 'none' }}>
                <div id="world-clock-section-root" className="flex-shrink-0">
                  <WorldClockSection
                    clocks={clocks}
                    setClocks={setClocks}
                    lang={lang}
                    t={t}
                    onHomeTzChange={setHomeTz}
                    homeTzId={homeTzId}
                    setHomeTzId={setHomeTzId}
                    part2Ref={worldClockPart2Ref}
                    part2Height={worldClockPart2VisibleHeight}
                    isDraggingWorldClock={isDraggingWorldClock}
                  />
                </div>
                <TimelineSection
                  events={events}
                  setEvents={setEvents}
                  lang={lang}
                  t={t}
                  now={now}
                  isDark={isDark}
                  customIcons={customIcons}
                  setCustomIcons={setCustomIcons}
                  onHeaderDragStart={handleWorldClockDragStart}
                  onHeaderDragMove={handleWorldClockDragMove}
                  onHeaderDragEnd={handleWorldClockDragEnd}
                  viewingId={viewingId}
                  setViewingId={setViewingId}
                  onOpenAlbumForEvent={openAlbumsForEvent}
                />
              </div>

              {/* 世界時鐘（獨立分頁）：不是把「時光線」首頁那個世界時鐘視窗原封不動搬過來——
                  這裡拿掉了首頁版本特有的高度上限與拖曳收合手勢（那是為了跟下面的時間軸
                  共用畫面高度才有的機制，這個獨立分頁沒有時間軸要爭空間），改用
                  unlimitedHeight 讓整頁世界時鐘用滿版面，更有獨立完整頁面的感覺；
                  城市／時區／時間顯示／城市管理／新增／刪除／排序等全部功能、資料邏輯都跟
                  「時光線」共用同一份 clocks／setClocks，一個字都沒少。 */}
              {activeTab === 'clock' && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <WorldClockSection
                    clocks={clocks}
                    setClocks={setClocks}
                    lang={lang}
                    t={t}
                    onHomeTzChange={setHomeTz}
                    homeTzId={homeTzId}
                    setHomeTzId={setHomeTzId}
                    unlimitedHeight
                  />
                </div>
              )}

              {/* 日程（獨立分頁）：頁面結構由上至下＝頁面標題（在最上面的 Header，這裡看不到）→
                  「新增日程／搜尋」操作 → 日曆 → 日程篩選設定（展示全部事件）→
                  對應的日程／事件列表。日曆（AnniversaryCalendar）跟事件列表（TimelineSection，
                  layout="cards"）資料共用同一份 events／處理邏輯，只是不再顯示時間軸的視覺結構，
                  改成單純的事件卡片，且列表內容跟著日曆目前選的月份／年份同步（見需求二、六）。
                  跟「時光線」（home）分頁一樣，這裡改成永遠掛載、用 display 控制顯示/隱藏，
                  不再用 activeTab === 'schedule' && (...) 這種條件渲染——後者每次切換分頁都會把
                  AnniversaryCalendar／TimelineSection 整個卸載再重新掛載，所有 useMemo 快取、
                  日曆目前選的月份、捲動位置全部歸零，這正是「從其他頁面切進日程頁很慢」的主因；
                  改成常駐掛載後，切分頁純粹是 CSS 顯示/隱藏，不會重新渲染整棵子樹。 */}
              <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ display: activeTab === 'schedule' ? 'flex' : 'none' }}>
                  {/* 「新增日程／搜尋」按鈕的實際掛載點：內容由下面的 TimelineSection（cards 模式）
                      透過 createPortal 掛進來。改成用負的 marginTop 把這顆按鈕往上平移、蓋住
                      一半上面 Header 的標題列（見需求一），position:relative + zIndex 31（比
                      Header 的 zIndex:30 高）確定按鈕會疊在 Header 上面、不會被蓋住；因為這是
                      這個 flex 直排容器的第一個子元素，負的 marginTop 會把它、連同下面所有
                      內容（日曆、篩選列、事件列表）一起往上帶，等於「整體內容再向上移」
                      一次到位，不用另外再調一次外層容器的位置。 */}
                  <div ref={setScheduleControlsEl} className="flex-shrink-0 relative" style={{ zIndex: 31, marginTop: -34 }} />

                  {/* 年／月／週檢視滑塊：放在頂部標題列（Header）跟日曆之間，切換 scheduleViewMode，
                      直接控制下面 AnniversaryCalendar 的檢視模式（見需求四）。跟「新建地標」的
                      模式選擇同一種滑動選中膠囊樣式（見 SCHEDULE_VIEW_MODES）。 */}
                  <div className="relative flex p-1 rounded-full flex-shrink-0" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute', top: 4, bottom: 4, left: 4,
                        width: 'calc((100% - 8px) / 3)', borderRadius: 999,
                        background: ACCENT,
                        boxShadow: '0 2px 8px rgba(108,123,224,0.35)',
                        transform: `translateX(${SCHEDULE_VIEW_MODES.findIndex(m => m.id === scheduleViewMode) * 100}%)`,
                        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 220ms ease, box-shadow 220ms ease',
                        willChange: 'transform',
                        pointerEvents: 'none',
                      }}
                    />
                    {SCHEDULE_VIEW_MODES.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setScheduleViewMode(m.id)}
                        className="relative z-10 flex-1 min-w-0 rounded-full text-xs font-bold"
                        style={{
                          padding: '7px 3px',
                          color: scheduleViewMode === m.id ? '#fff' : INK_SOFT,
                          background: 'transparent',
                          transition: 'color 180ms ease',
                        }}
                      >
                        {t[m.labelKey]}
                      </button>
                    ))}
                  </div>

                  <AnniversaryCalendar ref={scheduleCalendarRef} events={events} lang={lang} t={t} now={now} onRangeChange={setScheduleRange} viewMode={scheduleViewMode} setViewMode={setScheduleViewMode} enabledAltCalendars={enabledAltCalendars} />

                  {/* 這一整行本身不套毛玻璃背景，只有純文字提示＋真正的按鈕模組並排。
                      左邊「只展示未來待辦事件」是不可點擊的純文字說明，不需要背景卡片；
                      右邊「展示全部事件」文字＋開關才是真正的按鈕模組，毛玻璃背景縮小到只
                      包住這一小塊，不再整行都套上卡片背景。 */}
                  <div className="flex items-center justify-between gap-2 flex-shrink-0 px-1">
                    <span className="text-xs" style={{ color: INK_SOFT }}>{t.futureOnlyLabel}</span>
                    <div className="rounded-2xl px-3 py-1.5 flex items-center gap-2 flex-shrink-0" style={glass()}>
                      <span className="text-xs" style={{ color: INK_SOFT }}>{t.scheduleShowAllLabel}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={scheduleShowAll}
                        aria-label={t.scheduleShowAllLabel}
                        onClick={() => setScheduleShowAll(v => !v)}
                        className="relative flex-shrink-0 rounded-full"
                        style={{
                          width: 38,
                          height: 22,
                          padding: 2,
                          background: scheduleShowAll ? ACCENT : 'rgba(120,125,135,0.22)',
                          border: scheduleShowAll ? `1px solid ${ACCENT}` : '1px solid rgba(120,125,135,0.16)',
                          boxShadow: scheduleShowAll ? `0 3px 10px ${accentAlpha('30')}` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
                          transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        }}
                      >
                        <span
                          className="absolute rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            top: 2,
                            left: scheduleShowAll ? 18 : 2,
                            background: '#fff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                            transition: 'left 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TimelineSection
                      events={events}
                      setEvents={setEvents}
                      lang={lang}
                      t={t}
                      now={now}
                      isDark={isDark}
                      customIcons={customIcons}
                      setCustomIcons={setCustomIcons}
                      viewingId={viewingId}
                      setViewingId={setViewingId}
                      onOpenAlbumForEvent={openAlbumsForEvent}
                      layout="cards"
                      controlsPortalEl={scheduleControlsEl}
                      rangeFilter={scheduleRange}
                      showAll={scheduleShowAll}
                    />
                  </div>
              </div>

              {activeTab === 'gallery' && (
                <AlbumsFeature
                  events={events}
                  setEvents={setEvents}
                  albums={albums}
                  setAlbums={setAlbums}
                  route={albumRoute}
                  setRoute={setAlbumRoute}
                  lang={lang}
                  t={t}
                  isLargeScreen={isLargeScreen}
                  onViewEvent={setViewingId}
                />
              )}

              {activeTab === 'profile' && (
                <ProfilePage
                  t={t}
                  fbUser={fbUser}
                  localSaveError={localSaveError}
                  syncStatus={syncStatus}
                  onOpenAuth={() => setShowAuthModal(true)}
                  notifyEnabled={notifyEnabled}
                  onToggleNotify={handleToggleNotify}
                  notifyDaysBefore={notifyDaysBefore}
                  setNotifyDaysBefore={setNotifyDaysBefore}
                  notifyPermission={notifyPermission}
                  onOpenFeedback={() => setShowFeedbackModal(true)}
                  isDark={isDark}
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  lang={lang}
                  setLang={setLang}
                  events={events}
                  albums={albums}
                  clocks={clocks}
                  customIcons={customIcons}
                  onImportBackup={applyCloudData}
                  lastSyncedAt={lastSyncedAt}
                  enabledAltCalendars={enabledAltCalendars}
                  setEnabledAltCalendars={setEnabledAltCalendars}
                  appVersion={appVersion}
                />
              )}
            </main>
            <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
          </>
        )}
      </div>
      {showAuthModal && (
        <AuthModal
          lang={lang} t={t} user={fbUser} onClose={() => setShowAuthModal(false)}
          backupData={{ clocks, events, lang, isDark, customIcons, albums }}
          onImportBackup={applyCloudData}
        />
      )}
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
      {pendingMerge && <MergeDialog t={t} onResolve={resolveMerge} />}
      {fileHandlerMsg && (
        <div
          className="fixed left-1/2 px-4 py-3 rounded-xl text-sm font-bold text-center shadow-lg"
          style={{
            // 手機版底下多了一條 Bottom Navigation，這個提示條原本貼著螢幕底部，
            // 現在要往上讓開導覽列的高度（含安全區），不然兩者會疊在一起。
            // 大屏沒有底部導覽列，維持原本的間距不變。
            bottom: isLargeScreen
              ? 'calc(24px + env(safe-area-inset-bottom, 0px))'
              : 'calc(80px + env(safe-area-inset-bottom, 0px))',
            transform: 'translateX(-50%)',
            zIndex: 100,
            maxWidth: '90vw',
            background: fileHandlerMsg.type === 'success' ? MINT : DANGER,
            color: '#fff',
          }}
        >
          {fileHandlerMsg.text}
        </div>
      )}
      <Watermark />
      {SHOW_TEST_WATERMARK && <TestVersionWatermark />}
    </>
  );
}
