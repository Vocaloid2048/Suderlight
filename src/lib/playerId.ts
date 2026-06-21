/**
 * 球员身份管理 —— 每个球员唯一 ID，用于跨设备存档同步
 *
 * 生成规则：
 * - 首次访问：自动生成 8 位字母数字 ID
 * - 储存于 localStorage，每次加载时读取
 * - 发送到后端时放在 X-Player-Id 头中
 * - 用户可在 UI 中查看/复制自己的 ID，在另一台设备输入后恢复存档
 */

const PLAYER_ID_KEY = 'glimmer_city_player_id_v1';

function generateId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符 0/O/1/I
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
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
