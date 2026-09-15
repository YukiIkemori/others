汐見の家 サイト一式
===================

■ サーバーへの上げ方

このフォルダの中身を、さくらのレンタルサーバのドキュメントルート
（ふつうは /home/アカウント名/www/）にそのまま上げてください。

ひとつだけ作業があります。

  htaccess.txt  →  .htaccess  にリネームする

先頭にドットが付きます。FileZilla の右側（サーバー側）で
アップロード後にリネームするのが確実です。

■ 上げる順番

1. 独自SSLを有効にする（さくらのコントロールパネル）
2. このフォルダの中身を全部アップロードする
3. htaccess.txt を .htaccess にリネームする
4. 旧URLがちゃんと飛ぶか、いくつか確認する
     http://shiomihouse.com/1331/   → /stories/renovation/ido/
     http://shiomihouse.com/166/    → /stories/shiomi/
     http://shiomihouse.com/en/514/ → /stories/shiomi/1-tobei/
     http://shiomihouse.com/1187/   → /media/
5. 問題なければ .htaccess を開いて【HTTPS】の2行のコメント（#）を外す
6. サーチコンソールで sitemap.xml を送信する
7. ここまで確認できてから WordPress（/wp/）を消す

※ 5 を先にやるとサイトに繋がらなくなります。SSL が有効になってからです。
※ 7 の前に /wp/wp-content/uploads/ を手元に落としておいてください。
   消すと元画像が取れなくなります。

■ 中身

  index.html         トップ
  about/             汐見の家について
  rooms/             部屋と設備
  meals/             食事
  access/            アクセス
  reserve/           ご予約（※フォームはまだ動きません）
  stories/           読み物
  media/             メディア掲載
  thanks/            Special Thanks
  404.html           見つからないときのページ
  style.css          見た目（全ページこれ1枚）
  img/               写真
  sitemap.xml        検索エンジン向けの地図
  robots.txt         同上
  htaccess.txt       → .htaccess にリネームする

全40ページ。JavaScript は使っていません。外部から読み込むものもありません。

■ 文言を直したいとき

HTML ファイルを直接開いて、文字のところを書き換えれば直ります。
< > で囲まれた部分は触らないでください。

■ まだ終わっていないこと

・問い合わせフォームが動きません。
  reserve/index.html の上の方に「これは確認用の見本です」という
  水色の囲みがあります。フォームを動かすときに、その囲みごと消します。

・木炭蓄電器「TANDEN」の記事で、写真が1枚欠けています。
  元のサイトの時点で画像が失われていました。
