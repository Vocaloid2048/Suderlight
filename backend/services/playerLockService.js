const locks = new Map();

async function withPlayerLock(playerId, task) {
  const key = String(playerId || 'global');
  const previous = locks.get(key) || Promise.resolve();

  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });

  locks.set(key, previous.then(() => current));

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (locks.get(key) === current) {
      locks.delete(key);
    }
  }
}

module.exports = {
  withPlayerLock,
};