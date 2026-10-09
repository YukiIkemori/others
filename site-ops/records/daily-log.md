# 日次チェック記録

- 2026-10-05 07:48 JST: 異常なし。3サイトのsitemap抽出URL(各約35〜65件)・robotsすべて200。GSC: mononippon 10/02=731表示(増加傾向)、monometri 10/02=17表示(初回)、sukinobi=0(データ待ち)。Actions: monometri/sukinobiは最新成功。mononippon最新は別セッション(AsiaVela)のvietnam翻訳デプロイ成功。
- 2026-10-06 07:48 JST: 異常なし。3サイトのsitemap抽出URL・robots すべて200。GSC(10/03): mononippon 766表示/8クリック(増加傾向)、monometri 91表示/1クリック(初クリック)、sukinobi 1表示(初表示)。Actions: monometri/sukinobiに失敗なし。mononipponは別案件(AsiaVela)のデプロイのみ成功。
- 2026-10-07 07:48 JST: 異常なし。3サイトのsitemap抽出URL・robots すべて200。GSC(10/04): mononippon 720表示/14クリック、monometri 124表示/5クリック、sukinobi 6表示/0。Actions失敗なし。注意: 10/6に3リポジトリへ運営者(私以外)がSEO修復コミット(記事画像・出版社ロゴ・旧クエリURLのリダイレクト診断)を適用済み → 今週の週次(10/12)で内容を確認し、14日ルールの対象に加える。
- 2026-10-08 07:48 JST: 異常なし。3サイトのsitemap抽出URL・robots すべて200。GSC最新確定日は10/04(約3日遅れ): mononippon 720/14、monometri 124/5、sukinobi 6/0。Actions失敗なし(新規の変更は別案件AsiaVelaのみ)。10/6のSEO修復はユーザー指示の別AIによるもの(確認済み)。
- 2026-10-09 07:48 JST: 異常なし(5サイト)。sitemap抽出URL・robotsすべて200(monometri 676 / sukinobi 33 / mononippon 931 / asiavela 14,476 / okurinochizu 43)。GSC(最新確定10/06): mononippon 692/6、monometri 90/2、sukinobi 5/0、asiavela 1,118/8(増加継続)、okurinochizu データ待ち(サイトマップ送信済み10/9)。Actions失敗なし。sukinobiはユーザー側の別AIによるレイアウト調整コミットが10/8に入っている(デプロイ成功)。okurinochizuはActions実行履歴なし(別経路でデプロイ)。
- 2026-10-10 07:48 JST: 【要注意あり】URL死活は抽出分すべて200だが、**別AI(ChatGPT)による大規模な構造変更が10/9に入った**。
  - monometri: 575記事→104記事に統合(95カテゴリ)。旧URLは301。サイトマップ 676→109件。
  - asiavela: サイトマップ 14,476→5,731件(382件×15言語)。**Japan配下のページがサイトマップから消え、検索表示のあった上位300ページの181ページ(表示の約58%)が404**(例: /en/japan/japan-temple-stays/、/nl/japan/best-time-japan/)。STATUS.mdでは『一部を除き noindex』方針。10/9 17:31「Restore Thailand and preserve hidden Taiwan URLs」。意図的か要確認。301なしの404はリスク。
  - mononippon: 「five-language editorial revision, 858 live articles」を10/9に公開(別AI)。
  - sukinobi/okurinochizu: 引き続き別AIが調整中。
  - GSCは10/6まで確定(3日遅れ)で、10/9の変更の影響はまだ数字に出ていない。GA4: asiavela 47セッション/3日、okurinochizu 33セッション/3日(データ入り始め)。
  - 対応: 私は編集しない(別AIが作業中)。ユーザーにasiavelaの404を報告。週次(10/12)は5サイトとも観測中心にするか確認。
