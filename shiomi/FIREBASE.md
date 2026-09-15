# 確認用サイトを Firebase Hosting に上げる

先方に URL を送って見てもらうための手順。**本番（さくら）とは別物**で、
ここに上げても shiomihouse.com には何も影響しない。

## なぜ Firebase か

GitHub Pages は `ユーザー名.github.io/others/` のようにサブフォルダ配信になる。
このサイトはリンクを `/about/` のようにルートからの絶対パスで書いているので、
サブフォルダ配信だと全部 404 になる。

Firebase Hosting は `プロジェクト名.web.app` のルート配信なので、そのまま動く。

## 検索に出ないようにしてある

確認用サイトが検索に出ると、本番と同じ内容が2つ並ぶことになる。避けるため：

- 全ページに `X-Robots-Tag: noindex, nofollow` を付けている（`firebase.json`）
- 各ページの `canonical` は `https://shiomihouse.com/...` を指したまま

この2つで、確認用サイトが検索結果に出ることはない。

## 301リダイレクトも動く

`.htaccess` に書いた301を `firebase.json` にも移してある（220本）。
つまり**本番に上げる前に、旧URLがちゃんと飛ぶかを確認用サイトで試せる**。

    https://プロジェクト名.web.app/1331/   → /stories/renovation/ido/
    https://プロジェクト名.web.app/166/    → /stories/shiomi/
    https://プロジェクト名.web.app/en/514/ → /stories/shiomi/1-tobei/

## 手順（Windows）

### 1. Firebase CLI を入れる

Node.js が入っているなら：

    npm install -g firebase-tools

入っていないなら、単体で動く exe がある。
https://firebase.google.com/docs/cli の「スタンドアロン バイナリ」から
`firebase-tools-instant-win.exe` を落として、適当なフォルダに置く。
以下のコマンドの `firebase` をその exe のパスに読み替える。

### 2. ログインする

    firebase login

ブラウザが開くので、Googleアカウントで許可する。

### 3. このフォルダへ移動する

    cd パス\to\others\shiomi

`firebase.json` と `.firebaserc` と `site` フォルダがある場所。

### 4. プロジェクトを指定する

`.firebaserc` には `shiomi-test-2d186` と書いてある。
以前に作ったプロジェクトがそのまま使えるならそのままでよい。

違うプロジェクトを使う、または新しく作る場合：

    firebase projects:list        （持っているプロジェクトを見る）
    firebase use --add            （使うものを選ぶ）

新規に作るなら https://console.firebase.google.com/ で作ってから上のコマンド。

### 5. 上げる

    firebase deploy --only hosting

終わると URL が出る。それを先方に送る。

    Hosting URL: https://shiomi-test-2d186.web.app

### 6. 直したら上げ直す

同じコマンドをもう一度打つだけ。URL は変わらない。

    firebase deploy --only hosting

## 毎回コマンドを打つのが面倒なら

GitHub に push したら自動で上がるようにもできる。

    firebase init hosting:github

ブラウザが開いて、GitHubリポジトリを選ぶと、必要な鍵の設定まで自動でやってくれる。
ただし今回のように更新が年に数回なら、手で `firebase deploy` を打つ方が
覚えることが少なくて楽だと思う。

## 確認が終わったら

Firebase のプロジェクトは消してよい。本番には何の関係もない。

    firebase hosting:disable      （公開だけ止める）

または Firebase コンソールからプロジェクトごと削除する。

## 注意

- **認証情報をチャットに貼らない。** `firebase login` はブラウザで完結する
- 確認用サイトの URL は、先方以外に広めない
- 本番（さくら）に上げるときは `site/README-納品.txt` の手順を見ること。
  `firebase.json` はさくらでは使わない（あちらは `.htaccess`）
