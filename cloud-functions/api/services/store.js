/**
 * 共享内存数据存储 —— 所有 service 通过此模块共享数据。
 * EdgeOne Cloud Functions 环境无可持久化文件系统，全部采用内存存储。
 */
const memoryStore = {
  saves: {},
  memories: {},
  npcs: {},
  clues: [],
  worldbook: { entries: [] },
  innerWorlds: {},
  dictionary: [],
};

export default memoryStore;
