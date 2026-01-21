import { type NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// --- CONFIGURATION ---
export const maxDuration = 300; // 5 minute timeout for heavy AI
export const dynamic = 'force-dynamic';

/**
 * Robust Helper to run Python scripts and extract JSON from messy output
 */
async function runPythonScript(scriptName: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", scriptName);
    // Use "python" for Windows, "python3" for Mac/Linux
    const python = spawn("python", [scriptPath, ...args]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => (stdout += data.toString()));
    python.stderr.on("data", (data) => (stderr += data.toString()));

    python.on("close", (code) => {
      if (code === 0) {
        try {
          // Hardened JSON Extraction: Finds the { ... } even if there are progress bars
          const startIdx = stdout.indexOf('{');
          const endIdx = stdout.lastIndexOf('}');
          
          if (startIdx === -1 || endIdx === -1) {
            return resolve({ status: "error", message: "No JSON found", raw: stdout });
          }

          const cleanJson = stdout.substring(startIdx, endIdx + 1);
          resolve(JSON.parse(cleanJson));
        } catch (e) {
          reject(`JSON Parse Error: ${e} | Raw Output: ${stdout}`);
        }
      } else {
        console.error("Python Stderr:", stderr);
        reject(`Python Error (Code ${code}): ${stderr}`);
      }
    });
  });
}

export async function POST(request: NextRequest) {
  let tempInputPath = "";

  try {
    // 1. Handle incoming FormData (Large Files)
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ status: "error", message: "No file uploaded" }, { status: 400 });
    }

    const tempDir = path.join(process.cwd(), "public", "temp_uploads");
    const outputDir = path.join(process.cwd(), "public", "output");
    
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 2. Save physical file for Python
    const safeName = file.name.replace(/[^a-z0-9.]/gi, '_');
    tempInputPath = path.join(tempDir, `input_${Date.now()}_${safeName}`);
    fs.writeFileSync(tempInputPath, Buffer.from(await file.arrayBuffer()));

    console.log(`[Forensic Engine] Starting analysis for: ${safeName}`);

    // 3. Run the forensic pipeline
    // Note: We pass the physical path (tempInputPath) instead of raw base64 data
    const separationResult = await runPythonScript("audio_separator.py", [
      tempInputPath,
      outputDir,
      safeName
    ]);

    // 4. Cleanup temp file
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);

    // 5. Final Report Construction
    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      filename: safeName,
      separation: separationResult,
      stems: {
        vocals: `/output/${safeName}_vocals.wav`,
        background: `/output/${safeName}_background.wav`,
        footsteps: `/output/${safeName}_footsteps.wav`
      }
    });

  } catch (error: any) {
    if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    console.error("Forensic Route Error:", error);
    return NextResponse.json({ 
      status: "error", 
      message: error.message || "Internal server error" 
    }, { status: 500 });
  }
}