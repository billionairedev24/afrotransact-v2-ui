"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { logError } from "@/lib/errors"
import { toast } from "sonner"
import {
  Mail,
  Loader2,
  ArrowLeft,
  Save,
  RotateCcw,
  Eye,
  Code,
  NotebookPen,
  Tag,
  Info,
  ChevronRight,
  Plus,
  Trash2,
  Send,
  X,
  Copy,
} from "lucide-react"
import {
  getEmailTemplates,
  getEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
  resetEmailTemplate,
  createEmailTemplate,
  deleteEmailTemplate,
  sendTestEmail,
  previewRawTemplate,
  type EmailTemplate,
  type VariableDef,
} from "@/lib/api"

const CATEGORY_LABELS: Record<string, string> = {
  order: "Orders",
  payment: "Payments",
  seller: "Seller",
  admin: "Admin",
  user: "User",
  system: "System",
  custom: "Custom",
}

const CATEGORY_COLORS: Record<string, string> = {
  order: "bg-blue-100 text-blue-700",
  payment: "bg-emerald-100 text-emerald-700",
  seller: "bg-amber-100 text-amber-700",
  admin: "bg-purple-100 text-purple-700",
  user: "bg-sky-100 text-sky-700",
  system: "bg-gray-100 text-gray-600",
  custom: "bg-pink-100 text-pink-700",
}

const STARTER_HTML = `<h1 style="color:#E6BE00;font-size:24px;margin:0 0 8px;">Your Template Title</h1>
<p style="color:#525252;font-size:16px;margin:0 0 24px;">Hello {{.RecipientName}},</p>
<p style="color:#525252;font-size:15px;line-height:1.6;margin:0 0 24px;">
  Your content goes here. Use template variables to personalise the email.
</p>
{{ctaButton .ActionURL "Call To Action"}}`

const STARTER_NOTES = `Write the copy you want this email to say, in plain English.

A developer will read these notes and paste the wording into the HTML template.

Example:
- Opening line: "Thanks for your order, {first name}!"
- Body: Confirm we got the order and we'll email again when it ships.
- CTA button label: "View your order"
- Tone: friendly, short sentences.`

type ViewMode = "list" | "detail" | "create"
type EditorMode = "notes" | "html"

function normalizePreviewValue(key: string, value: unknown): unknown {
  if (value == null) return value

  if (Array.isArray(value)) {
    return value.map((item) => normalizePreviewValue("", item))
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    Object.entries(obj).forEach(([k, v]) => {
      out[k] = normalizePreviewValue(k, v)
    })
    return out
  }

  if (typeof value !== "string") return value

  const raw = value.trim()
  if (raw === "") return value

  // Go template comparisons (gt/lt) require comparable numeric types.
  // Coerce known monetary/quantity-like fields from string -> number.
  const shouldBeNumber =
    key.endsWith("Cents") ||
    key === "Quantity" ||
    key === "quantity" ||
    key === "Total" ||
    key === "total"

  if (!shouldBeNumber) return value

  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : value
}

function normalizePreviewData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data
  return normalizePreviewValue("", data) as Record<string, unknown>
}

function normalizeTemplateForPreview(html: string): string {
  // Go templates can reject mixed numeric kinds in comparisons (e.g. float64 vs int literal).
  // For preview only, rewrite `{{if gt .SomeCents 0}}` -> `{{if .SomeCents}}` to avoid type mismatch.
  return html.replace(/\{\{\s*if\s+gt\s+(\.[A-Za-z0-9_]+(?:Cents|Total|Quantity))\s+0(?:\.0+)?\s*\}\}/g, "{{if $1}}")
}

function collectPreviewDataWarnings(data: Record<string, unknown> | undefined): string[] {
  if (!data) return []
  const warnings: string[] = []

  function walk(value: unknown, path: string) {
    if (value == null) return
    if (Array.isArray(value)) {
      value.forEach((item, idx) => walk(item, `${path}[${idx}]`))
      return
    }
    if (typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
        const next = path ? `${path}.${k}` : k
        walk(v, next)
      })
      return
    }

    const key = path.split(".").pop() ?? path
    const shouldBeNumber =
      key.endsWith("Cents") ||
      key === "Quantity" ||
      key === "quantity" ||
      key === "Total" ||
      key === "total"

    if (!shouldBeNumber || typeof value !== "string") return
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      warnings.push(`${path}: empty string; expected numeric value`)
      return
    }
    if (!Number.isFinite(Number(trimmed))) {
      warnings.push(`${path}: "${value}" is not numeric`)
    }
  }

  walk(data, "")
  return warnings
}

