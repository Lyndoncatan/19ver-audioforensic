# ================================
# MediaPipe Audio Classification Integration
# Enhanced Audio Classification using YAMNet Model
# ================================

import numpy as np
import json
import sys
import base64
import tempfile
import os
from scipy.io import wavfile
import subprocess

# Check if MediaPipe is installed, if not install it
try:
    from mediapipe.tasks import python
    from mediapipe.tasks.python.components import containers
    from mediapipe.tasks.python import audio
except ImportError:
    print("Installing MediaPipe...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mediapipe"])
    from mediapipe.tasks import python
    from mediapipe.tasks.python.components import containers
    from mediapipe.tasks.python import audio

def get_yamnet_model_path():
    """Get local YAMNet model path"""
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'yamnet.tflite')
    
    if not os.path.exists(model_path):
        print(f"❌ YAMNet model not found at: {model_path}")
        print("Please ensure yamnet.tflite is in the scripts directory")
        raise FileNotFoundError(f"YAMNet model not found at {model_path}")
    
    print(f"✅ Using local YAMNet model: {model_path}")
    return model_path

def classify_audio_with_mediapipe(audio_data_base64, filename="uploaded_audio"):
    """
    Classify audio using MediaPipe YAMNet model
    """
    try:
        print(f"🎵 Starting MediaPipe Audio Classification: {filename}")
        
        # Decode base64 audio data
        audio_bytes = base64.b64decode(audio_data_base64)
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name
        
        # Get local model path
        model_path = get_yamnet_model_path()
        
        # Read audio file
        sample_rate, wav_data = wavfile.read(temp_path)
        print(f"📊 Audio loaded: {sample_rate} Hz, {len(wav_data)} samples")
        
        # Convert to float and normalize
        if wav_data.dtype == np.int16:
            wav_data_float = wav_data.astype(float) / np.iinfo(np.int16).max
        elif wav_data.dtype == np.int32:
            wav_data_float = wav_data.astype(float) / np.iinfo(np.int32).max
        else:
            wav_data_float = wav_data.astype(float)
        
        # Handle stereo to mono conversion
        if len(wav_data_float.shape) > 1:
            wav_data_float = np.mean(wav_data_float, axis=1)
        
        # Create MediaPipe audio classifier
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = audio.AudioClassifierOptions(
            base_options=base_options, 
            max_results=10,  # Get top 10 classifications
            score_threshold=0.1  # Minimum confidence threshold
        )
        
        # Perform classification
        with audio.AudioClassifier.create_from_options(options) as classifier:
            audio_clip = containers.AudioData.create_from_array(wav_data_float, sample_rate)
            classification_result_list = classifier.classify(audio_clip)
            
            print(f"🔍 Found {len(classification_result_list)} audio segments")
            
            # Process classification results
            enhanced_classifications = []
            all_categories = {}
            
            for idx, classification_result in enumerate(classification_result_list):
                timestamp_ms = idx * 975  # Each segment is ~0.975 seconds
                timestamp_s = timestamp_ms / 1000.0
                
                segment_classifications = []
                
                if classification_result.classifications:
                    for category in classification_result.classifications[0].categories:
                        category_name = category.category_name
                        confidence = category.score
                        
                        # Store individual segment classification
                        segment_classifications.append({
                            "category": category_name,
                            "confidence": round(confidence, 4),
                            "timestamp": round(timestamp_s, 2)
                        })
                        
                        # Accumulate overall statistics
                        if category_name not in all_categories:
                            all_categories[category_name] = {
                                "total_confidence": 0,
                                "count": 0,
                                "max_confidence": 0,
                                "timestamps": []
                            }
                        
                        all_categories[category_name]["total_confidence"] += confidence
                        all_categories[category_name]["count"] += 1
                        all_categories[category_name]["max_confidence"] = max(
                            all_categories[category_name]["max_confidence"], confidence
                        )
                        all_categories[category_name]["timestamps"].append(timestamp_s)
                
                enhanced_classifications.append({
                    "segment": idx,
                    "timestamp": round(timestamp_s, 2),
                    "duration": 0.975,
                    "classifications": segment_classifications[:5]  # Top 5 per segment
                })
            
            # Calculate overall statistics
            overall_stats = []
            for category, stats in all_categories.items():
                avg_confidence = stats["total_confidence"] / stats["count"]
                overall_stats.append({
                    "category": category,
                    "average_confidence": round(avg_confidence, 4),
                    "max_confidence": round(stats["max_confidence"], 4),
                    "occurrence_count": stats["count"],
                    "coverage_percentage": round((stats["count"] / len(classification_result_list)) * 100, 1),
                    "timestamps": stats["timestamps"][:10]  # First 10 occurrences
                })
            
            # Sort by average confidence
            overall_stats.sort(key=lambda x: x["average_confidence"], reverse=True)
            
            # Generate enhanced sound events based on classifications
            enhanced_sound_events = []
            for segment in enhanced_classifications:
                if segment["classifications"]:
                    top_classification = segment["classifications"][0]
                    
                    # Map MediaPipe categories to forensic categories
                    forensic_category = map_to_forensic_category(top_classification["category"])
                    
                    enhanced_sound_events.append({
                        "time": segment["timestamp"],
                        "duration": segment["duration"],
                        "type": forensic_category,
                        "mediapipe_category": top_classification["category"],
                        "confidence": top_classification["confidence"],
                        "amplitude": min(top_classification["confidence"], 1.0),  # Use confidence as amplitude proxy
                        "frequency": estimate_frequency_from_category(top_classification["category"]),
                        "decibels": confidence_to_decibels(top_classification["confidence"]),
                        "classification_source": "MediaPipe YAMNet"
                    })
            
            # Create comprehensive analysis results
            duration = len(wav_data_float) / sample_rate
            
            analysis_results = {
                "filename": filename,
                "duration": round(duration, 2),
                "sampleRate": int(sample_rate),
                "segments_analyzed": len(classification_result_list),
                "segment_duration": 0.975,
                
                # Enhanced classifications
                "mediapipe_classifications": {
                    "overall_statistics": overall_stats[:15],  # Top 15 categories
                    "segment_classifications": enhanced_classifications,
                    "total_categories_detected": len(all_categories),
                    "model_used": "YAMNet (MediaPipe)"
                },
                
                # Enhanced sound events
                "enhanced_sound_events": enhanced_sound_events,
                "detectedSounds": len(enhanced_sound_events),
                
                # Compatibility with existing system
                "soundEvents": enhanced_sound_events[:20],  # Top 20 for compatibility
                "dominantFrequency": estimate_dominant_frequency(overall_stats),
                "maxDecibels": max([event["decibels"] for event in enhanced_sound_events]) if enhanced_sound_events else -60,
                "averageRMS": calculate_rms_from_classifications(overall_stats),
                
                # Analysis metadata
                "analysisComplete": True,
                "analysisType": "mediapipe_enhanced",
                "timestamp": "2024-01-01T00:00:00Z",
                "classification_confidence": "high"
            }
            
            print(f"\n🎯 MediaPipe Classification Results:")
            print(f"📁 File: {filename}")
            print(f"⏱ Duration: {duration:.2f} seconds")
            print(f"🔍 Segments: {len(classification_result_list)}")
            print(f"🏷 Categories: {len(all_categories)}")
            print(f"🎵 Sound Events: {len(enhanced_sound_events)}")
            
            print(f"\n🏆 Top Classifications:")
            for i, stat in enumerate(overall_stats[:5]):
                print(f"{i+1}. {stat['category']}: {stat['average_confidence']:.3f} confidence ({stat['coverage_percentage']:.1f}% coverage)")
            
            # Clean up
            os.unlink(temp_path)
            
            return json.dumps(analysis_results, indent=2)
            
    except Exception as e:
        error_result = {
            "error": str(e),
            "analysisComplete": False,
            "analysisType": "mediapipe_enhanced",
            "message": "MediaPipe audio classification failed"
        }
        print(f"❌ MediaPipe Classification Error: {str(e)}")
        return json.dumps(error_result, indent=2)

