#!/bin/bash
# Upload a brane heightmap PNG to ComfyUI and queue an img2img generation.
# Usage: ./heightmap-to-comfy.sh <heightmap.png> [prompt] [denoise]
#
# Examples:
#   ./heightmap-to-comfy.sh ~/Downloads/brane-heightmap-*.png
#   ./heightmap-to-comfy.sh map.png "alien crystal cave, bioluminescent" 0.5
#   ./heightmap-to-comfy.sh map.png "oil painting, baroque" 0.65

COMFY="http://192.168.1.3:8188"
IMAGE="${1:?Usage: $0 <image.png> [prompt] [denoise]}"
PROMPT="${2:-organic alien landscape, cymatics patterns made physical, cinematic lighting, highly detailed}"
DENOISE="${3:-0.55}"
CHECKPOINT="sd_xl_base_1.0.safetensors"
SEED=$((RANDOM * RANDOM))

echo "Uploading: $(basename "$IMAGE")"
UPLOAD=$(curl -s -X POST "$COMFY/upload/image" \
    -F "image=@$IMAGE" \
    -F "overwrite=true")

FILENAME=$(echo "$UPLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
echo "Uploaded as: $FILENAME"

echo "Queuing img2img (denoise=$DENOISE, seed=$SEED)"
echo "Prompt: $PROMPT"

RESULT=$(curl -s -X POST "$COMFY/prompt" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "
import json
workflow = {
    '1': {'class_type': 'LoadImage', 'inputs': {'image': '$FILENAME'}},
    '2': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': '$CHECKPOINT'}},
    '3': {'class_type': 'CLIPTextEncode', 'inputs': {'text': '''$PROMPT''', 'clip': ['2', 1]}},
    '4': {'class_type': 'CLIPTextEncode', 'inputs': {'text': 'blurry, ugly, deformed, text, watermark', 'clip': ['2', 1]}},
    '5': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['1', 0], 'vae': ['2', 2]}},
    '6': {'class_type': 'KSampler', 'inputs': {
        'model': ['2', 0], 'positive': ['3', 0], 'negative': ['4', 0],
        'latent_image': ['5', 0], 'seed': $SEED, 'steps': 25,
        'cfg': 7.0, 'sampler_name': 'euler_ancestral', 'scheduler': 'normal',
        'denoise': $DENOISE
    }},
    '7': {'class_type': 'VAEDecode', 'inputs': {'samples': ['6', 0], 'vae': ['2', 2]}},
    '8': {'class_type': 'SaveImage', 'inputs': {'images': ['7', 0], 'filename_prefix': 'brane_diffusion'}}
}
print(json.dumps({'prompt': workflow}))
")")

PROMPT_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt_id','error'))")
echo "Job queued: $PROMPT_ID"
echo "Watch progress at: $COMFY"
echo "Output: brane_diffusion_*.png in ComfyUI output directory"
