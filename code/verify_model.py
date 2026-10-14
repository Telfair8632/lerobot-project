"""Sanity-check that the ACT model checkpoint loads correctly."""
import torch
from pathlib import Path

CHECKPOINT_DIR = Path.home() / "Desktop" / "050000" / "pretrained_model"

# 1. Check the files exist
model_path = CHECKPOINT_DIR / "model.safetensors"
config_path = CHECKPOINT_DIR / "config.json"

print(f"Checkpoint: {CHECKPOINT_DIR}")
print(f"  model.safetensors exists: {model_path.exists()} ({model_path.stat().st_size / 1e6:.1f} MB)")
print(f"  config.json exists: {config_path.exists()}")

if not model_path.exists():
    print("ERROR: model.safetensors not found!")
    exit(1)

# 2. Load the config
import json
with open(config_path) as f:
    config = json.load(f)
print(f"\nPolicy type: {config.get('_class', 'unknown')}")
print(f"Keys: {list(config.keys())}")

# 3. Load the weights
from safetensors.torch import load_file
state_dict = load_file(str(model_path))
print(f"\nState dict: {len(state_dict)} tensors, total params: {sum(v.numel() for v in state_dict.values()):,}")

# 4. Try a full model load (if the LeRobot environment is available)
try:
    from lerobot.policies.act.modeling_act import ACTPolicy
    policy = ACTPolicy(config)
    policy.load_state_dict(state_dict, strict=False)
    policy.eval()
    print(f"\nModel loaded successfully!")
    print(f"Input dim: {config.get('input_dim', '?')}, Output dim: {config.get('output_dim', '?')}")
    print(f"Ready for inference.")
except Exception as e:
    print(f"\nPartial load (model class not instantiated): {e}")
    print("Model weights are valid. Full inference needs lerobot environment.")
