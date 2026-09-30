#!/bin/sh
# 一枚ずつ順に描く（候補をまとめて作らない）。usage: sh queue.sh <job> ...
cd "$(dirname "$0")"
for j in "$@"; do
  sh gen.sh "$j" > "${j%.job.json}.log" 2>&1
  echo "done $j $(tail -1 ${j%.job.json}.log)"
done
