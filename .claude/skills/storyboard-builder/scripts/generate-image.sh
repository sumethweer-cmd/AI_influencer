#!/usr/bin/env bash
# generate-image.sh — call the OpenAI or Gemini image-generation API for one storyboard scene.
# Usage:
#   generate-image.sh --provider openai --prompt "<scene description>" --out intake/<slug>/storyboard/scene-01.png
#   generate-image.sh --provider gemini --prompt "<scene description>" --out intake/<slug>/storyboard/scene-01.png
#
# Reads the API key from the environment ($OPENAI_API_KEY or $GEMINI_API_KEY) — never pass a key on the
# command line (it would end up in shell history and process listings).
set -euo pipefail

PROVIDER="" PROMPT="" OUT=""
while [ $# -gt 0 ]; do case "$1" in
  --provider) PROVIDER="$2"; shift 2;;
  --prompt) PROMPT="$2"; shift 2;;
  --out) OUT="$2"; shift 2;;
  *) echo "unknown arg: $1" >&2; exit 1;;
esac; done

[ -n "$PROVIDER" ] || { echo "missing --provider openai|gemini"; exit 1; }
[ -n "$PROMPT" ] || { echo "missing --prompt \"<scene description>\""; exit 1; }
[ -n "$OUT" ] || { echo "missing --out <path/to/scene-NN.png>"; exit 1; }

command -v curl >/dev/null 2>&1 || { echo "curl not found — run scripts/doctor.sh"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq not found — run scripts/doctor.sh"; exit 1; }

mkdir -p "$(dirname "$OUT")"
TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

case "$PROVIDER" in

openai)
  [ -n "${OPENAI_API_KEY:-}" ] || { echo "OPENAI_API_KEY is not set — export it in your shell first"; exit 1; }
  echo "→ requesting image from OpenAI (gpt-image-1)…"
  HTTP_STATUS=$(curl -sS -o "$TMP_JSON" -w '%{http_code}' https://api.openai.com/v1/images/generations \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg prompt "$PROMPT" '{model:"gpt-image-1", prompt:$prompt, size:"1024x1536", n:1}')")
  if [ "$HTTP_STATUS" != "200" ]; then
    echo "✗ OpenAI request failed (HTTP $HTTP_STATUS):"; jq -r '.error.message // .' "$TMP_JSON" 2>/dev/null || cat "$TMP_JSON"
    exit 1
  fi
  jq -r '.data[0].b64_json // empty' "$TMP_JSON" > "$TMP_JSON.b64"
  [ -s "$TMP_JSON.b64" ] || { echo "✗ no image data in response:"; cat "$TMP_JSON"; rm -f "$TMP_JSON.b64"; exit 1; }
  base64 -d "$TMP_JSON.b64" > "$OUT" 2>/dev/null || base64 --decode "$TMP_JSON.b64" > "$OUT"
  rm -f "$TMP_JSON.b64"
  ;;

gemini)
  [ -n "${GEMINI_API_KEY:-}" ] || { echo "GEMINI_API_KEY is not set — export it in your shell first"; exit 1; }
  echo "→ requesting image from Gemini (gemini-2.5-flash-image, aka 'nano banana')…"
  HTTP_STATUS=$(curl -sS -o "$TMP_JSON" -w '%{http_code}' \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=$GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg prompt "$PROMPT" '{contents:[{parts:[{text:$prompt}]}]}')")
  if [ "$HTTP_STATUS" != "200" ]; then
    echo "✗ Gemini request failed (HTTP $HTTP_STATUS):"; jq -r '.error.message // .' "$TMP_JSON" 2>/dev/null || cat "$TMP_JSON"
    exit 1
  fi
  jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data' "$TMP_JSON" | head -1 > "$TMP_JSON.b64"
  [ -s "$TMP_JSON.b64" ] || { echo "✗ no image data in response:"; cat "$TMP_JSON"; rm -f "$TMP_JSON.b64"; exit 1; }
  base64 -d "$TMP_JSON.b64" > "$OUT" 2>/dev/null || base64 --decode "$TMP_JSON.b64" > "$OUT"
  rm -f "$TMP_JSON.b64"
  ;;

*)
  echo "unknown --provider '$PROVIDER' — use 'openai' or 'gemini'"; exit 1;;
esac

if [ -s "$OUT" ]; then
  echo "✓ $OUT"
else
  echo "✗ output file is empty — something went wrong decoding the response"
  exit 1
fi
