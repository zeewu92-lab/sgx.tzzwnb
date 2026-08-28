import { ACCENT_CANVAS_HEX, colorHex } from '../constants/colors.js';
import { isImageDark, loadAppIconOnce, loadImageAsync } from './image.js';

export const EXPORT_W = 1080;

export const EXPORT_PAD = 64;

export const EXPORT_RADIUS = 56;

export const STORY_W = 1080;

export const STORY_H = 1920;

export function exportColors(isDark) {
  return isDark
    ? { ink: '#F2F3F6', inkSoft: 'rgba(242,243,246,0.65)', cardBg: '#1D2029', cardBorder: '#2B2F3A', pageBg: '#121419' }
    : { ink: '#232733', inkSoft: 'rgba(35,39,51,0.6)', cardBg: '#F7F8FA', cardBorder: '#ECEDF1', pageBg: '#FFFFFF' };
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawImageCover(ctx, img, x, y, w, h) {
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

export function wrapCanvasText(ctx, text, maxWidth, maxLines) {
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

export function drawPill(ctx, text, x, y, { font, textColor, bgColor, padX = 24, height = 64 }) {
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

export function drawBrandWatermark(ctx, rightX, bottomY, inkColor, appIcon) {
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

export function truncateSingleLine(ctx, text, maxWidth) {
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

export async function buildEventCardCanvas(ev, lang, t, isDark) {
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

export async function buildStoryCanvas(cardCanvas, ev, isDark) {
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

export function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

export async function exportEventCardImage(ev, lang, t, isDark, format) {
  const cardCanvas = await buildEventCardCanvas(ev, lang, t, isDark);
  const finalCanvas = format === 'story' ? await buildStoryCanvas(cardCanvas, ev, isDark) : cardCanvas;
  const blob = await canvasToBlob(finalCanvas);
  const safeTitle = (ev.title || 'event').replace(/[\\/:*?"<>|]/g, '').slice(0, 24);
  const filename = `時光線_${safeTitle}_${format === 'story' ? 'story' : 'card'}.png`;
  return { blob, filename };
}

export async function shareOrDownloadImage(blob, filename, t) {
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
