#!/usr/bin/env python3
"""ご予約・お問い合わせのページと、その送信処理（PHP）を書き出す。

フォームの項目をここで一度だけ決めて、
表示するHTMLと、受け取るPHPの両方をここから作る。
片方だけ直して食い違う、という事故を避けるため。
"""
import os, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bp", os.path.join(HERE, "build-pages.py"))
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)

UP = "../"

# (name, 見出し, 必須か) — メールの本文もこの順で並ぶ
FIELDS = [
    ("name",      "お名前",           True),
    ("email",     "メールアドレス",   True),
    ("tel",       "電話番号",         True),
    ("checkin",   "チェックイン日",   True),
    ("checkout",  "チェックアウト日", True),
    ("adults",    "大人",             False),
    ("kids",      "小学生",           False),
    ("infants",   "未就学児",         False),
    ("roomtype",  "お部屋の使い方",   False),
    ("dinner",    "夕飯",             False),
    ("breakfast", "朝飯",             False),
    ("goemon",    "五右衛門風呂",     False),
    ("message",   "ご質問・ご要望",   False),
]

FORM = '''
      <form method="post" action="send.php" class="form">

        <div class="form-row">
          <label for="name">お名前 <span class="required">必須</span></label>
          <input type="text" id="name" name="name" autocomplete="name" required>
          <p class="form-note">代表の方お一人で結構です。ご同行の方のお名前は、当日ご記帳いただきます。</p>
        </div>

        <div class="form-row">
          <label for="email">メールアドレス <span class="required">必須</span></label>
          <input type="email" id="email" name="email" autocomplete="email" required>
        </div>

        <div class="form-row">
          <label for="tel">電話番号 <span class="required">必須</span></label>
          <input type="tel" id="tel" name="tel" autocomplete="tel" required>
          <p class="form-note">携帯電話会社のメールアドレス（docomo・au・SoftBankなど）をお使いの場合、こちらからの返信が迷惑メールとして弾かれることがあります。そのときはお電話します。</p>
        </div>

        <div class="form-row form-row--short">
          <label for="checkin">チェックイン日 <span class="required">必須</span></label>
          <input type="date" id="checkin" name="checkin" required>
        </div>

        <div class="form-row form-row--short">
          <label for="checkout">チェックアウト日 <span class="required">必須</span></label>
          <input type="date" id="checkout" name="checkout" required>
        </div>

        <fieldset class="form-row">
          <legend>人数 <span class="required">必須</span></legend>
          <div class="choice choice-count">
            <span><label for="adults">大人</label><input type="number" id="adults" name="adults" min="0" max="20" value="1" inputmode="numeric"></span>
            <span><label for="kids">小学生</label><input type="number" id="kids" name="kids" min="0" max="20" value="0" inputmode="numeric"></span>
            <span><label for="infants">未就学児</label><input type="number" id="infants" name="infants" min="0" max="20" value="0" inputmode="numeric"></span>
          </div>
          <p class="form-note">定員は7名です。超える場合もご相談ください。</p>
        </fieldset>

        <fieldset class="form-row">
          <legend>お部屋の使い方</legend>
          <div class="choice">
            <label><input type="radio" name="roomtype" value="おまかせ（グループごとの個室）" checked> おまかせ（グループごとの個室）</label>
            <label><input type="radio" name="roomtype" value="一棟貸し"> 一棟貸し（1泊 30,000円）</label>
          </div>
        </fieldset>

        <fieldset class="form-row">
          <legend>シェアごはん</legend>
          <div class="choice">
            <label><input type="checkbox" name="dinner" value="希望する"> 夕飯（1,600円）</label>
            <label><input type="checkbox" name="breakfast" value="希望する"> 朝飯（700円）</label>
          </div>
          <p class="form-note">夕飯をご希望の場合は<strong>17時までにチェックイン</strong>をお願いします。火曜と日曜の夜、貸切のときはお休みです。</p>
        </fieldset>

        <fieldset class="form-row">
          <legend>五右衛門風呂</legend>
          <div class="choice">
            <label><input type="checkbox" name="goemon" value="希望する"> 焚いてみたい</label>
          </div>
          <p class="form-note">準備に時間がかかるため、前日までのご相談をお願いしています。日によってはお受けできないこともあります。</p>
        </fieldset>

        <div class="form-row">
          <label for="message">ご質問・ご要望</label>
          <textarea id="message" name="message" rows="6"></textarea>
          <p class="form-note">到着のおおよその時刻、交通手段、アレルギー、その他ご心配なことがあればお書きください。</p>
        </div>

        <div class="hp" aria-hidden="true">
          <label for="website">この欄は空のままにしてください</label>
          <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
        </div>

        <p class="button-row"><button type="submit" class="button button--primary button--large">この内容で問い合わせる</button></p>
      </form>
'''