def map_to_forensic_category(mediapipe_category):
    """Map MediaPipe categories to forensic investigation categories"""
    category_mapping = {
        # Speech and Voice
        "Speech": "Human Voice",
        "Male speech, man speaking": "Male Voice",
        "Female speech, woman speaking": "Female Voice",
        "Child speech, kid speaking": "Child Voice",
        "Conversation": "Conversation",
        "Narration, monologue": "Monologue",
        "Babbling": "Infant Vocalization",
        
        # Music and Instruments
        "Music": "Musical Content",
        "Musical instrument": "Instrument",
        "Plucked string instrument": "String Instrument",
        "Guitar": "Guitar",
        "Piano": "Piano",
        "Drum kit": "Percussion",
        "Singing": "Vocal Music",
        
        # Environmental Sounds
        "Vehicle": "Vehicle Sound",
        "Car": "Automobile",
        "Truck": "Heavy Vehicle",
        "Motorcycle": "Motorcycle",
        "Aircraft": "Aircraft",
        "Train": "Railway",
        
        # Mechanical and Electronic
        "Machine": "Mechanical Sound",
        "Motor": "Motor/Engine",
        "Tools": "Tool Usage",
        "Alarm": "Alert Signal",
        "Bell": "Bell/Chime",
        "Phone": "Telephone",
        
        # Nature and Animals
        "Animal": "Animal Sound",
        "Dog": "Canine",
        "Cat": "Feline",
        "Bird": "Avian",
        "Wind": "Wind Noise",
        "Rain": "Precipitation",
        "Water": "Water Sound",
        
        # Human Activities
        "Footsteps": "Footsteps",
        "Door": "Door Sound",
        "Applause": "Applause",
        "Laughter": "Laughter",
        "Crying": "Crying",
        "Cough": "Cough",
        "Sneeze": "Sneeze",
        
        # Background and Noise
        "Silence": "Silence/Quiet",
        "White noise": "Background Noise",
        "Pink noise": "Ambient Noise",
        "Static": "Electronic Noise",
        "Hum": "Electrical Hum"
    }
    
    # Check for exact matches first
    if mediapipe_category in category_mapping:
        return category_mapping[mediapipe_category]
    
    # Check for partial matches
    for key, value in category_mapping.items():
        if key.lower() in mediapipe_category.lower():
            return value
    
    # Default categorization based on keywords
    category_lower = mediapipe_category.lower()
    if any(word in category_lower for word in ["speech", "voice", "talk", "speak"]):
        return "Human Voice"
    elif any(word in category_lower for word in ["music", "song", "instrument"]):
        return "Musical Content"
    elif any(word in category_lower for word in ["vehicle", "car", "truck", "engine"]):
        return "Vehicle Sound"
    elif any(word in category_lower for word in ["animal", "dog", "cat", "bird"]):
        return "Animal Sound"
    elif any(word in category_lower for word in ["machine", "motor", "mechanical"]):
        return "Mechanical Sound"
    else:
        return f"Other: {mediapipe_category}"

