"""
train_tone_classifier.py
========================
Colab notebook to fine-tune DistilHuBERT for Mandarin tone classification (tones 1–4).
Copy each cell (separated by # %%) into a new Colab notebook and run top-to-bottom.

Runtime: GPU (Runtime → Change runtime type → T4 GPU)
Time: ~45 min total (data gen 15min, training 20min, export 10min)
Output: tone_classifier_int8.onnx (~24MB) — download and put in public/models/
"""

# %% [markdown]
# # Mandarin Tone Classifier — DistilHuBERT Fine-tuning
# Trains a 4-class audio classifier (tones 1–4) using synthetic TTS data,
# exports to ONNX INT8 for browser use with onnxruntime-web.

# %% Cell 1 — Install dependencies
# Colab already has transformers, torch, torchaudio, librosa — don't reinstall them.
# Only install packages Colab is missing.
!pip install -q edge-tts audiomentations evaluate optimum onnx soundfile

# Verify transformers is healthy before proceeding
import transformers, torch
print(f"transformers {transformers.__version__}  |  torch {torch.__version__}  |  GPU: {torch.cuda.is_available()}")
# Should print something like: transformers 4.47.x | torch 2.x | GPU: True
# If GPU: False → Runtime → Change runtime type → T4 GPU

# %% Cell 2 — Syllable + character data
# 50 syllables that have all 4 tones in common Mandarin words.
# Each entry: syllable → [T1_char, T2_char, T3_char, T4_char]

SYLLABLE_CHARS = {
    'ma':   ['妈', '麻', '马', '骂'],
    'ba':   ['巴', '拔', '把', '爸'],
    'da':   ['搭', '达', '打', '大'],
    'ta':   ['他', '踏', '塔', '踏'],
    'na':   ['拿', '拿', '哪', '那'],
    'la':   ['拉', '拉', '喇', '腊'],
    'ga':   ['噶', '轧', '嘎', '噶'],
    'ha':   ['哈', '哈', '哈', '哈'],
    'ka':   ['咖', '卡', '卡', '卡'],
    'sha':  ['沙', '痧', '傻', '煞'],
    'fa':   ['发', '乏', '法', '罚'],
    'wan':  ['弯', '完', '晚', '万'],
    'man':  ['蛮', '馒', '满', '慢'],
    'tan':  ['滩', '谈', '坦', '叹'],
    'can':  ['餐', '残', '惨', '灿'],
    'han':  ['憨', '寒', '喊', '汉'],
    'lan':  ['拦', '蓝', '懒', '烂'],
    'yang': ['央', '阳', '养', '样'],
    'tang': ['汤', '唐', '躺', '烫'],
    'wang': ['汪', '王', '往', '旺'],
    'fang': ['方', '房', '访', '放'],
    'bang': ['帮', '膀', '绑', '棒'],
    'gang': ['刚', '钢', '港', '杠'],
    'yi':   ['一', '移', '以', '意'],
    'bi':   ['逼', '鼻', '比', '必'],
    'di':   ['低', '敌', '底', '地'],
    'ti':   ['梯', '题', '体', '替'],
    'ni':   ['妮', '泥', '你', '逆'],
    'li':   ['离', '力', '里', '力'],
    'ji':   ['机', '极', '己', '计'],
    'qi':   ['期', '其', '起', '气'],
    'xi':   ['西', '习', '喜', '细'],
    'mi':   ['迷', '谜', '米', '密'],
    'you':  ['优', '由', '有', '又'],
    'tou':  ['偷', '头', '抖', '透'],
    'gou':  ['沟', '猴', '狗', '够'],
    'kou':  ['抠', '口', '口', '扣'],
    'mei':  ['眉', '没', '美', '妹'],
    'fei':  ['飞', '肥', '匪', '费'],
    'wei':  ['威', '围', '委', '位'],
    'bei':  ['杯', '北', '被', '背'],
    'shu':  ['书', '熟', '鼠', '树'],
    'zhu':  ['猪', '竹', '主', '住'],
    'chu':  ['出', '除', '处', '处'],
    'yu':   ['鱼', '鱼', '语', '玉'],
    'lu':   ['驴', '鹿', '旅', '路'],
    'zhi':  ['知', '直', '纸', '至'],
    'chi':  ['吃', '迟', '齿', '斥'],
    'shi':  ['诗', '时', '史', '是'],
    'tong': ['通', '同', '桶', '痛'],
    'dong': ['东', '动', '懂', '冻'],
    'long': ['龙', '龙', '拢', '弄'],
    'gong': ['工', '共', '拱', '贡'],
    'hong': ['轰', '红', '哄', '哄'],
    'xiao': ['消', '肖', '小', '笑'],
    'jiao': ['交', '嚼', '饺', '叫'],
    'yao':  ['腰', '摇', '咬', '要'],
    'mao':  ['猫', '毛', '冒', '帽'],
    'hao':  ['蒿', '豪', '好', '号'],
    'xue':  ['靴', '学', '雪', '血'],
    'yue':  ['约', '月', '岳', '乐'],
}