PRICES = '''
      <dl class="facts-strip">
        <div><dt>素泊り</dt><dd><strong class="price"><span class="price__label">1泊1名</span> <span class="nowrap"><span class="figure">5,500</span><span class="price__unit">円</span></span></strong><small>小学生は半額、乳幼児1人まで無料</small></dd></div>
        <div><dt>一棟貸し</dt><dd>1泊 <span class="nowrap"><span class="figure figure--small">30,000</span>円</span></dd></div>
        <div><dt>シェアごはん</dt><dd><span class="nowrap">夕飯 1,600円</span> ／ <span class="nowrap">朝飯 700円</span></dd></div>
        <div><dt>定員</dt><dd><span class="nowrap"><span class="figure figure--small">7</span>名</span><small>超える場合や長期滞在はご相談ください</small></dd></div>
      </dl>
'''

BEFORE = '''
      <dl class="def-list">
        <dt>お部屋</dt>
        <dd>襖で仕切られた和室に布団を敷きます。相部屋で始めた宿ですが、コロナ禍以降は原則としてグループごとの個室です。縁側の引き戸には鍵がありません。猫も出入りしています。</dd>
        <dt>チェックイン・チェックアウト</dt>
        <dd>15:00 〜 ／ 10:00 まで。夕飯をご希望の場合は17時までにお越しください。</dd>
        <dt>門限</dt>
        <dd>ありません。ただし静かな集落で、20時を過ぎると静まり返ります。夜の出入りは静かにお願いします。</dd>
        <dt>使える時間</dt>
        <dd>シャワー・ドライヤー・洗面台・キッチン・掘りごたつの間・玄関土間は 6時〜24時。洗濯乾燥機は22時までに（洗濯・乾燥 各100円）。</dd>
        <dt>五右衛門風呂</dt>
        <dd>薪で焚きます。井戸の水を引いて沸かし、上がり湯には上水を使います。準備に時間がかかるため、前日までのご相談をお願いしています。日によってはお受けできないこともあります。</dd>
        <dt>小さなお子さま</dt>
        <dd>歓迎です。そのぶん、赤ちゃんと泊まり合わせることもありますのでご了承ください。五右衛門風呂の焚き口や井戸、段差の大きい縁側など、古民家には思いがけないリスクがありますので、お心づもりをお願いします。</dd>
      </dl>
'''


