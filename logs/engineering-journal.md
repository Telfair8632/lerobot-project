# LeRobot Robotic-Arm Behavior Cloning — Engineering Journal

**Author**: Sun Haonan
**Period**: May – June 2026
**Goal**: Build an end-to-end imitation-learning system on the SO-ARM101 robot arm, probe the generalization limits of behavior cloning, and lay the groundwork for evolving toward vision-language-action (VLA) models.

---

## 1. Project Overview

This project uses the LeRobot v3.0 framework and a 6-DoF SO-ARM101 robot arm to build a complete imitation-learning pipeline: teleoperated data collection, cloud-GPU training, and local inference on real hardware. An ACT (Action Chunking Transformer) policy served as the baseline and was trained on 49 pick-and-place demonstrations; training loss fell from 6.793 to 0.110 (a 98.4% reduction). Real-world inference then exposed the central limitation of behavior cloning: overfitting that collapses into "grasping at a memorized fixed position." That finding became the concrete experimental motivation for the next stage — language-conditioned VLA models.

---

## 2. Hardware Architecture

### 2.1 Equipment

| Device | Model | Role |
|---|---|---|
| Laptop | Huawei MateBook 16 (AMD iGPU, Windows 11) | Teleoperation data collection |
| GPU server | AutoDL cloud, RTX 4090 48GB | Model training |
| Inference desktop | Self-built PC, RTX 3060 Ti 8GB | Model inference + robot control |
| Depth camera | Orbbec Astra Pro Plus | Vision input (RGB stream only for now) |
| Robot arms | SO-ARM101 ×2 | Leader (teleoperation) + Follower (execution) |

### 2.2 Hardware Decisions

- **Why not train on the 3060 Ti**: 8GB VRAM is not enough to train the full ACT model (~6GB for training plus batch overhead).
- **Why not train on the laptop**: no discrete GPU; CPU training time would be unacceptable.
- **Why no M.2 eGPU route**: the MateBook 16 has a single M.2 slot, already occupied by the system drive.
- **Astra Pro Plus depth channel**: requires the Orbbec proprietary Windows driver; currently only the RGB stream is visible through the generic UVC driver. Depth integration is deferred to the next stage.

---

## 3. Environment Setup and the 18 Problems Solved

### 3.1 Laptop (data-collection environment)

**Problem 1: Astra Pro Plus not detected by LeRobot**
- **Symptom**: `python -m lerobot.find_cameras opencv` only found the built-in camera
- **Root cause**: the Astra depth channel uses Orbbec's proprietary protocol, incompatible with OpenCV DirectShow; `pyorbbecsdk` on Windows needs a dedicated driver
- **Fix**: install `pyorbbecsdk-community`; drop the depth channel for now and use the RGB stream via UVC

**Problem 2: LeRobot's default Windows DSHOW backend cannot open the Astra**
- **Symptom**: Camera #1 fails with DSHOW, succeeds with MSMF
- **Root cause**: `lerobot/src/lerobot/cameras/utils.py:63` — `get_cv2_backend()` hardcodes `cv2.CAP_DSHOW`
- **Fix**: change to `cv2.CAP_MSMF`

**Problem 3: the `fourcc` CLI field is rejected**
- **Symptom**: newer LeRobot's `OpenCVCameraConfig` no longer accepts `fourcc`
- **Fix**: remove the `fourcc` field from the YAML config

**Problem 4: PowerShell cannot parse nested YAML**
- **Symptom**: nested quotes and braces get truncated into multiple lines by PowerShell
- **Fix**: switch to a YAML config file + `--config_path` argument

**Problem 5: Rerun SDK version incompatibility**
- **Symptom**: `AttributeError: module 'rerun' has no attribute 'Scalar'`
- **Root cause**: the API was renamed to `Scalars` in newer versions
- **Fix**: global replace `rr.Scalar` → `rr.Scalars` in `visualization_utils.py`

**Problem 6: camera locked by MSMF**
- **Symptom**: after a recording script crash, Camera #1 returns `Failed to read frame`
- **Root cause**: the process did not release the camera; the MSMF backend state was locked
- **Fix**: unplug/replug the Astra USB cable for 5 seconds

**Problem 7: local dataset loading forces a HuggingFace Hub access**
- **Symptom**: `ConnectTimeout` — the dataset is local, yet a network request is attempted
- **Root cause**: an assert in `lerobot_dataset.py:476` fails and falls back to network download
- **Fix**: set `HF_HUB_OFFLINE=1`; patch the source to skip Hub access in offline mode

