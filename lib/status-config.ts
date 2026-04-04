/**
 * Centralised status colours and labels — single source of truth for all
 * order, subscription, and billing statuses across every page.
 * Uses complete Tailwind class strings so JIT never purges them.
 */

export interface StatusStyle {
  label: string
  /** Tailwind text-colour class */
  text: string
  /** Tailwind bg class (badge fill, no border) */
  bg: string
  /** bg + matching border class — use for bordered-badge contexts */
  bgBorder: string
}

export const STATUS_CONFIG: Record<string, StatusStyle> = {
  // ── Order / fulfilment statuses ───────────────────────────────
  pending:            { label: "Pending",           text: "text-amber-500",   bg: "bg-amber-500/15",   bgBorder: "bg-amber-500/10 border-amber-500/20"    },
  awaiting_payment:   { label: "Awaiting Payment",  text: "text-orange-600",  bg: "bg-orange-500/15",  bgBorder: "bg-orange-500/10 border-orange-500/20"  },
  payment_pending:    { label: "Payment Pending",   text: "text-orange-600",  bg: "bg-orange-500/15",  bgBorder: "bg-orange-500/10 border-orange-500/20"  },
  payment_failed:     { label: "Payment Failed",    text: "text-red-500",     bg: "bg-red-500/15",     bgBorder: "bg-red-500/10 border-red-500/20"        },
  paid:               { label: "Paid",              text: "text-blue-500",    bg: "bg-blue-500/15",    bgBorder: "bg-blue-500/10 border-blue-500/20"      },
  confirmed:          { label: "Confirmed",         text: "text-blue-500",    bg: "bg-blue-500/15",    bgBorder: "bg-blue-500/10 border-blue-500/20"      },
  processing:         { label: "Processing",        text: "text-indigo-500",  bg: "bg-indigo-500/15",  bgBorder: "bg-indigo-500/10 border-indigo-500/20"  },
  packaged:           { label: "Packaged",          text: "text-indigo-500",  bg: "bg-indigo-500/15",  bgBorder: "bg-indigo-500/10 border-indigo-500/20"  },
  dispatched:         { label: "Dispatched",        text: "text-indigo-500",  bg: "bg-indigo-500/15",  bgBorder: "bg-indigo-500/10 border-indigo-500/20"  },
  shipped:            { label: "Shipped",           text: "text-violet-500",  bg: "bg-violet-500/15",  bgBorder: "bg-violet-500/10 border-violet-500/20"  },
  out_for_delivery:   { label: "Out for Delivery",  text: "text-sky-500",     bg: "bg-sky-500/15",     bgBorder: "bg-sky-500/10 border-sky-500/20"        },
  delivered:          { label: "Delivered",         text: "text-green-600",   bg: "bg-green-500/15",   bgBorder: "bg-green-500/10 border-green-500/20"    },
  completed:          { label: "Completed",         text: "text-green-600",   bg: "bg-green-500/15",   bgBorder: "bg-green-500/10 border-green-500/20"    },
  cancelled:          { label: "Cancelled",         text: "text-slate-500",   bg: "bg-slate-500/15",   bgBorder: "bg-slate-500/10 border-slate-500/20"    },
  refunded:           { label: "Refunded",          text: "text-teal-600",    bg: "bg-teal-500/15",    bgBorder: "bg-teal-500/10 border-teal-500/20"      },
  disputed:           { label: "Disputed",          text: "text-red-600",     bg: "bg-red-500/15",     bgBorder: "bg-red-500/10 border-red-500/20"        },
  delivery_exception: { label: "Exception",         text: "text-red-600",     bg: "bg-red-500/15",     bgBorder: "bg-red-500/10 border-red-500/20"        },
  returned:           { label: "Returned",          text: "text-orange-600",  bg: "bg-orange-500/15",  bgBorder: "bg-orange-500/10 border-orange-500/20"  },

  // ── Subscription / billing statuses ──────────────────────────
  trial:              { label: "Trial",             text: "text-sky-500",     bg: "bg-sky-500/15",     bgBorder: "bg-sky-500/10 border-sky-500/20"        },
  trial_extended:     { label: "Trial Extended",    text: "text-emerald-500", bg: "bg-emerald-500/15", bgBorder: "bg-emerald-500/10 border-emerald-500/20"},
  active:             { label: "Active",            text: "text-green-600",   bg: "bg-green-500/15",   bgBorder: "bg-green-500/10 border-green-500/20"    },
  past_due:           { label: "Payment Due",       text: "text-amber-500",   bg: "bg-amber-500/15",   bgBorder: "bg-amber-500/10 border-amber-500/20"    },
  grace_period:       { label: "Grace Period",      text: "text-orange-600",  bg: "bg-orange-500/15",  bgBorder: "bg-orange-500/10 border-orange-500/20"  },
  suspended:          { label: "Suspended",         text: "text-red-500",     bg: "bg-red-500/15",     bgBorder: "bg-red-500/10 border-red-500/20"        },
  expired:            { label: "Expired",           text: "text-slate-500",   bg: "bg-slate-500/15",   bgBorder: "bg-slate-500/10 border-slate-500/20"    },
}

/** Returns a StatusStyle for any status string, with a safe fallback for unknowns. */
export function getStatusStyle(status: string): StatusStyle {
  return (
    STATUS_CONFIG[status.toLowerCase()] ?? {
      label: status.replace(/_/g, " "),
      text: "text-gray-500",
      bg: "bg-gray-100",
      bgBorder: "bg-gray-100 border-gray-200",
    }
  )
}
