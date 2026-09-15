<?php
/**
 * 汐見の家 お問い合わせフォームの受け取り口。
 *
 * さくらのレンタルサーバの PHP で動きます。ライブラリは使いません。
 * 置き場所: /reserve/send.php （フォームと同じ階層）
 *
 * ■ 公開前に必ず直すところ
 *   FROM_ADDR … 「差出人」に使うアドレス。
 *               shiomihouse.com のサーバーから送るので、
 *               *shiomihouse.com のアドレス* にしてください。
 *               gmail.com のアドレスを差出人にすると、
 *               なりすまし扱いで届かないことがあります。
 *               （さくらのコントロールパネルでメールアドレスを1つ作り、
 *                 そのアドレスをここに書く）
 *   TO_ADDR   … 受け取り先。いまは Gmail 宛。
 */
declare(strict_types=1);

const TO_ADDR    = 'shiomihouse@gmail.com';
const FROM_ADDR  = 'no-reply@shiomihouse.com';   // ← 公開前に実在するアドレスへ
const FROM_NAME  = '古民家ゲストハウス 汐見の家';
const SITE_HOST  = 'shiomihouse.com';
const LOG_DIR    = __DIR__ . '/../../shiomi-form-log';  // 公開ディレクトリの外

mb_internal_encoding('UTF-8');

$FIELDS = [
    ['name', 'お名前', true],
    ['email', 'メールアドレス', true],
    ['tel', '電話番号', true],
    ['checkin', 'チェックイン日', true],
    ['checkout', 'チェックアウト日', true],
    ['adults', '大人', false],
    ['kids', '小学生', false],
    ['infants', '未就学児', false],
    ['roomtype', 'お部屋の使い方', false],
    ['dinner', '夕飯', false],
    ['breakfast', '朝飯', false],
    ['goemon', '五右衛門風呂', false],
    ['message', 'ご質問・ご要望', false],
];


/** ヘッダに改行を混ぜられないようにする（メールヘッダ・インジェクション対策） */
function one_line(string $s): string
{
    return trim(preg_replace('/[\r\n\t]+/u', ' ', $s));
}

function clean(string $s): string
{
    $s = str_replace("\r\n", "\n", $s);
    $s = str_replace("\r", "\n", $s);
    // 制御文字は改行とタブ以外を落とす
    return trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s));
}

function shell_page(string $title, string $lead, string $body): string
{
    $tpl = <<<'HTML'
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>__TITLE__｜汐見の家</title>
<meta name="description" content="__LEAD__">
<link rel="canonical" href="https://shiomihouse.com/reserve/">
<meta name="theme-color" content="#fbfaf7">
<link rel="stylesheet" href="/style.css">
<meta name="robots" content="noindex">
</head>
<body>

<a class="reserve-float" href="/reserve/">ご予約</a>

<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="/"><img src="/img/logo.svg" alt="" width="111" height="132"><span class="brand__name"><span class="brand__sub">古民家ゲストハウス</span>汐見の家</span></a>
    <nav class="site-nav" aria-label="メインメニュー">
      <ul>
        <li><a href="/about/">汐見の家について</a></li>
        <li><a href="/rooms/">部屋と設備</a></li>
        <li><a href="/meals/">食事</a></li>
        <li><a href="/access/">アクセス</a></li>
        <li><a href="/stories/">読み物</a></li>
        <li class="nav-reserve"><a href="/reserve/" aria-current="page">ご予約</a></li>
      </ul>
    </nav>
  </div>
</header>

<main>

  <div class="container">
    <div class="page-head">
      <h1>__TITLE__</h1>
      <p>__LEAD__</p>
    </div>
  </div>

  <section class="band">
    <div class="container--text">
__BODY__
    </div>
  </section>

</main>

<footer class="site-footer">
  <div class="container site-footer__inner">
    <div>
      <a class="brand" href="/"><img src="/img/logo-white.svg" alt="" width="111" height="132"><span class="brand__name"><span class="brand__sub">古民家ゲストハウス</span>汐見の家</span></a>
      <p><strong>古民家ゲストハウス 汐見の家</strong><br>〒794-2520 愛媛県越智郡上島町弓削佐島299<br>TEL <a class="nowrap" href="tel:0897729800">0897-72-9800</a><br><a class="nowrap" href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></p>
      <p class="site-footer__note">長く空き家だったため、地図に番地が出ないことがあります。その場合は「古民家ゲストハウス汐見の家」で検索してください。</p>
    </div>
    <nav aria-label="フッターメニュー">
      <ul>
        <li><a href="/about/">汐見の家について</a></li>
        <li><a href="/rooms/">部屋と設備</a></li>
        <li><a href="/meals/">食事</a></li>
        <li><a href="/access/">アクセス</a></li>
        <li><a href="/stories/">読み物</a></li>
        <li><a href="/media/">メディア掲載</a></li>
        <li><a href="/thanks/">Special Thanks</a></li>
        <li><a href="/reserve/">ご予約</a></li>
      </ul>
    </nav>
    <p class="site-footer__copy">© 汐見の家合同会社</p>
  </div>
</footer>

</body>
</html>
HTML;
    return str_replace(
        ['__TITLE__', '__LEAD__', '__BODY__'],
        [htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
         htmlspecialchars($lead, ENT_QUOTES, 'UTF-8'),
         $body],
        $tpl
    );
}

