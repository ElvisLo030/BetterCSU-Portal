#!/bin/bash
# 若 manifest.json 版號相對上一筆 push 有變，且 GitHub 尚無對應 Release，則打包並建立 Releases。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

read_version() {
  python3 -c "import json,sys; print(json.load(sys.stdin)['version'])"
}

CUR="$(read_version < manifest.json)"
TAG="v${CUR}"
ZIP="BetterCSU-Portal-v${CUR}.zip"
BEFORE="${GITHUB_EVENT_BEFORE:-}"
FORCE="${FORCE_RELEASE:-false}"
PREV=""

if [ -n "$BEFORE" ] && [[ ! "$BEFORE" =~ ^0+$ ]] && git cat-file -e "${BEFORE}:manifest.json" 2>/dev/null; then
  PREV="$(git show "${BEFORE}:manifest.json" | read_version)"
fi

if [ "$FORCE" != true ] && [ -n "$PREV" ] && [ "$PREV" = "$CUR" ]; then
  echo "Version unchanged (${CUR}); skip release."
  exit 0
fi

if [ "$FORCE" != true ] && [ -z "$PREV" ]; then
  echo "No previous manifest version to compare; skip release. Set FORCE_RELEASE=true to cut ${TAG}."
  exit 0
fi

if [ "$FORCE" = true ] && [ -n "$PREV" ] && [ "$PREV" = "$CUR" ]; then
  echo "Manual run: current version is ${CUR}."
elif [ -n "$PREV" ]; then
  echo "Version ${PREV} -> ${CUR}."
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release ${TAG} already exists; skip."
  exit 0
fi

./scripts/package.sh

TARGET=()
if [ -n "${GITHUB_SHA:-}" ]; then
  TARGET=(--target "$GITHUB_SHA")
fi

gh release create "$TAG" "$ZIP" \
  --title "BetterCSU-Portal ${TAG}" \
  --generate-notes \
  "${TARGET[@]}"

echo "Created release ${TAG}."
