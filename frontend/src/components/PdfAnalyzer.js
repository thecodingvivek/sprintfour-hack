'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { uploadPdf, exportPdf, generatePolicy, auditRedactedText } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Upload,
  FileText,
  Loader2,
  Shield,
  Download,
  RotateCcw,
  Info,
  BookOpen,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Search,
  FileWarning,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const riskColors = {
  high: 'bg-[#FDEBEC] text-[#9F2F2D] border-[#FDEBEC]',
  medium: 'bg-[#FBF3DB] text-[#956400] border-[#FBF3DB]',
  low: 'bg-[#EDF3EC] text-[#346538] border-[#EDF3EC]',
}

const typeColors = {
  PERSON: 'bg-[#E1F3FE] text-[#1F6C9F]',
  EMAIL_ADDRESS: 'bg-[#FDEBEC] text-[#9F2F2D]',
  PHONE_NUMBER: 'bg-[#FBF3DB] text-[#956400]',
  CREDIT_CARD: 'bg-[#FDEBEC] text-[#9F2F2D]',
  ADDRESS: 'bg-[#EDF3EC] text-[#346538]',
  DATE_OF_BIRTH: 'bg-[#E1F3FE] text-[#1F6C9F]',
  US_SSN: 'bg-[#FDEBEC] text-[#9F2F2D]',
  IP_ADDRESS: 'bg-[#E1F3FE] text-[#1F6C9F]',
  IBAN_CODE: 'bg-[#EDF3EC] text-[#346538]',
  EMPLOYEE_ID: 'bg-[#FBF3DB] text-[#956400]',
  URL: 'bg-[#E1F3FE] text-[#1F6C9F]',
  DEFAULT: 'bg-[#F1F0ED] text-[#2F3437]',
}

function getTypeColor(type) {
  return typeColors[type] || typeColors.DEFAULT
}

