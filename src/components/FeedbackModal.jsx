import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Plus, ChevronLeft, ChevronRight, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

const ACCENT = 'var(--accent, #6C7BE0)';
const INK = 'var(--ink)';
const INK_SOFT = 'var(--ink-soft)';
const CARD_BORDER = '1px solid var(--card-border)';
const INPUT_BG = 'var(--input-bg)';
const DANGER = '#FF004A';

// 跟 AuthModal 用的是同一組玻璃感視窗樣式（毛玻璃卡片 + 半透明白底），
// 讓「意見反饋」跟「帳號登入」視窗的質感一致，不會突然看起來像兩套不同的 UI。
const FEEDBACK_GLASS = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.4)',
  boxShadow: '0 8px 32px rgba(31,38,135,0.18)',
};

// Telegram sendMediaGroup 一次最多帶 10 張，這裡跟後端的分批邏輯（見 feedback.js）保持同一個上限，
// 前端先擋掉超過的部分，使用者不用送出後才被後端拒絕。
const MAX_IMAGES = 10;

// 「建議」字數上限，純視覺提醒用——超過不會擋輸入，純粹讓使用者知道意見內容偏長，
// 跟後端 feedback.js 真正的硬性驗證（message.length > 2000 才會被拒絕）數字保持一致，
// 這樣「看起來超過建議值」跟「送出真的會失敗」不會兜不起來、造成使用者困惑。
const MESSAGE_SUGGESTED_LIMIT = 2000;
const MESSAGE_COLLAPSED_HEIGHT = 132;
const MESSAGE_EXPANDED_HEIGHT = 300;

// 「新增聯絡方式」二級選單的可選類型。id 是內部識別用的 key，label 是選單與已加項目上顯示的文字，
// inputType／placeholder 用來讓對應的輸入框有正確的鍵盤與提示文字（例如手機號碼喚起數字鍵盤）。
// 'other' 比較特別：需要使用者自己填「名稱」，所以在渲染與送出邏輯裡都會額外判斷這個 id。
const CONTACT_TYPES = [
  { id: 'wechat', label: 'WeChat', placeholder: 'WeChat 帳號' },
  { id: 'qq', label: 'QQ', placeholder: 'QQ 號碼', inputType: 'tel' },
  { id: 'phone', label: '手機號碼', placeholder: '手機號碼', inputType: 'tel' },
  { id: 'email', label: 'E-mail', placeholder: 'E-mail 信箱', inputType: 'email' },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: 'WhatsApp 號碼', inputType: 'tel' },
  { id: 'telegram', label: 'Telegram', placeholder: 'Telegram 帳號' },
  { id: 'discord', label: 'Discord', placeholder: 'Discord 帳號' },
  { id: 'facebook', label: 'Facebook', placeholder: 'Facebook 帳號／連結' },
  { id: 'other', label: '其他', placeholder: '聯絡資訊' },
];
const CONTACT_TYPE_LABEL = Object.fromEntries(CONTACT_TYPES.map(c => [c.id, c.label]));

// 「意見類型」二級選單的可選項目，單選——選了哪個就直接顯示在「意見類型」欄位裡，
// 跟「新增聯絡方式」那組多選、可重複添加的選單性質不同，所以分開兩組常數與各自的 state。
const FEEDBACK_TYPES = ['功能建議', '問題回報', '介面與體驗', '效能問題', '帳號與資料', '隱私與安全', '其他'];

// 把已填寫的聯絡方式陣列組成一段文字，掛在既有的 'contact' 欄位送給後端——
// 後端（feedback.js）本來就只是把 contact 當一段不透明的字串塞進 Telegram caption，
// 這裡改成多行文字（每種聯絡方式一行）完全不需要動後端。
function formatContactsForSubmit(contacts) {
  return contacts
    .map(c => {
      const value = c.value.trim();
      if (!value) return null;
      const label = c.type === 'other' ? (c.label.trim() || '其他') : CONTACT_TYPE_LABEL[c.type];
      return `${label}：${value}`;
    })
    .filter(Boolean)
    .join('\n');
}