### 3.2 Dataset Management

**Problem 8: 50 episodes but 49 video files**
- **Symptom**: episode 000049's mp4 was manually deleted while its parquet file remained
- **Fix**: consistency cleanup — delete `episode_000049.parquet`, update `info.json`, remove line 50 of `episodes.jsonl`

**Problem 9: v2.1 → v3.0 format conversion**
- **Symptom**: a dataset recorded with LeRobot v2.1 on the laptop fails to load in the server's v3.0 environment
- **Fix**: `python -m lerobot.scripts.convert_dataset_v21_to_v30 --repo-id=<local path>`
- **Pitfall**: the episode-count mismatch (49 vs 50) repeatedly broke the conversion; `info.json`, `episodes.jsonl` and `episodes_stats.jsonl` must be updated in sync

### 3.3 Cloud Training Environment (AutoDL + RTX 4090)

**Problem 10: cloning GitHub is slow**
- **Symptom**: `git clone huggingface/lerobot` stalls at 16%
- **Attempted**: ghproxy mirror failed → direct clone succeeded (intermittently)

**Problem 11: GPU not as advertised**
- **Symptom**: AutoDL labels it "vGPU-48GB"; `nvidia-smi` reveals a modified RTX 4090
- **Conclusion**: no impact on ACT training

**Problem 12: training entry point moved**
- **Symptom**: `python -m lerobot.train` does not exist
- **Fix**: in v3.0 the entry is `python -m lerobot.scripts.lerobot_train`

**Problem 13: missing training dependencies**
- **Symptom**: `ImportError: 'accelerate' is required`; `OSError: libavutil.so.57`
- **Fix**: `pip install accelerate wandb`; `apt-get install -y ffmpeg libav*`; use `--dataset.video_backend pyav` to avoid torchcodec

**Problem 14: split mismatch causes index out of bounds**
- **Symptom**: `IndexError: Invalid key: 12762 is out of bounds for size 12625`
- **Root cause**: v2.1 splits say `"0:50"` but there are 49 episodes; `total_frames` disagrees with reality
- **Fix**: `sed` the splits in `info.json` to `"0:39"` and `total_frames` to `12625`

**Problem 15: training succeeds but the ending "looks like a crash"**
- **Symptom**: `httpx.ConnectError: Network is unreachable`
- **Analysis**: `grep "step:" ~/train.log | tail -5` confirms training completed (50000/50000)
- **Root cause**: after training, `push_to_hub` tries to upload to HuggingFace, but the AutoDL container's network is restricted
- **Conclusion**: training itself succeeded — the error only reports the failed upload

### 3.4 Model Download and Inference Deployment

**Problem 16: getting files out of AutoDL is hard**
- **Symptom**: AutoDL's file manager supports upload only, no download
- **Attempted**: `python -m http.server` + browser → port blocked by firewall
- **Final solution**: VS Code Remote-SSH, right-click download of the `050000/` folder (~590MB)

**Problem 17: a v3.0 model cannot load in a local v2.1 environment (cross-version compatibility disaster)**
- **Symptom**: `ACTPolicy.from_pretrained()` raises `fields 'use_peft', 'pretrained_path' are not valid`
- **Path 1**: strip extra config fields → `PermissionError` on the Temp directory (a draccus bug on Windows)
- **Path 2**: hand-construct `ACTConfig` + direct `load_state_dict` → NormalizationMode enum mismatch → `forward()` signature mismatch → v3.0 stores normalization stats in preprocessor/postprocessor safetensors with names incompatible with v2.1 → `AssertionError: mean is infinity`
- **Conclusion**: manual cross-version alignment costs too much
- **Final solution**: install the same LeRobot v3.0 on the 3060 Ti as on the server

**Problem 18: camera cannot be opened by OpenCV on the 3060 Ti machine**
- **Symptom**: `cv2.VideoCapture(0)` defaults to the DSHOW backend there; the Astra is incompatible; `find_cameras` sees nothing
- **Analysis**: v3.0's `Cv2Backends` supports MSMF (enum 1400), but the Windows default resolves ANY → DSHOW
- **Fix**: explicitly set `backend: MSMF` in the rollout command/config

---

## 4. Data Collection

### 4.1 Dataset Specification

