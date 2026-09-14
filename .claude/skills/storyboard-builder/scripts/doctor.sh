#!/usr/bin/env bash
# doctor.sh — check everything storyboard-builder needs and say EXACTLY what's missing and how to install it.
# Run this on first use or whenever anything fails. Works on macOS, Linux, and Windows (Git Bash).
ok(){ printf '  [OK]      %s\n' "$1"; }
miss(){ printf '  [MISSING] %s\n      -> install: %s\n' "$1" "$2"; FAIL=1; }
FAIL=0
case "$(uname -s 2>/dev/null)" in Darwin) OS=mac;; MINGW*|MSYS*|CYGWIN*) OS=win;; *) OS=linux;; esac
echo "storyboard-builder doctor — OS: $OS"
echo "REQUIRED:"
command -v curl >/dev/null 2>&1 && ok "curl" \
  || miss "curl" "$([ $OS = mac ] && echo 'brew install curl' || ([ $OS = win ] && echo 'winget install cURL.cURL' || echo 'apt install curl'))"
command -v jq >/dev/null 2>&1 && ok "jq (JSON parsing)" \
  || miss "jq" "$([ $OS = mac ] && echo 'brew install jq' || ([ $OS = win ] && echo 'winget install jqlang.jq' || echo 'apt install jq'))"

echo "AT LEAST ONE IMAGE API KEY:"
if [ -n "${OPENAI_API_KEY:-}" ]; then ok "OPENAI_API_KEY is set"; HAVE_KEY=1; fi
if [ -n "${GEMINI_API_KEY:-}" ]; then ok "GEMINI_API_KEY is set"; HAVE_KEY=1; fi
if [ -z "${HAVE_KEY:-}" ]; then
  miss "no API key found" "export OPENAI_API_KEY=... (platform.openai.com/api-keys) or export GEMINI_API_KEY=... (aistudio.google.com/apikey) in your shell — never paste it into chat or a committed file"
fi

echo
if [ "$FAIL" = 1 ]; then echo "RESULT: fix the [MISSING] items above, then re-run."; exit 1
else echo "RESULT: ready. Run scripts/generate-image.sh for each storyboard scene."; fi
