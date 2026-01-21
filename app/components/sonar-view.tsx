"use client"

import { Card } from "@/components/ui/card"
import { useEffect, useRef, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WaveSurfer from "wavesurfer.js"
import { 
  Target, Play, Pause, Layers, Activity, 
  FileText, ChevronRight, Scissors, Loader2, 
  Download, Mic2, Wind, Database, Bird, Car, Footprints, AudioWaveform,
  Waves
} from "lucide-react"

// --- HELPER COMPONENT ---
function ForensicTrack({ url, label, color, icon: Icon, masterPlaying, masterTime }: any) {
  const containerRef = useRef<HTMLDivElement>(null)
  const waveSurferRef = useRef<WaveSurfer | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !url) return
    waveSurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#0f172a",
      progressColor: color,
      cursorColor: "#ffffff",
      barWidth: 2,
      barGap: 3,
      height: 80,
      url: url, 
    })
    waveSurferRef.current.on("ready", () => setIsReady(true))
    return () => waveSurferRef.current?.destroy()
  }, [url, color])

  useEffect(() => {
    if (!waveSurferRef.current || !isReady) return
    if (masterPlaying && !waveSurferRef.current.isPlaying()) waveSurferRef.current.play()
    else if (!masterPlaying && waveSurferRef.current.isPlaying()) waveSurferRef.current.pause()
    const wsTime = waveSurferRef.current.getCurrentTime()
    if (Math.abs(wsTime - masterTime) > 0.1) waveSurferRef.current.setTime(masterTime)
  }, [masterPlaying, masterTime, isReady])

  return (
    <Card className="bg-slate-950/50 border-slate-800 p-6 transition-all hover:border-slate-600 group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-xl group-hover:scale-110 transition-transform">
            <Icon size={22} style={{ color }} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-100 italic">{label}</h4>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
               <span className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">Signal_Isolated</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800" asChild>
          <a href={url} download><Download size={18} className="text-slate-400" /></a>
        </Button>
      </div>
      <div ref={containerRef} className="opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer" />
    </Card>
  )
}

