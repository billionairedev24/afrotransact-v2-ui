"use client"

/**
 * Everything held about one lead, in a side panel.
 *
 * The table shows what you scan; this shows what you act on — including the
 * things there is no room for in a row: notes from the stand, which categories
 * they picked, whether their link was sent and whether they have filled their
 * own details in yet.
 */

import { X, Mail, MailCheck, Send, Loader2 } from "lucide-react"
import type { SellerLead, LeadStage } from "@/lib/api"

export interface LeadDetailsPanelProps {
  lead: SellerLead
  stageLabel: (s: LeadStage) => string
  onClose: () => void
  onSendLink: () => void
  onInvite: () => void
  sending?: boolean
  inviting?: boolean
}

function fmt(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children || "—"}</dd>
    </div>
  )
}

export function LeadDetailsPanel({
  lead, stageLabel, onClose, onSendLink, onInvite, sending, inviting,
}: LeadDetailsPanelProps) {
  const alreadyInvited = !!lead.inviteId

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-details-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background"
      >
        <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-background px-6 py-5">
          <div className="min-w-0">
            <h2 id="lead-details-title" className="truncate text-lg font-semibold text-foreground">
              {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email}
            </h2>
            <p className="truncate text-sm text-muted-foreground">{lead.email}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 px-6 py-4">
          <dl className="divide-y divide-border">
            <Row label="Stage">{stageLabel(lead.stage)}</Row>
            <Row label="Phone">{lead.phone}</Row>
            <Row label="Business">{lead.businessName}</Row>
            <Row label="City">{lead.city}</Row>
            <Row label="Categories">{lead.categories}</Row>
            <Row label="Also sells">{lead.sells}</Row>
            <Row label="Notes">{lead.notes}</Row>
            <Row label="Source">{lead.source === "PUBLIC" ? "Registration link" : "Captured by admin"}</Row>
            <Row label="Link sent">{fmt(lead.linkSentAt)}</Row>
            <Row label="Details in">{fmt(lead.profileCompletedAt)}</Row>
            <Row label="Captured">{fmt(lead.createdAt)}</Row>
            <Row label="Last updated">{fmt(lead.updatedAt)}</Row>
          </dl>
        </div>

        <footer className="sticky bottom-0 flex gap-2 border-t border-border bg-background px-6 py-4">
          <button
            onClick={onSendLink}
            disabled={sending}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" />
              : lead.linkSentAt ? <MailCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {lead.linkSentAt ? "Resend link" : "Send link"}
          </button>
          <button
            onClick={onInvite}
            disabled={alreadyInvited || inviting}
            title={alreadyInvited ? "Already invited" : undefined}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {alreadyInvited ? "Invited" : "Invite"}
          </button>
        </footer>
      </aside>
    </div>
  )
}
