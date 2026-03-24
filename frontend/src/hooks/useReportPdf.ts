import { useCallback } from 'react'
import type { ScenarioFull, SessionSummary } from '../types/scenario'

export function useReportPdf() {
  const exportPdf = useCallback(async (summary: SessionSummary, scenario: ScenarioFull) => {
    // Dynamic import so jsPDF is not bundled unless used
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    const pageW  = doc.internal.pageSize.getWidth()
    const margin = 16
    const col    = pageW - margin * 2
    let y        = margin

    const ln = (n = 5) => { y += n }
    const checkPage = (needed = 12) => {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage(); y = margin
      }
    }

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42)          // gray-950
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(34, 211, 238)        // cyan-400
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('DWELL', margin, 12)
    doc.setTextColor(148, 163, 184)       // gray-400
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Incident Response Training — Debrief Report', margin, 19)

    const outcome = summary.outcome === 'complete' ? 'PASSED' : 'FAILED'
    const outcomeColor: [number, number, number] = summary.outcome === 'complete' ? [52, 211, 153] : [248, 113, 113]
    doc.setTextColor(...outcomeColor)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(outcome, pageW - margin, 12, { align: 'right' })
    y = 36

    // ── Scenario info ─────────────────────────────────────────────────────────
    doc.setTextColor(30, 41, 59)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin, y, col, 28, 2, 2, 'F')

    doc.setTextColor(15, 23, 42)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(scenario.name, margin + 4, y + 8)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const diffLabel = scenario.difficulty_level.toUpperCase()
    doc.text(`Difficulty: ${diffLabel}   |   Max Attempts: ${scenario.max_attempts}   |   Ransomware Class: ${scenario.scenario_structure.ransomwareFamily}`, margin + 4, y + 16)

    const started   = summary.started_at   ? new Date(summary.started_at).toLocaleString()   : '—'
    const completed = summary.completed_at ? new Date(summary.completed_at).toLocaleString() : '—'
    doc.text(`Started: ${started}   |   Completed: ${completed}`, margin + 4, y + 23)
    y += 34

    // ── Score ─────────────────────────────────────────────────────────────────
    checkPage(30)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('Performance Summary', margin, y)
    ln(6)

    const boxes: [string, string, [number,number,number]][] = [
      ['Correct Choices',  String(summary.correct_choices),  [52, 211, 153]],
      ['Wrong Choices',    String(summary.wrong_choices),    [248, 113, 113]],
      ['Attempts Used',    `${summary.attempts_used} / ${scenario.max_attempts}`, [148, 163, 184]],
      ['Stages Cleared',   String(summary.phases_completed.length), [34, 211, 238]],
    ]
    const boxW = (col - 6) / 4
    boxes.forEach(([label, val, color], i) => {
      const bx = margin + i * (boxW + 2)
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F')
      doc.setTextColor(...color)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(val, bx + boxW / 2, y + 10, { align: 'center' })
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(71, 85, 105)
      doc.text(label, bx + boxW / 2, y + 16, { align: 'center' })
    })
    y += 24

    // ── Lessons learned ───────────────────────────────────────────────────────
    const lessons = scenario.scenario_structure.lessonsLearned ?? []
    if (lessons.length) {
      checkPage(16)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('Key Lessons Learned', margin, y)
      ln(6)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
      lessons.forEach(lesson => {
        checkPage(12)
        const lines = doc.splitTextToSize(`• ${lesson}`, col - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 5 + 2
      })
      ln(4)
    }

    // ── Reference links ───────────────────────────────────────────────────────
    const refs = scenario.scenario_structure.referenceLinks ?? []
    if (refs.length) {
      checkPage(16)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('Reference Links', margin, y)
      ln(6)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      refs.forEach(ref => {
        checkPage(8)
        doc.setTextColor(34, 211, 238)
        doc.text(ref, margin + 2, y)
        doc.link(margin + 2, y - 4, col - 4, 6, { url: ref })
        ln(6)
      })
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.setFont('helvetica', 'normal')
      doc.text('Dwell — Incident Response Training — Confidential Report', margin, doc.internal.pageSize.getHeight() - 8)
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
    }

    const safeName = scenario.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    doc.save(`dwell_debrief_${safeName}_${Date.now()}.pdf`)
  }, [])

  return { exportPdf }
}
