/**
 * Waitlist client helper. Wraps the POST /api/v1/waitlist endpoint with a
 * friendly-error shape used by the GeoGate banner + non-operational panel.
 *
 * The backend dedupes via UNIQUE(email, country_code), so retries are safe;
 * the returned `existing` flag lets callers tailor copy ("already on the
 * list" vs. "thanks").
 */

import { postWaitlistSignup, type WaitlistSignupResult } from "./api"
import { friendlyMessage } from "./errors"

export interface JoinWaitlistInput {
  email: string
  countryCode: string
  subdivisionCode?: string | null
}

export interface JoinWaitlistOk {
  ok: true
  existing: boolean
}

export interface JoinWaitlistErr {
  ok: false
  error: string
}

export type JoinWaitlistResult = JoinWaitlistOk | JoinWaitlistErr

export async function joinWaitlist(input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
  try {
    const res: WaitlistSignupResult = await postWaitlistSignup({
      email: input.email.trim(),
      countryCode: input.countryCode.toUpperCase(),
      subdivisionCode: input.subdivisionCode ? input.subdivisionCode.toUpperCase() : undefined,
    })
    return { ok: true, existing: Boolean(res.existing) }
  } catch (err) {
    return { ok: false, error: friendlyMessage(err, "Could not join the waitlist. Please try again.") }
  }
}
