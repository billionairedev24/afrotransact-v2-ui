/**
 * Account-hub feature flags — gates the Recipients / My preorders / Wallet
 * sections in the one-page account hub (AccountClient) until their backend
 * data sources exist.
 *
 * These are NOT wired to a live config service yet: the `recipients_enabled`
 * and `referral_enabled` keys don't exist in any backend config today, and
 * there is no preorder-campaign "is a campaign active" signal wired into the
 * storefront yet either. Rather than invent a new fetch or call an unbuilt
 * endpoint, this reads from an optional, already-loaded flags map (the shape
 * a future storefront `effectiveFeatures` fetch would produce) and otherwise
 * defaults everything off — which keeps the gated sections completely absent
 * from the account hub until they're deliberately turned on.
 */

export interface AccountFeatureFlags {
  recipientsEnabled: boolean
  referralEnabled: boolean
  preorderActive: boolean
}

interface EffectiveFeatures {
  [key: string]: boolean | undefined
}

// TODO(account-hub): once a storefront config/feature-flag fetch exists
// (e.g. loaded in the account layout as `effectiveFeatures`), pass it in
// here instead of `undefined` so `recipients_enabled` / `referral_enabled`
// can flip these on without a code change.
export function getAccountFeatureFlags(effectiveFeatures?: EffectiveFeatures): AccountFeatureFlags {
  return {
    recipientsEnabled: effectiveFeatures?.["recipients_enabled"] === true,
    referralEnabled: effectiveFeatures?.["referral_enabled"] === true,
    preorderActive: false,
  }
}