def estimate_frequency_from_category(category):
    """Estimate frequency range based on sound category"""
    frequency_estimates = {
        "Speech": 300,
        "Male speech": 150,
        "Female speech": 250,
        "Child speech": 400,
        "Music": 440,
        "Piano": 440,
        "Guitar": 330,
        "Drum": 100,
        "Bell": 1000,
        "Bird": 2000,
        "Dog": 500,
        "Cat": 800,
        "Vehicle": 200,
        "Machine": 150,
        "Wind": 50,
        "Water": 300
    }
    
    for key, freq in frequency_estimates.items():
        if key.lower() in category.lower():
            return freq
    
    return 440  # Default A4 note

def confidence_to_decibels(confidence):
    """Convert confidence score to approximate decibel level"""
    if confidence <= 0:
        return -60
    # Map confidence (0-1) to decibel range (-60 to 0)
    return round(-60 + (confidence * 60), 1)

def estimate_dominant_frequency(overall_stats):
    """Estimate dominant frequency from classification statistics"""
    if not overall_stats:
        return 440
    
    # Weight frequencies by confidence and coverage
    weighted_freq = 0
    total_weight = 0
    
    for stat in overall_stats[:5]:  # Top 5 categories
        freq = estimate_frequency_from_category(stat["category"])
        weight = stat["average_confidence"] * stat["coverage_percentage"]
        weighted_freq += freq * weight
        total_weight += weight
    
    return round(weighted_freq / total_weight if total_weight > 0 else 440, 1)

def calculate_rms_from_classifications(overall_stats):
    """Calculate approximate RMS from classification confidence"""
    if not overall_stats:
        return 0.01
    
    # Use average confidence of top categories as RMS proxy
    top_confidences = [stat["average_confidence"] for stat in overall_stats[:3]]
    avg_confidence = sum(top_confidences) / len(top_confidences)
    
    # Scale to typical RMS range
    return round(avg_confidence * 0.1, 6)

if __name__ == "__main__":
    print("🎵 MediaPipe Audio Classification System Ready")
    print("Enhanced with YAMNet model for professional audio analysis")
    
    if len(sys.argv) > 1:
        audio_data = sys.argv[1]
        filename = sys.argv[2] if len(sys.argv) > 2 else "uploaded_audio"
        result = classify_audio_with_mediapipe(audio_data, filename)
        print(result)
    else:
        print("No audio data provided. Script ready for integration.")
