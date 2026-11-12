// Cloudflare Pages Function: POST /api/check — リンク切れ確認（実装は fetch.js）
import { handleCheck } from './fetch.js';

export const onRequest = (context) => handleCheck(context.request, context.env);