print(f"Total syllables: {len(SYLLABLE_CHARS)}")
print(f"Total samples before augment: {len(SYLLABLE_CHARS) * 4} per voice")

# %% Cell 3 — Generate TTS audio with edge-tts
import asyncio
import edge_tts
import os, json

DATA_DIR = '/content/tone_data'
os.makedirs(DATA_DIR, exist_ok=True)

# 7 Chinese voices (mix of male/female, mainland/Taiwan)
VOICES = [
    'zh-CN-XiaoxiaoNeural',   # female, standard
    'zh-CN-YunxiNeural',      # male, standard
    'zh-CN-XiaoyiNeural',     # female, warm
    'zh-CN-YunjianNeural',    # male, deep
    'zh-CN-XiaochenNeural',   # female, clear
    'zh-TW-HsiaoChenNeural',  # female, Taiwan
    'zh-TW-YunJheNeural',     # male, Taiwan
]

async def generate_one(char, voice, out_path, retries=3):
    """Generate TTS for one character with retries. Returns True on success."""
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(char, voice, rate='-10%')
            await communicate.save(out_path)
            # Verify file has actual content (>1KB means audio received)
            if os.path.exists(out_path) and os.path.getsize(out_path) > 1024:
                return True
            if os.path.exists(out_path):
                os.remove(out_path)
        except Exception:
            if os.path.exists(out_path):
                os.remove(out_path)
        await asyncio.sleep(0.3 * (attempt + 1))  # back-off
    return False

async def generate_all():
    metadata = []
    tasks = []

    for syllable, chars in SYLLABLE_CHARS.items():
        for tone_idx, char in enumerate(chars):
            tone = tone_idx + 1
            for voice_idx, voice in enumerate(VOICES):
                fname = f"{syllable}_t{tone}_v{voice_idx}.mp3"
                out_path = os.path.join(DATA_DIR, fname)
                if not os.path.exists(out_path) or os.path.getsize(out_path) < 1024:
                    tasks.append((char, voice, out_path, syllable, tone, voice_idx))

    print(f"Generating {len(tasks)} audio files...")
    failed = 0

    # Small batches with delay to avoid rate limiting
    batch_size = 20
    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i+batch_size]
        results = await asyncio.gather(*[
            generate_one(char, voice, path)
            for char, voice, path, *_ in batch
        ])
        for j, ok in enumerate(results):
            char, voice, path, syllable, tone, voice_idx = batch[j]
            if ok:
                metadata.append({
                    'file': path,
                    'syllable': syllable,
                    'tone': tone,
                    'char': char,
                    'voice': voice_idx,
                })
            else:
                failed += 1
        print(f"  {min(i+batch_size, len(tasks))}/{len(tasks)} processed | failed so far: {failed}")
        await asyncio.sleep(0.5)  # pause between batches

    # Also add already-existing files from a previous run
    for syllable, chars in SYLLABLE_CHARS.items():
        for tone_idx, char in enumerate(chars):
            tone = tone_idx + 1
            for voice_idx, voice in enumerate(VOICES):
                fname = f"{syllable}_t{tone}_v{voice_idx}.mp3"
                out_path = os.path.join(DATA_DIR, fname)
                already = {'file': out_path, 'syllable': syllable, 'tone': tone,
                           'char': char, 'voice': voice_idx}
                if already not in metadata and os.path.exists(out_path) and os.path.getsize(out_path) > 1024:
                    metadata.append(already)

    with open(os.path.join(DATA_DIR, 'metadata.json'), 'w') as f:
        json.dump(metadata, f)
    print(f"\nDone: {len(metadata)} succeeded, {failed} failed (skipped)")
    return metadata

metadata = await generate_all()

# %% Cell 4 — Convert MP3 → WAV at 16kHz, apply augmentation
import librosa
import soundfile as sf
import numpy as np
from audiomentations import Compose, AddGaussianNoise, TimeStretch, PitchShift, Gain
import random

WAV_DIR = '/content/tone_wav'
os.makedirs(WAV_DIR, exist_ok=True)

augment = Compose([
    AddGaussianNoise(min_amplitude=0.002, max_amplitude=0.015, p=0.5),
    TimeStretch(min_rate=0.90, max_rate=1.10, p=0.4),
    PitchShift(min_semitones=-1.5, max_semitones=1.5, p=0.4),
    Gain(min_gain_db=-6, max_gain_db=6, p=0.5),
])

wav_metadata = []

