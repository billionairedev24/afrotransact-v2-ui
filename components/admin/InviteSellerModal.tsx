"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/button"
import { createSellerInvite, ApiError, type SellerInvite } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-helpers"

interface Props {
  open: boolean
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type View = "form" | "sent"

const INITIAL_EXPIRY = 168

export function InviteSellerModal({ open, onClose }: Props) {
  const [view, setView] = useState<View>("form")
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [expiresInHours, setExpiresInHours] = useState<number>(INITIAL_EXPIRY)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<SellerInvite | null>(null)

  function resetForm() {
    setView("form")
    setEmail("")
    setFirstName("")
    setLastName("")
    setExpiresInHours(INITIAL_EXPIRY)
    setNotes("")
    setError(null)
    setSubmitting(false)
    setInvite(null)
  }

  // Reset on close.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(resetForm, 0)
      return () => clearTimeout(t)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedEmail = email.trim()
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Enter a valid email address.")
      return
    }
    if (!trimmedFirst) {
      setError("First name is required.")
      return
    }
    if (!trimmedLast) {
      setError("Last name is required.")
      return
    }
    if (!Number.isFinite(expiresInHours) || expiresInHours <= 0) {
      setError("Expiry must be a positive number of hours.")
      return
    }
    if (notes.length > 500) {
      setError("Notes must be 500 characters or fewer.")
      return
    }

    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError("Your session has expired. Please sign in again.")
        setSubmitting(false)
        return
      }
      const created = await createSellerInvite(token, {
        email: trimmedEmail,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        expiresInHours,
        notes: notes.trim() ? notes.trim() : undefined,
      })
      setInvite(created)
      setView("sent")
    } catch (err) {
      if (err instanceof ApiError) {
        let parsed: { error?: string; message?: string; code?: string; inviteId?: string } = {}
        try { parsed = JSON.parse(err.body) } catch { /* ignore */ }
        if (err.status === 409 && parsed.code === "user_exists") {
          setError("An account with this email already exists. Use Resend if there's a pending invite, or check with support.")
        } else if (err.status === 409 && parsed.code === "pending_invite_exists") {
          const id = parsed.inviteId ? ` (${parsed.inviteId})` : ""
          setError(`A pending invite already exists for this email${id}. Use Resend on that invite instead.`)
        } else if (err.status >= 400 && err.status < 500) {
          setError(parsed.message ?? parsed.error ?? "Could not create invite.")
        } else {
          setError("Could not create invite. Please try again.")
        }
      } else {
        setError("Could not create invite. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        {view === "form" ? "Invite a seller" : "Invite sent"}
      </DialogHeader>

      {view === "form" ? (
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We&apos;ll create the seller&apos;s account and email them a secure link to set their password.
              They&apos;ll be taken directly to onboarding once they sign in.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
                Email <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="invite-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@example.com"
                  disabled={submitting}
                  className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="invite-first" className="text-sm font-medium text-foreground">
                  First name <span className="text-destructive">*</span>
                </label>
                <input
                  id="invite-first"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ada"
                  disabled={submitting}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="invite-last" className="text-sm font-medium text-foreground">
                  Last name <span className="text-destructive">*</span>
                </label>
                <input
                  id="invite-last"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Lovelace"
                  disabled={submitting}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="invite-expiry" className="text-sm font-medium text-foreground">
                Expires in (hours)
              </label>
              <input
                id="invite-expiry"
                type="number"
                min={1}
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                disabled={submitting}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground">Default is 168 hours (7 days).</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="invite-notes" className="text-sm font-medium text-foreground">
                Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="invite-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={submitting}
                placeholder="Internal context for this invite…"
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground">{notes.length}/500</p>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </form>
      ) : invite ? (
        <>
          <DialogBody className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <p className="font-medium text-emerald-800">
                  Invite emailed to <span className="font-semibold">{invite.email}</span>
                </p>
                <p className="text-emerald-700">
                  {invite.firstName} {invite.lastName} will receive a secure link to set their password.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="font-medium">{invite.firstName} {invite.lastName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{invite.status}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Expires</dt>
                <dd className="font-medium">{new Date(invite.expiresAt).toLocaleString()}</dd>
              </div>
            </dl>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Invite another seller
            </Button>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </>
      ) : null}
    </Dialog>
  )
}
