from fastapi import FastAPI, UploadFile, File
import uvicorn
import os
from run_yamnet import run_yamnet  # function from fixed run_yamnet.py
from live_audio_analysis import generate_live_analysis

app = FastAPI()

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    try:
        # Read uploaded file bytes
        audio_bytes = await file.read()

        # Save to temporary file for YAMNet
        temp_path = "temp_audio.wav"
        with open(temp_path, "wb") as f:
            f.write(audio_bytes)

        # --- Run YAMNet Analysis ---
        yamnet_result = run_yamnet(temp_path)

        # --- Run Live Audio Analysis ---
        live_analysis_result = generate_live_analysis(audio_bytes, filename=file.filename)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return {
            "yamnet": yamnet_result,
            "live": live_analysis_result
        }

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
