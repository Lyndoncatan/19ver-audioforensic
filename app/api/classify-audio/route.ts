import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const { audioData, filename } = await request.json()

    if (!audioData) {
      return NextResponse.json({ error: "No audio data provided" }, { status: 400 })
    }

    // Call MediaPipe classification script
    const scriptPath = path.join(process.cwd(), "scripts", "mediapipe_audio_classifier.py")

    return new Promise((resolve) => {
      const python = spawn("python3", [scriptPath, audioData, filename || "uploaded_audio"])

      let stdout = ""
      let stderr = ""

      python.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      python.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      python.on("close", (code) => {
        if (code === 0) {
          try {
            // Extract JSON from stdout (last JSON object)
            const lines = stdout.trim().split("\n")
            let jsonResult = ""

            // Find the JSON result (usually the last complete JSON object)
            for (let i = lines.length - 1; i >= 0; i--) {
              if (lines[i].startsWith("{")) {
                // Try to parse as JSON
                const jsonLines = [lines[i]]
                for (let j = i + 1; j < lines.length; j++) {
                  jsonLines.push(lines[j])
                  try {
                    jsonResult = JSON.parse(jsonLines.join("\n"))
                    break
                  } catch (e) {
                    // Continue building JSON
                  }
                }
                if (jsonResult) break
              }
            }

            if (jsonResult) {
              resolve(NextResponse.json(jsonResult))
            } else {
              resolve(
                NextResponse.json(
                  {
                    error: "Failed to parse classification results",
                    stdout,
                    stderr,
                  },
                  { status: 500 },
                ),
              )
            }
          } catch (error) {
            resolve(
              NextResponse.json(
                {
                  error: "Failed to process classification results",
                  details: error instanceof Error ? error.message : "Unknown error",
                  stdout,
                  stderr,
                },
                { status: 500 },
              ),
            )
          }
        } else {
          resolve(
            NextResponse.json(
              {
                error: "MediaPipe classification failed",
                code,
                stderr,
                stdout,
              },
              { status: 500 },
            ),
          )
        }
      })

      // Set timeout for long-running processes
      setTimeout(() => {
        python.kill()
        resolve(
          NextResponse.json(
            {
              error: "Classification timeout",
              message: "MediaPipe classification took too long",
            },
            { status: 408 },
          ),
        )
      }, 60000) // 60 second timeout
    })
  } catch (error) {
    console.error("Audio classification API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
