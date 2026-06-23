/**
 * Dictionary 路由 —— 术语词典查询
 */
import { Router } from 'express';
import memoryStore from '../services/store.js';
import INLINE_DICTIONARY from '../data/dictionary.js';

let dictionaryLoaded = false;
function ensureLoaded() {
  if (!dictionaryLoaded && INLINE_DICTIONARY && memoryStore.dictionary.length === 0) {
    memoryStore.dictionary = INLINE_DICTIONARY;
    dictionaryLoaded = true;
  }
}

const router = Router();

// GET /dictionary
router.get('/', (req, res, next) => {
  try {
    ensureLoaded();
    res.json(memoryStore.dictionary || []);
  } catch (e) { next(e); }
});

export default router;