export default function FeedbackModal({ onClose, isDark = false }) {
  // 這個彈窗是用 createPortal 直接掛到 document.body（見檔案最下方），在 DOM 樹裡
  // 跟 App 裡設定 --ink／--card-bg 等 CSS 變數的 #app-root 是手足關係、不是子孫，
  // 繼承不到那些變數（跟 App.jsx 開頭註解說明的其他幾個 portal 彈窗是同樣的狀況）。
  // 所以這裡兩個二級選單需要精準區分深/淺色的視覺（玻璃底色、邊框、文字），
  // 就直接用 isDark 這個 prop 算出對應色票，不依賴會被斷開繼承的 CSS 變數。
  // 呼叫端記得傳入 isDark={isDark}，沒傳的話預設為淺色模式，不會壞掉但深色模式下配色會不準。
  const DROPDOWN_BG = isDark ? 'rgba(29,32,41,0.94)' : 'rgba(255,255,255,0.94)';
  const DROPDOWN_BORDER = isDark ? '1px solid #2B2F3A' : '1px solid #ECEDF1';
  const DROPDOWN_INK = isDark ? '#F2F3F6' : '#232733';
  const DROPDOWN_ITEM_SELECTED_BG = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(35,39,51,0.05)';

  // 進場／離場動畫：跟 AuthModal 同一套手法——先掛上 DOM（opacity 0 / 背景透明），
  // 下一個 frame 再切成 'shown' 觸發 CSS transition，讓背景淡入、卡片浮現；
  // 關閉時反過來先切 'closing' 播完動畫，再真的呼叫 onClose 把節點卸載。
  const [modalPhase, setModalPhase] = useState('enter');
  const MODAL_DURATION = 180;
  useEffect(() => {
    const id = requestAnimationFrame(() => setModalPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  function handleClose() {
    if (modalPhase === 'closing') return;
    setModalPhase('closing');
    setTimeout(onClose, MODAL_DURATION);
  }
  const modalShown = modalPhase === 'shown';

  const [message, setMessage] = useState('');
  // 「放大」輸入框：只是換一個高度呈現、方便輸入較長內容，不影響 message 本身的值。
  const [messageExpanded, setMessageExpanded] = useState(false);
  // 意見類型：單選，未選時是空字串——空字串代表「沒有選」，送出時就不會附加這個欄位，
  // 完全不影響原本「只填意見內容就能送出」的流程。
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackTypeMenuOpen, setFeedbackTypeMenuOpen] = useState(false);
  const feedbackTypeMenuRef = useRef(null);
  // 多筆聯絡方式：每筆是 { id, type, label, value }。label 只有 type === 'other' 時才會用到
  // （使用者自訂的名稱，例如「Line」），其餘類型的顯示名稱直接查 CONTACT_TYPE_LABEL。
  const [contacts, setContacts] = useState([]);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  // 選單展開方向：'right'（按鈕右側，優先）／'left'（右側空間不夠就改左側）／
  // 'below'（左右都放不下才退回往下展開的保底方案）。開啟當下量一次可用空間再決定，
  // 不用一直監聽 resize——彈窗開著的當下使用者不太會去轉螢幕方向。
  const [contactMenuPlacement, setContactMenuPlacement] = useState('right');
  const contactMenuRef = useRef(null);
  const CONTACT_MENU_WIDTH = 160;
  const CONTACT_MENU_GAP = 8;
  const contactIdRef = useRef(0);

  // 按 Esc 關閉：哪個選單／放大狀態最後開的就先收合哪個，都沒開才關閉整個視窗，
  // 跟一般「一次 Esc 只收掉最上層那件事」的操作習慣一致。
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (feedbackTypeMenuOpen) setFeedbackTypeMenuOpen(false);
      else if (contactMenuOpen) setContactMenuOpen(false);
      else if (messageExpanded) setMessageExpanded(false);
      else handleClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackTypeMenuOpen, contactMenuOpen, messageExpanded]);

  // 點選單外面的地方就收合「意見類型」選單
  useEffect(() => {
    if (!feedbackTypeMenuOpen) return;
    function handleClickOutside(e) {
      if (feedbackTypeMenuRef.current && !feedbackTypeMenuRef.current.contains(e.target)) setFeedbackTypeMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [feedbackTypeMenuOpen]);

  // 點選單外面的地方就收合「新增聯絡方式」選單
  useEffect(() => {
    if (!contactMenuOpen) return;
    function handleClickOutside(e) {
      if (contactMenuRef.current && !contactMenuRef.current.contains(e.target)) setContactMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contactMenuOpen]);

  // 已加入的類型（'其他' 除外）就不再顯示在選單裡，避免使用者不小心重複加兩個 WeChat；
  // 「其他」允許加很多個（例如同時想留 Line 跟 Signal），所以不受這個限制。
  const usedTypes = new Set(contacts.filter(c => c.type !== 'other').map(c => c.type));
  const availableContactTypes = CONTACT_TYPES.filter(c => c.id === 'other' || !usedTypes.has(c.id));

  function addContact(typeId) {
    contactIdRef.current += 1;
    setContacts(prev => [...prev, { id: contactIdRef.current, type: typeId, label: '', value: '' }]);
    setContactMenuOpen(false);
  }

  function updateContact(id, patch) {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeContact(id) {
    setContacts(prev => prev.filter(c => c.id !== id));
  }

  // 開啟選單當下量一次按鈕跟螢幕邊界的距離，優先往右展開；右側放不下改左側；
  // 兩側都放不下（極窄螢幕）才退回往下展開，並保留原本的「不超出螢幕邊界」保底。
  function toggleContactMenu() {
    if (!contactMenuOpen && contactMenuRef.current) {
      const rect = contactMenuRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      if (spaceRight >= CONTACT_MENU_WIDTH + CONTACT_MENU_GAP) setContactMenuPlacement('right');
      else if (spaceLeft >= CONTACT_MENU_WIDTH + CONTACT_MENU_GAP) setContactMenuPlacement('left');
      else setContactMenuPlacement('below');
    }
    setContactMenuOpen(v => !v);
  }
  // 多圖：每張存 { file, url }，url 是 URL.createObjectURL 產生的本機預覽網址，
  // 卸載或移除圖片時要記得 revoke，不然分頁開久了會累積記憶體。
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState(''); // '', 'sending', 'success', 'error'
  const [feedbackCode, setFeedbackCode] = useState(''); // 送出成功後後端回傳的短碼，例如 FB8K2N9
  const [previewIndex, setPreviewIndex] = useState(null); // 點縮圖後開啟的燈箱，null 表示沒開
  const fileInputRef = useRef(null);

  useEffect(() => {
    // 元件卸載時，把目前還沒被 revoke 的所有預覽網址一次清掉
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilesSelected(e) {
    const picked = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    e.target.value = ''; // 允許連續選同一批檔案也能觸發 change
    if (!picked.length) return;
    setImages(prev => {
      const room = MAX_IMAGES - prev.length;
      const toAdd = picked.slice(0, Math.max(room, 0)).map(file => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...toAdd];
    });
  }

  function removeImage(index) {
    setImages(prev => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
    setPreviewIndex(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');

    const formData = new FormData();
    formData.append('message', message);
    if (feedbackType) formData.append('feedbackType', feedbackType);
    const contactText = formatContactsForSubmit(contacts);
    if (contactText) formData.append('contact', contactText);
    // 多張圖片用同一個欄位名重複 append，後端用 form.getAll('images') 收成陣列，
    // 再決定要 sendMediaGroup（相簿效果）還是逐張 sendPhoto。
    images.forEach(img => formData.append('images', img.file, img.file.name || 'image.jpg'));

    try {
      const res = await fetch('/api/feedback', { method: 'POST', body: formData });
      const data = await res.json();
      setStatus(data.ok ? 'success' : 'error');
      if (data.ok && data.code) setFeedbackCode(data.code);
    } catch {
      setStatus('error');
    }
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{
          zIndex: 200,
          background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
          transition: `background ${MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={handleClose}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-5"
          style={{
            ...FEEDBACK_GLASS,
            opacity: modalShown ? 1 : 0,
            transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
            transition: `opacity ${MODAL_DURATION}ms ease, transform ${MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black" style={{ color: INK }}>意見回饋</h2>
            <button onClick={handleClose} style={{ color: INK_SOFT }}>
              <X size={20} />
            </button>
          </div>

          {status === 'success' ? (
            <div className="py-6 text-center">
              <p className="text-sm font-bold" style={{ color: INK }}>感謝您的意見！</p>
              {feedbackCode && (
                <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>
                  回饋編號 #{feedbackCode}
                </p>
              )}
              <button
                onClick={handleClose}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: ACCENT, color: '#fff' }}
              >
                關閉
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* 意見類型：單選欄位，樣式跟下面的 textarea／輸入框同一套 token（INPUT_BG／CARD_BORDER／
                  rounded-xl），視覺上是「一個可點的輸入框」而不是獨立的按鈕語彙，跟整體表單風格一致。
                  點擊後展開二級選單，選好某一項就直接寫回這個欄位、選單自動收合。 */}
              <div className="relative" ref={feedbackTypeMenuRef}>
                <button
                  type="button"
                  onClick={() => setFeedbackTypeMenuOpen(v => !v)}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: INPUT_BG, color: feedbackType ? INK : INK_SOFT, border: CARD_BORDER }}
                >
                  <span>{feedbackType || '意見類型（選填）'}</span>
                  <ChevronDown size={14} style={{ color: INK_SOFT, transform: feedbackTypeMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', flexShrink: 0 }} />
                </button>
                {feedbackTypeMenuOpen && (
                  <div
                    className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-20"
                    style={{
                      background: DROPDOWN_BG,
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      border: DROPDOWN_BORDER,
                      boxShadow: '0 10px 30px rgba(35,39,51,0.22)',
                    }}
                  >
                    {FEEDBACK_TYPES.map(ft => (
                      <button
                        key={ft}
                        type="button"
                        onClick={() => { setFeedbackType(ft); setFeedbackTypeMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm"
                        style={{ color: ft === feedbackType ? ACCENT : DROPDOWN_INK, background: ft === feedbackType ? DROPDOWN_ITEM_SELECTED_BG : 'transparent' }}
                      >
                        {ft}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 意見內容輸入區：外層是統一的圓角背景容器（INPUT_BG／CARD_BORDER，深淺色都會跟著
                  CSS 變數切換，對比度由 App 既有的色票保證），textarea 本身貼滿容器、背景透明，
                  右上角疊字數統計、右下角疊放大／收合按鈕——都用 padding 讓輸入文字自動避開，
                  不會被蓋住。展開只是改容器高度＋CSS transition，內容與游標位置完全不受影響。 */}
              <div
                className="relative w-full rounded-xl overflow-hidden"
                style={{
                  background: INPUT_BG,
                  border: CARD_BORDER,
                  height: messageExpanded ? MESSAGE_EXPANDED_HEIGHT : MESSAGE_COLLAPSED_HEIGHT,
                  transition: 'height 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="想跟我們說什麼？"
                  required
                  className="absolute inset-0 w-full h-full text-sm outline-none resize-none bg-transparent"
                  style={{ color: INK, padding: '28px 12px 34px 12px', border: 'none' }}
                />
                {/* 字數統計：純視覺提醒，不設 maxLength，超過建議字數也能繼續輸入；
                    只有超過時前面的數字變紅，斜線後的建議上限文字顏色維持不變。 */}
                <span
                  className="absolute top-2 right-3 text-[11px] font-bold pointer-events-none"
                  style={{ color: INK_SOFT }}
                >
                  <span style={{ color: message.length > MESSAGE_SUGGESTED_LIMIT ? DANGER : INK_SOFT }}>
                    {message.length}
                  </span>
                  /{MESSAGE_SUGGESTED_LIMIT}
                </span>
                <button
                  type="button"
                  onClick={() => setMessageExpanded(v => !v)}
                  className="absolute bottom-2 right-2 flex items-center justify-center rounded-lg"
                  style={{ width: 24, height: 24, background: 'var(--card-border)', color: INK_SOFT }}
                  title={messageExpanded ? '收起輸入框' : '放大輸入框'}
                >
                  {messageExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
              </div>
              {/* 「新增聯絡方式」按鈕＋二級選單：self-start 讓按鈕維持原本的緊湊寬度（不像
                  textarea／意見類型欄位撐滿整列），右側才會有空間讓選單往右展開。
                  選好類型後，對應的輸入框會動態出現在下方（見下面 contacts.map 那一段）。 */}
              <div className="relative self-start" ref={contactMenuRef}>
                <button
                  type="button"
                  onClick={toggleContactMenu}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold"
                  style={{ border: '1px dashed var(--card-border)', color: INK_SOFT }}
                >
                  新增聯絡方式
                  {availableContactTypes.length > 0 && (
                    <ChevronDown size={14} style={{ transform: contactMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
                  )}
                </button>
                {contactMenuOpen && availableContactTypes.length > 0 && (
                  <div
                    className="absolute rounded-xl overflow-hidden z-20"
                    style={{
                      width: CONTACT_MENU_WIDTH,
                      top: contactMenuPlacement === 'below' ? 'calc(100% + 8px)' : 0,
                      left: contactMenuPlacement === 'right' ? 'calc(100% + 8px)' : (contactMenuPlacement === 'below' ? 0 : 'auto'),
                      right: contactMenuPlacement === 'left' ? 'calc(100% + 8px)' : 'auto',
                      background: DROPDOWN_BG,
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      border: DROPDOWN_BORDER,
                      boxShadow: '0 10px 30px rgba(35,39,51,0.22)',
                    }}
                  >
                    {availableContactTypes.map(ct => (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => addContact(ct.id)}
                        className="w-full text-left px-3 py-2 text-sm"
                        style={{ color: DROPDOWN_INK }}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 已加入的聯絡方式：每一筆都是可直接編輯的輸入框＋刪除按鈕，
                  '其他' 額外多一個「名稱」輸入框讓使用者自訂顯示文字。 */}
              {contacts.length > 0 && (
                <div className="flex flex-col gap-2">
                  {contacts.map(c => (
                    <div key={c.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex-shrink-0 text-xs font-bold px-2 py-2 rounded-xl text-center"
                          style={{ background: INPUT_BG, color: INK_SOFT, minWidth: 64 }}
                        >
                          {CONTACT_TYPE_LABEL[c.type]}
                        </span>
                        {c.type === 'other' ? (
                          <input
                            type="text"
                            value={c.label}
                            onChange={(e) => updateContact(c.id, { label: e.target.value })}
                            placeholder="名稱，如 Line"
                            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ background: INPUT_BG, color: INK, border: CARD_BORDER }}
                          />
                        ) : (
                          <input
                            type={CONTACT_TYPES.find(t => t.id === c.type)?.inputType || 'text'}
                            value={c.value}
                            onChange={(e) => updateContact(c.id, { value: e.target.value })}
                            placeholder={CONTACT_TYPES.find(t => t.id === c.type)?.placeholder}
                            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ background: INPUT_BG, color: INK, border: CARD_BORDER }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeContact(c.id)}
                          className="flex-shrink-0 flex items-center justify-center rounded-full"
                          style={{ width: 26, height: 26, color: INK_SOFT }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {c.type === 'other' && (
                        <input
                          type="text"
                          value={c.value}
                          onChange={(e) => updateContact(c.id, { value: e.target.value })}
                          placeholder="聯絡資訊"
                          className="rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ marginLeft: 72, background: INPUT_BG, color: INK, border: CARD_BORDER }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 圖片縮圖列：已選的圖片＋一個「新增」方塊，超過上限就不再顯示新增方塊 */}
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div
                    key={img.url}
                    className="relative rounded-lg overflow-hidden flex-shrink-0"
                    style={{ width: 64, height: 64, border: CARD_BORDER }}
                  >
                    <img
                      src={img.url}
                      alt=""
                      onClick={() => setPreviewIndex(i)}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute flex items-center justify-center rounded-full"
                      style={{ top: 3, right: 3, width: 18, height: 18, background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className="flex items-center justify-center gap-1.5 rounded-lg flex-shrink-0 px-3 text-xs font-bold"
                    style={{ height: 64, border: '1px dashed var(--card-border)', color: INK_SOFT }}
                  >
                    <Plus size={20} />
                    上傳圖片檔案
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              {images.length > 0 && (
                <p className="text-[11px]" style={{ color: INK_SOFT }}>
                  已選 {images.length}/{MAX_IMAGES} 張圖片，點縮圖可預覽
                </p>
              )}

              {status === 'error' && (
                <p className="text-xs font-bold" style={{ color: DANGER }}>
                  傳送失敗，請稍後再試
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold mt-1"
                style={{ background: ACCENT, color: '#fff', opacity: status === 'sending' ? 0.6 : 1 }}
              >
                <Send size={14} />
                {status === 'sending' ? '傳送中...' : '送出'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 圖片燈箱：點縮圖後全螢幕預覽，支援左右切換與點空白處/叉叉關閉 */}
      {previewIndex !== null && images[previewIndex] && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 260, background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPreviewIndex(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewIndex(null); }}
            className="absolute flex items-center justify-center rounded-full"
            style={{ top: 16, right: 16, width: 36, height: 36, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            <X size={18} />
          </button>

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewIndex(i => (i - 1 + images.length) % images.length); }}
              className="absolute flex items-center justify-center rounded-full"
              style={{ left: 12, width: 40, height: 40, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <img
            src={images[previewIndex].url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-[88vw] max-h-[80vh] rounded-lg object-contain"
          />

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewIndex(i => (i + 1) % images.length); }}
              className="absolute flex items-center justify-center rounded-full"
              style={{ right: 12, width: 40, height: 40, background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <ChevronRight size={20} />
            </button>
          )}

          {images.length > 1 && (
            <p
              className="absolute text-xs font-bold"
              style={{ bottom: 20, color: '#fff', opacity: 0.8 }}
            >
              {previewIndex + 1} / {images.length}
            </p>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
