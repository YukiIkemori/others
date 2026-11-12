// 単体の Cloudflare Worker として取得プロキシを動かす場合のエントリ。
// （サイト本体を GitHub Pages など Functions の無い場所に置くとき用）
//
//   1. Cloudflare ダッシュボード → Workers → 新規作成
//   2. functions/api/fetch.js の中身とこのファイルを合わせて貼る（または wrangler でデプロイ）
//   3. 環境変数 ALLOWED_ORIGINS に SEOチェッカーを置いたオリジンを設定
//      例: https://off-notes.com（これは既定で許可済み）
//   4. ツール側（off-notes-yuki-site の _drafts/seo-checker/js/config.js）の PROXY_URL に Worker の URL を書く
import { handle, handleCheck } from '../functions/api/fetch.js';

export default {
  // <Worker の URL>/check がリンク切れ確認、それ以外がページ取得
  fetch: (request, env) => (new URL(request.url).pathname.endsWith('/check') ? handleCheck(request, env) : handle(request, env)),
};