| Property | Value |
|---|---|
| Episodes | 49 (50 planned; 1 anomalous episode removed) |
| Total frames | 12,883 (12,625 after v3.0 conversion) |
| FPS | 30 |
| Recording length per episode | 12 s |
| Scene reset time | 8 s |
| Camera | Orbbec Astra Pro Plus (RGB only) |
| Resolution | 640×480 |

### 4.2 Collection Protocol (flawed, in hindsight)

- Only one object type was used (single color)
- Initial object positions did not vary systematically (no ≥4-corner coverage)
- Limited variation of the target container (placement location)
- **No language annotations** (the key ingredient for the next-stage VLA)

### 4.3 Lesson Learned

The dataset's weaknesses directly caused the model's overfitting. Ideally the 50 episodes should have covered:
- 5 object types × 5 positions × 2 target containers = 50 episodes
- one English instruction annotation per episode

---

## 5. Model Training

### 5.1 Model Configuration

| Parameter | Value |
|---|---|
| Policy | ACT (Action Chunking Transformer) |
| Vision backbone | ResNet-18 (ImageNet-pretrained) |
| Hidden dim | 512 |
| Transformer encoder layers | 4 |
| Transformer decoder layers | 1 |
| Chunk size | 100 |
| Action steps | 100 |
| VAE | enabled (latent dim 32) |
| Dropout | 0.1 |
| KL weight | 10.0 |
| Optimizer | AdamW (lr=1e-5, weight_decay=1e-4) |
| LR schedule | Cosine annealing |
| Total parameters | **51,668,614** (~207MB FP32) |
| Training steps | 50,000 |
| Batch size | 8 |
| Wall time | ~78 minutes |
| GPU | RTX 4090 48GB → actual usage ~6GB |

### 5.2 Training Curve

| Step | Loss | Grad norm |
|---|---|---|
| 0 | 6.793 | – |
| 200 | 6.793 | 154.9 |
| 3,000 | 0.902 | 37.3 |
| 10,000 | ~0.35 | – |
| 20,000 | ~0.18 | – |
| 40,000 | ~0.12 | – |
| **50,000** | **0.110** | **10.0** |

Loss decreased smoothly with no oscillation — a healthy run: a 98.4% reduction.

---

## 6. Inference Testing and the Key Finding

### 6.1 Test Conditions

- Inference machine: RTX 3060 Ti 8GB
- Camera: a webcam (different from the Astra Pro Plus used in training)
- Robot: SO-ARM101 Follower (COM3)

### 6.2 Results

**The model loaded and produced actions**, but its behavior was severely degraded:

1. **Fixed-direction grasping**: wherever the object was placed in the workspace, the arm kept reaching toward the most frequent object position from the training data
2. **No task planning**: the model has no notion of "the grasp is complete," so it loops forever
3. **Camera mismatch amplified the degradation**: overhead Astra views during training vs. a side-view webcam at inference shifted the visual distribution, pushing the model further toward its "safest" prediction — the average action

### 6.3 Key Finding: Two Forms of Overfitting in Behavior Cloning

```
Form 1 (textbook overfitting):
  low training loss, high test loss
  → the model memorized training samples and fails to generalize

Form 2 (behavior-cloning overfitting — observed in this project):
  training loss is very low (0.110), and at test time the policy executes
  a "loss-optimal strategy"
  → that strategy is not "perceive the scene and plan a path" but
    "ignore the scene and output the most frequent action"
  → with 49 near-identical training episodes, "always grasp at the fixed
    position" has lower loss than "actually learn visual tracking"
```

**This is the project's most valuable finding**: on a low-diversity dataset, behavior cloning with a large model (51.7M parameters) converges not to "intelligence" but to the most economical fit to the training data. Loss alone is not a sufficient indicator of behavior-cloning success.

---

## 7. Why the Model Overfit: Root-Cause Analysis

| Factor | Contribution | Notes |
|---|---|---|
| Insufficient data diversity | **primary** | 49 episodes, one object, unsystematic positions |
| Excess model capacity | secondary | 51.7M parameters vs ~12k frames → heavily overparameterized |
| Missing task-intent signal | **primary** | a pure vision→action map carries no "which one, and why" |
| LR / optimizer | not an issue | conservative lr=1e-5, smooth loss curve |
| ImageNet pretraining | double-edged | strong visual features make shortcut learning easier |
| Train/inference camera mismatch | aggravating | visual distribution shift between cameras |

