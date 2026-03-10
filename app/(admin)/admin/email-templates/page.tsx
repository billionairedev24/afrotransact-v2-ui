"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { getAccessToken } from "@/lib/auth-helpers"
import { toast } from "sonner"
import {
  Mail,
  Loader2,
  ArrowLeft,
  Save,
  RotateCcw,
  Eye,
  Code,
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

const STARTER_HTML = `<h1 style="color:#CA8A04;font-size:24px;margin:0 0 8px;">Your Template Title</h1>
<p style="color:#525252;font-size:16px;margin:0 0 24px;">Hello {{.RecipientName}},</p>
<p style="color:#525252;font-size:15px;line-height:1.6;margin:0 0 24px;">
  Your content goes here. Use template variables to personalise the email.
</p>
{{ctaButton .ActionURL "Call To Action"}}`

type ViewMode = "list" | "detail" | "create"

export default function EmailTemplatesPage() {
  const { status } = useSession()

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<(EmailTemplate & { sample_data: Record<string, unknown> }) | null>(null)
  const [editSubject, setEditSubject] = useState("")
  const [editHTML, setEditHTML] = useState("")
  const [editText, setEditText] = useState("")
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
  const [newText, setNewText] = useState("")
  const [newUseLayout, setNewUseLayout] = useState(true)
  const [newVariables, setNewVariables] = useState<VariableDef[]>([
    { name: "RecipientName", description: "Recipient's display name", required: true, sample_value: "Jane Doe" },
    { name: "ActionURL", description: "Primary CTA link", required: false, sample_value: "https://afrotransact.com" },
  ])
  const [newPreviewHTML, setNewPreviewHTML] = useState("")
  const [creating, setCreating] = useState(false)

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
    } catch (e: any) {
      toast.error("Failed to load templates: " + e.message)
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
      setActiveTab("editor")
      setPreviewHTML("")
      setViewMode("detail")
    } catch (e: any) {
      toast.error("Failed to load template: " + e.message)
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
        html_body: editHTML,
        data: selected.sample_data,
      })
      setPreviewHTML(html)
    } catch {
      setPreviewHTML("<p style='color:red;padding:20px;'>Preview render failed — check your template syntax.</p>")
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
        html_body: newHTML,
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
      })
      toast.success("Template saved")
      setSelected({ ...selected, subject_template: editSubject, html_body: editHTML, text_body: editText, is_default: false })
      loadTemplates()
    } catch (e: any) {
      toast.error("Save failed: " + e.message)
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
      toast.success("Template reset to default")
      loadTemplates()
    } catch (e: any) {
      toast.error("Reset failed: " + e.message)
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
      })
      toast.success(`Template "${newName}" created`)
      resetCreateForm()
      setViewMode("list")
      loadTemplates()
    } catch (e: any) {
      toast.error("Create failed: " + e.message)
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
    } catch (e: any) {
      toast.error("Delete failed: " + e.message)
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
    } catch (e: any) {
      toast.error("Send test failed: " + e.message)
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
    editText !== (selected.text_body || "")
  )

  const categories = Array.from(new Set(templates.map(t => t.category)))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // ── Create Template View ────────────────────────────────────────────────────
  if (viewMode === "create") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { resetCreateForm(); setViewMode("list"); setActiveTab("editor") }}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Create New Template</h1>
            <p className="text-sm text-gray-500">Build a custom email template for future notifications.</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newSlug || !newName || !newSubject || !newHTML}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors"
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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor" ? "border-yellow-600 text-yellow-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Code className="h-4 w-4" /> HTML Editor
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

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            {activeTab === "editor" ? (
              <textarea
                value={newHTML}
                onChange={e => setNewHTML(e.target.value)}
                spellCheck={false}
                className="w-full h-[500px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {newPreviewHTML ? (
                  <iframe
                    srcDoc={newPreviewHTML}
                    className="w-full h-[500px] border-0"
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
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            </div>
          </div>

          {/* Variables editor */}
          <div className="xl:col-span-1 space-y-4">
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
              <div className="space-y-1.5 text-xs text-gray-500">
                <p><code className="text-yellow-700">{"{{formatMoney .AmountCents .Currency}}"}</code><br/>Formats cents to $45.99</p>
                <p><code className="text-yellow-700">{"{{ctaButton .URL \"Label\"}}"}</code><br/>Gold CTA button</p>
                <p><code className="text-yellow-700">{"{{if .Var}}…{{end}}"}</code><br/>Conditional block</p>
                <p><code className="text-yellow-700">{"{{range .Items}}…{{end}}"}</code><br/>Loop over arrays</p>
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelected(null); setViewMode("list"); setActiveTab("editor") }}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{selected.name}</h1>
            <p className="text-sm text-gray-500">{selected.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {!selected.is_default && (
              <>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reset
                </button>
                {/* Only custom (non-system-default) templates can be deleted */}
                {selected.category === "custom" && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setShowSendTest(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Send className="h-4 w-4" /> Send Test
            </button>
            <button
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
            <Send className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleSendTest}
              disabled={sendingTest || !testEmail}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </button>
            <button onClick={() => setShowSendTest(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "editor"
                ? "border-yellow-600 text-yellow-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Code className="h-4 w-4" /> HTML Editor
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

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            {activeTab === "editor" ? (
              <textarea
                value={editHTML}
                onChange={e => setEditHTML(e.target.value)}
                spellCheck={false}
                className="w-full h-[600px] rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {previewHTML ? (
                  <iframe
                    srcDoc={previewHTML}
                    className="w-full h-[600px] border-0"
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
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-y transition-colors"
              />
            </div>
          </div>

          {/* Variables panel */}
          <div className="xl:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-4 sticky top-6">
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
                    className="block w-full text-left rounded-md border border-gray-100 bg-gray-50 px-3 py-2 hover:bg-yellow-50 hover:border-yellow-200 transition-colors group"
                  >
                    <code className="text-xs font-mono text-yellow-700 group-hover:text-yellow-800">
                      {"{{."}{v.name}{"}}"}
                    </code>
                    <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
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
                <div className="space-y-1.5 text-xs text-gray-500">
                  <p><code className="text-yellow-700">{"{{formatMoney .AmountCents .Currency}}"}</code><br/>Formats cents to $45.99</p>
                  <p><code className="text-yellow-700">{"{{ctaButton .URL \"Label\"}}"}</code><br/>Gold CTA button</p>
                  <p><code className="text-yellow-700">{"{{if .Var}}…{{end}}"}</code><br/>Conditional block</p>
                  <p><code className="text-yellow-700">{"{{range .Items}}…{{end}}"}</code><br/>Loop over arrays</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-yellow-600" />
            Email Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the content of transactional emails. Changes take effect immediately.
          </p>
        </div>
        <button
          onClick={() => { resetCreateForm(); setViewMode("create"); setActiveTab("editor") }}
          className="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
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
      <div className="grid gap-3">
        {templates
          .filter(t => t.slug !== "_layout" || filterCategory === "system")
          .map(tpl => (
          <button
            key={tpl.slug}
            onClick={() => selectTemplate(tpl.slug)}
            disabled={loadingDetail}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-yellow-300 hover:shadow-sm transition-all group"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-yellow-50 transition-colors">
              <Mail className="h-5 w-5 text-gray-400 group-hover:text-yellow-600 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">{tpl.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[tpl.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {CATEGORY_LABELS[tpl.category] ?? tpl.category}
                </span>
                {!tpl.is_default && (
                  <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-[10px] font-medium">Customized</span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate mt-0.5">{tpl.description}</p>
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
