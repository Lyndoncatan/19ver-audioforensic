import os
import torch
import soundfile as sf
import json
import io
from pydub import AudioSegment
from pyannote.audio import Pipeline
from huggingface_hub import login

# --- 1. LOCAL FFMEPG SETUP ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FFMPEG_DIR = os.path.join(BASE_DIR, "ffmpeg")
os.environ["PATH"] += os.pathsep + FFMPEG_DIR

AudioSegment.converter = os.path.join(FFMPEG_DIR, "ffmpeg.exe")
AudioSegment.ffprobe = os.path.join(FFMPEG_DIR, "ffprobe.exe")

# --- 2. AUTHENTICATION (Updated for Security) ---
# This will now look for the token in your computer's environment variables
HF_TOKEN = os.getenv("HF_TOKEN") 

def run_forensic_analysis(audio_path):
    print(f"\n[INFO] Initializing Offline Forensic Analysis...")
    
    if not HF_TOKEN:
        print("[ERROR] Hugging Face Token not found! Please set the HF_TOKEN environment variable.")
        return

    try:
        login(token=HF_TOKEN)
        
        print("[INFO] Building AI Brain from local cache...")
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", 
            token=HF_TOKEN
        )
        
        pipeline.to(torch.device("cpu"))

        print(f"[INFO] Decoding: {os.path.basename(audio_path)}")
        audio = AudioSegment.from_file(audio_path).set_frame_rate(16000).set_channels(1)
        
        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        buffer.seek(0)
        data, samplerate = sf.read(buffer)
        waveform = torch.tensor(data).float().unsqueeze(0)

        print("[INFO] Analyzing voices... (Processing locally)")
        diarization = pipeline({"waveform": waveform, "sample_rate": samplerate})

        json_output = {
            "fileName": os.path.basename(audio_path),
            "totalDuration": round(len(audio) / 1000.0, 2),
            "segments": []
        }

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            json_output["segments"].append({
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
                "speaker": speaker
            })

        output_file = os.path.join(BASE_DIR, "analysis_results.json")
        with open(output_file, 'w') as f:
            json.dump(json_output, f, indent=4)

        print("\n" + "="*45)
        print(f" SUCCESS: Results saved to analysis_results.json")
        print("="*45)
        
    except Exception as e:
        print(f"\n[ERROR] Analysis failed: {e}")

if __name__ == "__main__":
    target_audio = os.path.join(BASE_DIR, "test_audio.wav")
    if os.path.exists(target_audio):
        run_forensic_analysis(target_audio)
    else:
        print(f"[!] File not found: {target_audio}")