import { type NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Helper to run Python scripts.
 * Note: Uses "python" command for Windows compatibility as seen in your logs.
 */
async function runPythonScript(scriptName: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", scriptName);
    const python = spawn("python", [scriptPath, ...args]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => (stdout += data.toString()));
    python.stderr.on("data", (data) => (stderr += data.toString()));

    python.on("close", (code) => {
      if (code === 0) {
        try {
          const lines = stdout.trim().split("\n");
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith("{")) {
              return resolve(JSON.parse(lines.slice(i).join("\n")));
            }
          }
          resolve({ message: "No JSON output found", raw: stdout });
        } catch (e) {
          reject(`JSON Parse Error: ${e} | Raw Output: ${stdout}`);
        }
      } else {
        reject(`Python Error (Code ${code}): ${stderr}`);
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { audioData, filename } = await request.json();

    if (!audioData) {
      return NextResponse.json({ error: "No audio data provided" }, { status: 400 });
    }

    // 1. Setup Directories
    // We save to 'public/output' so the frontend can access files via URL
    const outputDir = path.join(process.cwd(), "public", "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Sanitize filename for shell/file-system safety
    const safeBaseName = filename?.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_') || "forensic_sample";

    console.log(`[API] Processing: ${safeBaseName}`);

    // 2. Run MediaPipe Classification
    const mediaPipeResult = await runPythonScript("mediapipe_audio_classifier.py", [
      audioData,
      safeBaseName
    ]);

    // 3. Run Forensic Diarization
    const diarizationResult = await runPythonScript("forensic_diarization.py", []);

    // 4. Run Source Separation (The "SonarView" Fix)
    // We pass the audio path and the output directory to our new separator script
    console.log("[API] Separating Audio Sources...");
    const separationResult = await runPythonScript("audio_separator.py", [
      audioData,
      outputDir,
      safeBaseName
    ]);

    // 5. Construct Final Report for SonarView
    const finalForensicReport = {
      url: audioData,
      status: "Success",
      timestamp: new Date().toISOString(),
      classification: mediaPipeResult,
      diarization: diarizationResult,
      separationInfo: separationResult,
      // These URLs point directly to the files Demucs will generate in /public/output
      stems: {
        vocals: `/output/${safeBaseName}_vocals.wav`,
        background: `/output/${safeBaseName}_background.wav`,
        animals: `/output/${safeBaseName}_animals.wav`,
        vehicles: `/output/${safeBaseName}_vehicles.wav`,
        footsteps: `/output/${safeBaseName}_footsteps.wav`,
        wind: `/output/${safeBaseName}_wind.wav`,
      }
    };

    return NextResponse.json(finalForensicReport);

  } catch (error: any) {
    console.error("Forensic API error:", error);
    return NextResponse.json({ 
      error: "Analysis failed", 
      details: error.toString() 
    }, { status: 500 });
  }
}