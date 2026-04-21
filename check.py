import torch

ckpt = torch.load("best_model.pth", map_location="cpu")

if isinstance(ckpt, dict):
    print("Keys:", list(ckpt.keys()))
else:
    print("Raw state dict, keys:", len(ckpt))

state = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt

print("\n--- Classifier weights ---")
for k, v in state.items():
    if "classifier" in k:
        print(f"{k}: shape={v.shape}, mean={v.float().mean():.6f}, std={v.float().std():.6f}")

print("\n--- Overall weight stats ---")
all_means = [v.float().mean().item() for v in state.values() if v.dtype in [torch.float32, torch.float16]]
print(f"Average mean across all layers: {sum(all_means)/len(all_means):.6f}")
print(f"Total layers: {len(all_means)}")