def page():
    return [
        bp.head("ご予約・お問い合わせ｜汐見の家 - 瀬戸内・佐島の古民家ゲストハウス",
                "汐見の家のご予約とお問い合わせ。素泊り1泊5,500円、一棟貸し1泊30,000円、定員7名。"
                "フォームまたはお電話（0897-72-9800）で承ります。24時間以内にご返信します。",
                "/reserve/", UP),
        bp.header("/reserve/", UP),
        bp.breadcrumb([("ご予約・お問い合わせ", None)]),
        bp.page_head("ご予約・お問い合わせ",
                     'フォームか、お電話（<a href="tel:0897729800">0897-72-9800</a>）で承ります。'
                     '24時間以内にご返信します。'),
        f'''
  <section class="band" aria-labelledby="price-h">
    <div class="container">
      <div class="band__head"><h2 id="price-h">料金</h2></div>
{PRICES}
    </div>
  </section>

  <section class="band" aria-labelledby="form-h">
    <div class="container">
{bp.side('<span id="form-h">フォームから</span>', f"""        <p class="lead">ご宿泊のお申し込みは、いただいた内容を確認して<strong>こちらから返信したときに成立</strong>します。この時点ではまだ確定ではありませんので、ご了承ください。</p>
{FORM}""")}
    </div>
  </section>

  <section class="band band--deep" aria-labelledby="tel-h">
    <div class="container">
{bp.side('<span id="tel-h">お電話でも</span>', """        <div class="prose">
          <p>フォームが使いにくいときは、お電話ください。</p>
          <p><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>
          <p>島の宿ですので、出られないことがあります。その場合は改めておかけ直しいただくか、フォームをお使いください。</p>
        </div>""")}
    </div>
  </section>

  <section class="band" aria-labelledby="before-h">
    <div class="container">
{bp.side('<span id="before-h">ご予約の前に</span>', f"""        <div class="prose">
{BEFORE}
          <p class="button-row"><a class="button" href="/faq/">よくあるご質問</a><a class="button" href="/rooms/">部屋と設備をもっと見る</a><a class="button" href="/access/">行き方を調べる</a></p>
        </div>""")}
    </div>
  </section>
''',
        bp.footer(UP),
    ]


def result_page(title, lead, body):
    """送信のあとに出す画面。

    /reserve/done/ からも /reserve/send.php からも同じものを出すので、
    画像とCSSの在り処はサイトの根から書く（階層の深さに左右されないように）。
    """
    root = "/"
    return "".join([
        bp.head(f"{title}｜汐見の家", lead, "/reserve/", root).replace(
            "</head>", '<meta name="robots" content="noindex">\n</head>'),
        bp.header("/reserve/", root),
        bp.page_head(title, lead),
        f'''
  <section class="band">
    <div class="container--text">
{body}
    </div>
  </section>
''',
        bp.footer(root),
    ])


DONE_BODY = '''      <p>お問い合わせを受け付けました。控えのメールをお送りしています。届いていないときは、迷惑メールの箱もご確認ください。</p>
      <p>24時間以内にご返信します。それを過ぎても届かないときは、行き違いの可能性がありますので、お手数ですがお電話ください。</p>
      <p><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>
      <p class="button-row"><a class="button" href="/">トップへ戻る</a><a class="button" href="/access/">行き方を見ておく</a></p>'''

ERROR_BODY = '''      <div class="note note--important">
        <p>入力に足りないところがありました。<strong>ブラウザの「戻る」</strong>で前の画面に戻ると、書いた内容はそのまま残っています。</p>
      </div>
      <!--ERRORS-->
      <p>うまくいかないときは、お電話でも承ります。</p>
      <p><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>'''

FAIL_BODY = '''      <div class="note note--important">
        <p>申し訳ありません。サーバーの都合でメールを送れませんでした。お手数ですが、お電話かメールで直接ご連絡ください。</p>
      </div>
      <p><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>
      <p><a href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></p>'''

PREVIEW_BODY = '''      <div class="note note--important">
        <p>ここは確認用のサイトです。<strong>送信はされません。</strong>本番のサーバー（さくらのレンタルサーバ）に置くと、そのまま動きます。</p>
      </div>
      <p class="button-row"><a class="button" href="/reserve/">フォームに戻る</a></p>'''


