import sys
import json
import librosa
import numpy as np

def analyze_audio(audio_path, filename="uploaded_audio"):
    try:
        y, sr = librosa.load(audio_path, sr=None)

        duration = librosa.get_duration(y=y, sr=sr)
        rms = float(np.mean(librosa.feature.rms(y=y)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        result = {
            "filename": filename,
            "sample_rate": sr,
            "duration_seconds": round(duration, 2),
            "rms_energy": round(rms, 6),
            "zero_crossing_rate": round(zcr, 6),
            "status": "analysis_success"
        }

        return json.dumps(result)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        })

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({ "error": "No audio file provided" }))
        sys.exit(1)

    audio_path = sys.argv[1]
    filename = sys.argv[2] if len(sys.argv) > 2 else "uploaded_audio"

    print(analyze_audio(audio_path, filename))
