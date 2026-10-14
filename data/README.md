# Dataset

- `rgb_pick_place_v1` — a LeRobot-format pick-and-place demonstration dataset (~50 episodes recorded, 49 usable after cleanup; parquet episode files + videos).
- The packaged original `rgb_pick_place_v1.zip` (245MB) exceeds GitHub's per-file limit and is stored as a [Release asset](../releases) (`dataset-rgb-pick-place-v1.zip`).
- To restore: unzip into this directory (`unzip dataset-rgb-pick-place-v1.zip -d data/`), or run `scripts/download-release-assets.sh` / `.ps1` from the repo root — it downloads and places everything automatically.
- Note: the archive's metadata preserves the pre-cleanup count (50 episodes / 12,883 frames); the cleaned, converted set used for training is 49 episodes / 12,625 frames. See `logs/engineering-journal.md`, Problems 8–9.
