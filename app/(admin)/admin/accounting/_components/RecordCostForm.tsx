"use client"

import { useState } from "react"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog"
import { Input, Textarea } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface RecordCostFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (body: {
    expenseDate: string
    category: string
    amountCents: number
    currency?: string
    description?: string
    recurring?: boolean
  }) => Promise<void> | void
  submitting?: boolean
}

const CATEGORIES = [
  { value: "infrastructure", label: "Infrastructure" },
  { value: "tools", label: "Tools" },
  { value: "other", label: "Other" },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RecordCostForm({ open, onClose, onSubmit, submitting }: RecordCostFormProps) {
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(todayIso())
  const [recurring, setRecurring] = useState(false)
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCategory("")
    setAmount("")
    setExpenseDate(todayIso())
    setRecurring(false)
    setDescription("")
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) {
      setError("Choose a category.")
      return
    }
    const parsed = parseFloat(amount)
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter an amount greater than 0.")
      return
    }
    const amountCents = Math.round(parsed * 100)
    setError(null)
    await onSubmit({
      expenseDate,
      category,
      amountCents,
      currency: "USD",
      description: description.trim() || undefined,
      recurring,
    })
    reset()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Record a cost</DialogHeader>
      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Category
            </label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category…</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Amount (USD)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Date
              </label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Frequency
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecurring(false)}
                className={
                  !recurring
                    ? "flex-1 rounded-xl border border-brand-gold bg-brand-gold/10 px-3 py-2 text-sm font-medium text-brand-gold-ink"
                    : "flex-1 rounded-xl border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                }
              >
                One-off
              </button>
              <button
                type="button"
                onClick={() => setRecurring(true)}
                className={
                  recurring
                    ? "flex-1 rounded-xl border border-brand-gold bg-brand-gold/10 px-3 py-2 text-sm font-medium text-brand-gold-ink"
                    : "flex-1 rounded-xl border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                }
              >
                Monthly
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <Textarea
              placeholder="e.g. GCP hosting invoice for August"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Recording…" : "Record cost"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
