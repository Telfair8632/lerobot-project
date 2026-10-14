"""Load the ACT model trained with LeRobot v3.0 and test inference."""
import json, torch, shutil
from pathlib import Path
from safetensors.torch import load_file

CKPT = Path.home() / "Desktop" / "050000" / "pretrained_model"
CKPT_DIR = Path.home() / "Desktop" / "050000"

# ========== 1. Load the cleaned config ==========
with open(CKPT / "config.json") as f:
    cfg = json.load(f)

from lerobot.configs.types import PolicyFeature, FeatureType, NormalizationMode

input_features = {}
for k, v in cfg['input_features'].items():
    input_features[k] = PolicyFeature(type=FeatureType(v['type']), shape=tuple(v['shape']))
output_features = {}
for k, v in cfg['output_features'].items():
    output_features[k] = PolicyFeature(type=FeatureType(v['type']), shape=tuple(v['shape']))
norm_map = {k: NormalizationMode(v) for k, v in cfg.get('normalization_mapping', {}).items()}

valid_keys = {
    'n_obs_steps', 'chunk_size', 'n_action_steps', 'vision_backbone',
    'pretrained_backbone_weights', 'replace_final_stride_with_dilation', 'pre_norm',
    'dim_model', 'n_heads', 'dim_feedforward', 'feedforward_activation',
    'n_encoder_layers', 'n_decoder_layers', 'use_vae', 'latent_dim',
    'n_vae_encoder_layers', 'temporal_ensemble_coeff', 'dropout', 'kl_weight',
    'optimizer_lr', 'optimizer_weight_decay', 'optimizer_lr_backbone',
}
act_kwargs = {k: cfg[k] for k in valid_keys if k in cfg}
act_kwargs['input_features'] = input_features
act_kwargs['output_features'] = output_features
act_kwargs['normalization_mapping'] = norm_map

# ========== 2. Build ACTConfig + ACTPolicy ==========
from lerobot.policies.act.configuration_act import ACTConfig
config = ACTConfig(**act_kwargs)
print(f"Config: {config.type}, backbone={config.vision_backbone}, dim={config.dim_model}")
print(f"  Image: {list(config.image_features.keys())}")
print(f"  Action: {config.action_feature.shape}")

from lerobot.policies.act.modeling_act import ACTPolicy
policy = ACTPolicy(config)

# ========== 3. Load weights + restore normalization stats ==========
state_dict = load_file(str(CKPT / "model.safetensors"))

# Load normalization stats from the preprocessor/postprocessor files
preproc_path = CKPT_DIR.parent / "pretrained_model" / "policy_preprocessor_step_3_normalizer_processor.safetensors"
postproc_path = CKPT_DIR.parent / "pretrained_model" / "policy_postprocessor_step_0_unnormalizer_processor.safetensors"

# The preprocessor/postprocessor files actually live in 050000/pretrained_model/
import os
pp_dir = CKPT_DIR / "pretrained_model"
for f in os.listdir(pp_dir):
    print(f"  File: {f}")

preproc = load_file(str(pp_dir / "policy_preprocessor_step_3_normalizer_processor.safetensors"))
postproc = load_file(str(pp_dir / "policy_postprocessor_step_0_unnormalizer_processor.safetensors"))
print(f"Preproc keys: {list(preproc.keys())[:5]}...")
print(f"Postproc keys: {list(postproc.keys())[:5]}...")

# Map the preprocessor/postprocessor normalization stats onto the policy's
# missing normalize_* layers:
#   preproc  -> normalize_inputs stats
#   postproc -> unnormalize_outputs stats + normalize_targets stats
for key in state_dict:
    if key in preproc:
        policy.state_dict()[key].copy_(preproc[key])
    if key in postproc:
        policy.state_dict()[key].copy_(postproc[key])

missing, unexpected = policy.load_state_dict(state_dict, strict=False)
print(f"\nLoaded {len(state_dict)} tensors. Missing: {len(missing)}, Unexpected: {len(unexpected)}")
if missing: print(f"  Missing: {missing}")

# Manually fill the missing normalization buffers (assigned straight from preproc/postproc)
from collections import OrderedDict
for name, param in policy.named_parameters():
    if name in preproc:
        param.data.copy_(preproc[name])
for name, buf in policy.named_buffers():
    full_name = name
    if full_name in preproc:
        buf.data.copy_(preproc[full_name])
    elif full_name in postproc:
        buf.data.copy_(postproc[full_name])

policy.eval()
print("Model ready!")

# ========== 4. Inference smoke test ==========
# ACTPolicy.forward accepts a batch dict
img = torch.randn(1, 3, 480, 640)  # RGB
state = torch.randn(1, 6)

batch = {
    "observation.images.front": img,
    "observation.state": state,
}
with torch.no_grad():
    actions = policy.predict_action_chunk(batch)
print(f"\nInput: img={list(img.shape)}, state={list(state.shape)}")
print(f"Predicted action chunk: {list(actions.shape)}")
print(f"Sample action: {actions[0, 0].tolist()}")
print("\nDone! Model is ready for inference.")
