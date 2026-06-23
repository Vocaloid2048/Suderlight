/**
 * Player Lock Service —— 玩家操作互斥锁
 */
const playerLocks = {};

async function withPlayerLock(playerId, fn) {
  if (!playerLocks[playerId]) playerLocks[playerId] = Promise.resolve();
  const r = playerLocks[playerId].then(() => fn()).finally(() => {});
  playerLocks[playerId] = r.catch(() => {});
  return r;
}

export { withPlayerLock };
