# ML Models

## basic-pitch.onnx
- **Source:** Spotify Basic Pitch (ICASSP 2022)
- **License:** Apache 2.0
- **Size:** ~5MB
- **Input:** 22050Hz mono audio, ~2s windows
- **Output:** note frames (88 bins), onset frames (88 bins), contour frames (360 bins)
- **Paper:** https://arxiv.org/abs/2210.01524

### Download Instructions

The model file is not checked into git (too large). To obtain it:

1. **From Python basic-pitch package:**
   ```bash
   pip install basic-pitch
   python3 -c "
   from basic_pitch import ICASSP_2022_MODEL_PATH
   import shutil
   shutil.copy(ICASSP_2022_MODEL_PATH, 'assets/models/basic-pitch.onnx')
   "
   ```

2. **From Spotify GitHub:**
   Visit https://github.com/spotify/basic-pitch/tree/main/basic_pitch/saved_models/icassp_2022/nmp
   and convert the SavedModel to ONNX format using `tf2onnx`.

Note: The app gracefully falls back to monophonic YIN detection if the model is unavailable.
