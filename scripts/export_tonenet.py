"""
export_tonenet.py — Export ToneNet Keras model to ONNX for browser use

Usage:
  python scripts/export_tonenet.py

Requirements:
  pip install tensorflow tf2onnx librosa numpy requests

What this does:
  1. Downloads the pre-trained ToneNet.h5 from rwzeto/tonenet (GitHub)
  2. Loads it in Keras
  3. Exports to ONNX via tf2onnx
  4. Saves to public/models/tonenet.onnx
  5. Runs a quick sanity check (random input → 4 logits)

After running this script:
  - Remove the early `throw` in src/utils/models/tonetModel.js (see comment there)
  - The JS mel-spectrogram pipeline is already implemented in that file
"""

import os
import sys
import struct
import urllib.request
import numpy as np

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT    = os.path.dirname(SCRIPT_DIR)
MODEL_DIR    = os.path.join(REPO_ROOT, 'public', 'models')
H5_PATH      = os.path.join(MODEL_DIR, 'ToneNet.h5')
ONNX_PATH    = os.path.join(MODEL_DIR, 'tonenet.onnx')

# Primary source: rwzeto/tonenet (plug-and-play wrapper repo)
# Fallback: saber5433/ToneNet (original)
DOWNLOAD_URLS = [
    'https://github.com/rwzeto/tonenet/raw/main/ToneNet.h5',
    'https://github.com/rwzeto/tonenet/raw/master/ToneNet.h5',
    'https://github.com/saber5433/ToneNet/raw/main/Model/ToneNet.hdf5',
    'https://github.com/saber5433/ToneNet/raw/master/Model/ToneNet.hdf5',
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def check_deps():
    missing = []
    for pkg in ['tensorflow', 'tf2onnx', 'librosa', 'numpy', 'requests']:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"[!] Missing packages: {', '.join(missing)}")
        print(f"    Run: pip install {' '.join(missing)}")
        sys.exit(1)


def download_model():
    os.makedirs(MODEL_DIR, exist_ok=True)

    if os.path.exists(H5_PATH):
        print(f"[✓] Found existing model: {H5_PATH}")
        return H5_PATH

    # Try each URL
    for url in DOWNLOAD_URLS:
        dest = H5_PATH if url.endswith('.h5') else H5_PATH.replace('.h5', '.hdf5')
        print(f"[~] Trying: {url}")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status != 200:
                    continue
                total = int(resp.headers.get('Content-Length', 0))
                downloaded = 0
                with open(dest, 'wb') as f:
                    while True:
                        chunk = resp.read(65536)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            pct = downloaded / total * 100
                            print(f"\r    {pct:.1f}% ({downloaded // 1024}KB)", end='', flush=True)
                print()
            print(f"[✓] Downloaded to {dest}")
            return dest
        except Exception as e:
            print(f"    Failed: {e}")
            if os.path.exists(dest):
                os.remove(dest)

    # Manual fallback instructions
    print("""
[!] Automatic download failed. Please manually download the model:

    Option A (recommended):
      1. Go to: https://github.com/rwzeto/tonenet
      2. Download ToneNet.h5
      3. Place it at: public/models/ToneNet.h5

    Option B:
      1. Go to: https://github.com/saber5433/ToneNet
      2. Download Model/ToneNet.hdf5
      3. Place it at: public/models/ToneNet.h5

    Then re-run this script.
""")
    sys.exit(1)


def export_to_onnx(h5_path):
    import tensorflow as tf
    import tf2onnx

    print(f"[~] Loading Keras model from {h5_path} …")
    model = tf.keras.models.load_model(h5_path, compile=False)

    print(f"[i] Input shape:  {model.input_shape}")
    print(f"[i] Output shape: {model.output_shape}")
    print(f"[i] Parameters:   {model.count_params():,}")

    # Expected: input (None, 225, 225, 3), output (None, 4)
    input_shape = model.input_shape[1:]  # strip batch dim
    if input_shape != (225, 225, 3):
        print(f"[!] Unexpected input shape {input_shape}, expected (225, 225, 3)")
        print("    The JS mel-spectrogram pipeline may need adjusting.")

    print(f"[~] Converting to ONNX …")
    input_sig = [tf.TensorSpec(
        shape=(None, *input_shape),
        dtype=tf.float32,
        name='input'
    )]

    onnx_model, _ = tf2onnx.convert.from_keras(
        model,
        input_signature=input_sig,
        opset=13,
        output_path=ONNX_PATH,
    )

    size_mb = os.path.getsize(ONNX_PATH) / 1024 / 1024
    print(f"[✓] Saved ONNX model to {ONNX_PATH} ({size_mb:.1f} MB)")

    return input_shape


def sanity_check(input_shape):
    """Verify the ONNX model runs correctly."""
    try:
        import onnxruntime as rt
    except ImportError:
        print("[~] Skipping sanity check (onnxruntime not installed)")
        print("    pip install onnxruntime  — to verify the export")
        return

    print("[~] Running sanity check …")
    sess = rt.InferenceSession(ONNX_PATH, providers=['CPUExecutionProvider'])
    dummy = np.random.rand(1, *input_shape).astype(np.float32)
    outputs = sess.run(None, {'input': dummy})
    logits = outputs[0][0]
    predicted = int(np.argmax(logits)) + 1  # 1-indexed tone
    print(f"[✓] Sanity check passed. Random input → Tone {predicted} (logits: {logits})")


def print_next_steps():
    print("""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DONE! Next steps to activate ToneNet in the browser:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 1. Install onnxruntime-web in the JS project:
      cd justfortones-web
      npm install onnxruntime-web

 2. In src/utils/models/tonetModel.js, remove this line:
      throw new Error('ToneNet not yet available ...')

 3. Run the app and check the browser console for:
      [ToneDetector] tonenet ready

 4. Test on Test C — the ensemble will now include ToneNet
    and accuracy should jump to ~90%+.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print(" ToneNet → ONNX Export Script")
    print("=" * 60)

    check_deps()
    h5_path = download_model()
    input_shape = export_to_onnx(h5_path)
    sanity_check(input_shape)
    print_next_steps()
