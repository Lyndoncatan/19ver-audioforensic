import librosa
import numpy as np
from scipy.signal import find_peaks
import json
import base64
import tempfile
import os
from datetime import datetime
import matplotlib
matplotlib.use('Agg')  # For server environments

def generate_live_analysis(audio_bytes, filename="uploaded_audio"):
    """
    Generate comprehensive live audio analysis with multiple visualizations.
    Accepts raw audio bytes (e.g., from uploaded file) instead of base64.
    Returns a JSON-serializable dictionary.
    """
    try:
        # Save temporary WAV file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        # Load audio
        y, sr = librosa.load(temp_path, sr=None)
        duration = librosa.get_duration(y=y, sr=sr)

        # --- STFT ---
        stft_result = librosa.stft(y, hop_length=512, n_fft=2048)
        stft_db = librosa.amplitude_to_db(np.abs(stft_result), ref=np.max)
        time_frames = librosa.frames_to_time(np.arange(stft_db.shape[1]), sr=sr, hop_length=512)
        freq_bins = librosa.fft_frequencies(sr=sr, n_fft=2048)
        stft_data = {"z": stft_db.tolist(), "x": time_frames.tolist(), "y": freq_bins.tolist(), "type": "heatmap"}

        # --- FFT ---
        fft_result = np.fft.fft(y)
        magnitude = np.abs(fft_result)
        frequency = np.linspace(0, sr, len(magnitude))
        fft_data = {"x": frequency[:len(frequency)//2].tolist(), "y": magnitude[:len(magnitude)//2].tolist(),
                    "type": "scatter", "mode": "lines"}

        # --- Energy & Peaks ---
        frame_length = 1024
        hop_length = 512
        energy = np.array([sum(abs(y[i:i+frame_length]**2)) for i in range(0, len(y), hop_length)])
        energy = energy / np.max(energy) if np.max(energy) > 0 else energy
        peaks, _ = find_peaks(energy, height=0.2, distance=5)
        energy_data = {"energy": energy.tolist(), "peaks": peaks.tolist(),
                       "peak_values": energy[peaks].tolist() if len(peaks) > 0 else [], "frames": list(range(len(energy)))}

        # --- Spectral Features ---
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # --- Sound Event Classification ---
        sound_events = []
        for peak in peaks:
            time_pos = (peak * hop_length) / sr
            frame_idx = min(peak, len(spectral_centroids) - 1)
            centroid = spectral_centroids[frame_idx]
            rolloff = spectral_rolloff[frame_idx]
            zcr_val = zcr[frame_idx] if frame_idx < len(zcr) else 0
            amplitude = energy[peak]
            decibels = 20 * np.log10(amplitude) if amplitude > 0 else -np.inf

            if centroid < 1000 and rolloff < 2000:
                sound_type, confidence = "Low Frequency/Bass", 0.8
            elif centroid < 3000 and zcr_val < 0.1:
                sound_type, confidence = "Voice/Speech", 0.9
            elif centroid > 4000 and rolloff > 8000:
                sound_type, confidence = "High Frequency/Noise", 0.7
            elif zcr_val > 0.15:
                sound_type, confidence = "Percussive/Transient", 0.85
            else:
                sound_type, confidence = "Mixed/Complex", 0.6

            sound_events.append({
                "time": round(time_pos, 2),
                "frequency": round(float(centroid), 1),
                "amplitude": round(float(amplitude), 3),
                "type": sound_type,
                "confidence": confidence,
                "decibels": round(float(decibels), 1),
                "spectral_rolloff": round(float(rolloff), 1),
                "zero_crossing_rate": round(float(zcr_val), 3)
            })

        sound_events.sort(key=lambda x: x["amplitude"], reverse=True)

        # --- Frequency Spectrum Visualization ---
        max_amplitude = np.max(np.abs(y))
        max_decibels = 20 * np.log10(max_amplitude) if max_amplitude > 0 else -np.inf
        dominant_freq = np.mean(spectral_centroids)
        rms = np.mean(librosa.feature.rms(y=y))

        # Clean up temp file
        os.unlink(temp_path)

        # --- Compile Results ---
        results = {
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "duration": round(duration, 2),
            "sampleRate": int(sr),
            "averageRMS": round(float(rms), 6),
            "detectedSounds": len(peaks),
            "dominantFrequency": round(float(dominant_freq), 1),
            "maxDecibels": round(float(max_decibels), 1),
            "soundEvents": sound_events[:15],
            "visualizations": {"stft": stft_data, "fft": fft_data, "energy": energy_data},
            "spectralFeatures": {
                "meanSpectralCentroid": round(float(np.mean(spectral_centroids)), 1),
                "meanSpectralRolloff": round(float(np.mean(spectral_rolloff)), 1),
                "meanZeroCrossingRate": round(float(np.mean(zcr)), 3),
                "mfccMean": [round(float(np.mean(mfcc)), 3) for mfcc in mfccs]
            },
            "analysisComplete": True,
            "analysisType": "live_comprehensive"
        }

        return results

    except Exception as e:
        return {
            "error": str(e),
            "analysisComplete": False,
            "analysisType": "live_comprehensive",
            "message": "Live audio analysis failed",
            "timestamp": datetime.now().isoformat()
        }

# --- Optional: process real-time chunk ---
def process_real_time_chunk(audio_chunk, sr=44100):
    """Quick analysis for real-time streaming"""
    try:
        fft_result = np.fft.fft(audio_chunk)
        magnitude = np.abs(fft_result)
        energy = np.sum(audio_chunk ** 2)
        freqs = np.fft.fftfreq(len(audio_chunk), 1/sr)
        spectral_centroid = np.sum(freqs[:len(freqs)//2] * magnitude[:len(magnitude)//2]) / np.sum(magnitude[:len(magnitude)//2])
        return {"fft": magnitude[:len(magnitude)//2].tolist(), "energy": float(energy),
                "spectral_centroid": float(spectral_centroid), "timestamp": datetime.now().isoformat()}
    except Exception as e:
        return {"error": str(e)}

# --- Script can still run standalone for testing ---
if __name__ == "__main__":
    print("🎵 Live Audio Analysis System Ready")
