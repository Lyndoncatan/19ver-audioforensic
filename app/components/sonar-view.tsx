"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useRef, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RotateCcw } from "lucide-react"

interface AudioData {
  blob: Blob
  url: string
  name: string
  duration: number
  analysisResults?: any
}

interface SonarViewProps {
  audioData: AudioData | null
}

export default function SonarView({ audioData }: SonarViewProps) {
  const canvas2DRef = useRef<HTMLCanvasElement>(null)
  const canvas3DRef = useRef<HTMLCanvasElement>(null)
  const [rotationX, setRotationX] = useState(0)
  const [rotationY, setRotationY] = useState(0)
  const [zoom3D, setZoom3D] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [viewMode, setViewMode] = useState<"split" | "full2d" | "full3d">("split")

  useEffect(() => {
    if (audioData?.analysisResults) {
      draw2DSonarView()
      draw3DSonarView()

      // Set up animation loop for scanning line
      const animationId = setInterval(() => {
        draw2DSonarView()
        draw3DSonarView()
      }, 100)

      return () => {
        clearInterval(animationId)
      }
    }
  }, [audioData?.analysisResults, rotationX, rotationY, zoom3D])

  const draw2DSonarView = useCallback(() => {
    const canvas = canvas2DRef.current
    if (!canvas || !audioData?.analysisResults) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    ctx.fillStyle = "#0a0a1a"
    ctx.fillRect(0, 0, width, height)

    // Draw concentric circles (sonar rings)
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.min(width, height) / 2 - 40

    // Draw range circles with labels
    for (let i = 1; i <= 5; i++) {
      const radius = (maxRadius / 5) * i
      const frequency = (2000 / 5) * i

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 - i * 0.05})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Add frequency labels
      ctx.fillStyle = "rgba(0, 255, 0, 0.7)"
      ctx.font = "10px Arial"
      ctx.fillText(`${frequency}Hz`, centerX + radius - 25, centerY - 5)
    }

    // Draw crosshairs with time labels
    ctx.strokeStyle = "rgba(0, 255, 0, 0.3)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, height)
    ctx.stroke()

    // Add time labels around the circle
    ctx.fillStyle = "rgba(0, 255, 0, 0.7)"
    ctx.font = "10px Arial"
    const duration = audioData.analysisResults.duration
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI - Math.PI / 2
      const labelRadius = maxRadius + 15
      const x = centerX + Math.cos(angle) * labelRadius
      const y = centerY + Math.sin(angle) * labelRadius
      const time = (i / 8) * duration
      ctx.fillText(`${time.toFixed(1)}s`, x - 15, y + 3)
    }

    // Draw sound events as labeled blips
    const results = audioData.analysisResults
    if (results?.soundEvents) {
      results.soundEvents.forEach((event: any, index: number) => {
        const angle = (event.time / results.duration) * 2 * Math.PI - Math.PI / 2
        const distance = Math.min((event.frequency / 2000) * maxRadius, maxRadius)
        const intensity = event.amplitude

        const x = centerX + Math.cos(angle) * distance
        const y = centerY + Math.sin(angle) * distance

        // Draw blip with glow effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8 + intensity * 10)
        gradient.addColorStop(
          0,
          `rgba(${Math.floor(255 * intensity)}, ${Math.floor(255 * (1 - intensity))}, 0, ${0.9})`,
        )
        gradient.addColorStop(1, `rgba(${Math.floor(255 * intensity)}, ${Math.floor(255 * (1 - intensity))}, 0, 0.1)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, 3 + intensity * 5, 0, 2 * Math.PI)
        ctx.fill()

        // Draw pulse effect
        ctx.beginPath()
        ctx.arc(x, y, 8 + intensity * 10, 0, 2 * Math.PI)
        ctx.strokeStyle = `rgba(${Math.floor(255 * intensity)}, ${Math.floor(255 * (1 - intensity))}, 0, ${0.3 * intensity})`
        ctx.lineWidth = 2
        ctx.stroke()

        // Add sound type labels for prominent sounds
        if (intensity > 0.6 || index < 3) {
          ctx.fillStyle = "white"
          ctx.font = "9px Arial"
          ctx.shadowColor = "black"
          ctx.shadowBlur = 2

          // Position label to avoid overlap
          const labelX = x + (Math.cos(angle) > 0 ? 10 : -30)
          const labelY = y + (Math.sin(angle) > 0 ? -5 : 15)

          ctx.fillText(event.type, labelX, labelY)
          ctx.fillText(`${event.frequency}Hz`, labelX, labelY + 10)
          ctx.fillText(`${(intensity * 100).toFixed(0)}%`, labelX, labelY + 20)

          ctx.shadowBlur = 0
        }
      })
    }

    // Draw scanning line with trail effect
    const scanAngle = (Date.now() / 2000) % (2 * Math.PI)

    // Draw trail
    for (let i = 0; i < 20; i++) {
      const trailAngle = scanAngle - i * 0.05
      const alpha = ((20 - i) / 20) * 0.3

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(
        centerX + Math.cos(trailAngle - Math.PI / 2) * maxRadius,
        centerY + Math.sin(trailAngle - Math.PI / 2) * maxRadius,
      )
      ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw main scanning line
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(
      centerX + Math.cos(scanAngle - Math.PI / 2) * maxRadius,
      centerY + Math.sin(scanAngle - Math.PI / 2) * maxRadius,
    )
    ctx.strokeStyle = "rgba(0, 255, 0, 0.8)"
    ctx.lineWidth = 3
    ctx.stroke()

    // Add center dot
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)"
    ctx.beginPath()
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI)
    ctx.fill()
  }, [audioData])

  const draw3DSonarView = useCallback(() => {
    const canvas = canvas3DRef.current
    if (!canvas || !audioData?.analysisResults) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Draw 3D background
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) / 2,
    )
    gradient.addColorStop(0, "#001122")
    gradient.addColorStop(1, "#000000")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2
    const baseRadius = Math.min(width, height) / 3

    // 3D projection parameters
    const perspective = 800
    const cameraZ = 500

    // Helper function for 3D to 2D projection
    const project3D = (x: number, y: number, z: number) => {
      // Apply rotations
      const cosX = Math.cos(rotationX)
      const sinX = Math.sin(rotationX)
      const cosY = Math.cos(rotationY)
      const sinY = Math.sin(rotationY)

      // Rotate around X axis
      const y1 = y * cosX - z * sinX
      const z1 = y * sinX + z * cosX

      // Rotate around Y axis
      const x2 = x * cosY + z1 * sinY
      const z2 = -x * sinY + z1 * cosY

      // Apply perspective projection
      const scale = perspective / (perspective + z2 * zoom3D)
      return {
        x: centerX + x2 * scale,
        y: centerY + y1 * scale,
        z: z2,
        scale: scale,
      }
    }

    // Draw 3D grid/sphere wireframe
    ctx.strokeStyle = "rgba(0, 100, 200, 0.3)"
    ctx.lineWidth = 1

    // Draw latitude lines
    for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += Math.PI / 6) {
      ctx.beginPath()
      let firstPoint = true
      for (let lon = 0; lon <= 2 * Math.PI; lon += Math.PI / 20) {
        const x = baseRadius * Math.cos(lat) * Math.cos(lon)
        const y = baseRadius * Math.sin(lat)
        const z = baseRadius * Math.cos(lat) * Math.sin(lon)

        const projected = project3D(x, y, z)
        if (projected.z > -perspective) {
          if (firstPoint) {
            ctx.moveTo(projected.x, projected.y)
            firstPoint = false
          } else {
            ctx.lineTo(projected.x, projected.y)
          }
        }
      }
      ctx.stroke()
    }

    // Draw longitude lines
    for (let lon = 0; lon < 2 * Math.PI; lon += Math.PI / 6) {
      ctx.beginPath()
      let firstPoint = true
      for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += Math.PI / 20) {
        const x = baseRadius * Math.cos(lat) * Math.cos(lon)
        const y = baseRadius * Math.sin(lat)
        const z = baseRadius * Math.cos(lat) * Math.sin(lon)

        const projected = project3D(x, y, z)
        if (projected.z > -perspective) {
          if (firstPoint) {
            ctx.moveTo(projected.x, projected.y)
            firstPoint = false
          } else {
            ctx.lineTo(projected.x, projected.y)
          }
        }
      }
      ctx.stroke()
    }

    // Draw 3D sound events
    const results = audioData.analysisResults
    if (results?.soundEvents) {
      const soundEvents3D = results.soundEvents
        .map((event: any) => {
          // Convert audio properties to 3D coordinates
          const timeAngle = (event.time / results.duration) * 2 * Math.PI
          const freqRadius = (event.frequency / 2000) * baseRadius
          const decibelHeight = ((event.decibels + 60) / 60) * baseRadius * 0.5 // Normalize decibels to height

          const x = freqRadius * Math.cos(timeAngle)
          const z = freqRadius * Math.sin(timeAngle)
          const y = decibelHeight - baseRadius * 0.25 // Center the height

          return {
            ...event,
            x,
            y,
            z,
            projected: project3D(x, y, z),
          }
        })
        .filter((event) => event.projected.z > -perspective)
        .sort((a, b) => b.projected.z - a.projected.z) // Sort by depth for proper rendering

      soundEvents3D.forEach((event: any, index: number) => {
        const { projected } = event
        const intensity = event.amplitude
        const size = (3 + intensity * 8) * projected.scale * zoom3D

        // Draw 3D sound event
        const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, size)

        // Color based on frequency and decibels
        const hue = (event.frequency / 2000) * 240 // Blue to red based on frequency
        const saturation = Math.min(100, (event.decibels + 60) * 2) // Saturation based on decibels
        const lightness = 30 + intensity * 50

        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`)
        gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.1)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(projected.x, projected.y, size, 0, 2 * Math.PI)
        ctx.fill()

        // Draw connecting line to show distance
        ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(projected.x, projected.y)
        ctx.stroke()

        // Add 3D labels for prominent events
        if (intensity > 0.5 || index < 5) {
          ctx.fillStyle = "white"
          ctx.font = `${Math.max(8, 10 * projected.scale)}px Arial`
          ctx.shadowColor = "black"
          ctx.shadowBlur = 2

          const labelX = projected.x + 10
          const labelY = projected.y - 10

          ctx.fillText(`${event.type}`, labelX, labelY)
          ctx.fillText(`${event.frequency}Hz`, labelX, labelY + 12)
          ctx.fillText(`${event.decibels}dB`, labelX, labelY + 24)
          ctx.fillText(
            `Dist: ${Math.sqrt(event.x * event.x + event.y * event.y + event.z * event.z).toFixed(0)}`,
            labelX,
            labelY + 36,
          )

          ctx.shadowBlur = 0
        }
      })
    }

    // Draw 3D axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
    ctx.lineWidth = 2

    // X axis (red)
    const xAxis = project3D(baseRadius, 0, 0)
    if (xAxis.z > -perspective) {
      ctx.strokeStyle = "rgba(255, 100, 100, 0.7)"
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(xAxis.x, xAxis.y)
      ctx.stroke()
      ctx.fillStyle = "rgba(255, 100, 100, 0.9)"
      ctx.font = "12px Arial"
      ctx.fillText("Frequency", xAxis.x + 5, xAxis.y)
    }

    // Y axis (green)
    const yAxis = project3D(0, baseRadius, 0)
    if (yAxis.z > -perspective) {
      ctx.strokeStyle = "rgba(100, 255, 100, 0.7)"
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(yAxis.x, yAxis.y)
      ctx.stroke()
      ctx.fillStyle = "rgba(100, 255, 100, 0.9)"
      ctx.font = "12px Arial"
      ctx.fillText("Decibels", yAxis.x + 5, yAxis.y)
    }

    // Z axis (blue)
    const zAxis = project3D(0, 0, baseRadius)
    if (zAxis.z > -perspective) {
      ctx.strokeStyle = "rgba(100, 100, 255, 0.7)"
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(zAxis.x, zAxis.y)
      ctx.stroke()
      ctx.fillStyle = "rgba(100, 100, 255, 0.9)"
      ctx.font = "12px Arial"
      ctx.fillText("Time", zAxis.x + 5, zAxis.y)
    }

    // Draw center point
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    ctx.beginPath()
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI)
    ctx.fill()
  }, [audioData, rotationX, rotationY, zoom3D])

  // Mouse interaction for 3D view
  useEffect(() => {
    const canvas = canvas3DRef.current
    if (!canvas) return

    let isDragging = false
    let lastX = 0
    let lastY = 0

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true
      lastX = e.clientX
      lastY = e.clientY
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.clientX - lastX
      const deltaY = e.clientY - lastY

      setRotationY((prev) => prev + deltaX * 0.01)
      setRotationX((prev) => prev + deltaY * 0.01)

      lastX = e.clientX
      lastY = e.clientY
    }

    const handleMouseUp = () => {
      isDragging = false
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom3D((prev) => Math.max(0.5, Math.min(3, prev + e.deltaY * -0.001)))
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("wheel", handleWheel)

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("wheel", handleWheel)
    }
  }, [])

  // Click handlers for canvas interaction
  useEffect(() => {
    const canvas2D = canvas2DRef.current
    const canvas3D = canvas3DRef.current
    if (!canvas2D || !canvas3D || !audioData?.analysisResults) return

    const handleCanvas2DClick = (event: MouseEvent) => {
      const rect = canvas2D.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const centerX = canvas2D.width / 2
      const centerY = canvas2D.height / 2
      const maxRadius = Math.min(canvas2D.width, canvas2D.height) / 2 - 40

      // Calculate clicked position in polar coordinates
      const dx = x - centerX
      const dy = y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx) + Math.PI / 2

      if (distance <= maxRadius) {
        const time = (angle / (2 * Math.PI)) * audioData.analysisResults.duration
        const frequency = (distance / maxRadius) * 2000

        // Find nearest sound event
        const nearestEvent = audioData.analysisResults.soundEvents.reduce((nearest: any, event: any) => {
          const eventDistance = Math.abs(event.time - time) + Math.abs(event.frequency - frequency) / 100
          const nearestDistance = Math.abs(nearest.time - time) + Math.abs(nearest.frequency - frequency) / 100
          return eventDistance < nearestDistance ? event : nearest
        })

        if (nearestEvent) {
          setSelectedEvent(nearestEvent)
        }
      }
    }

    const handleCanvas3DClick = (event: MouseEvent) => {
      // 3D click detection would be more complex, for now just clear selection
      setSelectedEvent(null)
    }

    canvas2D.addEventListener("click", handleCanvas2DClick)
    canvas3D.addEventListener("click", handleCanvas3DClick)
    canvas2D.style.cursor = "crosshair"
    canvas3D.style.cursor = "grab"

    return () => {
      canvas2D.removeEventListener("click", handleCanvas2DClick)
      canvas3D.removeEventListener("click", handleCanvas3DClick)
    }
  }, [audioData])

  if (!audioData) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-purple-600 mb-4">Advanced Sonar Visualization</h2>
        <p className="text-gray-600 mb-8">Upload or record audio to see dual sonar visualization</p>
        <div className="bg-gray-100 rounded-lg p-8">
          <p className="text-gray-500">No audio data available for visualization</p>
        </div>
      </div>
    )
  }

  if (!audioData.analysisResults) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-purple-600 mb-4">Advanced Sonar Visualization</h2>
        <p className="text-gray-600 mb-8">Analyze audio first to see dual sonar visualization</p>
        <div className="bg-gray-100 rounded-lg p-8">
          <p className="text-gray-500">Analysis required for visualization</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between md:flex-row flex-col items-center mb-6">
        <h2 className="text-2xl font-bold text-purple-600">Advanced Sonar Visualization</h2>

        {/* View Mode Controls */}
        <div className="flex space-x-2">
          <Button onClick={() => setViewMode("split")} variant={viewMode === "split" ? "default" : "outline"} size="sm">
            Split View
          </Button>
          <Button
            onClick={() => setViewMode("full2d")}
            variant={viewMode === "full2d" ? "default" : "outline"}
            size="sm"
          >
            2D Full
          </Button>
          <Button
            onClick={() => setViewMode("full3d")}
            variant={viewMode === "full3d" ? "default" : "outline"}
            size="sm"
          >
            3D Full
          </Button>
          <Button
            onClick={() => {
              setRotationX(0)
              setRotationY(0)
              setZoom3D(1)
            }}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* 2D Sonar Display */}
        {(viewMode === "split" || viewMode === "full2d") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                2D Sonar Display
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  Time × Frequency
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <canvas
                ref={canvas2DRef}
                width={viewMode === "full2d" ? 800 : 600}
                height={viewMode === "full2d" ? 600 : 400}
                className="w-full border rounded-lg bg-gray-900"
              />
              <p className="text-sm text-gray-600 mt-2 text-center">
                Sound events plotted by time (angle) and frequency (distance from center)
              </p>
            </CardContent>
          </Card>
        )}

        {/* 3D Sonar Display */}
        {(viewMode === "split" || viewMode === "full3d") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                3D Sonar Display
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  Time × Frequency × Decibels
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <canvas
                ref={canvas3DRef}
                width={viewMode === "full3d" ? 800 : 600}
                height={viewMode === "full3d" ? 600 : 400}
                className="w-full border rounded-lg bg-gray-900"
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-600">3D visualization: Drag to rotate, scroll to zoom</p>
                <div className="text-xs text-gray-500">
                  Zoom: {zoom3D.toFixed(1)}x | Rotation: {((rotationX * 180) / Math.PI).toFixed(0)}°,{" "}
                  {((rotationY * 180) / Math.PI).toFixed(0)}°
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Control Panel and Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legend & Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full opacity-30"></div>
                <span className="text-sm">2D Sonar Grid</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full opacity-50"></div>
                <span className="text-sm">3D Wireframe</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">Sound Events</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm">Scanning Line</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <p className="text-xs text-gray-600">
                  <strong>3D Controls:</strong>
                  <br />• Drag: Rotate view
                  <br />• Scroll: Zoom in/out
                  <br />• Click: Select events
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detection Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detection Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <strong>Total Events:</strong> {audioData.analysisResults.detectedSounds}
              </p>
              <p>
                <strong>Frequency Range:</strong> 0 - 2000 Hz
              </p>
              <p>
                <strong>Decibel Range:</strong>{" "}
                {audioData.analysisResults.soundEvents?.length > 0
                  ? `${Math.min(...audioData.analysisResults.soundEvents.map((e: any) => e.decibels))} - ${Math.max(...audioData.analysisResults.soundEvents.map((e: any) => e.decibels))} dB`
                  : "N/A"}
              </p>
              <p>
                <strong>Duration:</strong> {audioData.analysisResults.duration}s
              </p>
              <p>
                <strong>3D Resolution:</strong> High
              </p>
              <p>
                <strong>Distance Mapping:</strong> Active
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Selected Event Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedEvent ? "Selected Event" : "Sound Categories"}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEvent ? (
              <div className="space-y-2">
                <p>
                  <strong>Type:</strong> {selectedEvent.type}
                </p>
                <p>
                  <strong>Time:</strong> {selectedEvent.time}s
                </p>
                <p>
                  <strong>Frequency:</strong> {selectedEvent.frequency} Hz
                </p>
                <p>
                  <strong>Amplitude:</strong> {(selectedEvent.amplitude * 100).toFixed(1)}%
                </p>
                <p>
                  <strong>Decibels:</strong> {selectedEvent.decibels} dB
                </p>
                <p>
                  <strong>3D Distance:</strong>{" "}
                  {Math.sqrt(
                    Math.pow(selectedEvent.frequency / 10, 2) +
                      Math.pow(selectedEvent.decibels + 60, 2) +
                      Math.pow(selectedEvent.time * 100, 2),
                  ).toFixed(0)}{" "}
                  units
                </p>
                <Button onClick={() => setSelectedEvent(null)} variant="outline" size="sm" className="mt-2">
                  Clear Selection
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(new Set(audioData.analysisResults.soundEvents?.map((e: any) => e.type) || [])).map(
                  (type: any) => (
                    <div key={type} className="flex justify-between">
                      <span>{type}</span>
                      <span className="text-sm text-gray-600">
                        {audioData.analysisResults.soundEvents?.filter((e: any) => e.type === type).length || 0}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Technical Information */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">3D Sonar Technical Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Coordinate System</h4>
              <ul className="text-blue-700 space-y-1">
                <li>• X-Axis: Frequency (Hz)</li>
                <li>• Y-Axis: Decibel Level (dB)</li>
                <li>• Z-Axis: Time Position (s)</li>
                <li>• Origin: Center reference point</li>
              </ul>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Distance Calculation</h4>
              <ul className="text-green-700 space-y-1">
                <li>• 3D Euclidean distance</li>
                <li>• Real-time position tracking</li>
                <li>• Amplitude-based sizing</li>
                <li>• Perspective projection</li>
              </ul>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">Visualization Features</h4>
              <ul className="text-purple-700 space-y-1">
                <li>• Interactive 3D rotation</li>
                <li>• Dynamic zoom control</li>
                <li>• Color-coded frequency mapping</li>
                <li>• Real-time event tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
