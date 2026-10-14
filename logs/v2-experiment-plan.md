# LeRobot V2 Experiment Plan: From "Failed Baseline" to "Verified Attribution"

**Date**: 2026-10-08
**Prerequisites**: SO-ARM101 ×2, Astra camera, and the 3060 Ti desktop available
**Budget**: ~26 hours / 3 weeks (within the 10–30 h/month budget)
**Deadline anchor**: ED/EA submissions land in early November; the timeline is back-planned from that

---

## 0. What V2 Is — and Its Success Criteria

**V2 is not "build a perfect grasping arm". It is "verify V1's attribution with controlled experiments".**

V1's conclusion was a hypothesis: insufficient data diversity + camera shift → overfitting into a "fixed-position grasp".
V2's goal is to back that causal chain with three numbers, and to measure the real improvement after fixing data diversity.

Success criteria (in priority order):
1. Obtain a quantitative success rate for v1 under the correct camera (the baseline number)
2. Obtain v2's success rate with a decomposable attribution chain (how much comes from the camera, how much from the data)
3. Obtain evidence of spatial generalization (performance on unseen positions)
4. Expectation management: an in-distribution success rate of 50–80% counts as success (the typical range for ACT with 50–100 pick-place demos in the literature). **Even if the improvement disappoints, "I designed an experiment and measured that something beyond diversity is at play" is a valid conclusion.**

---

## 1. Design Overview: An Attribution Chain in Three Numbers

| Group | Model | Camera | Question answered |
|---|---|---|---|
| A | v1 (trained on old data) | side-view webcam | reproduce V1's observed behavior with numbers |
| B | v1 | **overhead Astra (same as training)** | camera-shift contribution = B − A |
| C | v2 (trained on new data) | overhead Astra | data-diversity contribution = C − B |

**Core discipline: exactly one variable may differ between v1 and v2 — the dataset.** Architecture, hyperparameters, training steps, inference parameters (N_ACTION_STEPS=20, etc.) and the evaluation protocol all stay identical, otherwise the comparison is invalid.

---

## 2. Phase 0: Evaluation Protocol + v1 Re-test (~6h, week 1)

### 2.1 Test scene and fixed conditions
- Tape marks on the table for 6 object positions (2×3 grid covering the workspace) + 2 **new positions** (never seen in training — the generalization probe, see 5.2)
- The camera mount is taped down too (overhead Astra, same height and angle as in v1 training)
- Fixed lighting: same time of day / curtains + desk lamp, unchanged throughout; solid-color tablecloth background
- The arm returns to its home pose before every trial (same reset motion as during data collection)

### 2.2 Evaluation log fields (CSV/Excel recommended)

| trial | model/ckpt | camera | object | position id | position type | result (0–3) | reaches fixed spot? | time (s) | #chunks | notes |
|---|---|---|---|---|---|---|---|---|---|---|

Result grading:
- 0 = no object contact / reached the wrong place
- 1 = touched but did not pick up
- 2 = picked up but did not place into the container
- 3 = full success (picked up + placed)

Report two headline metrics separately: **pick-up rate (≥2)** and **success rate (=3)**. A model can learn to grasp but not to place; merging the two would hide that.

