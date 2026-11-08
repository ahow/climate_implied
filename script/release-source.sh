#!/usr/bin/env bash
# Source-only synchronization. Credentials remain process-local.
set -euo pipefail
# Source must pass locally even before the remote CI deployment gate is wired.
# This is not a substitute for Railway waiting for the GitHub check.
npx tsx --test script/*.test.ts
uv run python -m unittest discover -s script -p 'test_*.py'
npm run check
npm run build
export DANGEROUSLY_ALLOW_GIT=1
export GIT_TERMINAL_PROMPT=0 GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0=''
export GIT_CONFIG_KEY_1=credential.helper
export GIT_CONFIG_VALUE_1='!f() { if [ "$1" = get ]; then printf "username=x-access-token\npassword=%s\n" "$GITHUB_PERSONAL_ACCESS_TOKEN"; fi; }; f'
python script/sync-github.py
