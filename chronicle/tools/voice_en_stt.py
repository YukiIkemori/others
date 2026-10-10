#!/usr/bin/env python3
"""Offline content check of the dubbed voice files (no API, nothing paid): an open-source speech recognizer
(faster-whisper, downloaded once into $HF_HOME: base.en ~145 MB for English, the multilingual small ~480 MB for Mandarin and
Korean) transcribes assets/voice/<lang>/<id>.ogg and compares the words with <lang>_text of design/voice/<lang>_lines.csv.

  HF_HOME=<cache dir> python3 tools/voice_en_stt.py --ids-file design/voice/voice_scope.txt [--lang en|zh|ko] [--retry-out <file>]

Writes per id `stt: {heard, similarity, repeated, short, blocks}` into design/voice/<lang>_report.json. Report-only, except
the objective patterns that mean "the take is far off the text" (the cost rule's local check): `repeated` = the actor
said the line, or a phrase of it, twice (>= 4 words in the line, and either the whole line twice with >= 1.6x the words,
or a run of >= 3 of the line's words said twice back to back with >= 1.25x the words), and (zh / ko only) `wrong` = under 35 %
of the text recognized although the line is >= 6 characters (the actor said something else, or read the notes aloud). Those ids go
to --retry-out (for tools/voice_tts.js --lang <lang> --ids-file <file> --force; the tool still allows at most 2 audio
requests per id). `short` (under half of the words heard in one single block of speech: maybe cut off) is only flagged.
Shouts and the recognizer's spelling (names, interjections) are not judged.
Mandarin / Korean: the "words" are characters (hanzi after Traditional -> Simplified by OpenCC; hangul syllables), spaces and
punctuation do not count; a recognizer is less exact there than for English, so `similarity` is a rough guide.
"""
import argparse
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


_T2S = None


def words(s, lang='en'):
    if lang == 'zh':
        global _T2S
        if _T2S is None:
            import opencc
            _T2S = opencc.OpenCC('t2s')
        return list(re.sub(r'[^\u4e00-\u9fff0-9]', '', _T2S.convert(s)))
    if lang == 'ko':
        return list(re.sub(r'[^가-힣0-9]', '', s))
    return re.findall(r"[a-z0-9']+", s.lower().replace('-', ' ').replace('—', ' '))


def lev(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i]
        for j in range(1, len(b) + 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1])))
        prev = cur
    return prev[-1]


def sim(a, b):
    return 1 - lev(a, b) / max(1, len(a), len(b))


def repeats(a, b):
    """how many separate windows of the transcript b say the line a (similarity >= 0.75)"""
    n, i, hits = len(a), 0, 0
    while i + max(1, n - 1) <= len(b):
        w = b[i:i + n]
        if sim(a, w) >= 0.75:
            hits += 1
            i += n
        else:
            i += 1
    return hits


def phrase_repeat(a, b, nmin=3, sep=' '):
    """a run of >= nmin words (characters: 4) of the line a said twice back to back in the transcript b"""
    line = sep.join(a)
    for n in range(nmin, len(a) + 1):
        for i in range(len(b) - 2 * n + 1):
            if b[i:i + n] == b[i + n:i + 2 * n] and sep.join(b[i:i + n]) in line:
                return True
    return False


def blocks(samples, rate):
    """speech blocks: 100 ms frames above -40 dB of the peak frame, separated by >= 300 ms of quiet"""
    import numpy as np
    fr = int(rate * 0.1)
    if len(samples) < fr:
        return 1
    x = samples[: len(samples) // fr * fr].reshape(-1, fr)
    db = 10 * np.log10((x ** 2).mean(axis=1) + 1e-12)
    on = db > db.max() - 40
    n, quiet, inside = 0, 0, False
    for v in on:
        if v:
            if not inside:
                n += 1
            inside, quiet = True, 0
        else:
            quiet += 1
            if quiet >= 3:
                inside = False
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids-file', required=True)
    ap.add_argument('--lang', default='en', choices=['en', 'zh', 'ko'])
    ap.add_argument('--report')
    ap.add_argument('--retry-out')
    ap.add_argument('--model')
    a = ap.parse_args()
    lang = a.lang
    a.report = a.report or os.path.join(ROOT, 'design', 'voice', lang + '_report.json')
    a.model = a.model or ('base.en' if lang == 'en' else 'small')
    from faster_whisper import WhisperModel, decode_audio
    rows = {r['id']: r for r in csv.DictReader(open(os.path.join(ROOT, 'design', 'voice', lang + '_lines.csv'), encoding='utf-8'))}
    ids = [x.split('#')[0].strip() for x in open(a.ids_file, encoding='utf-8') if x.split('#')[0].strip()]
    rep = json.load(open(a.report, encoding='utf-8')) if os.path.exists(a.report) else {}
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
    retry, short, done = [], [], 0
    cjk = lang != 'en'
    col = lang + '_text'
    for i in ids:
        f = os.path.join(ROOT, 'assets', 'voice', lang, i + '.ogg')
        if not os.path.exists(f) or i not in rows or not rows[i].get(col):
            continue
        audio = decode_audio(f, sampling_rate=16000)
        segs, _ = model.transcribe(audio, beam_size=5, language=lang, vad_filter=False)
        heard = (''.join if cjk else ' '.join)(s.text.strip() for s in segs).strip()
        t, h = words(rows[i][col], lang), words(heard, lang)
        nb = blocks(audio, 16000)
        rec = {'heard': heard, 'similarity': round(sim(t, h), 2), 'blocks': nb, 'repeated': False, 'short': False}
        nmin, sep, floor = (4, '', 5) if cjk else (3, ' ', 3)
        if len(t) >= floor + 1 and ((len(h) >= 1.6 * len(t) and repeats(t, h) >= 2) or (len(h) >= 1.25 * len(t) and phrase_repeat(t, h, nmin, sep))):
            rec['repeated'] = True
            retry.append(i)
        if len(t) >= floor + 1 and len(h) < 0.5 * len(t) and nb <= 1:
            rec['short'] = True
            short.append(i)
        if cjk and len(t) >= 6 and rec['similarity'] < 0.35 and not rec['repeated']:
            rec['wrong'] = True
            retry.append(i)
        rep.setdefault(i, {'id': i})['stt'] = rec
        done += 1
        flag = ' REPEATED' if rec['repeated'] else ' WRONG' if rec.get('wrong') else ' short?' if rec['short'] else ''
        print(f"{i:28} {rec['similarity']:.2f}{flag}  {heard[:90]}", flush=True)
    json.dump(rep, open(a.report, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    open(a.report, 'a', encoding='utf-8').write('\n')
    if a.retry_out:
        open(a.retry_out, 'w', encoding='utf-8').write(''.join(x + '\n' for x in retry))
    print(f'[voice_en_stt {lang}] {done} files transcribed, {len(retry)} to retry (said twice / wrong text): {" ".join(retry)}; {len(short)} maybe cut off: {" ".join(short)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