function finish(int $code, string $title, string $lead, string $body)
{
    http_response_code($code);
    header('Content-Type: text/html; charset=UTF-8');
    echo shell_page($title, $lead, $body);
    exit;
}

/**
 * UTF-8 のまま送る。
 * mb_send_mail は ISO-2022-JP に変換しようとして文字化けのもとになるので使わない。
 * 件名は MIME で、本文は base64 にして、そのことをヘッダで伝える。
 */
function send_utf8_mail(string $to, string $subject, string $body, string $reply_to): bool
{
    $from = mb_encode_mimeheader(FROM_NAME, 'UTF-8', 'B') . ' <' . FROM_ADDR . '>';
    $head = implode("\r\n", [
        'MIME-Version: 1.0',
        'From: ' . $from,
        'Reply-To: ' . one_line($reply_to),
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        'X-Mailer: shiomihouse-form',
    ]);
    return @mail(
        $to,
        mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n"),
        chunk_split(base64_encode($body)),
        $head,
        '-f' . FROM_ADDR
    );
}

/** 同じ相手からの連投を止める。1時間に5件まで */
function rate_limited(string $ip): bool
{
    if (!is_dir(LOG_DIR) && !@mkdir(LOG_DIR, 0700, true)) {
        return false;   // 置き場所が作れないときは素通しする（送れない方が困る）
    }
    $file = LOG_DIR . '/rate-' . hash('sha256', $ip) . '.txt';
    $now  = time();
    $hits = [];
    if (is_readable($file)) {
        foreach (explode("\n", (string)file_get_contents($file)) as $line) {
            $t = (int)trim($line);
            if ($t > $now - 3600) {
                $hits[] = $t;
            }
        }
    }
    if (count($hits) >= 5) {
        return true;
    }
    $hits[] = $now;
    @file_put_contents($file, implode("\n", $hits), LOCK_EX);
    return false;
}


// ── ここから処理 ───────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /reserve/', true, 303);
    exit;
}

// 1) 罠の欄。人が見えない欄なので、埋まっていれば機械
if (clean((string)($_POST['website'] ?? '')) !== '') {
    finish(200, 'ありがとうございました', '受け付けました。', '<p>受け付けました。</p>');
}

// 2) 連投よけ
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
if (rate_limited($ip)) {
    finish(429, '少し時間をおいてください',
        '短い間に何度も送信されました。',
        '<p>お手数ですが、しばらく経ってからもう一度お試しください。'
        . 'お急ぎのときは <a href="tel:0897729800">0897-72-9800</a> までどうぞ。</p>');
}

