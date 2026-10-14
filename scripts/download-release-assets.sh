#!/usr/bin/env bash
# Download the large Release assets of this repository and restore them to their paths.
set -euo pipefail

REPO="${1:-}"   # optional: repo full name, e.g. user/lerobot-project; defaults to origin
if [ -z "$REPO" ]; then
  REPO=$(git remote get-url origin 2>/dev/null | sed -E 's#.*github.com[:/]##; s#\.git$##')
fi
if [ -z "$REPO" ]; then
  echo "Usage: bash scripts/download-release-assets.sh <owner/repo>" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fetch() {  # fetch <asset> <dest>
  local asset="$1" dest="$2"
  echo "==> $asset -> $dest"
  mkdir -p "$(dirname "$dest")"
  gh release download assets-v1 --repo "$REPO" --pattern "$asset" --output "$dest"
}

fetch "checkpoint-050000-pretrained-model.safetensors" "checkpoints/050000/pretrained_model/model.safetensors"
fetch "checkpoint-050000-optimizer-state.safetensors"  "checkpoints/050000/training_state/optimizer_state.safetensors"
fetch "checkpoint-050000-clean-model.safetensors"      "checkpoints/050000_clean/model.safetensors"
fetch "dataset-rgb-pick-place-v1.zip"                  "$TMP/rgb_pick_place_v1.zip"

echo "==> Unpacking the dataset into data/rgb_pick_place_v1"
mkdir -p data
unzip -q -o "$TMP/rgb_pick_place_v1.zip" -d data/

echo "Done."
