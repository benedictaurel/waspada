# Driver Drowsiness Detection

A modular real-time prototype that detects prolonged eye closure using MediaPipe facial landmarks and Eye Aspect Ratio (EAR). It includes IR-oriented grayscale normalization, optional CLAHE contrast enhancement, frame skipping, an on-screen debug overlay, and a dependency-free audible alert.

## Setup

Use 64-bit Python 3.11 (recommended), or Python 3.10/3.12. Python 3.13 and
3.14 are not compatible with the pinned MediaPipe Tasks runtime on Windows.
Check the interpreter before creating the environment:

```powershell
python --version
```

If multiple Python versions are installed, select 3.11 explicitly:

```powershell
cd eye-drowsiness-detection
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install --only-binary=:all: -r requirements.txt
```

`--only-binary=:all:` deliberately prevents pip from attempting a lengthy local
NumPy or MediaPipe compilation when the interpreter is unsupported.

MediaPipe 0.10 installs the OpenCV contrib distribution, so the requirements use that single OpenCV package to avoid competing `cv2` installations. For a truly headless Raspberry Pi image, replace it with `opencv-contrib-python-headless` using a platform-specific lock file after confirming a compatible MediaPipe wheel for the Pi's OS, architecture, and Python version.

## Run

```powershell
python -m drowsiness_pipeline.main
```

Press `q` or Escape to exit. Useful deployment options:

```powershell
python -m drowsiness_pipeline.main --clahe --width 320 --height 240
python -m drowsiness_pipeline.main --no-display --process-every 2
python -m drowsiness_pipeline.main --ear-threshold 0.22 --consecutive-frames 18
```

Defaults follow the implementation plan: EAR below `0.22` for 18 processed frames triggers an alert. Tune both values for the driver, camera, lighting, and effective inference rate. If `--process-every` is greater than 1, the counter is based on processed frames, so reduce `--consecutive-frames` to retain the same wall-clock trigger delay.

The detector uses MediaPipe's Tasks Face Landmarker API with the official model
stored at `drowsiness_pipeline/models/face_landmarker.task`. A different model
can be selected with `--model-path`. Eye landmarks are converted to pixel
coordinates before EAR calculation to avoid aspect-ratio distortion.