// 3) 入力の確認
$vals = [];
$errs = [];
foreach ($FIELDS as [$name, $label, $required]) {
    $v = clean((string)($_POST[$name] ?? ''));
    if ($required && $v === '') {
        $errs[] = "{$label}が空でした";
    }
    $vals[$name] = $v;
}

$email = one_line($vals['email']);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errs[] = 'メールアドレスの形が正しくないようです';
}

if ($vals['checkin'] !== '' && $vals['checkout'] !== ''
    && $vals['checkout'] < $vals['checkin']) {
    $errs[] = 'チェックアウト日がチェックイン日より前になっています';
}

// 本文にリンクが多いものは広告とみなす
if (preg_match_all('#https?://#i', $vals['message']) >= 3) {
    $errs[] = 'ご質問・ご要望に URL が多く含まれています';
}

if ($errs) {
    $list = '<ul>';
    foreach ($errs as $e) {
        $list .= '<li>' . htmlspecialchars($e, ENT_QUOTES, 'UTF-8') . '</li>';
    }
    $list .= '</ul>';
    finish(400, '送信できませんでした', '入力をご確認ください。',
        str_replace('<!--ERRORS-->', $list, <<<'HTML'
      <div class="note note--important">
        <p>入力に足りないところがありました。<strong>ブラウザの「戻る」</strong>で前の画面に戻ると、書いた内容はそのまま残っています。</p>
      </div>
      <!--ERRORS-->
      <p>うまくいかないときは、お電話でも承ります。</p>
      <p><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>
HTML));
}

// 4) メールを組み立てる
$lines = [];
foreach ($FIELDS as [$name, $label, $required]) {
    $v = $vals[$name];
    if ($v === '' && !$required) {
        $v = '（なし）';
    }
    if ($name === 'message') {
        $lines[] = "{$label}:";
        $lines[] = $v;
    } else {
        $lines[] = "{$label}: {$v}";
    }
}

$name_h  = one_line($vals['name']);
$subject = "【汐見の家】ご予約・お問い合わせ（{$name_h}様）";

$body = "汐見の家のサイトから、お問い合わせが届きました。\n\n"
      . "----------------------------------------\n"
      . implode("\n", $lines) . "\n"
      . "----------------------------------------\n\n"
      . "受付日時: " . date('Y-m-d H:i:s') . "\n"
      . "送信元: {$ip}\n"
      . "このメールにそのまま返信すると、お客様に届きます。\n";

$sent = send_utf8_mail(TO_ADDR, $subject, $body, $email);

if (!$sent) {
    error_log('[shiomi-form] mail() failed');
    finish(500, '送信できませんでした', 'サーバーの都合で送れませんでした。', <<<'HTML'
      <div class="note note--important">
        <p>申し訳ありません。サーバーの都合でメールを送れませんでした。お手数ですが、お電話かメールで直接ご連絡ください。</p>
      </div>
      <p><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>
      <p><a href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></p>
HTML);
}

// 5) お客様へ控えを送る（送れなくても受付は成立させる）
$reply_body = "{$name_h} 様\n\n"
    . "汐見の家です。お問い合わせを受け付けました。\n"
    . "内容を確認のうえ、24時間以内にご返信します。\n\n"
    . "※ このメールは自動送信の控えです。\n"
    . "　 ご宿泊のお申し込みは、こちらから改めてご返信したときに成立します。\n"
    . "　 この時点ではまだ確定ではありませんので、ご了承ください。\n\n"
    . "----------------------------------------\n"
    . implode("\n", $lines) . "\n"
    . "----------------------------------------\n\n"
    . "お急ぎのときは、お電話でも承ります。\n"
    . "　古民家ゲストハウス 汐見の家\n"
    . "　〒794-2520 愛媛県越智郡上島町弓削佐島299\n"
    . "　TEL 0897-72-9800\n"
    . "　https://" . SITE_HOST . "/\n";

send_utf8_mail($email, '【汐見の家】お問い合わせを受け付けました', $reply_body, TO_ADDR);

// 6) 読み込み直しで二重送信にならないよう、別の住所へ送る
header('Location: /reserve/done/', true, 303);
exit;