// --- MAIN COMPONENT ---
export default function SonarView({ audioData, liveEvents = [], isRecording = false }: any) {
  const canvas2DRef = useRef<HTMLCanvasElement>(null)
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [rotation, setRotation] = useState({ x: 0.5, y: 0.5 })
  const [currentTime, setCurrentTime] = useState(0)
  const [isSeparating, setIsSeparating] = useState(false)
  const [showStems, setShowStems] = useState(false)
  const [currentStems, setCurrentStems] = useState<any>(null)
  
  const scanAngle = useRef(0)
  const activeEvents = isRecording ? liveEvents : (audioData?.analysisResults?.soundEvents || [])

  const jumpToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [])

  const handleDeconstruct = async () => {
    if (!audioData?.url) return;
    setShowStems(false);
    setIsSeparating(true);
    
    try {
      const responseBlob = await fetch(audioData.url);
      const audioBlob = await responseBlob.blob();
      const formData = new FormData();
      
      // Ensure file name is valid and append it correctly for the backend
      const safeFileName = (audioData.name || "audio.wav").replace(/\s+/g, "_");
      formData.append("file", audioBlob, safeFileName);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const response = await fetch("/api/classify-audio/forensic", {
        method: "POST",
        body: formData, // Sending as FormData is required by your backend engine
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      if (result.status === "success" && result.stems) {
        setCurrentStems(result.stems);
        setShowStems(true);
      } else {
        throw new Error(result.message || "Deconstruction failed.");
      }
    } catch (error: any) {
      const msg = error.name === 'AbortError' ? "Processing Timed Out (File too complex for CPU)" : error.message;
      alert(`Forensic Engine Error: ${msg}`);
      console.error("Forensic Engine Failure:", error);
    } finally {
      setIsSeparating(false);
    }
  };

  const draw2DRadar = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const cx = width / 2; const cy = height / 2; const maxR = Math.min(width, height) / 2 - 60
    ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = "rgba(34, 197, 94, 0.15)"; ctx.lineWidth = 1
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2); ctx.stroke() }
    if (isPlaying) {
        scanAngle.current = (scanAngle.current + 0.05) % (Math.PI * 2)
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, maxR, scanAngle.current, scanAngle.current + 0.4)
        ctx.lineTo(cx, cy); ctx.fillStyle = "rgba(34, 197, 94, 0.1)"; ctx.fill()
    }
    activeEvents.forEach((ev: any) => {
      const a = (ev.time / (audioData?.analysisResults?.duration || 1)) * Math.PI * 2 - Math.PI / 2
      const d = (ev.frequency / 16000) * maxR
      const x = cx + Math.cos(a) * d; const y = cy + Math.sin(a) * d
      const isActive = Math.abs(currentTime - ev.time) < 0.3
      ctx.fillStyle = isActive ? "#fff" : (ev.speaker === "SPEAKER_01" ? "#ef4444" : "#3b82f6")
      ctx.beginPath(); ctx.arc(x, y, isActive ? 8 : 4, 0, Math.PI * 2); ctx.fill()
    })
  }, [audioData, activeEvents, currentTime, isPlaying])

  const draw3DVoxel = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, width, height)
    const project = (x: number, y: number, z: number) => {
      const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x)
      const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y)
      let y1 = y * cosX - z * sinX; let z1 = y * sinX + z * cosX
      let x2 = x * cosY + z1 * sinY; let z2 = -x * sinY + z1 * cosY
      const f = 600 / (600 + z2); return { x: width / 2 + x2 * f, y: height / 2 + y1 * f, f }
    }
    activeEvents.forEach((ev: any) => {
      const duration = (audioData?.analysisResults?.duration * 1000 || 1)
      const xPos = ((ev.time * 1000 % duration) / duration * 400) - 200
      const zPos = ((ev.frequency / 16000) * 400) - 200
      const h = ((ev.decibels + 70) / 70) * 150
      const base = project(xPos, 100, zPos); const top = project(xPos, 100 - h, zPos)
      ctx.strokeStyle = ev.speaker === 'SPEAKER_01' ? '#ef4444' : '#3b82f6'
      ctx.lineWidth = 2 * base.f; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke()
    })
  }, [audioData, activeEvents, rotation])

  useEffect(() => {
    let frame: number;
    const render = () => {
      if (canvas2DRef.current) draw2DRadar(canvas2DRef.current.getContext('2d')!, 800, 600)
      if (canvas3DRef.current) draw3DVoxel(canvas3DRef.current.getContext('2d')!, 800, 600)
      frame = requestAnimationFrame(render)
    }
    render(); return () => cancelAnimationFrame(frame)
  }, [draw2DRadar, draw3DVoxel])

  return (
    <div className="w-full max-w-[1600px] mx-auto p-6 space-y-6 bg-[#020617] text-slate-100 min-h-screen font-mono">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-4">
          <Target className="w-12 h-12 text-blue-500" />
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Forensic Sonar V4</h1>
            <Badge variant="outline" className="text-green-500 border-green-500/30 mt-2 tracking-widest font-black uppercase">System_Active</Badge>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleDeconstruct} disabled={isSeparating} className="bg-indigo-600 hover:bg-indigo-500 font-bold h-20 px-10 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">
            {isSeparating ? (
              <div className="flex flex-col items-center">
                <Loader2 className="animate-spin mb-1" />
                <span className="text-[10px] tracking-widest">AI SEPARATION IN PROGRESS...</span>
              </div>
            ) : (
              <><Scissors className="mr-3" /> DECONSTRUCT AUDIO</>
            )}
          </Button>
          <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-2xl border border-slate-700">
            <audio ref={audioRef} src={audioData?.url} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />
            <Button onClick={() => { isPlaying ? audioRef.current?.pause() : audioRef.current?.play(); setIsPlaying(!isPlaying); }} className="rounded-full w-14 h-14 bg-blue-600">
              {isPlaying ? <Pause /> : <Play className="ml-1" />}
            </Button>
            {/* FIX: Use Number() and default to 0 to prevent toFixed crash */}
            <div className="px-5 border-l border-slate-700 text-3xl font-black tabular-nums text-blue-400">
                {Number(currentTime || 0).toFixed(2)}s
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-950/80 border-slate-800 overflow-hidden relative">
            <Badge className="absolute top-4 left-4 bg-slate-900/90 text-green-400 z-10 font-black">2D_SPATIAL_MAP</Badge>
            <canvas ref={canvas2DRef} width={800} height={600} className="w-full aspect-square" />
          </Card>
          <Card className="bg-slate-950/80 border-slate-800 overflow-hidden relative">
            <Badge className="absolute top-4 left-4 bg-slate-900/90 text-blue-400 z-10 font-black">3D_TOPOGRAPHY</Badge>
            <canvas ref={canvas3DRef} width={800} height={600} className="w-full aspect-square" onMouseMove={(e) => { if (e.buttons === 1) setRotation(r => ({ x: r.x + e.movementY * 0.005, y: r.y + e.movementX * 0.005 })) }} />
          </Card>
        </div>
        <Card className="bg-slate-950/80 border-slate-800 flex flex-col h-full max-h-[600px]">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h2 className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest"><FileText className="w-4 h-4 text-blue-500" /> Signal Matrix</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeEvents.map((ev: any, i: number) => (
              <div key={i} onClick={() => jumpToTime(ev.time)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${Math.abs(currentTime - ev.time) < 0.3 ? 'bg-blue-600/30 border-l-4 border-blue-500' : 'bg-slate-900/30'}`}>
                <div className="flex flex-col">
                  {/* FIX: Ensure ev.time is a number before calling toFixed */}
                  <span className="text-[10px] tabular-nums text-slate-500 font-black">
                      {Number(ev.time || 0).toFixed(2)}s
                  </span>
                  <span className={`text-[11px] font-black ${ev.speaker === 'SPEAKER_01' ? 'text-red-400' : 'text-blue-400'}`}>{ev?.type?.toUpperCase() || "UNKNOWN"}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="separation" className="w-full">
        <TabsList className="bg-slate-950 border border-slate-800 h-16 p-1 gap-2">
          <TabsTrigger value="separation" className="gap-3 px-10 uppercase font-black text-[11px] data-[state=active]:bg-indigo-600"><Layers className="w-4 h-4"/> Forensic Stems</TabsTrigger>
          <TabsTrigger value="spectrogram" className="gap-3 px-10 uppercase font-black text-[11px] data-[state=active]:bg-blue-600"><Activity className="w-4 h-4"/> Spectral Analysis</TabsTrigger>
        </TabsList>
        <TabsContent value="separation" className="mt-8">
          {!showStems ? (
            <div className="h-96 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-600">
              <Database className="w-16 h-16 mb-6 opacity-20" />
              <p className="text-xs font-black tracking-[0.4em] uppercase opacity-40">Execute "Deconstruct Audio" to activate model</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <ForensicTrack url={audioData?.url} label="Original Full Mix" color="#ffffff" icon={AudioWaveform} masterPlaying={isPlaying} masterTime={currentTime} />
              <ForensicTrack url={currentStems.vocals} label="Vocals / Speech" color="#3b82f6" icon={Mic2} masterPlaying={isPlaying} masterTime={currentTime} />
              <ForensicTrack url={currentStems.background} label="Background / Ambient" color="#10b981" icon={Waves} masterPlaying={isPlaying} masterTime={currentTime} />
              <ForensicTrack url={currentStems.vehicles} label="Vehicle / Mechanical" color="#ef4444" icon={Car} masterPlaying={isPlaying} masterTime={currentTime} />
              <ForensicTrack url={currentStems.footsteps} label="Footsteps / Impact" color="#8b5cf6" icon={Footprints} masterPlaying={isPlaying} masterTime={currentTime} />
              <ForensicTrack url={currentStems.animals} label="Animal Sounds" color="#f59e0b" icon={Bird} masterPlaying={isPlaying} masterTime={currentTime} />
              <ForensicTrack url={currentStems.wind} label="Wind / Atmospheric" color="#06b6d4" icon={Wind} masterPlaying={isPlaying} masterTime={currentTime} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}