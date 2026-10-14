# LeRobot Training Pipeline Troubleshooting Log (2026-05-26/27)

## Hardware Architecture
- **Laptop**: Huawei MateBook 16 (AMD integrated graphics, Windows)
- **3060 Ti Desktop**: For inference, not yet connected
- **GPU Server**: AutoDL, RTX 4090 48GB (modified version), Ubuntu 22.04, CUDA 12.8, PyTorch 2.8.0
- **Depth Camera**: Orbbec Astra Pro Plus
- **Robot Arms**: SO-ARM101 ×2 (leader + follower), COM3/COM4

---

## Issue Chain and Solutions

### 1. Astra Pro Plus Depth Camera Not Detected by LeRobot
**Symptom**: `python -m lerobot.find_cameras opencv` only found the built-in camera, not the Astra.
**Root Cause**: Astra does not use the OpenCV DirectShow backend; it requires `pyorbbecsdk`, and the depth channel needs the Orbbec proprietary driver.
**Solution**: 
- Install `pyorbbecsdk-community` (community edition available on PyPI)
- `find_cameras` still cannot see the depth channel, but OpenCV can read the RGB stream via the MSMF backend (Camera #1)
- Temporarily gave up on the depth channel; first run the full pipeline with RGB only

### 2. LeRobot Default DSHOW Backend on Windows Cannot Open Astra
**Symptom**: Camera #1 fails to open with DSHOW, but succeeds with MSMF.
**Root Cause**: `lerobot/src/lerobot/cameras/utils.py:63` — `get_cv2_backend()` hardcodes `cv2.CAP_DSHOW` on Windows.
**Solution**: Changed that line from `cv2.CAP_DSHOW` → `cv2.CAP_MSMF`.

### 3. `fourcc` Field Invalid in Teleoperation Command
**Symptom**: The new LeRobot `OpenCVCameraConfig` no longer supports the `fourcc` parameter.
**Solution**: Removed the `fourcc` field from the YAML configuration.

### 4. PowerShell Cannot Parse Inline YAML Camera Config
**Symptom**: Nested braces and quotes were truncated across multiple lines by PowerShell.
**Solution**: Switched to a YAML config file `teleop_config.yaml` + `--config_path` argument.

### 5. Rerun Visualization SDK Version Incompatibility
**Symptom**: `AttributeError: module 'rerun' has no attribute 'Scalar'` (renamed to `Scalars` in the new version).
**Solution**: Global replace `rr.Scalar` → `rr.Scalars` in `lerobot/utils/visualization_utils.py`.

### 6. Camera MSMF Backend Locked Up
**Symptom**: After the recording script crashed, reopening Camera #1 returned `Failed to read frame`.
**Root Cause**: The process crash did not properly release the camera; the MSMF backend state was locked.
**Solution**: Unplug and replug the Astra USB cable for 5 seconds to recover.

### 7. LeRobot Forces HuggingFace Hub Access When Loading Local Dataset
**Symptom**: `ConnectTimeout` — the dataset is local, but the code still attempts `list_repo_refs()`.
**Root Cause**: `lerobot_dataset.py:476` — the assert checking episode file integrity failed → fell back to network download.
**Solution**: 
- Set `HF_HUB_OFFLINE=1`
- Laptop version: modified `__init__` to skip network checks and directly `load_hf_dataset()` in offline mode
- Added `import os` to that file

### 8. Dataset Has 50 Episodes but Only 49 Video Files
**Symptom**: The mp4 for episode 000049 was manually deleted but the parquet file still existed.
**Solution**: Consistency cleanup:
- `rm episode_000049.parquet`
- `sed -i` updated info.json: total_episodes=49, total_videos=49
- Removed line 50 in episodes.jsonl

### 9. Dataset v2.1 → v3.0 Format Conversion
**Symptom**: LeRobot v3.0 on the server could not load the v2.1 format dataset from the laptop.
**Solution**: `python -m lerobot.scripts.convert_dataset_v21_to_v30 --repo-id=<local_path>`

### 10. Slow GitHub Clone on AutoDL Server
**Symptom**: `git clone huggingface/lerobot` stuck at 16%.
**Solution**: Tried ghproxy (a GitHub mirror proxy), which failed; directly connected to GitHub, which eventually succeeded.

### 11. Training Command Entry Point Changed
**Symptom**: `python -m lerobot.train` does not exist.
**Solution**: v3.0 training entry point changed to `python -m lerobot.scripts.lerobot_train`.

### 12. Missing Training Dependencies
**Symptom**: `ImportError: 'accelerate' is required`, `OSError: libavutil.so.57`.
**Solution**:
- `pip install accelerate wandb`
- `apt-get install -y ffmpeg libavcodec-dev libavformat-dev libavutil-dev libavdevice-dev`
- Use `--dataset.video_backend pyav` to avoid torchcodec dependency

### 13. Split Configuration Mismatch Causes Index Out of Bounds
**Symptom**: `IndexError: Invalid key: 12762 is out of bounds for size 12625`
**Root Cause**: v2.1 original splits were `"0:50"`, but there are actually only 49 episodes; total_frames was marked as 12883 but didn't match the v3.0 recalculation.
**Solution**: `sed -i` modified splits to `"0:39"` and total_frames to `12625` in info.json.

---

## Final Working Training Command
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

Training start loss: **6.793**, speed ~11 step/s, estimated 70 minutes to complete.

---

## Modified Files List
1. `lerobot/src/lerobot/cameras/utils.py` — `CAP_DSHOW` → `CAP_MSMF`
2. `lerobot/src/lerobot/utils/visualization_utils.py` — `rr.Scalar` → `rr.Scalars`
3. `lerobot/src/lerobot/datasets/lerobot_dataset.py` — Added `import os` + offline loading logic

## Dataset Locations
- Laptop: `C:\Users\Telfair\.cache\huggingface\lerobot\rgb_pick_place_v1\`
- Server: `/root/.cache/huggingface/lerobot/rgb_pick_place_v1/`
- 49 episodes, ~12883 frames, RGB only, 30 FPS
- No language annotations (to be added during the subsequent VLA phase)

---

## Phase 2: Training Completion + Model Download + Cross-Version Inference (2026-05-27)

### 14. Actual GPU Is Not a 5090
**Symptom**: Checking `nvidia-smi` revealed it is an RTX 4090 48GB modified version, not a 5090.
**Conclusion**: No impact on ACT training; 48GB VRAM is more than sufficient. AutoDL's vGPU labels may be inaccurate.

### 15. Training Completed 50,000 Steps, but Exploded at the End
**Symptom**: `tail -30 ~/train.log` showed the last lines as `httpx.ConnectError: Network is unreachable`.
**Analysis**: Confirmed 100% training completion (50000/50000) via `grep "step:" ~/train.log | tail -5`; loss dropped from 6.793 → 0.110.
**Root Cause**: After training finished, it automatically attempted `push_to_hub` to HuggingFace, but the AutoDL container has restricted outbound network access.
**Conclusion**: Training itself succeeded; checkpoint is at `/root/lerobot/outputs/rgb_baseline/checkpoints/050000/`.
**Training Results**:
- Final Loss: **0.110** (98.4% reduction)
- Duration: 78 minutes (~11 step/s)
- Checkpoints: 020000, 040000, 050000, last

### 16. Downloading Model Files from AutoDL
**Symptom**: AutoDL's file manager only supports upload, not download — needed an alternative.
**Attempts**:
- `python -m http.server 8899` + browser access → port blocked by firewall
- VS Code Remote-SSH extension → connected successfully
**Solution**: Connected via VS Code Remote-SSH, right-clicked and downloaded the `050000` folder (~590MB, including optimizer state).
**Key Info**: SSH port is 5 digits (not 22); find it on the AutoDL instance details page.

### 17. v3.0 Trained Model Cannot Load in v2.1 Local Environment
**Symptom**: `ACTPolicy.from_pretrained()` threw `draccus.utils.DecodingError: fields 'use_peft', 'pretrained_path' are not valid`.
**Root Cause**: The server v3.0 config.json contains fields unknown to v2.1.
**Attempt**: After cleaning up extraneous config fields, encountered `PermissionError` accessing the Temp directory (draccus Windows bug).
**Second Attempt**: Manually constructed ACTConfig + direct `load_state_dict`, encountered:
1. `NormalizationMode` loaded from JSON as a string instead of an enum → converted to `NormalizationMode(v)`
2. `type` field is not an ACTConfig constructor parameter → removed
3. `forward()` signature mismatch → should use `predict_action_chunk(batch_dict)`
4. **Stuck**: normalization stats (mean/std) are in v3.0's preprocessor/postprocessor safetensors, with naming conventions incompatible with v2.1's `normalize_inputs.buffer_*`, causing `AssertionError: mean is infinity`

### 18. Final Solution: Install Matching LeRobot v3.0 on 3060 Ti
**Conclusion**: The normalization format between laptop v2.1 and server v3.0 is incompatible; manual alignment costs are too high.
**Correct Path**:
```bash
# On the 3060 Ti
git clone https://github.com/huggingface/lerobot.git  # v3.0
pip install -e .
pip install av accelerate
# One-liner load
policy = ACTPolicy.from_pretrained('path/to/050000/pretrained_model')
```
**Verified Info**:
- Model: ACT, Backbone: ResNet-18
- Parameters: 51,668,614 (206.7MB FP32)
- Input: `observation.images.front` [3,480,640] + `observation.state` [6]
- Output: action chunk [100, 6] (6 DOF: shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper)

---

## Key Lessons Learned

| Area | Lesson |
|---|---|
| Version Management | LeRobot versions must be consistent between data collection and training; training and inference versions must also match |
| Offline Environment | Domestic network + HuggingFace = `HF_HUB_OFFLINE=1` needed everywhere |
| Windows Compatibility | LeRobot's Windows support is a second-class citizen: DSHOW/MSMF backend issues, PowerShell syntax issues, draccus temp file permission issues |
| Dataset Format | v2.1 → v3.0 format conversion is not transparent, and involves splits/frames metadata consistency |
| AutoDL | Slow GitHub access, restricted outbound network, file downloads require SSH, but GPU training itself is stable |
| Teleoperation Recording | Note language annotations (object name + position) for each episode as you go, otherwise the VLA phase will take a full day to backfill |
