"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryRef,
} from "@/lib/api"
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  ConfirmDialog,
} from "@/components/ui/Dialog"
import { RowActions, type RowAction } from "@/components/ui/RowActions"
import {
  Plus,
  Loader2,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react"

type FormState = {
  name: string
  slug: string
  sortOrder: string
  parentId: string
}

const EMPTY_FORM: FormState = { name: "", slug: "", sortOrder: "0", parentId: "" }

export default function AdminCategoriesPage() {
  const { status } = useSession()
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (e) {
      logError(e, "loading categories")
      toast.error("Failed to load categories")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openCreate(parentId = "") {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, parentId })
    setDialogOpen(true)
  }

  function openEdit(cat: CategoryRef) {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      slug: cat.slug,
      sortOrder: String(cat.sortOrder),
      parentId: cat.parentId ?? "",
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    const token = await getAccessToken()
    if (!token) {
      toast.error("Authentication required")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateCategory(token, editingId, {
          name: form.name,
          slug: form.slug || undefined,
          sortOrder: form.sortOrder ? parseInt(form.sortOrder) : undefined,
        })
        toast.success("Category updated")
      } else {
        await createCategory(token, {
          name: form.name,
          slug: form.slug || undefined,
          parentId: form.parentId || undefined,
          sortOrder: form.sortOrder ? parseInt(form.sortOrder) : undefined,
        })
        toast.success("Category created")
      }
      closeDialog()
      await loadCategories()
    } catch (e) {
      logError(e, "saving category")
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    const token = await getAccessToken()
    if (!token) {
      toast.error("Authentication required")
      return
    }

    setDeleting(true)
    try {
      await deleteCategory(token, deleteTarget.id)
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await loadCategories()
    } catch (e) {
      logError(e, "deleting category")
      toast.error("Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  function flatParents(cats: CategoryRef[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = []
    for (const c of cats) {
      result.push({ id: c.id, label: "\u00A0\u00A0".repeat(depth) + c.name })
      if (c.children?.length) {
        result.push(...flatParents(c.children, depth + 1))
      }
    }
    return result
  }

  function renderTree(cats: CategoryRef[], depth = 0) {
    return cats.map((cat) => {
      const hasChildren = (cat.children?.length ?? 0) > 0
      const isExpanded = expanded.has(cat.id)

      const actions: RowAction[] = [
        {
          label: "Add Subcategory",
          icon: <Plus />,
          onClick: () => openCreate(cat.id),
        },
        {
          label: "Edit",
          icon: <Pencil />,
          onClick: () => openEdit(cat),
        },
        {
          label: "Delete",
          icon: <Trash2 />,
          variant: "danger",
          onClick: () => setDeleteTarget({ id: cat.id, name: cat.name }),
        },
      ]

      return (
        <div key={cat.id}>
          <div
            className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
            style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
          >
            <button
              onClick={() => hasChildren && toggleExpand(cat.id)}
              className="w-5 h-5 flex items-center justify-center shrink-0"
              disabled={!hasChildren}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )
              ) : (
                <span className="w-4" />
              )}
            </button>

            <FolderTree className="h-4 w-4 text-primary shrink-0" />

            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900">{cat.name}</span>
              <span className="text-xs text-gray-500 ml-2">/{cat.slug}</span>
            </div>

            <span className="text-xs text-gray-500 shrink-0">#{cat.sortOrder}</span>

            <RowActions actions={actions} />
          </div>

          {hasChildren && isExpanded && renderTree(cat.children!, depth + 1)}
        </div>
      )
    })
  }

  if (status !== "authenticated" && !loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        Sign in as admin to manage categories.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">
            Organize your product catalog with a hierarchical category tree.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-[#0f0f10] hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Category
        </button>
      </div>

      {/* Category tree */}
      <div
        className="rounded-2xl border border-gray-200 overflow-hidden bg-white"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-gray-500">Loading categories…</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center">
            <FolderTree className="mx-auto h-10 w-10 text-gray-600" />
            <p className="mt-3 text-sm text-gray-500">
              No categories yet. Create your first one above.
            </p>
          </div>
        ) : (
          renderTree(categories)
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog}>
        <DialogHeader onClose={closeDialog}>
          {editingId ? "Edit Category" : "New Category"}
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              placeholder="e.g. Fresh Produce"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none"
              placeholder="auto-generated if empty"
            />
          </div>
          {!editingId && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Parent Category</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
              >
                <option value="">— Top Level —</option>
                {flatParents(categories).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <button
            onClick={closeDialog}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#0f0f10] hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingId ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
