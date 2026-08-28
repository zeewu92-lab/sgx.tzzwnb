import { ACCENT } from '../../constants/colors.js';

export function renderInlineBold(line, keyPrefix) {
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

export function MarkdownBody({ text, color, colorSoft }) {
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