### 2.3 Trial protocol (30 trials per group, ~40 minutes)
1. Randomize trial order (never test positions in sequence — avoid fatigue/drift confounds)
2. Side-view phone records video for the whole session + inference logs captured in parallel (source material and dispute evidence)
3. Stop conditions (any one): successful placement / 60 s timeout / 3 consecutive chunks without progress → timeout counts as failure (this closes the door on v1's infinite-loop problem at the protocol level)
4. Judging "reaches fixed spot": by eye, cross-checked afterwards against the trajectory log (see 2.4)

### 2.4 Four required fixes to inference.py (~2h)
1. **Filling zeros when joint_state fails is a hidden hazard** (original lines 66–68): an all-zero state corrupts the model's input distribution. Change to 3 retries, then abort the trial
2. **No trial-level timeout/termination logic**: wrap the outer loop with the 60 s / no-progress stop
3. **No action logging**: append every commanded action to a CSV (trial_id, step, 6 joint values) — the data source for the "trajectory evidence plot"; mandatory
4. **No safety limits**: clamp actions to the follower's joint limits (read from the robot config) before sending

Note: fixing bugs is fine, but **inference parameters such as N_ACTION_STEPS=20 must stay identical across v1/v2 evaluations** (ablations are separate, see 6.2).

### 2.5 Run groups A and B
- Group A: v1 model + side-view webcam, 30 trials
- Group B: v1 model + Astra, 30 trials (**this half-day dissects V1's biggest confound — protect it at all costs**)

---

## 3. Phase 1: v2 Data Collection (~6h, week 2)

### 3.1 Data matrix: 5 objects × 6 positions × 2 container spots = 60 episodes
- Choose 5 objects with distinct colors/shapes, all graspable one-handed: e.g. red cube, blue cube, green cylinder, yellow ball, small pill bottle (the pill bottle echoes the aging-society narrative)
- 2 fixed container positions (left/right) as placement targets
- Reserve 1 **test-only novel object** (never in training)

### 3.2 Collection environment: record directly on the 3060 Ti (LeRobot v3.0)
v1 was recorded on the laptop with v2.1 and forced through format conversion + metadata surgery. This time the whole chain is v3.0 in one step, avoiding every pitfall in sections 3.3/3.4 of the journal. If the space does not allow it, fall back to laptop v2.1 + the proven conversion flow (remember to sync `info.json` / `episodes.jsonl` / `episodes_stats.jsonl`).

### 3.3 Language annotation (do it this time, for two reasons)
- The LeRobot data format natively supports a task field; add to the recording command `--tasks "pick up the red cube and place it in the left bin"` (confirm the exact v3 flag with `--help`; or write `meta/tasks.jsonl` afterwards)
- Uniform template: "pick up the {color} {object} and place it in the {left/right} bin"
- Reason 1: it is the raw material for the next-stage VLA (V1 lesson: retrofitting annotations later is expensive). Reason 2: a "language-annotated pick-place dataset" is clearly more valuable when published on HuggingFace

### 3.4 Quality rules (guard against "learning the noise in", per the CS231N reflection)
- Every episode: direct, smooth, one-shot motions; delete and re-record any failed/hesitant/dropped episode on the spot
- Deletions must go through the metadata-consistency flow (V1 lesson #8: sync mp4/parquet/info.json/episodes.jsonl)
- Randomize recording order
- Every episode ends with an explicit return to the home pose (a consistent terminal state for the model)
- QC immediately after recording: replay 2–3 spot-check episodes + file count == episode count
- **Double backup**: compress a copy to cloud storage right after recording (V1 lost an episode once)

---

## 4. Phase 2: Training (~2h unattended, week 2)

Identical to v1 except the dataset name and output directory:

```bash
cd ~/lerobot && nohup python -m lerobot.scripts.lerobot_train \
  --dataset.repo_id rgb_pick_place_v2 \
  --dataset.video_backend pyav \
  --policy.type act \
  --policy.repo_id rgb_diverse_v2 \
  --output_dir ./outputs/rgb_v2 \
  --job_name rgb_v2 \
  --steps 50000 \
  --eval.n_episodes 9 \
  --eval.batch_size 5 \
  --wandb.enable false \
  > ~/train_v2.log 2>&1 &
```

- Save more checkpoints (e.g. save_freq=10000, flag name per v3) as material for the 6.1 "success rate vs steps" curve
- Keep the full train_v2.log; afterwards parse it into a training-curve figure (v1 vs v2 overlaid)
- Record reproducibility info in the README: GPU model, `pip freeze`, dataset version

---

## 5. Phase 3: v2 Evaluation & Analysis (~5h, week 3)

### 5.1 Group C: in-distribution
6 training positions × 5 trials × (any 2–3 objects) = 30 trials, protocol identical to A/B.

### 5.2 OOD tests (cheap and central to the story — do not cut)
- 2 new positions × 5 trials = 10 trials → bar chart of "training positions vs new positions"
- (optional) novel object × 5 trials → object generalization

### 5.3 Four deliverable figures (all the material for reports/video/essays)
1. **Main table**: rows A/B/C × columns pick-up rate / success rate, with n and a simple confidence interval (±15–18% at n=30; one sentence of explanation suffices — no statistical overkill)
2. **Trajectory evidence plot (the hardest figure of this project)**: x-axis = left-right object placement, y-axis = shoulder_pan commanded value of the first action segment per trial. v1 is expected to be a flat line (ignores object position → memory); v2 is expected to show slope (follows vision → real generalization). **This turns "is it watching or reciting" into a number**
3. OOD bar chart (in-distribution vs new positions)
4. Training curves v1 vs v2 overlaid

---

## 6. Optional Ablations (only if time remains; can spill past RD)

| Ablation | Cost | Notes |
|---|---|---|
| 6.1 Success rate vs checkpoint | ~1.5h eval | test 10k/20k/40k/50k × 12 trials each; tests the "50k steps on small data = memorization" hypothesis |
| 6.2 N_ACTION_STEPS 1/5/20 | ~1h | benefit of more frequent replanning |
| 6.3 Equal-size control: subsample 49 of 60 episodes and retrain | 78min train + 1h eval | separates "more data" from "more diverse data" — the purest scientific ablation, and it reads beautifully in an application |
| 6.4 Image augmentation (color-jitter etc.) | check config | one control group if v3 training config supports it |

---

## 7. Phase 4: Release (~5h, week 3)

1. **GitHub**: suggested structure `patches/` (4 source patches), `scripts/` (inference/verification), `eval/` (protocol + sheets + scripts), `results/` (the four figures), `README` (the 18-pitfall summary + v1→v2 comparison table)
2. **HuggingFace**: v2 dataset (language-annotated) + model cards for v1/v2 stating the comparison
3. **Demo video (1.5–2 min)**: 15 s problem showcase (v1's blind reaching + counter) → 20 s method on one page → 30 s v2 success montage → 10 s OOD test and limitations → GitHub/HF links at the end
4. **Activity-list entry**: `Built robot imitation-learning pipeline (data→train→deploy); diagnosed overfitting from low-diversity data; redesigned dataset, boosting success 0%→XX% (n=60).`
5. **Additional Info**: two or three sentences + links

---

## 8. Schedule and Cut Order

| Week | Content | Hours |
|---|---|---|
| W1 (10.8–10.14) | all of Phase 0 + inference.py hardening + first GitHub version | ~10h |
| W2 (10.15–10.21) | Phase 1 collection + Phase 2 training | ~8h |
| W3 (10.22–10.28) | Phase 3 evaluation & analysis + Phase 4 release | ~8h |

~26h total, at the top of the budget. **If time runs short, cut in this order** (first cut first):
1. 6.1 checkpoint curve (most expensive)
2. 6.2 N_ACTION_STEPS ablation
3. novel-object OOD test
4. 6.3/6.4 equal-size and augmentation ablations (defer past RD)
5. **Try hard to keep**: the group-B camera ablation (half a day) and the 5.2 new-position test (very cheap) — they are the pivots of the attribution chain and the generalization story

---

## 9. If v2 Fails Too (Contingency)

That is still a valid finding — debug in this order and report honestly:
1. Data QC: replay spot-checks for hesitant/failed episodes that slipped in
2. Did the camera mount drift from collection time (compare first frames of collection videos)
3. Was the evaluation protocol executed consistently (lighting / home pose / timeout judgment)
4. If all check out → the conclusion becomes "5×6×2 diversity is still not enough to break position memorization, pointing at capacity and termination signals as additional factors" — an honest record is worth more than a pretty number, and it stands equally well in application essays

## 10. Explicitly Out of Scope (goes into future work)

- VLA / SmolVLA / Pi0 migration (narrated in essays as "the designed next step")
- Full DAgger closed loop (describe the experiment design in writing)
- Depth channel, multi-task, larger-scale data