export default function EmailTemplatesPage() {
  const { status } = useSession()

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<(EmailTemplate & { sample_data: Record<string, unknown> }) | null>(null)
  const [editSubject, setEditSubject] = useState("")
  const [editHTML, setEditHTML] = useState("")
  const [editText, setEditText] = useState("")
  // Plain-text notes where the admin describes the copy/verbiage they want.
  // Developers read these notes and edit the HTMLBody by hand — we never
  // compile the notes into rendered output. This keeps the control flow
  // honest: admins describe intent, developers translate intent to HTML.
  const [editNotes, setEditNotes] = useState("")
  const [editorMode, setEditorMode] = useState<EditorMode>("notes")
  const [previewHTML, setPreviewHTML] = useState("")
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [filterCategory, setFilterCategory] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create template state
  const [newSlug, setNewSlug] = useState("")
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newCategory, setNewCategory] = useState("custom")
  const [newSubject, setNewSubject] = useState("")
  const [newHTML, setNewHTML] = useState(STARTER_HTML)
  const [newNotes, setNewNotes] = useState(STARTER_NOTES)
  const [newEditorMode, setNewEditorMode] = useState<EditorMode>("notes")
  const [newText, setNewText] = useState("")
  const [newUseLayout, setNewUseLayout] = useState(true)
  const [newVariables, setNewVariables] = useState<VariableDef[]>([
    { name: "RecipientName", description: "Recipient's display name", required: true, sample_value: "Jane Doe" },
    { name: "ActionURL", description: "Primary CTA link", required: false, sample_value: "https://afrotransact.com" },
  ])
  const [newPreviewHTML, setNewPreviewHTML] = useState("")
  const [creating, setCreating] = useState(false)
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])

  // Send test email state
  const [showSendTest, setShowSendTest] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const list = await getEmailTemplates(token, filterCategory || undefined)
      setTemplates(list ?? [])
    } catch (e: unknown) {
      logError(e, "loading email templates")
      toast.error("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [filterCategory])

  useEffect(() => {
    if (status === "authenticated") loadTemplates()
  }, [status, loadTemplates])

  const selectTemplate = async (slug: string) => {
    setLoadingDetail(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const tpl = await getEmailTemplate(token, slug)
      setSelected(tpl)
      setEditSubject(tpl.subject_template)
      setEditHTML(tpl.html_body)
      setEditText(tpl.text_body || "")
      setEditNotes(tpl.admin_notes ?? "")
      setActiveTab("editor")
      setPreviewHTML("")
      setViewMode("detail")
      // Default to the Notes tab so non-technical admins land somewhere
      // they can actually type without needing to read HTML.
      setEditorMode("notes")
    } catch (e: unknown) {
      logError(e, "loading email template")
      toast.error("Failed to load template")
    } finally {
      setLoadingDetail(false)
    }
  }

  const loadPreview = useCallback(async () => {
    if (!selected) return
    try {
      const token = await getAccessToken()
      if (!token) return
      const html = await previewEmailTemplate(token, selected.slug, {
        html_body: normalizeTemplateForPreview(editHTML),
        data: normalizePreviewData(selected.sample_data),
      })
      setPreviewHTML(html)
      setPreviewWarnings(collectPreviewDataWarnings(selected.sample_data))
    } catch {
      setPreviewHTML("<p style='color:red;padding:20px;'>Preview render failed — check your template syntax.</p>")
      setPreviewWarnings(collectPreviewDataWarnings(selected?.sample_data))
    }
  }, [selected, editHTML])

  useEffect(() => {
    if (viewMode === "detail" && activeTab === "preview") {
      loadPreview()
    }
  }, [activeTab, loadPreview, viewMode])

  useEffect(() => {
    if (viewMode !== "detail" || activeTab !== "preview") return
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(loadPreview, 800)
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [editHTML, activeTab, loadPreview, viewMode])

  // Preview for new template creation
  const loadNewPreview = useCallback(async () => {
    try {
      const token = await getAccessToken()
      if (!token) return
      const sampleData: Record<string, unknown> = {}
      newVariables.forEach(v => {
        sampleData[v.name] = v.sample_value || `{{${v.name}}}`
      })
      const html = await previewRawTemplate(token, {
        html_body: normalizeTemplateForPreview(newHTML),
        use_layout: newUseLayout,
        variables: newVariables,
        data: sampleData,
      })
      setNewPreviewHTML(html)
    } catch {
      setNewPreviewHTML("<p style='color:red;padding:20px;'>Preview render failed — check your template syntax.</p>")
    }
  }, [newHTML, newUseLayout, newVariables])

  useEffect(() => {
    if (viewMode !== "create" || activeTab !== "preview") return
    loadNewPreview()
  }, [viewMode, activeTab, loadNewPreview])

  useEffect(() => {
    if (viewMode !== "create" || activeTab !== "preview") return
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(loadNewPreview, 800)
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [newHTML, activeTab, loadNewPreview, viewMode])

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      await updateEmailTemplate(token, selected.slug, {
        subject_template: editSubject,
        html_body: editHTML,
        text_body: editText,
        admin_notes: editNotes,
      })
      toast.success("Template saved")
      setSelected({
        ...selected,
        subject_template: editSubject,
        html_body: editHTML,
        text_body: editText,
        admin_notes: editNotes,
        is_default: false,
      })
      loadTemplates()
    } catch (e: unknown) {
      logError(e, "saving email template")
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!selected) return
    if (!confirm("Reset this template to its default content? Your edits will be lost.")) return
    setResetting(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const tpl = await resetEmailTemplate(token, selected.slug)
      setSelected({ ...selected, ...tpl })
      setEditSubject(tpl.subject_template)
      setEditHTML(tpl.html_body)
      setEditText(tpl.text_body || "")
      setEditNotes(tpl.admin_notes ?? "")
      toast.success("Template reset to default")
      loadTemplates()
    } catch (e: unknown) {
      logError(e, "resetting email template")
      toast.error("Reset failed")
    } finally {
      setResetting(false)
    }
  }

  const handleCreate = async () => {
    if (!newSlug || !newName || !newSubject || !newHTML) {
      toast.error("Slug, name, subject, and HTML body are all required")
      return
    }
    setCreating(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      await createEmailTemplate(token, {
        slug: newSlug,
        name: newName,
        description: newDescription,
        category: newCategory,
        subject_template: newSubject,
        html_body: newHTML,
        text_body: newText,
        variables: newVariables,
        use_layout: newUseLayout,
        admin_notes: newNotes,
      })
      toast.success(`Template "${newName}" created`)
      resetCreateForm()
      setViewMode("list")
      loadTemplates()
    } catch (e: unknown) {
      logError(e, "creating email template")
      toast.error("Create failed")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Permanently delete "${selected.name}"? This cannot be undone.`)) return
    try {
      const token = await getAccessToken()
      if (!token) return
      const resp = await deleteEmailTemplate(token, selected.slug)
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || "Delete failed")
      }
      toast.success("Template deleted")
      setSelected(null)
      setViewMode("list")
      loadTemplates()
    } catch (e: unknown) {
      logError(e, "deleting email template")
      toast.error("Delete failed")
    }
  }

  const handleSendTest = async () => {
    if (!selected || !testEmail) return
    setSendingTest(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const result = await sendTestEmail(token, selected.slug, { to: testEmail })
      toast.success(`Test email sent to ${result.to}`)
      setShowSendTest(false)
    } catch (e: unknown) {
      logError(e, "sending test email")
      toast.error("Send test failed")
    } finally {
      setSendingTest(false)
    }
  }

  const resetCreateForm = () => {
    setNewSlug("")
    setNewName("")
    setNewDescription("")
    setNewCategory("custom")
    setNewSubject("")
    setNewHTML(STARTER_HTML)
    setNewNotes(STARTER_NOTES)
    setNewEditorMode("notes")
    setNewText("")
    setNewUseLayout(true)
    setNewVariables([
      { name: "RecipientName", description: "Recipient's display name", required: true, sample_value: "Jane Doe" },
      { name: "ActionURL", description: "Primary CTA link", required: false, sample_value: "https://afrotransact.com" },
    ])
    setNewPreviewHTML("")
  }

  const addVariable = () => {
    setNewVariables([...newVariables, { name: "", description: "", required: false, sample_value: "" }])
  }

  const updateVariable = (idx: number, field: keyof VariableDef, value: string | boolean) => {
    setNewVariables(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  const removeVariable = (idx: number) => {
    setNewVariables(prev => prev.filter((_, i) => i !== idx))
  }

  const hasChanges = selected && (
    editSubject !== selected.subject_template ||
    editHTML !== selected.html_body ||
    editText !== (selected.text_body || "") ||
    editNotes !== (selected.admin_notes ?? "")
  )

  const categories = Array.from(new Set(templates.map(t => t.category)))

  if (loading) {
    return (
      <div className="flex min-w-0 items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // ── Create Template View ────────────────────────────────────────────────────
  if (viewMode === "create") {
    return (
      <div className="min-w-0 space-y-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => { resetCreateForm(); setViewMode("list"); setActiveTab("editor") }}
              className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900">Create New Template</h1>
              <p className="text-sm text-gray-500">Build a custom email template for future notifications.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newSlug || !newName || !newSubject || !newHTML}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors sm:ml-auto"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Create Template
          </button>
        </div>

        {/* Metadata fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (unique identifier)</label>
            <input
              type="text"
              value={newSlug}
              onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="e.g. welcome_back_reminder"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-mono outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-400">Lowercase letters, numbers, underscores. Used in code to reference this template.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Welcome Back Reminder"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Brief description of when this email is sent"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
          <input
            type="text"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            placeholder="e.g. We miss you, {{.RecipientName}}! — AfroTransact"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
          />
        </div>

        {/* Layout toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={newUseLayout}
            onChange={e => setNewUseLayout(e.target.checked)}
            className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
          />
          Wrap with shared email layout (header, footer, branding)
        </label>

        {/* Tabs: Copy notes / HTML / Preview */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => { setNewEditorMode("notes"); setActiveTab("editor") }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor" && newEditorMode === "notes"
                ? "border-yellow-600 text-yellow-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            title="Describe the copy in plain English. Developers edit the HTML to match."
          >
            <NotebookPen className="h-4 w-4" /> Copy notes
          </button>
          <button
            onClick={() => { setNewEditorMode("html"); setActiveTab("editor") }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor" && newEditorMode === "html"
                ? "border-yellow-600 text-yellow-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Code className="h-4 w-4" /> HTML
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "preview" ? "border-yellow-600 text-yellow-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="h-4 w-4" /> Live Preview
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="min-w-0 xl:col-span-3">
            {activeTab === "editor" && newEditorMode === "notes" ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 leading-relaxed">
                  Write the copy you want for this email in plain English. A developer will read these notes and update the HTML template to match. These notes are saved alongside the template and are <strong>never</strong> sent to customers.
                </div>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  spellCheck
                  placeholder="e.g. Opening line: Thanks for signing up, {first name}!  Body: Explain what they can do next. CTA: Go to my account. Tone: warm, 2 short sentences."
                  className="h-[500px] w-full max-w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors leading-relaxed"
                />
              </div>
            ) : activeTab === "editor" ? (
              <textarea
                value={newHTML}
                onChange={e => setNewHTML(e.target.value)}
                spellCheck={false}
                className="h-[500px] w-full max-w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            ) : (
              <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {newPreviewHTML ? (
                  <iframe
                    srcDoc={newPreviewHTML}
                    className="h-[500px] w-full max-w-full border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[500px] text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Rendering preview…
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Plain Text Fallback (optional)</label>
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={3}
                className="w-full max-w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            </div>
          </div>

          {/* Variables editor */}
          <div className="min-w-0 space-y-4 xl:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <Tag className="h-4 w-4 text-yellow-600" />
                  Template Variables
                </h3>
                <button
                  onClick={addVariable}
                  className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-3">
                {newVariables.map((v, idx) => (
                  <div key={idx} className="rounded-md border border-gray-100 bg-gray-50 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={v.name}
                        onChange={e => updateVariable(idx, "name", e.target.value.replace(/\s/g, ""))}
                        placeholder="VariableName"
                        className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-mono text-gray-900 outline-none focus:border-yellow-500"
                      />
                      <button onClick={() => removeVariable(idx)} className="text-gray-400 hover:text-red-500 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={v.description}
                      onChange={e => updateVariable(idx, "description", e.target.value)}
                      placeholder="Description"
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-yellow-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={v.sample_value}
                        onChange={e => updateVariable(idx, "sample_value", e.target.value)}
                        placeholder="Sample value"
                        className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 outline-none focus:border-yellow-500"
                      />
                      <label className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={v.required}
                          onChange={e => updateVariable(idx, "required", e.target.checked)}
                          className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                        />
                        Required
                      </label>
                    </div>
                    {v.name && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`{{.${v.name}}}`)
                          toast.success(`Copied {{.${v.name}}}`)
                        }}
                        className="flex items-center gap-1 text-[10px] text-yellow-600 hover:text-yellow-700"
                      >
                        <Copy className="h-2.5 w-2.5" />
                        {"{{."}{v.name}{"}}"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
                <Info className="h-3 w-3" /> Template Functions
              </h4>
              <div className="space-y-1.5 overflow-x-auto text-xs text-gray-500 break-words">
                <p><code className="break-all text-yellow-700">{"{{formatMoney .AmountCents .Currency}}"}</code><br/>Formats cents to $45.99</p>
                <p><code className="break-all text-yellow-700">{"{{ctaButton .URL \"Label\"}}"}</code><br/>Gold CTA button</p>
                <p><code className="break-all text-yellow-700">{"{{if .Var}}…{{end}}"}</code><br/>Conditional block</p>
                <p><code className="break-all text-yellow-700">{"{{range .Items}}…{{end}}"}</code><br/>Loop over arrays</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Detail / Editor View ──────────────────────────────────────────────────
  if (viewMode === "detail" && selected) {
    return (
      <div className="min-w-0 space-y-6">
        {/* Header */}
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => { setSelected(null); setViewMode("list"); setActiveTab("editor") }}
              className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold text-gray-900">{selected.name}</h1>
              <p className="text-sm text-gray-500 break-words">{selected.description}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            {selected.category !== "custom" && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                title={
                  selected.is_default
                    ? "Re-apply the latest shipped default for this template"
                    : "Discard admin edits and restore the shipped default"
                }
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reset to default
              </button>
            )}
            {selected.category === "custom" && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSendTest(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Send className="h-4 w-4" /> Send Test
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Send test email modal */}
        {showSendTest && (
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
            <Send className="h-4 w-4 shrink-0 text-blue-600 sm:mt-0.5" />
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </button>
              <button type="button" onClick={() => setShowSendTest(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Subject line */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
          <input
            type="text"
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
          />
          <p className="mt-1 text-xs text-gray-400">
            {"Use {{.VariableName}} for dynamic values, e.g. {{.OrderNumber}}"}
          </p>
        </div>

        {previewWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">Preview Data Warnings</p>
            <p className="mt-1 text-xs text-amber-700">
              Some numeric template variables in sample data are invalid and may break conditions/comparisons.
            </p>
            <div className="mt-2 max-h-28 overflow-auto space-y-1">
              {previewWarnings.map((w) => (
                <p key={w} className="text-xs font-mono text-amber-800">
                  - {w}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tabs: Copy notes (plain text) / HTML (raw) / Preview */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => { setEditorMode("notes"); setActiveTab("editor") }}
            title="Describe the copy you want. Developers will edit the HTML to match."
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor" && editorMode === "notes"
                ? "border-yellow-600 text-yellow-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <NotebookPen className="h-4 w-4" /> Copy notes
            {editNotes.trim().length > 0 && (
              <span className="ml-1 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700">●</span>
            )}
          </button>
          <button
            onClick={() => { setEditorMode("html"); setActiveTab("editor") }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor" && editorMode === "html"
                ? "border-yellow-600 text-yellow-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Code className="h-4 w-4" /> HTML
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "preview"
                ? "border-yellow-600 text-yellow-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="h-4 w-4" /> Live Preview
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="min-w-0 xl:col-span-3">
            {activeTab === "editor" && editorMode === "notes" ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 leading-relaxed">
                  Write the copy you want this email to say, in plain English. A developer will read these notes and update the HTML template to match. These notes stay on the template and are <strong>never</strong> sent to customers.
                </div>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  spellCheck={true}
                  placeholder={
                    "e.g.\n- Opening line: Thanks for your order, {first name}!\n- Body: Confirm we received it and explain we'll email when it ships.\n- CTA button label: View your order\n- Tone: friendly, short sentences, no jargon."
                  }
                  className="h-[600px] w-full max-w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors leading-relaxed"
                />
                <p className="text-xs text-gray-500">
                  Tip: reference template variables by intent (&quot;customer&apos;s first name&quot;, &quot;order number&quot;) — the developer knows the exact Go-template syntax.
                </p>
              </div>
            ) : activeTab === "editor" ? (
              <textarea
                value={editHTML}
                onChange={e => setEditHTML(e.target.value)}
                spellCheck={false}
                className="h-[600px] w-full max-w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            ) : (
              <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                {previewHTML ? (
                  <iframe
                    srcDoc={previewHTML}
                    className="h-[600px] w-full max-w-full border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[600px] text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Rendering preview…
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Plain Text Fallback (optional)</label>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={4}
                className="w-full max-w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            </div>
          </div>

          {/* Variables panel */}
          <div className="min-w-0 xl:col-span-1">
            <div className="sticky top-6 rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-3">
                <Tag className="h-4 w-4 text-yellow-600" />
                Available Variables
              </h3>
              <div className="space-y-2">
                {selected.variables
                  .filter(v => v.name !== "Body")
                  .map(v => (
                  <button
                    key={v.name}
                    onClick={() => {
                      navigator.clipboard.writeText(`{{.${v.name}}}`)
                      toast.success(`Copied {{.${v.name}}} to clipboard`)
                    }}
                    className="block w-full min-w-0 text-left rounded-md border border-gray-100 bg-gray-50 px-3 py-2 hover:bg-yellow-50 hover:border-yellow-200 transition-colors group"
                  >
                    <code className="break-all text-xs font-mono text-yellow-700 group-hover:text-yellow-800">
                      {"{{."}{v.name}{"}}"}
                    </code>
                    <p className="mt-0.5 break-words text-xs text-gray-500">{v.description}</p>
                    {v.sample_value && (
                      <p className="text-xs text-gray-400 mt-0.5">e.g. {v.sample_value}</p>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
                  <Info className="h-3 w-3" /> Template Functions
                </h4>
                <div className="space-y-1.5 overflow-x-auto text-xs text-gray-500 break-words">
                  <p><code className="break-all text-yellow-700">{"{{formatMoney .AmountCents .Currency}}"}</code><br/>Formats cents to $45.99</p>
                  <p><code className="break-all text-yellow-700">{"{{ctaButton .URL \"Label\"}}"}</code><br/>Gold CTA button</p>
                  <p><code className="break-all text-yellow-700">{"{{if .Var}}…{{end}}"}</code><br/>Conditional block</p>
                  <p><code className="break-all text-yellow-700">{"{{range .Items}}…{{end}}"}</code><br/>Loop over arrays</p>
                </div>
              </div>

              <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-xs break-words text-gray-400">
                <p><span className="font-medium text-gray-500">Slug:</span> {selected.slug}</p>
                <p><span className="font-medium text-gray-500">Version:</span> {selected.version}</p>
                <p><span className="font-medium text-gray-500">Layout:</span> {selected.use_layout ? "Shared wrapper" : "Standalone"}</p>
                {selected.updated_by && (
                  <p><span className="font-medium text-gray-500">Last edited by:</span> {selected.updated_by}</p>
                )}
                <p><span className="font-medium text-gray-500">Updated:</span> {new Date(selected.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Mail className="h-6 w-6 shrink-0 text-yellow-600" />
            <span className="min-w-0">Email Templates</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the content of transactional emails. Changes take effect immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { resetCreateForm(); setViewMode("create"); setActiveTab("editor") }}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* Category filter */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterCategory("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filterCategory === "" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({templates.length})
        </button>
        {categories.filter(c => c !== "system").map(cat => {
          const count = templates.filter(t => t.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterCategory === cat ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat} ({count})
            </button>
          )
        })}
      </div>

      {/* Template list */}
      <div className="grid min-w-0 gap-3">
        {templates
          .filter(t => t.slug !== "_layout" || filterCategory === "system")
          .map(tpl => (
          <button
            key={tpl.slug}
            type="button"
            onClick={() => selectTemplate(tpl.slug)}
            disabled={loadingDetail}
            className="group flex min-w-0 w-full max-w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-yellow-300 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors group-hover:bg-yellow-50">
              <Mail className="h-5 w-5 text-gray-400 transition-colors group-hover:text-yellow-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 truncate font-medium text-gray-900">{tpl.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[tpl.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {CATEGORY_LABELS[tpl.category] ?? tpl.category}
                </span>
                {!tpl.is_default && (
                  <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">Customized</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500">{tpl.description}</p>
            </div>
            <div className="flex-shrink-0 text-xs text-gray-400">
              v{tpl.version}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-yellow-600 flex-shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