---

## 8. Future Directions

### 8.1 Near term: better dataset + retrain the baseline

- Use ≥5 object types, systematically vary 6 initial positions
- Use the same camera for training and inference
- Goal: test whether data diversity alone resolves the overfitting

### 8.2 Mid term: language-conditioned VLA (the core direction)

- **Option A (lightweight)**: ACT + CLIP text encoder — add a language branch to the current model
- **Option B (frontier)**: migrate to a VLA policy natively supported by LeRobot v3.0 (e.g. Pi0.5 or SmolVLA) and fine-tune on our own data
- **Goal**: language instructions teach the model to distinguish "grasp the red cube" from "grasp the blue cube" — from memorizing positions to understanding tasks
- **Application vision**: assistive robots for an aging society — "bring me the pill bottle"

### 8.3 Long term: systematic extensions

- Integrate the Astra Pro Plus depth channel → solve Z-axis localization (the earliest technical bottleneck found)
- Multi-task learning (beyond pick-and-place)
- Real user testing (elderly / visually impaired people)

---

## 9. Modified Source Files

| File | Change | Purpose |
|---|---|---|
| `lerobot/src/lerobot/cameras/utils.py` | `CAP_DSHOW` → `CAP_MSMF` | Astra camera compatibility |
| `lerobot/src/lerobot/utils/visualization_utils.py` | `rr.Scalar` → `rr.Scalars` | Rerun SDK compatibility |
| `lerobot/src/lerobot/datasets/lerobot_dataset.py` | add `import os` + offline loading logic | HuggingFace unreachable behind the local network |
| `lerobot/src/lerobot/policies/pretrained.py` | `packaging.version.parse` → `parse_version` import | fix an upstream LeRobot v3.0 bug |

---

## 10. Key Lessons

| Area | Lesson |
|---|---|
| **Version management** | the LeRobot version must be strictly identical across collection, training and inference. v2.1 and v3.0 are not interoperable |
| **Offline environments** | behind a restricted network, every HuggingFace Hub access point is a potential bottleneck |
| **Windows compatibility** | LeRobot on Windows is a second-class citizen: DSHOW/MSMF backend switching, PowerShell syntax quirks, draccus temp-file permission bugs |
| **Dataset format** | v2.1 → v3.0 conversion touches metadata consistency across `info.json` / splits / `total_frames` / `episodes.jsonl` |
| **Behavior cloning** | low loss ≠ success. The model may latch onto spurious correlations instead of a genuine visuo-motor policy |
| **Teleoperated recording** | annotate a language instruction with every episode as you record; retrofitting annotations later is far more expensive |

---

## Appendix A: Final Training Command

```bash
cd ~/lerobot && nohup python -m lerobot.scripts.lerobot_train \
  --dataset.repo_id rgb_pick_place_v1 \
  --dataset.video_backend pyav \
  --policy.type act \
  --policy.repo_id rgb_baseline_model \
  --output_dir ./outputs/rgb_baseline \
  --job_name rgb_baseline \
  --steps 50000 \
  --eval.n_episodes 9 \
  --eval.batch_size 5 \
  --wandb.enable false \
  > ~/train.log 2>&1 &
```

## Appendix B: Model Specification

- **Type**: ACT (Action Chunking Transformer)
- **Vision backbone**: ResNet-18 (ImageNet-pretrained)
- **Parameters**: 51,668,614 (~207MB FP32)
- **Input**: `observation.images.front` [3, 480, 640] + `observation.state` [6]
- **Output**: action chunk [100, 6]
- **Checkpoint**: `/root/lerobot/outputs/rgb_baseline/checkpoints/050000/pretrained_model/`
- **Final loss**: 0.110

## Appendix C: Reflection Note — Why It Repeated the Same Motion

At inference the observations differed from training observations. A simple analogy: suppose you teach an AI to drive using 100 hours of normal driving footage. At first everything goes fine — then the steering drifts slightly, maybe from wind, an uneven road, or a small network error. The problem: the AI has never *seen* this slightly-drifted state. In the training data the expert never leaves the lane, so the AI has no idea what to do there. It takes a random action, drifts further into an even less familiar state, takes an even stranger action… This is **compounding errors**, also called **distribution shift**. In plain words: when it meets something it has never seen, it simply does not know what to do. A fuller theoretical write-up is in [`theory-reflections.md`](theory-reflections.md).
