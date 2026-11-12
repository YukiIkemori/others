// サイト運営者向けの任意設定。空のままでも動く。
export const CONFIG = {
  // Google PageSpeed Insights の API キー（無料・1日25,000回）。
  // Google Cloud Console で「HTTP リファラー制限」を自サイトのドメインに掛けたキーを入れる。
  // 上限を超えてもエラーになるだけで課金はされない。空の場合は共有枠（混雑しやすい）を使う。
  PSI_API_KEY: '',

  // 独自の取得プロキシ（worker/worker.js を Cloudflare Workers に置いた場合の URL）。
  // Cloudflare Pages にこのフォルダごとデプロイした場合は /api/fetch が自動で使われるので不要。
  PROXY_URL: '',
};
