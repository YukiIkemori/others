# SEOチェッカー

URL を入れると約70項目を診断し、100点満点のスコアと優先度順の改善点を出す静的サイトです。
ビルド不要・依存ライブラリなし。診断はすべて利用者のブラウザ内で実行されます。

## ランニングコスト

**0円**です。有料 API は一切使っておらず、どれだけ使われても請求は発生しません。

| 用途 | 使うもの | 費用 |
|---|---|---|
| サイト配信 | Cloudflare Pages（静的ファイル） | 無料・転送量無制限 |
| 診断対象ページの取得 | 同梱の Pages Function `functions/api/fetch.js` | 無料枠 1日10万リクエスト。超えるとその日はエラーになるだけで課金されない |
| 表示速度の計測 | Google PageSpeed Insights API（利用者のブラウザから直接） | 無料 |
| DNS 確認 | Google Public DNS（DoH） | 無料 |

1回の診断で Function を呼ぶのは 3〜5 回なので、1日およそ2万〜3万診断まで無料枠に収まります。

## デプロイ（Cloudflare Pages 推奨）

1. Cloudflare ダッシュボード → Workers & Pages → Pages → Git リポジトリを接続
2. ビルドコマンド: なし ／ 出力ディレクトリ: `seo-checker`（ルートディレクトリを `seo-checker` にしても可）
3. デプロイ完了。`/api/fetch` が自動で有効になり、追加設定は不要

### GitHub Pages など Functions の無い場所に置く場合

静的ファイルだけでも動きますが、ページ取得が無料の公開 CORS プロキシ頼みになり、**取得に失敗することが珍しくありません**
（公開プロキシは頻繁に落ちたり制限されたりします）。安定させるには `worker/worker.js` を Cloudflare Workers（無料）に置き、
環境変数 `ALLOWED_ORIGINS` にサイトのオリジンを設定し、`js/config.js` の `PROXY_URL` に Worker の URL を書いてください。

## 速度計測を安定させる（任意・無料）

PageSpeed Insights API はキー無しだと全世界共有の枠を使うため、混雑時は 429 エラーで計測できません。
[Google Cloud Console](https://developers.google.com/speed/docs/insights/v5/get-started?hl=ja) で API キーを無料発行し、
**HTTP リファラー制限を自サイトのドメインに掛けたうえで** `js/config.js` の `PSI_API_KEY` に入れてください（1日25,000回まで無料、超過しても課金なし）。
利用者が自分のキーを画面の「設定」に入れることもできます。

## 取得経路と診断できる範囲

| 取得経路 | HTML 診断 | ヘッダー・ステータス・リダイレクト |
|---|---|---|
| 同梱 Function / 独自 Worker | ○ | ○ |
| 直接取得（相手が CORS 許可している場合）・公開プロキシ | ○ | ×（「対象外」と表示。HTTP ステータスは速度計測から補完） |
| HTML 貼り付け | ○ | × |

HTML を取得できなかった場合は総合点を出さず、robots.txt・DNS・速度など取得できた項目だけを表示します。

## 制限事項

- JavaScript で描画されるページ（SPA）は初期 HTML だけを見ます（本文が空の場合はその旨を指摘します）
- リンク切れの巡回チェック、被リンク、検索順位、サイト全体のクロールは対象外です（単一ページ診断）
- スコアは一般的なベストプラクティスに基づく目安で、検索順位を保証するものではありません

## 構成

```
index.html / style.css      画面
js/app.js                   実行制御と描画
js/analyze.js               診断ロジックと採点（副作用なし）
js/fetcher.js               ページ取得・DNS・PageSpeed 呼び出し
js/config.js                運営者向けの任意設定
functions/api/fetch.js      取得プロキシ（Cloudflare Pages Function）
worker/worker.js            同じプロキシを単体 Worker として使う場合のエントリ
```

ローカル確認: `python3 -m http.server -d seo-checker 8000`（この場合は公開プロキシ経由になります）