for item in metadata:
    mp3_path = item['file'] if os.path.isabs(item['file']) else os.path.join(DATA_DIR, item['file'])
    if not os.path.exists(mp3_path):
        continue

    try:
        audio, sr = librosa.load(mp3_path, sr=16000, mono=True)
    except Exception as e:
        print(f"Skip {mp3_path}: {e}")
        continue

    # Normalize
    audio = audio / (np.abs(audio).max() + 1e-8)

    # Save original
    base = os.path.splitext(os.path.basename(mp3_path))[0]
    wav_path = os.path.join(WAV_DIR, f"{base}_orig.wav")
    sf.write(wav_path, audio, 16000)
    wav_metadata.append({'file': wav_path, 'tone': item['tone'] - 1})  # 0-indexed label

    # Save 2 augmented versions
    for aug_i in range(2):
        aug_audio = augment(audio, sample_rate=16000)
        aug_path = os.path.join(WAV_DIR, f"{base}_aug{aug_i}.wav")
        sf.write(aug_path, aug_audio, 16000)
        wav_metadata.append({'file': aug_path, 'tone': item['tone'] - 1})

print(f"Total WAV samples (orig + 2x aug): {len(wav_metadata)}")

# Check tone distribution
from collections import Counter
dist = Counter(m['tone'] for m in wav_metadata)
print("Tone distribution:", {f'T{k+1}': v for k, v in sorted(dist.items())})

# %% Cell 5 — Build HuggingFace Dataset
import torch
import torchaudio
from datasets import Dataset, DatasetDict, Audio

# Split 80/20 train/val, stratified by tone
random.seed(42)
by_tone = {t: [] for t in range(4)}
for item in wav_metadata:
    by_tone[item['tone']].append(item)

train_items, val_items = [], []
for tone, items in by_tone.items():
    random.shuffle(items)
    split = int(len(items) * 0.8)
    train_items.extend(items[:split])
    val_items.extend(items[split:])

random.shuffle(train_items)
random.shuffle(val_items)

print(f"Train: {len(train_items)} | Val: {len(val_items)}")

def make_dataset(items):
    return Dataset.from_dict({
        'audio': [i['file'] for i in items],
        'label': [i['tone'] for i in items],
    }).cast_column('audio', Audio(sampling_rate=16000))

ds = DatasetDict({
    'train': make_dataset(train_items),
    'validation': make_dataset(val_items),
})
print(ds)

# %% Cell 6 — Load DistilHuBERT + feature extractor
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

MODEL_ID = 'ntu-spml/distilhubert'

feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_ID)

id2label = {0: 'tone_1', 1: 'tone_2', 2: 'tone_3', 3: 'tone_4'}
label2id = {v: k for k, v in id2label.items()}

model = AutoModelForAudioClassification.from_pretrained(
    MODEL_ID,
    num_labels=4,
    id2label=id2label,
    label2id=label2id,
    ignore_mismatched_sizes=True,
)

print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
print(f"Trainable parameters: {sum(p.numel() for p in model.parameters() if p.requires_grad):,}")

# %% Cell 7 — Preprocess: extract features
MAX_DURATION = 3.0  # seconds — clip/pad all audio to 3s
MAX_LENGTH = int(MAX_DURATION * 16000)

def preprocess(batch):
    audio_arrays = [x['array'] for x in batch['audio']]

    # Pad or truncate to MAX_LENGTH
    processed = []
    for arr in audio_arrays:
        if len(arr) > MAX_LENGTH:
            arr = arr[:MAX_LENGTH]
        else:
            arr = np.pad(arr, (0, MAX_LENGTH - len(arr)))
        processed.append(arr)

    inputs = feature_extractor(
        processed,
        sampling_rate=16000,
        max_length=MAX_LENGTH,
        truncation=True,
        padding=True,
        return_tensors='pt',
    )
    inputs['labels'] = torch.tensor(batch['label'])
    return inputs

ds_processed = ds.map(
    preprocess,
    batched=True,
    batch_size=32,
    remove_columns=['audio'],
    desc='Extracting features',
)
ds_processed.set_format('torch')

print("Processed dataset:")
print(ds_processed)

# %% Cell 8 — Train
from transformers import TrainingArguments, Trainer
import evaluate

accuracy_metric = evaluate.load('accuracy')

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return accuracy_metric.compute(predictions=preds, references=labels)

training_args = TrainingArguments(
    output_dir='/content/tone_model',
    eval_strategy='epoch',
    save_strategy='epoch',
    learning_rate=3e-5,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=32,
    num_train_epochs=15,
    warmup_ratio=0.1,
    logging_steps=20,
    load_best_model_at_end=True,
    metric_for_best_model='accuracy',
    fp16=True,          # use GPU half-precision
    dataloader_num_workers=2,
    report_to='none',
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=ds_processed['train'],
    eval_dataset=ds_processed['validation'],
    compute_metrics=compute_metrics,
)