function PolicySection({ type, items }) {
  const icons = { hide: EyeOff, keep: Eye, review: Search }
  const labels = { hide: 'Will be hidden', keep: 'Will be kept', review: 'Will be reviewed' }
  const styles = {
    hide: 'border-[#FDEBEC] bg-[#FFF8F8]',
    keep: 'border-[#EDF3EC] bg-[#F8FBF8]',
    review: 'border-[#FBF3DB] bg-[#FFFCF5]',
  }
  const Icon = icons[type]
  return (
    <div className={`rounded-lg border p-3 ${styles[type]}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="size-3.5" />
        <p className="text-xs font-medium uppercase tracking-wider">{labels[type]}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs opacity-60">None specified</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm">{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PdfAnalyzer({ activeTab, onTabChange }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState(null)
  const [hoveredEntity, setHoveredEntity] = useState(null)

  const [purpose, setPurpose] = useState('')
  const [policy, setPolicy] = useState(null)
  const [activePolicyTab, setActivePolicyTab] = useState('hide')
  const [generatingPolicy, setGeneratingPolicy] = useState(false)
  const [policyGeneratedFor, setPolicyGeneratedFor] = useState('')

  const [reviewState, setReviewState] = useState({})

  const handleGeneratePolicy = useCallback(async () => {
    if (!purpose.trim()) return
    setGeneratingPolicy(true)
    try {
      const data = await generatePolicy(purpose)
      setPolicy(data.policy)
      setPolicyGeneratedFor(data.purpose)
    } catch (err) {
      setError('Policy generation failed: ' + err.message)
    } finally {
      setGeneratingPolicy(false)
    }
  }, [purpose])

  const handleRemovePolicy = useCallback(() => {
    setPolicy(null)
    setPurpose('')
    setPolicyGeneratedFor('')
  }, [])

  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setResult(null)
      setError(null)
      setAuditResult(null)
      setReviewState({})
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.type === 'text/plain' || f.name.endsWith('.txt'))) {
      setFile(f)
      setResult(null)
      setError(null)
      setAuditResult(null)
      setReviewState({})
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)
    setAuditResult(null)
    try {
      const data = await uploadPdf(file, {
        purpose: policyGeneratedFor || undefined,
        policy: policy || undefined,
      })
      setResult(data)
      setReviewState(
        (data.entities || []).reduce((acc, e, i) => {
          acc[i] = { decision: e.recommendation === 'keep' ? 'keep' : 'redact', modified: false }
          return acc
        }, {})
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }, [file, policy, policyGeneratedFor])

  const handleDecisionChange = useCallback((entityIndex, newDecision) => {
    setReviewState((prev) => ({
      ...prev,
      [entityIndex]: { decision: newDecision, modified: true },
    }))
    const el = document.getElementById('preview')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const handleExportPdf = useCallback(async () => {
    if (!file || !result) return
    setExporting(true)
    try {
      const redactions = (result.entities || []).reduce((acc, e, i) => {
        const decision = reviewState[i]?.decision
        if (decision === 'redact') acc.push({ value: e.value, type: e.type, action: 'redact' })
        else if (decision === 'anonymize') acc.push({ value: e.value, type: e.type, action: 'anonymize' })
        return acc
      }, [])
      const blob = await exportPdf(file, redactions)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'redacted_document.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('PDF export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }, [file, result, reviewState])

  const handleAudit = useCallback(async () => {
    if (!result) return
    setAuditing(true)
    setAuditResult(null)
    try {
      const data = await auditRedactedText(result.anonymized_text, {
        policy: policy || undefined,
      })
      setAuditResult(data)
    } catch (err) {
      setError('Audit failed: ' + err.message)
    } finally {
      setAuditing(false)
    }
  }, [result, policy])

  const handleReset = useCallback(() => {
    setFile(null)
    setNumPages(null)
    setResult(null)
    setError(null)
    setSelectedEntity(null)
    setAuditResult(null)
    setReviewState({})
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const decisionCounts = result
    ? (result.entities || []).reduce(
        (acc, _, i) => {
          const d = reviewState[i]?.decision || 'redact'
          if (d === 'redact') acc.redact++
          else if (d === 'anonymize') acc.anonymize++
          else acc.keep++
          return acc
        },
        { redact: 0, anonymize: 0, keep: 0 }
      )
    : { redact: 0, anonymize: 0, keep: 0 }
  const toExportCount = decisionCounts.redact + decisionCounts.anonymize

  const [activeSection, setActiveSection] = useState('overview')

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'audit', label: 'Audit' },
    { id: 'preview', label: 'Preview' },
    { id: 'explanations', label: 'Explanations' },
    { id: 'kept', label: 'Kept Items' },
    { id: 'actions', label: 'Actions' },
  ]

  const scrollToSection = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (!result) return
    const sectionIds = navItems.map((item) => item.id)
    const observers = []
    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (!el) continue
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      )
      observer.observe(el)
      observers.push(observer)
    }
    return () => observers.forEach((o) => o.disconnect())
  }, [result])

  const previewRef = useRef(null)
  const textLayerCounter = useRef(0)
  const [textLayersReady, setTextLayersReady] = useState(0)

  const handleTextLayerRenderSuccess = useCallback(() => {
    textLayerCounter.current += 1
    setTextLayersReady(textLayerCounter.current)
  }, [])

  const applyHighlights = useCallback(() => {
    if (!result || !previewRef.current) return
    const entities = result.entities || []

    const spans = previewRef.current.querySelectorAll(
      '.react-pdf__Page__textContent span[role="presentation"]'
    )

    const anonymizedEntityIndexes = new Set()

    spans.forEach((span) => {
      if (span.dataset.originalText) {
        span.textContent = span.dataset.originalText
      }
      span.style.background = ''
      span.style.color = ''
      span.style.borderRadius = ''
      span.style.border = ''
      span.style.fontFamily = ''
      span.style.display = ''
      span.style.minWidth = ''
      span.style.minHeight = ''
      span.style.padding = ''
      span.style.userSelect = ''
      span.style.boxShadow = ''
    })

    const annotationLayers = previewRef.current.querySelectorAll('.react-pdf__Page__annotations')
    annotationLayers.forEach(layer => {
      layer.style.pointerEvents = 'none'
    })

    spans.forEach((span) => {
      const text = (span.textContent || '').trim()
      if (!text) return
      const lower = text.toLowerCase()

      const entity = entities.find((e) => {
        const eLower = e.value.toLowerCase()
        return (
          lower.includes(eLower) ||
          eLower.includes(lower) ||
          e.value.split(/\s+/).some((word) => word.toLowerCase() === lower)
        )
      })
      if (!entity) return

      const entityIndex = entities.indexOf(entity)
      if (!span.dataset.originalText) {
        span.dataset.originalText = span.textContent || ''
      }

      const decision = reviewState[entityIndex]?.decision || 'redact'
      if (decision === 'redact') {
        const rect = span.getBoundingClientRect()
        span.textContent = ''
        span.style.background = '#2F3437'
        span.style.borderRadius = '2px'
        span.style.display = 'inline-block'
        span.style.userSelect = 'none'
        span.style.minWidth = `${Math.max(rect.width, 12)}px`
        span.style.minHeight = `${Math.max(rect.height, 10)}px`
        span.style.boxShadow = '0 0 0 3px #2F3437'
      } else if (decision === 'anonymize') {
        const rect = span.getBoundingClientRect()
        const hasRenderedTag = anonymizedEntityIndexes.has(entityIndex)
        span.textContent = hasRenderedTag ? '' : `<${entity.type}>`
        anonymizedEntityIndexes.add(entityIndex)
        span.style.background = '#F1F0ED'
        span.style.color = '#787774'
        span.style.borderRadius = '2px'
        span.style.fontFamily = 'monospace'
        span.style.display = 'inline-block'
        span.style.minWidth = `${Math.max(rect.width, 12)}px`
        span.style.minHeight = `${Math.max(rect.height, 10)}px`
        span.style.padding = '0 2px'
      }

      if (decision === 'redact' || decision === 'anonymize') {
        span.style.cursor = 'pointer'
        span.onmouseenter = () => {
          const rect = span.getBoundingClientRect()
          setHoveredEntity({ entity, index: entityIndex, rect })
        }
        span.onmouseleave = () => {
          setHoveredEntity(null)
        }
        span.onclick = () => {
          const el = document.getElementById(`explanation-${entityIndex}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('ring-2', 'ring-[#2F3437]', 'ring-offset-2')
            setTimeout(() => el.classList.remove('ring-2', 'ring-[#2F3437]', 'ring-offset-2'), 1500)
          }
        }
      } else {
        span.style.cursor = ''
        span.onmouseenter = null
        span.onmouseleave = null
        span.onclick = null
      }
    })
  }, [result, reviewState])

  useEffect(() => {
    if (!result) return
    if (textLayersReady > 0) applyHighlights()
  }, [result, textLayersReady, applyHighlights])

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(auto,800px)_1fr] gap-8 max-w-[1600px] mx-auto">
        {/* Left nav column */}
        <div className="hidden md:flex justify-end items-start">
          {result && (
            <nav className="sticky top-6 w-[10rem]">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      activeSection === item.id
                        ? 'bg-[#F1F0ED] text-[#2F3437]'
                        : 'text-[#787774] hover:bg-[#F1F0ED] hover:text-[#2F3437]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* Middle content column */}
        <div className="min-w-0 space-y-8">
      {/* Upload Section */}
      {!result && (
        <Card className="border-[#EAEAEA] shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-[#2F3437]" />
                <CardTitle className="font-heading text-xl tracking-tight">
                  Upload a file for analysis
                </CardTitle>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#F1F0ED] p-0.5">
                {[{ id: 'text', label: 'Text' }, { id: 'pdf', label: 'PDF' }].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-[#2F3437] shadow-sm'
                        : 'text-[#787774] hover:text-[#2F3437]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <CardDescription className="text-[#787774]">
              Upload a PDF or TXT file. Set a privacy policy to control what gets redacted, then analyze.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#EAEAEA] bg-white p-12 transition-colors hover:border-[#D0CEC9] hover:bg-[#FAFAF9]"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf,.txt,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="mb-3 size-8 text-[#B0AEAA]" />
              <p className="text-sm font-medium text-[#2F3437]">
                {file ? file.name : 'Click to select or drop a file'}
              </p>
              <p className="mt-1 text-xs text-[#B0AEAA]">
                {file ? `${(file.size / 1024).toFixed(0)} KB` : 'PDF or TXT files supported'}
              </p>
            </div>

            {/* Policy Section */}
            <div className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-3">
              {!policy ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-[#787774]" />
                    <span className="text-sm font-medium text-[#2F3437]">Privacy Policy</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g. Resume Review, Contract Analysis"
                      className="flex-1 rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#2F3437] placeholder:text-[#B0AEAA] outline-none focus-visible:border-[#D0CEC9] focus-visible:ring-1 focus-visible:ring-[#D0CEC9]"
                      onKeyDown={(e) => e.key === 'Enter' && handleGeneratePolicy()}
                    />
                    <Button
                      onClick={handleGeneratePolicy}
                      disabled={!purpose.trim() || generatingPolicy}
                      variant="outline"
                      className="shrink-0 border-[#EAEAEA] text-[#2F3437]"
                    >
                      {generatingPolicy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-[#B0AEAA]">
                    Describe the purpose to generate a tailored policy.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-[#346538]" />
                    <span className="text-sm font-medium text-[#2F3437]">
                      Policy active for <span className="text-[#346538]">{policyGeneratedFor}</span>
                    </span>
                    <Badge variant="outline" className="rounded-full bg-[#EDF3EC] text-[#346538] border-0 text-[10px] font-medium">Active</Badge>
                  </div>
                  <Button onClick={handleRemovePolicy} variant="ghost" size="sm" className="text-[#787774] hover:text-[#9F2F2D] h-7 px-2 shrink-0">
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!file || !policy || uploading}
              className="w-full bg-[#111111] text-white hover:bg-[#333333]"
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Shield className="size-4" />
                  Analyze Document
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-[#FDEBEC] shadow-none bg-[#FFF8F8]">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#9F2F2D]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#9F2F2D]">Error</p>
              <p className="mt-1 text-sm text-[#9F2F2D]/80">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-[#9F2F2D]">
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {result && (
        <>
          {/* Hover Popup */}
          {hoveredEntity && (
            <div 
              className="fixed z-[100] w-64 rounded-lg border border-[#EAEAEA] bg-white p-3 shadow-lg pointer-events-none"
              style={{ 
                top: hoveredEntity.rect.bottom + 4,
                left: hoveredEntity.rect.left 
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-[#2F3437] truncate">{hoveredEntity.entity.value}</span>
                <Badge variant="outline" className={`rounded-full border-0 text-[9px] font-medium uppercase tracking-wider shrink-0 ${getTypeColor(hoveredEntity.entity.type)}`}>
                  {hoveredEntity.entity.type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={`rounded-full border-0 text-[9px] font-medium uppercase tracking-wider ${riskColors[hoveredEntity.entity.risk_level] || ''}`}>
                  {hoveredEntity.entity.risk_level}
                </Badge>
                <Badge variant="outline" className={`rounded-full text-[9px] font-medium uppercase tracking-wider ${
                  (reviewState[hoveredEntity.index]?.decision || 'redact') === 'redact'
                    ? 'border-[#FDEBEC] bg-[#FDEBEC] text-[#9F2F2D]'
                    : (reviewState[hoveredEntity.index]?.decision || 'redact') === 'anonymize'
                      ? 'border-[#E8E6E1] bg-[#F1F0ED] text-[#787774]'
                      : 'border-[#EDF3EC] bg-[#EDF3EC] text-[#346538]'
                }`}>
                  {(reviewState[hoveredEntity.index]?.decision || 'redact') === 'redact' ? 'Redact' : (reviewState[hoveredEntity.index]?.decision || 'redact') === 'anonymize' ? 'Anonymize' : 'Keep'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-[#787774] line-clamp-3">{hoveredEntity.entity.explanation}</p>
            </div>
          )}

          {/* Risk Summary */}
          <Card id="overview" className="scroll-mt-24 border-[#EAEAEA] shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-[#2F3437]" />
                <CardTitle className="font-heading text-xl tracking-tight">
                  Analysis Results
                </CardTitle>
              </div>
              {result.overall_risk_summary && (
                <CardDescription className="text-[#787774]">{result.overall_risk_summary}</CardDescription>
              )}
              {policyGeneratedFor && (
                <CardDescription className="text-[#787774] flex items-center gap-1.5 mt-1">
                  <BookOpen className="size-3.5" />
                  Policy applied: <span className="text-[#2F3437]">{policyGeneratedFor}</span>
                </CardDescription>
              )}
            </CardHeader>
          </Card>

          {/* Privacy Audit */}
          <Card id="audit" className="scroll-mt-24 border-[#EAEAEA] shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#787774]" />
                <CardTitle className="font-heading text-base tracking-tight">LLM AS JUDGE</CardTitle>
              </div>
              <CardDescription>Check with one more agent which checks for senstive pii.</CardDescription>
            </CardHeader>
            <CardContent>
              {!auditResult ? (
                <Button onClick={handleAudit} disabled={auditing} variant="outline" className="border-[#EAEAEA] text-[#2F3437] hover:bg-[#F1F0ED]">
                  {auditing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {auditing ? 'Running audit...' : 'Run Privacy Audit'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={`rounded-full text-[11px] font-medium uppercase tracking-wider ${
                      auditResult.status === 'PASS' ? 'bg-[#EDF3EC] text-[#346538]' : 'bg-[#FBF3DB] text-[#956400]'
                    }`}>
                      {auditResult.status}
                    </Badge>
                    <Badge variant="secondary" className={`rounded-full text-[11px] font-medium uppercase tracking-wider ${
                      auditResult.residual_risk === 'LOW' ? 'bg-[#EDF3EC] text-[#346538]'
                      : auditResult.residual_risk === 'MEDIUM' ? 'bg-[#FBF3DB] text-[#956400]'
                      : 'bg-[#FDEBEC] text-[#9F2F2D]'
                    }`}>
                      Residual Risk: {auditResult.residual_risk}
                    </Badge>
                  </div>
                  {auditResult.result_summary && (
                    <p className="text-sm text-[#787774] leading-relaxed">{auditResult.result_summary}</p>
                  )}
                  {auditResult.remaining_identifiers?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Remaining Identifiers</p>
                      {auditResult.remaining_identifiers.map((item, i) => (
                        <div key={i} className="rounded-lg border border-[#EAEAEA] bg-white p-3">
                          <p className="text-sm font-medium text-[#2F3437]">{item.value}</p>
                          <p className="text-xs text-[#787774] mt-1">{item.reason}</p>
                          {item.recommendation && <p className="text-xs text-[#9F2F2D] mt-1">{item.recommendation}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button onClick={handleAudit} disabled={auditing} variant="ghost" size="sm" className="text-[#787774] hover:text-[#2F3437]">
                    {auditing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                    Re-run
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PDF Preview */}
          <div id="preview" className="scroll-mt-24">
            <Card className="border-[#EAEAEA] shadow-none">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#787774]" />
                  <CardTitle className="font-heading text-sm tracking-tight">{file?.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={previewRef} className="overflow-auto rounded-lg border border-[#EAEAEA] bg-white">
                  <Document
                    file={file}
                    onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                    className="flex flex-col items-center bg-[#FAFAF9] p-4"
                    loading={
                      <div className="flex items-center justify-center p-12">
                        <Loader2 className="size-6 animate-spin text-[#B0AEAA]" />
                      </div>
                    }
                  >
                    {Array.from({ length: numPages || 1 }, (_, i) => (
                      <Page
                        key={i}
                        pageNumber={i + 1}
                        width={600}
                        className="mb-4 shadow-sm"
                        onRenderTextLayerSuccess={handleTextLayerRenderSuccess}
                      />
                    ))}
                  </Document>
                </div>
                {numPages && (
                  <p className="mt-2 text-center text-xs text-[#B0AEAA]">{numPages} page{numPages > 1 ? 's' : ''}</p>
                )}
              </CardContent>
            </Card>


          </div>

          {/* Entity Explanations */}
          {(result.entities || []).length > 0 && (
            <Card id="explanations" className="scroll-mt-24 border-[#EAEAEA] shadow-none">
              <CardHeader>
                <CardTitle className="font-heading text-base tracking-tight">Entity Explanations</CardTitle>
                <CardDescription>Review each decision. Click an entity to change its status.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(result.entities || []).map((entity, i) => {
                    const review = reviewState[i] || { decision: 'redact', modified: false }
                    return (
                      <div id={`explanation-${i}`} key={i} className="rounded-lg border border-[#EAEAEA] bg-white p-4 transition-all duration-300">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-[#2F3437]">{entity.value}</span>
                              <Badge variant="outline" className={`rounded-full border-0 text-[10px] font-medium uppercase tracking-wider ${getTypeColor(entity.type)}`}>
                                {entity.type}
                              </Badge>
                              {entity.applied_policy_rule && (
                                <Badge variant="outline" className="rounded-full border-0 bg-[#F1F0ED] text-[#787774] text-[10px] font-medium">
                                  {entity.applied_policy_rule}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-[#787774]">{entity.explanation}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <Button
                                size="xs"
                                variant={review.decision === 'redact' ? 'default' : 'outline'}
                                onClick={() => handleDecisionChange(i, 'redact')}
                                className={review.decision === 'redact' ? 'bg-[#9F2F2D] text-white hover:bg-[#8A2826]' : 'border-[#EAEAEA] text-[#787774]'}
                              >
                                Redact
                              </Button>
                              <Button
                                size="xs"
                                variant={review.decision === 'anonymize' ? 'default' : 'outline'}
                                onClick={() => handleDecisionChange(i, 'anonymize')}
                                className={review.decision === 'anonymize' ? 'bg-[#787774] text-white hover:bg-[#63615E]' : 'border-[#EAEAEA] text-[#787774]'}
                              >
                                Anonymize
                              </Button>
                              <Button
                                size="xs"
                                variant={review.decision === 'keep' ? 'default' : 'outline'}
                                onClick={() => handleDecisionChange(i, 'keep')}
                                className={review.decision === 'keep' ? 'bg-[#346538] text-white hover:bg-[#2B542F]' : 'border-[#EAEAEA] text-[#787774]'}
                              >
                                Keep
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Non-Redacted */}
          {result.non_redacted && result.non_redacted.length > 0 && (
            <Card id="kept" className="scroll-mt-24 border-[#EAEAEA] shadow-none">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-[#346538]" />
                  <CardTitle className="font-heading text-base tracking-tight">Kept Visible — {result.non_redacted.length} items</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.non_redacted.map((item, i) => (
                    <div key={i} className="rounded-lg border border-[#EAEAEA] bg-white p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[#2F3437]">{item.value}</span>
                        <Badge variant="outline" className="rounded-full border-0 bg-[#EDF3EC] text-[#346538] text-[10px] font-medium uppercase tracking-wider">
                          {item.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#787774]">{item.explanation}</p>
                      <p className="mt-0.5 text-xs text-[#346538]">{item.reason_kept}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}



          {/* Actions */}
          <div id="actions" className="scroll-mt-24 flex items-center justify-center gap-4 pb-8">
            <Button
              onClick={handleExportPdf}
              disabled={exporting || toExportCount === 0}
              className="bg-[#111111] text-white hover:bg-[#333333]"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? 'Exporting...' : `Download Redacted PDF${policy ? ' with Policy' : ''}`}
            </Button>
            <Button onClick={handleReset} variant="ghost" className="text-[#787774] hover:text-[#2F3437]">
              <RotateCcw className="size-4" />
              Upload New PDF
            </Button>
          </div>
        </>
      )}
        </div>

        {/* Right policy column */}
        <div className="hidden md:flex justify-end items-start">
          <AnimatePresence>
            {policy && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="sticky top-6 w-[18rem]"
              >
                <div className="rounded-lg border border-[#EAEAEA] bg-white p-4 flex flex-col space-y-3">
                  <div className="flex items-center justify-between shrink-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#787774]">
                      Policy for: <span className="text-[#2F3437] normal-case">{policyGeneratedFor}</span>
                    </p>
                    <Button onClick={handleRemovePolicy} variant="ghost" size="sm" className="text-[#787774] hover:text-[#9F2F2D] h-7 px-2 shrink-0">
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  {/* Toggle buttons */}
                  <div className="flex gap-1 rounded-lg bg-[#F1F0ED] p-0.5 shrink-0">
                    {[
                      { id: 'hide', label: 'Hide' },
                      { id: 'keep', label: 'Keep' },
                      { id: 'review', label: 'Review' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActivePolicyTab(tab.id)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                          activePolicyTab === tab.id
                            ? 'bg-white text-[#2F3437] shadow-sm'
                            : 'text-[#787774] hover:text-[#2F3437]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Active section */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <PolicySection type={activePolicyTab} items={policy[activePolicyTab] || []} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Entity Detail Sheet */}
      <Sheet open={!!selectedEntity} onOpenChange={(open) => !open && setSelectedEntity(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md border-l-[#EAEAEA]">
          {selectedEntity && (
            <>
              <SheetHeader className="pb-4 border-b border-[#EAEAEA]">
                <SheetTitle className="font-heading text-lg tracking-tight text-[#2F3437]">{selectedEntity.value}</SheetTitle>
                <SheetDescription className="text-[#787774]">
                  Detected as{' '}
                  <Badge variant="outline" className={`rounded-full border-0 text-[10px] font-medium uppercase tracking-wider ${getTypeColor(selectedEntity.type)}`}>
                    {selectedEntity.type}
                  </Badge>
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 px-4">
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[#F1F0ED]">
                        <div className="h-2 rounded-full bg-[#2F3437] transition-all" style={{ width: `${Math.round(selectedEntity.score * 100)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-[#2F3437]">{Math.round(selectedEntity.score * 100)}%</span>
                    </div>
                  </div>
                  <Separator className="bg-[#EAEAEA]" />
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Detected By</p>
                    <Badge variant="secondary" className={`rounded-full text-[11px] font-medium ${
                      selectedEntity.detected_by === 'presidio' ? 'bg-[#E1F3FE] text-[#1F6C9F]' : 'bg-[#FBF3DB] text-[#956400]'
                    }`}>
                      {selectedEntity.detected_by === 'presidio' ? 'Presidio' : 'LLM'}
                    </Badge>
                  </div>
                  <Separator className="bg-[#EAEAEA]" />
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Explanation</p>
                    <p className="text-sm leading-relaxed text-[#2F3437]">{selectedEntity.explanation}</p>
                  </div>
                  <Separator className="bg-[#EAEAEA]" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Risk Level</p>
                      <Badge variant="secondary" className={`rounded-full text-[11px] font-medium uppercase ${riskColors[selectedEntity.risk_level] || ''}`}>
                        {selectedEntity.risk_level}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Current Decision</p>
                      <Badge variant="outline" className={`rounded-full text-[11px] font-medium uppercase ${
                        (reviewState[selectedEntity.index]?.decision || 'redact') === 'redact'
                          ? 'border-[#FDEBEC] bg-[#FDEBEC] text-[#9F2F2D]'
                          : reviewState[selectedEntity.index]?.decision === 'anonymize'
                            ? 'border-[#E8E6E1] bg-[#F1F0ED] text-[#787774]'
                            : 'border-[#EDF3EC] bg-[#EDF3EC] text-[#346538]'
                      }`}>
                        {reviewState[selectedEntity.index]?.decision === 'keep' ? 'Keep' : reviewState[selectedEntity.index]?.decision === 'anonymize' ? 'Anonymize' : 'Redact'}
                      </Badge>
                    </div>
                  </div>
                  <Separator className="bg-[#EAEAEA]" />
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA]">Location</p>
                    <p className="text-sm text-[#787774]">Characters {selectedEntity.start}–{selectedEntity.end}</p>
                  </div>
                  <div className="rounded-lg border border-[#EAEAEA] bg-[#F7F6F3] p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#B0AEAA] mb-1">Context</p>
                    <p className="text-sm text-[#2F3437]">
                      &ldquo;{result?.original_text?.slice(
                        Math.max(0, selectedEntity.start - 40),
                        Math.min(result.original_text.length, selectedEntity.end + 40)
                      )}&rdquo;
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={reviewState[selectedEntity.index]?.decision === 'redact' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(selectedEntity.index, 'redact')}
                      className={reviewState[selectedEntity.index]?.decision === 'redact' ? 'bg-[#9F2F2D] text-white' : 'border-[#EAEAEA] text-[#787774]'}
                    >
                      <EyeOff className="size-3.5" />
                      Redact
                    </Button>
                    <Button
                      size="sm"
                      variant={reviewState[selectedEntity.index]?.decision === 'anonymize' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(selectedEntity.index, 'anonymize')}
                      className={reviewState[selectedEntity.index]?.decision === 'anonymize' ? 'bg-[#787774] text-white' : 'border-[#EAEAEA] text-[#787774]'}
                    >
                      <EyeOff className="size-3.5" />
                      Anonymize
                    </Button>
                    <Button
                      size="sm"
                      variant={reviewState[selectedEntity.index]?.decision === 'keep' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(selectedEntity.index, 'keep')}
                      className={reviewState[selectedEntity.index]?.decision === 'keep' ? 'bg-[#346538] text-white' : 'border-[#EAEAEA] text-[#787774]'}
                    >
                      <Eye className="size-3.5" />
                      Keep
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
