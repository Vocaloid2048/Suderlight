/**
 * EdgeOne Pages Cloud Functions 入口
 * 直接导出 Express app，由 EdgeOne 自动部署。
 */
import createApp from './app.js';

const app = createApp();

export default app;
