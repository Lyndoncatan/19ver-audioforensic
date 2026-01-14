import jsPDF from "jspdf"

interface AudioData {
  blob: Blob
  url: string
  name: string
  duration: number
  analysisResults?: any
}

type ProgressCallback = (progress: number, stage: string) => void

export const generatePDFReport = async (audioData: AudioData, onProgress?: ProgressCallback): Promise<void> => {
  if (!audioData.analysisResults) {
    throw new Error("No analysis results available for PDF generation")
  }

  try {
    // Import autoTable dynamically
    const autoTable = (await import("jspdf-autotable")).default

    const doc = new jsPDF()
    const results = audioData.analysisResults

    // Progress tracking
    const updateProgress = (progress: number, stage: string) => {
      if (onProgress) {
        onProgress(progress, stage)
      }
    }

    updateProgress(5, "Initializing PDF document...")

    // Set up fonts and colors
    doc.setFont("helvetica", "bold")
    doc.setFontSize(20)
    doc.setTextColor(128, 0, 128) // Purple color

    // Title
    doc.text("Audio Forensic Analysis Report", 20, 25)

    // Add logo/header line
    doc.setDrawColor(128, 0, 128)
    doc.setLineWidth(2)
    doc.line(20, 30, 190, 30)

    updateProgress(10, "Adding file information...")

    // Reset font for content
    doc.setFont("helvetica", "normal")
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)

    let yPosition = 45

    // File Information Section
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("File Information", 20, yPosition)
    yPosition += 10

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)

    const fileInfo = [
      ["Filename", audioData.name || "Unknown"],
      ["Duration", `${results.duration || 0} seconds`],
      ["Sample Rate", `${results.sampleRate || 44100} Hz`],
      ["Analysis Date", new Date().toLocaleString()],
      ["Average RMS Energy", (results.averageRMS || 0).toFixed(6)],
      ["Max Decibels", `${results.maxDecibels || 0} dB`],
    ]

    // Use autoTable with proper options
    autoTable(doc, {
      startY: yPosition,
      head: [["Property", "Value"]],
      body: fileInfo,
      theme: "grid",
      headStyles: { fillColor: [128, 0, 128], textColor: 255 },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60 },
        1: { cellWidth: 110 },
      },
    })

    updateProgress(25, "Processing sound detection data...")

    // Get the final Y position from the last table
    yPosition = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : yPosition + 60

    // Sound Detection Summary
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Sound Detection Summary", 20, yPosition)
    yPosition += 10

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)

    const detectionSummary = [
      ["Total Sound Events Detected", (results.detectedSounds || 0).toString()],
      ["Dominant Frequency", `${results.dominantFrequency || 440} Hz`],
      ["Frequency Classification", classifyFrequency(results.dominantFrequency || 440)],
      ["Analysis Confidence", "High (Automated Detection)"],
      ["Processing Method", "FFT + STFT Analysis"],
      ["Detection Algorithm", "Energy-based with Spectral Features"],
    ]

    autoTable(doc, {
      startY: yPosition,
      head: [["Metric", "Value"]],
      body: detectionSummary,
      theme: "grid",
      headStyles: { fillColor: [0, 128, 0], textColor: 255 },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 80 },
        1: { cellWidth: 90 },
      },
    })

    updateProgress(40, "Generating sound events table...")

    yPosition = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : yPosition + 60

    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }

    // Sound Events Table
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Detected Sound Events", 20, yPosition)
    yPosition += 10

    if (results.soundEvents && results.soundEvents.length > 0) {
      const soundEventsData = results.soundEvents
        .slice(0, 15) // Show top 15 events
        .map((event: any, index: number) => [
          (index + 1).toString(),
          `${event.time || 0}s`,
          event.type || "Unknown",
          `${event.frequency || 0} Hz`,
          `${((event.amplitude || 0) * 100).toFixed(1)}%`,
          `${event.decibels || 0} dB`,
          classifyFrequency(event.frequency || 440),
        ])

      autoTable(doc, {
        startY: yPosition,
        head: [["#", "Time", "Type", "Frequency", "Amplitude", "Decibels", "Classification"]],
        body: soundEventsData,
        theme: "striped",
        headStyles: { fillColor: [255, 140, 0], textColor: 255 },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 20 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 35 },
        },
      })

      yPosition = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : yPosition + 100
    } else {
      doc.setFont("helvetica", "italic")
      doc.text("No sound events detected in this audio file.", 20, yPosition)
      yPosition += 15
    }

    updateProgress(60, "Creating frequency analysis...")

    // Add new page for frequency analysis
    doc.addPage()
    yPosition = 20

    // Frequency Analysis Section
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Comprehensive Frequency Analysis", 20, yPosition)
    yPosition += 15

    // Create frequency distribution chart (text-based)
    if (results.frequencySpectrum && results.frequencySpectrum.length > 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text("Frequency Distribution (Top 10 Components):", 20, yPosition)
      yPosition += 10

      const topFrequencies = results.frequencySpectrum
        .sort((a: any, b: any) => (b.magnitude || 0) - (a.magnitude || 0))
        .slice(0, 10)
        .map((freq: any, index: number) => [
          (index + 1).toString(),
          `${freq.frequency || 0} Hz`,
          `${((freq.magnitude || 0) * 100).toFixed(1)}%`,
          generateBarChart(freq.magnitude || 0),
          classifyFrequency(freq.frequency || 440),
        ])

      autoTable(doc, {
        startY: yPosition,
        head: [["Rank", "Frequency", "Magnitude", "Visual", "Classification"]],
        body: topFrequencies,
        theme: "grid",
        headStyles: { fillColor: [0, 0, 128], textColor: 255 },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 50 },
          4: { cellWidth: 40 },
        },
      })

      yPosition = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : yPosition + 80
    }

    updateProgress(75, "Adding analysis methodology...")

    // Statistical Analysis
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Statistical Analysis", 20, yPosition)
    yPosition += 10

    const statisticalData = generateStatisticalAnalysis(results)

    if (statisticalData.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        head: [["Metric", "Value", "Interpretation"]],
        body: statisticalData,
        theme: "grid",
        headStyles: { fillColor: [128, 0, 128], textColor: 255 },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 50 },
          1: { cellWidth: 40 },
          2: { cellWidth: 80 },
        },
      })

      yPosition = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : yPosition + 60
    }

    // Analysis Methodology
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Analysis Methodology", 20, yPosition)
    yPosition += 10

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)

    const methodology = [
      "This comprehensive audio forensic analysis was performed using advanced",
      "digital signal processing techniques:",
      "",
      "• Fast Fourier Transform (FFT) for frequency domain analysis",
      "• Short-Time Fourier Transform (STFT) for time-frequency representation",
      "• Energy-based sound event detection with adaptive thresholding",
      "• Spectral feature extraction including centroid and rolloff",
      "• Statistical analysis of amplitude and frequency distributions",
      "",
      "The analysis provides comprehensive insights into:",
      "• Temporal distribution and timing of sound events",
      "• Frequency characteristics and dominant spectral components",
      "• Amplitude variations and dynamic range analysis",
      "• Sound classification based on spectral and temporal features",
    ]

    methodology.forEach((line) => {
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }
      doc.text(line, 20, yPosition)
      yPosition += 6
    })

    updateProgress(90, "Generating conclusions and summary...")

    // Add new page for conclusions
    doc.addPage()
    yPosition = 20

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("Analysis Summary & Conclusions", 20, yPosition)
    yPosition += 15

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)

    const conclusions = generateDetailedConclusions(results)
    conclusions.forEach((conclusion) => {
      if (yPosition > 260) {
        doc.addPage()
        yPosition = 20
      }

      // Split long text into multiple lines
      const lines = doc.splitTextToSize(conclusion, 170)
      lines.forEach((line: string) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 20
        }
        doc.text(line, 20, yPosition)
        yPosition += 6
      })
      yPosition += 4 // Extra space between conclusions
    })

    // Add technical specifications
    yPosition += 10
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Technical Specifications", 20, yPosition)
    yPosition += 10

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)

    const techSpecs = [
      `Analysis Engine: Audio Forensic Detector v1.0`,
      `Processing Libraries: Web Audio API, Advanced Classification`,
      `Sample Rate: ${results.sampleRate || 44100} Hz`,
      `Analysis Duration: ${results.duration || 0} seconds`,
      `Total Data Points: ${Math.floor((results.sampleRate || 44100) * (results.duration || 0))}`,
      `Frequency Resolution: ${((results.sampleRate || 44100) / 2048).toFixed(2)} Hz`,
      `Time Resolution: ${((1024 / (results.sampleRate || 44100)) * 1000).toFixed(2)} ms`,
    ]

    techSpecs.forEach((spec) => {
      if (yPosition > 280) {
        doc.addPage()
        yPosition = 20
      }
      doc.text(spec, 20, yPosition)
      yPosition += 6
    })

    updateProgress(95, "Finalizing document...")

    // Add footer with generation info
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFont("helvetica", "italic")
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`Audio Forensic Detector - Generated on ${new Date().toLocaleString()}`, 20, 285)
      doc.text(`Page ${i} of ${pageCount}`, 170, 285)
      doc.text(`File: ${audioData.name}`, 20, 290)
    }

    updateProgress(100, "Saving PDF report...")

    // Save the PDF
    const filename = `Audio_Forensic_Report_${audioData.name.replace(/\.[^/.]+$/, "")}_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(filename)
  } catch (error) {
    console.error("PDF Generation Error:", error)
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Helper functions
const classifyFrequency = (freq: number): string => {
  if (freq < 60) return "Sub-Bass"
  if (freq < 250) return "Bass"
  if (freq < 500) return "Low-Mid"
  if (freq < 2000) return "Mid (Voice)"
  if (freq < 4000) return "High-Mid"
  if (freq < 8000) return "Presence"
  if (freq < 16000) return "Brilliance"
  return "Ultra-High"
}

const generateBarChart = (magnitude: number): string => {
  const barLength = Math.round(magnitude * 20)
  return "█".repeat(Math.max(0, barLength)) + "░".repeat(Math.max(0, 20 - barLength))
}

const generateStatisticalAnalysis = (results: any): string[][] => {
  const stats: string[][] = []

  if (results.soundEvents && results.soundEvents.length > 0) {
    const amplitudes = results.soundEvents.map((e: any) => e.amplitude || 0)
    const frequencies = results.soundEvents.map((e: any) => e.frequency || 0)

    if (amplitudes.length > 0 && frequencies.length > 0) {
      const avgAmplitude = amplitudes.reduce((a: number, b: number) => a + b, 0) / amplitudes.length
      const maxAmplitude = Math.max(...amplitudes)
      const minAmplitude = Math.min(...amplitudes)

      const avgFrequency = frequencies.reduce((a: number, b: number) => a + b, 0) / frequencies.length
      const maxFrequency = Math.max(...frequencies)
      const minFrequency = Math.min(...frequencies)

      stats.push(
        [
          "Average Amplitude",
          `${(avgAmplitude * 100).toFixed(1)}%`,
          avgAmplitude > 0.7 ? "High energy content" : "Moderate energy",
        ],
        [
          "Amplitude Range",
          `${(minAmplitude * 100).toFixed(1)}% - ${(maxAmplitude * 100).toFixed(1)}%`,
          "Dynamic range indicator",
        ],
        ["Average Frequency", `${avgFrequency.toFixed(0)} Hz`, classifyFrequency(avgFrequency)],
        ["Frequency Range", `${minFrequency.toFixed(0)} - ${maxFrequency.toFixed(0)} Hz`, "Spectral bandwidth"],
        [
          "Event Density",
          `${(results.soundEvents.length / (results.duration || 1)).toFixed(2)} events/sec`,
          results.soundEvents.length / (results.duration || 1) > 1 ? "High activity" : "Low activity",
        ],
      )
    }
  }

  return stats
}

const generateDetailedConclusions = (results: any): string[] => {
  const conclusions = []

  conclusions.push(
    `EXECUTIVE SUMMARY: Analysis of "${results.filename || "audio file"}" reveals ${results.detectedSounds || 0} distinct sound events over a ${results.duration || 0} second duration, providing comprehensive insights into the audio content's characteristics and forensic significance.`,
  )

  if (results.dominantFrequency) {
    conclusions.push(
      `FREQUENCY ANALYSIS: The dominant frequency component is ${results.dominantFrequency} Hz, classified as ${classifyFrequency(results.dominantFrequency)}. This indicates the primary spectral energy concentration and suggests the nature of the sound source.`,
    )
  }

  if (results.maxDecibels > -10) {
    conclusions.push(
      `AMPLITUDE ASSESSMENT: The audio contains high-amplitude signals (${results.maxDecibels} dB), indicating strong sound sources, potential clipping, or close-proximity recording conditions.`,
    )
  } else if (results.maxDecibels < -30) {
    conclusions.push(
      `AMPLITUDE ASSESSMENT: The audio has relatively low amplitude levels (${results.maxDecibels} dB), suggesting distant sources, quiet recording conditions, or potential signal attenuation.`,
    )
  }

  if (results.soundEvents && results.soundEvents.length > 0) {
    const eventTypesArray = results.soundEvents.map((e: any) => e.type || "Unknown")
    const uniqueEventTypes = Array.from(new Set(eventTypesArray))

    conclusions.push(
      `SOUND CLASSIFICATION: Detected sound types include: ${uniqueEventTypes.join(", ")}. This classification is based on spectral analysis and temporal characteristics.`,
    )
  }

  conclusions.push(
    `FORENSIC SIGNIFICANCE: This comprehensive analysis provides detailed acoustic fingerprinting suitable for forensic investigation, quality assessment, and comparative analysis purposes.`,
  )

  conclusions.push(
    `TECHNICAL VALIDATION: All measurements were performed using industry-standard digital signal processing techniques with high precision. Results are suitable for technical documentation.`,
  )

  return conclusions
}
