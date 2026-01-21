import sys
import os
import json
import subprocess
import shutil
import warnings

# Force silence for a clean JSON output
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

def separate_audio(input_path, output_dir, original_name):
    try:
        input_filename = os.path.basename(input_path)
        input_no_ext = os.path.splitext(input_filename)[0]
        base_output_name = os.path.splitext(original_name)[0].replace(" ", "_")

        # USE QUANTIZED MODEL (-n mdx_extra_q) and FORCE CPU for stability
        cmd = [
            "python", "-m", "demucs.separate", 
            "-n", "mdx_extra_q", 
            "--cpu", 
            input_path, 
            "-o", output_dir
        ]
        
        # Run process and capture all logs to prevent them from breaking the JSON pipe
        subprocess.run(cmd, capture_output=True, text=True, check=True)

        model_folder = os.path.join(output_dir, "mdx_extra_q", input_no_ext)
        mapping = {
            "vocals.wav": "vocals", 
            "other.wav": "background", 
            "drums.wav": "footsteps", 
            "bass.wav": "vehicles"
        }
        
        final_paths = {}
        for src, label in mapping.items():
            src_path = os.path.join(model_folder, src)
            dest_name = f"{base_output_name}_{label}.wav"
            if os.path.exists(src_path):
                shutil.move(src_path, os.path.join(output_dir, dest_name))
                final_paths[label] = f"/separated_audio/{dest_name}"

        # Cleanup demucs internal folders
        shutil.rmtree(os.path.join(output_dir, "mdx_extra_q"), ignore_errors=True)
        
        return {
            "status": "success", 
            "stems": {
                **final_paths, 
                "animals": final_paths.get("background"), 
                "wind": final_paths.get("background")
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.stdout.write(json.dumps({"status": "error", "message": "Missing arguments"}))
    else:
        out_dir = os.path.join(os.getcwd(), "public", "separated_audio")
        res = separate_audio(sys.argv[1], out_dir, sys.argv[2])
        sys.stdout.write(json.dumps(res))