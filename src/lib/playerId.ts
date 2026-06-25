/**
 * 球员身份管理 —— 每个球员唯一 ID，用于跨设备存档同步
 *
 * 生成规则：
 * - 首次访问：自动生成 8 位字母数字 ID
 * - 储存于 localStorage，每次加载时读取
 * - 请求后端时自动附加签名头
 */

const PLAYER_ID_KEY = 'glimmer_city_player_id_v1';
const SIGNATURE_SECRET =
  import.meta.env.VITE_PLAYER_SIGNATURE_SECRET ||
  import.meta.env.VITE_SIGNATURE_SECRET ||
  'i-dont-have-enough-credit-to-make-this-game';

function generateId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符 0/O/1/I
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSHA256Hex(payload: string, secret: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return '';
  }

  const encoder = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await window.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(signature);
}

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';

  let id = window.localStorage.getItem(PLAYER_ID_KEY);
  if (!id || id.length < 4) {
    id = generateId();
    window.localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function setPlayerId(id: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    return false;
  }
  window.localStorage.setItem(PLAYER_ID_KEY, id);
  return true;
}

export function getPlayerIdHeader(): Record<string, string> {
  const id = getPlayerId();
  return id ? { 'X-Player-Id': id } : {};
}

export async function getPlayerAuthHeaders(playerIdOverride?: string): Promise<Record<string, string>> {
  const playerId = playerIdOverride || getPlayerId();
  if (!playerId) return {};

  const timestamp = Date.now().toString();
  const payload = `${playerId}.${timestamp}`;
  const signature = await hmacSHA256Hex(payload, SIGNATURE_SECRET);

  return {
    'X-Player-Id': playerId,
    'X-Timestamp': timestamp,
    'X-Player-Signature': signature,
  };
}
