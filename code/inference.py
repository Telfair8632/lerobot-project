"""ACT model inference — runs on the 3060 Ti machine and drives the robot arm autonomously."""
import torch
import cv2
import numpy as np
import time
from pathlib import Path

# ====== Configuration ======
CHECKPOINT = Path.home() / "050000" / "pretrained_model"
CAMERA_INDEX = 0
FOLLOWER_PORT = "COM3"
FPS = 30
N_ACTION_STEPS = 20  # execute 20 steps per inference (first 20 of the 100-step chunk)

# ====== 1. Load the model ======
print("Loading model...")
from lerobot.policies.act.modeling_act import ACTPolicy
policy = ACTPolicy.from_pretrained(CHECKPOINT)
policy.to("cuda").eval()
print(f"  Inputs: {policy.config.input_features}")
print(f"  Outputs: {policy.config.output_features}")
print("Model ready!")

# ====== 2. Open the camera ======
print("Opening camera...")
cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_MSMF)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
cap.set(cv2.CAP_PROP_FPS, FPS)
ret, test_frame = cap.read()
if not ret:
    raise RuntimeError("Failed to read from camera")
print(f"  Camera: {test_frame.shape}")

# ====== 3. Connect the robot arm ======
print("Connecting robot...")
from lerobot.robots.so101_follower import SO101Follower, SO101FollowerConfig
from lerobot.cameras.opencv.configuration_opencv import OpenCVCameraConfig

robot_config = SO101FollowerConfig(
    port=FOLLOWER_PORT,
    id="inference_arm",
)
robot = SO101Follower(robot_config)
robot.connect()
print(f"  Robot connected on {FOLLOWER_PORT}")

# ====== 4. Inference loop ======
print("\n" + "="*50)
print("Ready for inference. Press Enter to start, Ctrl+C to stop.")
print("="*50)
input()

try:
    step = 0
    while True:
        loop_start = time.time()

        # 4a. Capture the current observation
        ret, frame_bgr = cap.read()
        if not ret:
            print("Camera read failed")
            continue
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        joint_state = robot.get_joint_positions()
        if joint_state is None:
            joint_state = np.zeros(6, dtype=np.float32)

        # 4b. Build the model input
        img_tensor = torch.from_numpy(frame_rgb).float().permute(2, 0, 1) / 255.0  # [3,480,640]
        state_tensor = torch.tensor(joint_state, dtype=torch.float32)

        batch = {
            "observation.images.front": img_tensor.unsqueeze(0).cuda(),
            "observation.state": state_tensor.unsqueeze(0).cuda(),
        }

        # 4c. Inference
        with torch.no_grad():
            action_chunk = policy.predict_action_chunk(batch)  # [1, 100, 6]
        actions = action_chunk[0].cpu().numpy()  # [100, 6]

        # 4d. Execute the first N steps
        for i in range(N_ACTION_STEPS):
            robot.set_joint_positions(actions[i].tolist())
            time.sleep(1.0 / FPS)

        # 4e. Logging
        step += 1
        elapsed = time.time() - loop_start
        print(f"  Step {step}: executed {N_ACTION_STEPS} actions in {elapsed:.2f}s")

except KeyboardInterrupt:
    print("\nStopping...")

finally:
    robot.disconnect()
    cap.release()
    print("Done.")
