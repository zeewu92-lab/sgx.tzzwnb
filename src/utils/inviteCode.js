const INVITE_KEY = 'beta-access-granted-v1';

const VALID_INVITE_HASHES = [
  // 每個邀請碼的 SHA-256 雜湊值各佔一行
];

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(
    text.trim().toUpperCase()
  );

  const buf = await crypto.subtle.digest('SHA-256', enc);

  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 統一介面，之後改用 Cloudflare Worker 時只需替換內部實作
export async function verifyInviteCode(code) {
  if (!code || !code.trim()) {
    return { ok: false };
  }

  const hash = await sha256Hex(code);

  return {
    ok: VALID_INVITE_HASHES.includes(hash),
  };

  // Phase 2：Cloudflare Worker
  // const res = await fetch('https://your-worker.example.workers.dev/redeem', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ code: code.trim() }),
  // });
  // if (!res.ok) return { ok: false };
  // const data = await res.json();
  // return { ok: !!data.ok, token: data.token };
}
