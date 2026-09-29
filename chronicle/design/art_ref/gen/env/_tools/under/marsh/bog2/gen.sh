#!/bin/sh
# one generation (one job file) through ../../../gen_env.py; the .gen.json keeps the prompt but not the account's model name
# usage: sh gen.sh <id>/<name>.job.json
set -e
. /tmp/claude-0/secrets/openai.env
export OPENAI_API_KEY OPENAI_MODEL
GEN_PAR=1 python3 ../../../gen_env.py "$1"
python3 - "$1" <<'PY'
import json, sys
j = json.load(open(sys.argv[1])); g = j['out'][:-4] + '.gen.json'
try:
    m = json.load(open(g)); m['model'] = 'generated'; json.dump(m, open(g, 'w'), ensure_ascii=False, indent=1)
except FileNotFoundError:
    pass
PY
