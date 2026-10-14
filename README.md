# Robotic-Arm Imitation Learning — Complete Project Archive

An end-to-end imitation-learning project on the SO-ARM101 robot arm using the LeRobot framework: teleoperated data collection → cloud training → real-world deployment → root-cause analysis → a controlled V2 experiment plan. Built and documented by Sun Haonan (2026).

**The one-sentence story:** the model trained beautifully (loss 6.793 → 0.110) — and then, on the real robot, kept grasping at a memorized position. This archive documents both the working pipeline and the investigation into *why*.

## Where to start

| If you want… | Read |
|---|---|
| the 2-minute overview | [`docs/project-overview.md`](docs/project-overview.md) + [`docs/project-overview.pptx`](docs/project-overview.pptx) |
| the full engineering story (18 problems solved) | [`logs/engineering-journal.md`](logs/engineering-journal.md) |
| the theory behind the failure analysis | [`logs/theory-reflections.md`](logs/theory-reflections.md) |
| what happens next (controlled experiments) | [`logs/v2-experiment-plan.md`](logs/v2-experiment-plan.md) |

## Repository structure

```
├── code/                     # Inference / loading / verification scripts
│   ├── inference.py              # Live inference loop: camera → policy → follower arm
│   ├── load_model.py             # Manual v3.0 checkpoint loading (cross-version workaround)
│   ├── verify_model.py           # Checkpoint sanity checker
│   ├── teleoperate-command.txt   # The exact teleoperation launch command used
│   └── lerobot.zip               # Verbatim snapshot of the working LeRobot codebase
│                                # (upstream + 4 local patches + custom helper scripts)
├── logs/                     # Engineering journal, theory notes, experiment plan
├── docs/                     # Project overview (markdown + PPTX + rendered slides)
├── checkpoints/              # Step-50,000 ACT checkpoint (configs + small weights)
│   ├── 050000/pretrained_model/
│   ├── 050000/training_state/
│   └── 050000_clean/
├── data/                     # Dataset notes (large files live in Releases)
└── scripts/                  # One-command downloader for the Release assets
```

## Large files (Release assets)

Four files exceed GitHub's 100MB-per-file limit and are distributed as [Release assets](../../releases) (each up to 2GB):

| Asset | Size | Restores to |
|---|---|---|
| `checkpoint-050000-pretrained-model.safetensors` | 198MB | `checkpoints/050000/pretrained_model/model.safetensors` |
| `checkpoint-050000-optimizer-state.safetensors` | 394MB | `checkpoints/050000/training_state/optimizer_state.safetensors` |
| `checkpoint-050000-clean-model.safetensors` | 198MB | `checkpoints/050000_clean/model.safetensors` |
| `dataset-rgb-pick-place-v1.zip` | 245MB | unzips to `data/rgb_pick_place_v1/` (parquet + videos) |

After cloning, restore everything with one command:

```bash
bash scripts/download-release-assets.sh          # bash
powershell -ExecutionPolicy Bypass -File scripts/download-release-assets.ps1   # Windows
```

Or download manually from the Releases page.

## Model & dataset at a glance

- **Policy**: ACT (Action Chunking Transformer), ResNet-18 backbone, 51,668,614 parameters (~207MB FP32)
- **Training**: 50,000 steps, AdamW lr=1e-5, batch 8, ~78 min on a cloud RTX 4090
- **Dataset**: `rgb_pick_place_v1` — 49 pick-and-place demonstrations, 12,625 frames, 640×480 @ 30 FPS, single overhead RGB camera
- **Hardware**: SO-ARM101 leader/follower pair, Orbbec Astra Pro Plus camera, local inference on RTX 3060 Ti

## Notes

- Archived October 2026; content spans May–October 2026.
- `lerobot.zip` is kept as a verbatim snapshot of the working codebase at training time (upstream LeRobot + the 4 local patches listed in the engineering journal, plus custom helper scripts; comments inside are as-written). The patches are also documented in [`logs/engineering-journal.md §9`](logs/engineering-journal.md).
- The raw dataset ZIP preserves a pre-cleanup count of 50 episodes / 12,883 frames; experimental conclusions use the cleaned, converted set of 49 episodes / 12,625 frames (see the journal, Problems 8–9).