trainer.train()

# %% Cell 9 — Evaluate final accuracy
results = trainer.evaluate()
print(f"\nFinal validation accuracy: {results['eval_accuracy']*100:.1f}%")

# Per-tone breakdown
from torch.nn.functional import softmax as torch_softmax

model.eval()
device = next(model.parameters()).device

correct = {t: 0 for t in range(4)}
total   = {t: 0 for t in range(4)}

val_loader = torch.utils.data.DataLoader(ds_processed['validation'], batch_size=64)
with torch.no_grad():
    for batch in val_loader:
        input_values = batch['input_values'].to(device)
        labels = batch['labels']
        logits = model(input_values).logits
        preds = logits.argmax(dim=-1).cpu()
        for pred, label in zip(preds, labels):
            total[label.item()] += 1
            if pred.item() == label.item():
                correct[label.item()] += 1

print("\nPer-tone accuracy:")
for t in range(4):
    pct = correct[t] / total[t] * 100 if total[t] > 0 else 0
    print(f"  Tone {t+1}: {correct[t]}/{total[t]} = {pct:.1f}%")

# %% Cell 10 — Save fine-tuned model
SAVE_DIR = '/content/tone_model_final'
model.save_pretrained(SAVE_DIR)
feature_extractor.save_pretrained(SAVE_DIR)
print(f"Saved to {SAVE_DIR}")

# %% Cell 11 — Export to ONNX
import torch.onnx

model.eval()
model.cpu()

# Dummy input: 3 seconds of silence at 16kHz
dummy_input = torch.zeros(1, MAX_LENGTH)

ONNX_PATH = '/content/tone_classifier.onnx'

torch.onnx.export(
    model,
    (dummy_input,),
    ONNX_PATH,
    input_names=['input_values'],
    output_names=['logits'],
    dynamic_axes={
        'input_values': {0: 'batch', 1: 'sequence'},
        'logits': {0: 'batch'},
    },
    opset_version=14,
    do_constant_folding=True,
)

import os
size_mb = os.path.getsize(ONNX_PATH) / 1024 / 1024
print(f"ONNX exported: {ONNX_PATH} ({size_mb:.1f} MB)")

# %% Cell 12 — INT8 Quantize
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

QUANT_PATH = '/content/tone_classifier_int8.onnx'

quantize_dynamic(
    ONNX_PATH,
    QUANT_PATH,
    weight_type=QuantType.QInt8,
)

size_mb_q = os.path.getsize(QUANT_PATH) / 1024 / 1024
print(f"INT8 quantized: {QUANT_PATH} ({size_mb_q:.1f} MB)")

# %% Cell 13 — Validate ONNX model
import onnxruntime as ort
import numpy as np

sess = ort.InferenceSession(QUANT_PATH, providers=['CPUExecutionProvider'])

# Test each tone with a sample from the validation set
print("ONNX validation (sample predictions):")
for tone in range(4):
    tone_items = [m for m in val_items if m['tone'] == tone][:3]
    for item in tone_items:
        audio, sr = librosa.load(item['file'], sr=16000, mono=True)
        # Pad/truncate
        if len(audio) > MAX_LENGTH:
            audio = audio[:MAX_LENGTH]
        else:
            audio = np.pad(audio, (0, MAX_LENGTH - len(audio)))
        # Normalize (feature extractor does this; replicate it)
        audio = (audio - audio.mean()) / (audio.std() + 1e-8)
        inp = audio[np.newaxis, :].astype(np.float32)
        logits = sess.run(None, {'input_values': inp})[0][0]
        pred = np.argmax(logits) + 1
        conf = int(np.exp(logits[np.argmax(logits)]) / np.exp(logits).sum() * 100)
        status = '✓' if pred == tone + 1 else '✗'
        print(f"  T{tone+1} → pred T{pred} ({conf}%) {status}")

# %% Cell 14 — Download
from google.colab import files

# Download the INT8 model (put in justfortones-web/public/models/)
files.download(QUANT_PATH)

# Also download FP32 for reference
files.download(ONNX_PATH)

print("""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Done! Next steps:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Copy tone_classifier_int8.onnx → public/models/tone_classifier.onnx

2. In src/utils/models/toneClassifierModel.js (new file):
   - Load with onnxruntime-web
   - Input: Float32Array [1, 48000] (3s at 16kHz, normalized)
   - Output: logits [1, 4] → softmax → tone 1-4

3. In toneDetector.js:
   - Re-enable with weight 0.85
   - Replace ToneNet with new model

Expected accuracy: 85-90% on real speech
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