def php():
    rows = "\n".join(
        f"    ['{n}', '{lab}', {'true' if req else 'false'}]," for n, lab, req in FIELDS)
    return f'''<?php
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


mb_internal_encoding('UTF-8');

$FIELDS = [
{rows}
];


/** ヘッダに改行を混ぜられないようにする（メールヘッダ・インジェクション対策） */
function one_line(string $s): string
{{
    return trim(preg_replace('/[\\r\\n\\t]+/u', ' ', $s));
}}

function clean(string $s): string
{{
    $s = str_replace("\\r\\n", "\\n", $s);
    $s = str_replace("\\r", "\\n", $s);
    // 制御文字は改行とタブ以外を落とす
    return trim(preg_replace('/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/u', '', $s));
}}

function shell_page(string $title, string $lead, string $body): string
{{
    $tpl = <<<'HTML'
__SHELL__
HTML;
    return str_replace(
        ['__TITLE__', '__LEAD__', '__BODY__'],
        [htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
         htmlspecialchars($lead, ENT_QUOTES, 'UTF-8'),
         $body],
        $tpl
    );
}}

function finish(int $code, string $title, string $lead, string $body)
{{
    http_response_code($code);
    header('Content-Type: text/html; charset=UTF-8');
    echo shell_page($title, $lead, $body);
    exit;
}}

/**
 * UTF-8 のまま送る。
 * mb_send_mail は ISO-2022-JP に変換しようとして文字化けのもとになるので使わない。
 * 件名は MIME で、本文は base64 にして、そのことをヘッダで伝える。
 */
function send_utf8_mail(string $to, string $subject, string $body, string $reply_to): bool
{{
    $from = mb_encode_mimeheader(FROM_NAME, 'UTF-8', 'B') . ' <' . FROM_ADDR . '>';
    $head = implode("\\r\\n", [
        'MIME-Version: 1.0',
        'From: ' . $from,
        'Reply-To: ' . one_line($reply_to),
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        'X-Mailer: shiomihouse-form',
    ]);
    return @mail(
        $to,
        mb_encode_mimeheader($subject, 'UTF-8', 'B', "\\r\\n"),
        chunk_split(base64_encode($body)),
        $head,
        '-f' . FROM_ADDR
    );
}}

/** 同じ相手からの連投を止める。1時間に5件まで */
function rate_limited(string $ip): bool
{{
    // 記録の置き場所はサーバーの一時領域。公開ディレクトリの中に置くと、
    // 置き場所によっては外から見えてしまう
    $dir = sys_get_temp_dir() . '/shiomi-form-log';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {{
        return false;   // 置き場所が作れないときは素通しする（送れない方が困る）
    }}
    $file = $dir . '/rate-' . hash('sha256', $ip) . '.txt';
    $now  = time();
    $hits = [];
    if (is_readable($file)) {{
        foreach (explode("\\n", (string)file_get_contents($file)) as $line) {{
            $t = (int)trim($line);
            if ($t > $now - 3600) {{
                $hits[] = $t;
            }}
        }}
    }}
    if (count($hits) >= 5) {{
        return true;
    }}
    $hits[] = $now;
    @file_put_contents($file, implode("\\n", $hits), LOCK_EX);
    return false;
}}


// ── ここから処理 ───────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {{
    header('Location: /reserve/', true, 303);
    exit;
}}

// 1) 罠の欄。人が見えない欄なので、埋まっていれば機械
if (clean((string)($_POST['website'] ?? '')) !== '') {{
    finish(200, 'ありがとうございました', '受け付けました。', '<p>受け付けました。</p>');
}}

// 2) 連投よけ
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
if (rate_limited($ip)) {{
    finish(429, '少し時間をおいてください',
        '短い間に何度も送信されました。',
        '<p>お手数ですが、しばらく経ってからもう一度お試しください。'
        . 'お急ぎのときは <a href="tel:0897729800">0897-72-9800</a> までどうぞ。</p>');
}}

// 3) 入力の確認
$vals = [];
$errs = [];
foreach ($FIELDS as [$name, $label, $required]) {{
    $v = clean((string)($_POST[$name] ?? ''));
    if ($required && $v === '') {{
        $errs[] = "{{$label}}が空でした";
    }}
    $vals[$name] = $v;
}}

$email = one_line($vals['email']);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {{
    $errs[] = 'メールアドレスの形が正しくないようです';
}}

if ($vals['checkin'] !== '' && $vals['checkout'] !== ''
    && $vals['checkout'] < $vals['checkin']) {{
    $errs[] = 'チェックアウト日がチェックイン日より前になっています';
}}

// 本文にリンクが多いものは広告とみなす
if (preg_match_all('#https?://#i', $vals['message']) >= 3) {{
    $errs[] = 'ご質問・ご要望に URL が多く含まれています';
}}

if ($errs) {{
    $list = '<ul>';
    foreach ($errs as $e) {{
        $list .= '<li>' . htmlspecialchars($e, ENT_QUOTES, 'UTF-8') . '</li>';
    }}
    $list .= '</ul>';
    finish(400, '送信できませんでした', '入力をご確認ください。',
        str_replace('<!--ERRORS-->', $list, <<<'HTML'
__ERROR_BODY__
HTML));
}}

// 4) メールを組み立てる
$lines = [];
foreach ($FIELDS as [$name, $label, $required]) {{
    $v = $vals[$name];
    if ($v === '' && !$required) {{
        $v = '（なし）';
    }}
    if ($name === 'message') {{
        $lines[] = "{{$label}}:";
        $lines[] = $v;
    }} else {{
        $lines[] = "{{$label}}: {{$v}}";
    }}
}}

$name_h  = one_line($vals['name']);
$subject = "【汐見の家】ご予約・お問い合わせ（{{$name_h}}様）";

$body = "汐見の家のサイトから、お問い合わせが届きました。\\n\\n"
      . "----------------------------------------\\n"
      . implode("\\n", $lines) . "\\n"
      . "----------------------------------------\\n\\n"
      . "受付日時: " . date('Y-m-d H:i:s') . "\\n"
      . "送信元: {{$ip}}\\n"
      . "このメールにそのまま返信すると、お客様に届きます。\\n";

$sent = send_utf8_mail(TO_ADDR, $subject, $body, $email);

if (!$sent) {{
    error_log('[shiomi-form] mail() failed');
    finish(500, '送信できませんでした', 'サーバーの都合で送れませんでした。', <<<'HTML'
__FAIL_BODY__
HTML);
}}

// 5) お客様へ控えを送る（送れなくても受付は成立させる）
$reply_body = "{{$name_h}} 様\\n\\n"
    . "汐見の家です。お問い合わせを受け付けました。\\n"
    . "内容を確認のうえ、24時間以内にご返信します。\\n\\n"
    . "※ このメールは自動送信の控えです。\\n"
    . "　 ご宿泊のお申し込みは、こちらから改めてご返信したときに成立します。\\n"
    . "　 この時点ではまだ確定ではありませんので、ご了承ください。\\n\\n"
    . "----------------------------------------\\n"
    . implode("\\n", $lines) . "\\n"
    . "----------------------------------------\\n\\n"
    . "お急ぎのときは、お電話でも承ります。\\n"
    . "　古民家ゲストハウス 汐見の家\\n"
    . "　〒794-2520 愛媛県越智郡上島町弓削佐島299\\n"
    . "　TEL 0897-72-9800\\n"
    . "　https://" . SITE_HOST . "/\\n";

send_utf8_mail($email, '【汐見の家】お問い合わせを受け付けました', $reply_body, TO_ADDR);

// 6) 読み込み直しで二重送信にならないよう、別の住所へ送る
header('Location: /reserve/done/', true, 303);
exit;
'''


if __name__ == "__main__":
    bp.write("reserve/index.html", page())

    bp.write("reserve/done/index.html", [result_page(
        "お問い合わせを受け付けました",
        "24時間以内にご返信します。", DONE_BODY)])
    bp.write("reserve/preview/index.html", [result_page(
        "確認用サイトでは送信されません",
        "本番のサーバーに置くと動きます。", PREVIEW_BODY)])

    shell = result_page("__TITLE__", "__LEAD__", "__BODY__")
    src = (php()
           .replace("__SHELL__", shell.rstrip("\n"))
           .replace("__ERROR_BODY__", ERROR_BODY)
           .replace("__FAIL_BODY__", FAIL_BODY))
    out = os.path.join(bp.ROOT, "reserve/send.php")
    with open(out, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"  書き出し: reserve/send.php  {os.path.getsize(out)//1024}KB")
