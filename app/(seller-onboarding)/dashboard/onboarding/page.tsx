"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { logError } from "@/lib/errors"
import {
  Building2,
  Store,
  FileText,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Upload,
  X,
  ExternalLink,
  Save,
  Shield,
  Sparkles,
  Check,
  AlertCircle,
  UserPlus,
  Trash2,
  Users,
  Wallet,
  ImageIcon,
  Lock,
} from "lucide-react"
import { getAccessToken } from "@/lib/auth-helpers"
import {
  startOnboarding,
  getOnboardingProgress,
  updateOnboardingBusiness,
  updateOnboardingStore,
  addOnboardingDocument,
  removeOnboardingDocument,
  chooseOnboardingSubscription,
  setupOnboardingStripe,
  confirmOnboardingPaymentMethod,
  submitOnboardingForReview,
  getPublicPlans,
  refreshOnboardingStripeStatus,
  type OnboardingProgress,
  type OnboardingDocument,
  type SubscriptionPlan,
} from "@/lib/api"
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete"
import { useUploadThing } from "@/lib/uploadthing"
import dynamic from "next/dynamic"

// Defer Stripe.js + @stripe/react-stripe-js to a late chunk loaded only when
// the seller reaches the payment-method step. Earlier steps (business info,
// documents, subscription choice) get a smaller initial bundle.
const PaymentMethodForm = dynamic(() => import("./_stripe-onboarding"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-gray-200 mb-4" />
      <div className="h-32 w-full rounded bg-gray-200" />
    </div>
  ),
})

const BG = "bg-gray-50"
const CARD = "bg-white"
const BORDER = "border-gray-200"

const STEPS = [
  { label: "Business", icon: Building2 },
  { label: "Entity", icon: Users },
  { label: "Store", icon: Store },
  { label: "Documents", icon: FileText },
  { label: "Plan", icon: CreditCard },
  { label: "Payment", icon: Wallet },
  { label: "Review", icon: CheckCircle2 },
] as const

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]

const ENTITY_TYPES = [
  { value: "individual", label: "Individual / Sole Proprietor" },
  { value: "sole_proprietorship", label: "Sole Proprietorship (DBA)" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Nonprofit" },
]

const BUSINESS_TYPES = [
  { value: "goods", label: "Goods" },
  { value: "services", label: "Services" },
  { value: "both", label: "Both" },
]

const INDUSTRY_CATEGORIES = [
  "Food & Beverage", "Fashion & Apparel", "Beauty & Personal Care",
  "Home & Garden", "Electronics", "Arts & Crafts", "Health & Wellness",
  "Jewelry & Accessories", "Books & Media", "Sports & Outdoors",
  "Toys & Games", "Automotive", "Pet Supplies", "Agriculture",
  "Professional Services", "Other",
]

interface Principal {
  id: string
  role: string
  firstName: string
  lastName: string
  title: string
  ownershipPct: number
  email: string
  phone: string
  dateOfBirth: string
  ssnLast4: string
  addressLine1: string
  city: string
  state: string
  zip: string
}

interface DocumentSlot {
  type: string
  label: string
  required: boolean
  uploaded?: OnboardingDocument
}

function getRequiredDocuments(entityType: string): DocumentSlot[] {
  switch (entityType.toLowerCase()) {
    case "individual":
      return [
        { type: "government_id", label: "Government-issued Photo ID", required: true },
      ]
    case "sole_proprietorship":
      return [
        { type: "government_id", label: "Government-issued Photo ID", required: true },
        { type: "business_license", label: "Business License / DBA Certificate", required: true },
      ]
    case "llc":
      return [
        { type: "ein_letter", label: "EIN Confirmation Letter (IRS CP 575)", required: true },
        { type: "articles_of_incorporation", label: "Articles of Organization", required: true },
        { type: "operating_agreement", label: "Operating Agreement", required: true },
        { type: "business_license", label: "Business License", required: false },
      ]
    case "corporation":
      return [
        { type: "ein_letter", label: "EIN Confirmation Letter (IRS CP 575)", required: true },
        { type: "articles_of_incorporation", label: "Articles of Incorporation", required: true },
        { type: "business_license", label: "Business License", required: false },
      ]
    case "partnership":
      return [
        { type: "ein_letter", label: "EIN Confirmation Letter", required: true },
        { type: "articles_of_incorporation", label: "Partnership Agreement", required: true },
        { type: "business_license", label: "Business License", required: false },
      ]
    case "nonprofit":
      return [
        { type: "ein_letter", label: "EIN Confirmation Letter", required: true },
        { type: "articles_of_incorporation", label: "Articles of Incorporation", required: true },
        { type: "501c3_letter", label: "501(c)(3) Determination Letter", required: true },
      ]
    default:
      return []
  }
}

function needsEIN(entityType: string) {
  return ["llc", "corporation", "partnership", "nonprofit"].includes(entityType.toLowerCase())
}

function needsPrincipals(entityType: string) {
  return ["llc", "corporation", "partnership"].includes(entityType.toLowerCase())
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
const inputErrCls =
  "w-full rounded-xl border border-red-500/60 bg-red-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 transition-colors"
const selectCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors appearance-none"
const selectErrCls =
  "w-full rounded-xl border border-red-500/60 bg-red-50 px-4 py-3 text-sm text-gray-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 transition-colors appearance-none"
const labelCls = "block text-sm font-medium text-gray-900 mb-1.5"

function FieldError({ error }: { error?: string }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{error}</p>
}

function emptyPrincipal(): Principal {
  return {
    id: crypto.randomUUID(),
    role: "owner",
    firstName: "",
    lastName: "",
    title: "",
    ownershipPct: 0,
    email: "",
    phone: "",
    dateOfBirth: "",
    ssnLast4: "",
    addressLine1: "",
    city: "",
    state: "",
    zip: "",
  }
}

export default function SellerOnboardingPage() {
  const { status } = useSession()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [maxReachedStep, setMaxReachedStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [initialized, setInitialized] = useState(false)

  // Step 0: Business info
  const [businessName, setBusinessName] = useState("")
  const [entityType, setEntityType] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [taxId, setTaxId] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [businessDescription, setBusinessDescription] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zip, setZip] = useState("")
  const [country, setCountry] = useState("US")
  const [industryCategory, setIndustryCategory] = useState("")
  const [annualRevenue, setAnnualRevenue] = useState("")
  const [numberOfEmployees, setNumberOfEmployees] = useState("")

  // Step 1: Entity details + principals
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [ssnLast4, setSsnLast4] = useState("")
  const [ein, setEin] = useState("")
  const [stateOfIncorporation, setStateOfIncorporation] = useState("")
  const [formationDate, setFormationDate] = useState("")
  const [dbaName, setDbaName] = useState("")
  const [principals, setPrincipals] = useState<Principal[]>([])

  // Step 2: Store
  const [storeName, setStoreName] = useState("")
  const [storeDescription, setStoreDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [deliveryRadius, setDeliveryRadius] = useState("25")

  // Step 4: Subscription
  const [selectedPlan, setSelectedPlan] = useState("")

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const hydrateFromProgress = useCallback((p: OnboardingProgress) => {
    setProgress(p)
    const s = p.onboardingStatus?.toLowerCase()
    if (s === "submitted" || s === "under_review" || s === "approved") {
      setSubmitted(true)
    }
    const b = p.businessInfo
    // Backend used to default new sellers to "My Business"; never treat that as a real name.
    const rawBusinessName = (b.businessName ?? "").trim()
    setBusinessName(rawBusinessName.toLowerCase() === "my business" ? "" : (b.businessName ?? ""))
    setEntityType(b.entityType ?? "")
    setBusinessType(b.businessType ?? "")
    setTaxId(b.taxId ?? "")
    setContactPhone(b.contactPhone ?? "")
    setContactEmail(b.contactEmail ?? "")
    setWebsite(b.website ?? "")
    setBusinessDescription(b.businessDescription ?? "")
    setAddressLine1(b.addressLine1 ?? "")
    setAddressLine2(b.addressLine2 ?? "")
    setCity(b.city ?? "")
    setState(b.state ?? "")
    setZip(b.zip ?? "")
    setCountry(b.country ?? "US")
    setIndustryCategory(b.industryCategory ?? "")
    setAnnualRevenue(b.annualRevenue ?? "")
    setNumberOfEmployees(b.numberOfEmployees != null ? String(b.numberOfEmployees) : "")

    if (p.entityDetails) {
      setDateOfBirth(p.entityDetails.dateOfBirth ?? "")
      setSsnLast4(p.entityDetails.ssnLast4 ?? "")
      setEin(p.entityDetails.ein ?? "")
      setStateOfIncorporation(p.entityDetails.stateOfIncorporation ?? "")
      setFormationDate(p.entityDetails.formationDate ?? "")
      setDbaName(p.entityDetails.dbaName ?? "")
    }

    if (p.principals && p.principals.length > 0) {
      setPrincipals(
        p.principals.map((pr) => ({
          id: pr.id ?? crypto.randomUUID(),
          role: pr.role ?? "owner",
          firstName: pr.firstName ?? "",
          lastName: pr.lastName ?? "",
          title: pr.title ?? "",
          ownershipPct: pr.ownershipPct ?? 0,
          email: pr.email ?? "",
          phone: pr.phone ?? "",
          dateOfBirth: pr.dateOfBirth ?? "",
          ssnLast4: pr.ssnLast4 ?? "",
          addressLine1: pr.addressLine1 ?? "",
          city: pr.addressCity ?? "",
          state: pr.addressState ?? "",
          zip: pr.addressZip ?? "",
        }))
      )
    }

    if (p.storeInfo) {
      setStoreName(p.storeInfo.name ?? "")
      setStoreDescription(p.storeInfo.description ?? "")
      setLogoUrl(p.storeInfo.logoUrl ?? "")
      setBannerUrl(p.storeInfo.bannerUrl ?? "")
    }

    if (p.subscription) {
      setSelectedPlan(p.subscription.planSlug ?? "")
    }

    // Backend tracks: 1=started, 2=business, 3=store, 4=docs, 5=subscription, 6=payment
    // Frontend steps: 0=business, 1=entity, 2=store, 3=docs, 4=subscription, 5=payment, 6=review
    const backendToFrontend: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }
    const frontendStep = backendToFrontend[p.currentStep]
    if (frontendStep !== undefined) {
      setStep(frontendStep)
      setMaxReachedStep((prev) => Math.max(prev, frontendStep))
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated") {
      if (status !== "loading") setLoading(false)
      return
    }
    if (initialized) return
    setInitialized(true)

    async function init() {
      const token = await getAccessToken()
      if (!token) { setLoading(false); return }
      try {
        const p = await startOnboarding(token)
        hydrateFromProgress(p)
        document.cookie = "afro_seller_intent=; path=/; max-age=0"
      } catch {
        try {
          const token2 = await getAccessToken()
          if (token2) {
            const p = await getOnboardingProgress(token2)
            hydrateFromProgress(p)
          }
        } catch {
          toast.error("Failed to load onboarding progress")
        }
      }
      try {
        const allPlans = await getPublicPlans()
        setPlans(allPlans.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder))
      } catch { /* plans will show empty state */ }
      setLoading(false)
    }

    init()
  }, [status, initialized, hydrateFromProgress])

  // After returning from Stripe Connect onboarding, refresh account status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has("stripe_return") && !params.has("stripe_refresh")) return
    if (status !== "authenticated") return

    async function refreshStripe() {
      const token = await getAccessToken()
      if (!token) return
      try {
        const p = await refreshOnboardingStripeStatus(token)
        hydrateFromProgress(p)
        setStep(5) // Keep on Payment step
        if (p.stripe?.chargesEnabled && p.stripe?.payoutsEnabled) {
          toast.success("Stripe Connect setup complete!")
        } else {
          toast.info("Stripe account created. Some verifications may still be pending.")
        }
      } catch {
        toast.error("Failed to refresh Stripe status")
      }
      // Clean up query params from URL
      window.history.replaceState({}, "", window.location.pathname)
    }

    refreshStripe()
  }, [status, hydrateFromProgress])

  async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T | null> {
    const token = await getAccessToken()
    if (!token) {
      toast.error("Session expired. Please sign in again.")
      void signIn("keycloak", { callbackUrl: "/dashboard/onboarding" })
      return null
    }
    return fn(token)
  }

  // ── Step 0: Business Info ──

  async function saveBusiness() {
    const errs: Record<string, string> = {}
    if (!businessName.trim()) errs.businessName = "Business name is required"
    if (!entityType) errs.entityType = "Entity type is required"
    if (!contactPhone.trim()) errs.contactPhone = "Contact phone is required"
    else if (!/^[\d\s()+-]{7,20}$/.test(contactPhone)) errs.contactPhone = "Enter a valid phone number"
    if (!contactEmail.trim()) errs.contactEmail = "Contact email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errs.contactEmail = "Enter a valid email address"
    if (website && !/^https?:\/\/.+/.test(website)) errs.website = "Must start with http:// or https://"
    if (!addressLine1.trim()) errs.addressLine1 = "Address is required"
    if (!city.trim()) errs.city = "City is required"
    if (!state) errs.state = "State is required"
    if (!zip.trim()) errs.zip = "ZIP code is required"
    else if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) errs.zip = "Must be a valid US ZIP (e.g. 12345)"

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      toast.error("Please fix the highlighted fields")
      return false
    }
    setFieldErrors({})

    setSaving(true)
    try {
      const p = await withToken((t) =>
        updateOnboardingBusiness(t, {
          businessName: businessName.trim(),
          entityType,
          businessType: businessType || undefined,
          taxId: taxId.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          website: website.trim() || undefined,
          businessDescription: businessDescription.trim() || undefined,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state,
          zip: zip.trim(),
          country: country || "US",
          industryCategory: industryCategory || undefined,
          annualRevenue: annualRevenue || undefined,
          numberOfEmployees: numberOfEmployees || undefined,
          dateOfBirth: dateOfBirth || undefined,
          ssnLast4: ssnLast4 || undefined,
          ein: ein || undefined,
          stateOfIncorporation: stateOfIncorporation || undefined,
          formationDate: formationDate || undefined,
          dbaName: dbaName || undefined,
          principals: principals.map((pr) => ({
            role: pr.role,
            firstName: pr.firstName,
            lastName: pr.lastName,
            title: pr.title,
            ownershipPct: pr.ownershipPct,
            email: pr.email,
            phone: pr.phone,
            dateOfBirth: pr.dateOfBirth,
            ssnLast4: pr.ssnLast4,
            addressLine1: pr.addressLine1,
            addressCity: pr.city,
            addressState: pr.state,
            addressZip: pr.zip,
          })),
        })
      )
      if (p) { hydrateFromProgress(p); toast.success("Business info saved") }
      return !!p
    } catch (e) {
      logError(e, "saving business info")
      toast.error("Failed to save business info")
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Step 1: Entity Details — saves together with business ──

  async function saveEntityDetails() {
    const et = entityType.toLowerCase()
    const errs: Record<string, string> = {}

    if (needsEIN(et)) {
      if (!ein.trim()) errs.ein = "EIN is required for your entity type"
      else {
        const einClean = ein.trim().replace(/-/g, "")
        if (!/^\d{9}$/.test(einClean)) errs.ein = "EIN must be 9 digits (format: XX-XXXXXXX)"
      }
    }

    const isIndividual = ["individual", "sole_proprietorship"].includes(et)
    if (isIndividual) {
      if (!dateOfBirth) errs.dateOfBirth = "Date of birth is required"
      else {
        const age = Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (age < 18) errs.dateOfBirth = "You must be at least 18 years old"
      }
      if (!ssnLast4.trim()) errs.ssnLast4 = "Last 4 of SSN is required"
      else if (!/^\d{4}$/.test(ssnLast4.trim())) errs.ssnLast4 = "Must be exactly 4 digits"
    }

    if (needsPrincipals(et)) {
      if (principals.length === 0) errs.principals = "At least one owner/officer is required"
      const totalOwnership = principals.reduce((s, p) => s + p.ownershipPct, 0)
      for (const [i, pr] of principals.entries()) {
        if (!pr.firstName.trim()) errs[`p${i}_firstName`] = "Required"
        if (!pr.lastName.trim()) errs[`p${i}_lastName`] = "Required"
        if (!pr.email.trim()) errs[`p${i}_email`] = "Required"
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pr.email.trim())) errs[`p${i}_email`] = "Invalid email"
        if (!pr.dateOfBirth) errs[`p${i}_dob`] = "Required"
        if (pr.ssnLast4 && !/^\d{4}$/.test(pr.ssnLast4.trim())) errs[`p${i}_ssn`] = "Must be 4 digits"
        if (pr.ownershipPct < 0 || pr.ownershipPct > 100) errs[`p${i}_ownership`] = "Must be 0–100%"
        if (!pr.addressLine1.trim()) errs[`p${i}_address`] = "Address is required"
        if (!pr.city.trim()) errs[`p${i}_city`] = "Required"
        if (!pr.state) errs[`p${i}_state`] = "Required"
        if (!pr.zip.trim()) errs[`p${i}_zip`] = "Required"
      }
      if (totalOwnership > 100) errs.totalOwnership = "Total ownership cannot exceed 100%"
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      toast.error("Please fix the highlighted fields")
      return false
    }
    setFieldErrors({})
    return saveBusiness()
  }

  // ── Step 2: Store ──

  async function saveStore() {
    if (!storeName.trim()) { toast.error("Store name is required"); return false }
    setSaving(true)
    try {
      const p = await withToken((t) =>
        updateOnboardingStore(t, {
          name: storeName.trim(),
          description: storeDescription.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          bannerUrl: bannerUrl.trim() || undefined,
          deliveryRadiusMiles: deliveryRadius ? Number(deliveryRadius) : undefined,
        })
      )
      if (p) { hydrateFromProgress(p); toast.success("Store info saved") }
      return !!p
    } catch (e) {
      logError(e, "saving store info")
      toast.error("Failed to save store info")
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3: Documents ──

  async function handleDocumentUploaded(docType: string, fileUrl: string, fileName: string, fileSize: number, mimeType: string) {
    try {
      const p = await withToken((t) =>
        addOnboardingDocument(t, {
          documentType: docType,
          fileUrl,
          fileName,
          fileSizeBytes: fileSize,
          mimeType,
        })
      )
      if (p) { hydrateFromProgress(p); toast.success("Document uploaded") }
    } catch (e) {
      logError(e, "saving document")
      toast.error("Failed to save document")
    }
  }

  async function handleDocumentRemove(docId: string) {
    try {
      const p = await withToken((t) => removeOnboardingDocument(t, docId))
      if (p) { hydrateFromProgress(p); toast.success("Document removed") }
    } catch (e) {
      logError(e, "removing document")
      toast.error("Failed to remove document")
    }
  }

  async function saveDocuments() { return true }

  // ── Step 4: Subscription ──

  async function saveSubscription() {
    if (!selectedPlan) { toast.error("Please choose a plan"); return false }
    setSaving(true)
    try {
      const p = await withToken((t) => chooseOnboardingSubscription(t, selectedPlan))
      if (p) { hydrateFromProgress(p); toast.success("Subscription plan saved") }
      return !!p
    } catch (e) {
      logError(e, "saving subscription")
      toast.error("Failed to save subscription")
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Step 5: Payment Setup (Stripe Connect + Payment Method) ──

  async function saveStripe() {
    setSaving(true)
    try {
      const p = await withToken((t) => setupOnboardingStripe(t))
      if (p) {
        hydrateFromProgress(p)
        if (p.stripe?.chargesEnabled && p.stripe?.payoutsEnabled) {
          toast.success("Stripe is already connected")
        } else if (p.stripe?.onboardingUrl) {
          toast.info("Redirecting to Stripe to complete verification…")
          window.location.href = p.stripe.onboardingUrl
          return true
        } else if (p.stripe?.stripeAccountId) {
          toast.info("Stripe account created. Click 'Continue Stripe Setup' to complete verification.")
        }
      }
      return true
    } catch (e) {
      logError(e, "setting up Stripe")
      toast.error("Failed to set up Stripe")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmPaymentMethod(pmId: string) {
    setSaving(true)
    try {
      const p = await withToken((t) => confirmOnboardingPaymentMethod(t, pmId))
      if (p) {
        hydrateFromProgress(p)
        toast.success("Payment method saved")
      }
    } catch (e) {
      logError(e, "saving payment method")
      toast.error("Failed to save payment method")
    } finally {
      setSaving(false)
    }
  }

  // ── Navigation ──

  async function handleNext() {
    let success = false
    switch (step) {
      case 0: success = await saveBusiness(); break
      case 1: success = await saveEntityDetails(); break
      case 2: success = await saveStore(); break
      case 3: success = await saveDocuments(); break
      case 4: success = await saveSubscription(); break
      case 5: success = true; break // Payment step: user interacts with Stripe directly, Next just advances to review
      default: success = true
    }
    if (success && step < 6) {
      const next = step + 1
      setStep(next)
      setMaxReachedStep((prev) => Math.max(prev, next))
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const p = await withToken((t) => submitOnboardingForReview(t))
      if (p) {
        hydrateFromProgress(p)
        setSubmitted(true)
        toast.success("Application submitted for review!")
      }
    } catch (e) {
      logError(e, "submitting onboarding")
      toast.error("Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveLater() {
    switch (step) {
      case 0: await saveBusiness(); break
      case 1: await saveBusiness(); break
      case 2: await saveStore(); break
      case 4: if (selectedPlan) await saveSubscription(); break
    }
    toast.success("Progress saved. You can continue later.")
    router.push("/dashboard")
  }

  const completionChecks = {
    business: !!(businessName && entityType && addressLine1 && city && state && zip),
    entity: (() => {
      if (!entityType) return false
      const et = entityType.toLowerCase()
      if (["individual", "sole_proprietorship"].includes(et) && !dateOfBirth) return false
      if (needsEIN(et) && !ein) return false
      if (needsPrincipals(et) && principals.length === 0) return false
      return true
    })(),
    store: !!storeName,
    documents: (() => {
      if (!entityType) return false
      const slots = getRequiredDocuments(entityType)
      const docs = progress?.documents ?? []
      return slots.filter((s) => s.required).every((s) => docs.some((d) => d.documentType === s.type))
    })(),
    subscription: !!selectedPlan || !!progress?.subscription,
    stripe: !!(progress?.stripe?.chargesEnabled),
    payment: !!(progress?.stripe?.hasPaymentMethod),
  }

  const allComplete = completionChecks.business && completionChecks.entity &&
    completionChecks.store && completionChecks.documents && completionChecks.subscription &&
    (completionChecks.stripe || completionChecks.payment)

  if (status === "loading" || loading) {
    return (
      <div className={`flex items-center justify-center py-20 gap-3 ${BG}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-gray-500">Loading onboarding…</span>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className={`flex items-center justify-center min-h-[60vh] ${BG}`}>
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border ${BORDER} ${CARD} p-12 text-center max-w-md`}
        >
          <Store className="h-14 w-14 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Sign in to continue</h2>
          <p className="mt-2 text-sm text-gray-500">
            You need to be signed in to set up your seller account.
          </p>
          <button
            onClick={() => signIn("keycloak", { callbackUrl: "/dashboard/onboarding" })}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={`flex items-center justify-center min-h-[60vh] ${BG}`}>
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border ${BORDER} ${CARD} p-12 text-center max-w-lg`}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Application Submitted</h2>
          <p className="mt-3 text-sm text-gray-500 max-w-sm leading-relaxed">
            Your seller application is under review. We&apos;ll notify you via email once it&apos;s been processed. This typically takes 1–2 business days.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-4xl mx-auto px-4 py-6 sm:py-10 ${BG}`}>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Seller Onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">Complete the steps below to start selling on AfroTransact</p>
      </div>

      <StepIndicator currentStep={step} maxReachedStep={maxReachedStep} onStepClick={(s) => { if (s <= maxReachedStep) setStep(s) }} completionChecks={completionChecks} />

      <div
        className={`rounded-2xl border ${BORDER} ${CARD} p-6 sm:p-8 mt-8`}
      >
        {submitted && step < 6 && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <Lock className="h-4 w-4 text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-600">
              Your application has been submitted. Fields are locked. To request changes, contact support.
            </p>
          </div>
        )}
        <fieldset disabled={submitted && step < 6} className={submitted && step < 6 ? "opacity-70 pointer-events-none" : ""}>
        {step === 0 && (
          <BusinessStep
            businessName={businessName} setBusinessName={setBusinessName}
            entityType={entityType} setEntityType={setEntityType}
            businessType={businessType} setBusinessType={setBusinessType}
            taxId={taxId} setTaxId={setTaxId}
            contactPhone={contactPhone} setContactPhone={setContactPhone}
            contactEmail={contactEmail} setContactEmail={setContactEmail}
            website={website} setWebsite={setWebsite}
            businessDescription={businessDescription} setBusinessDescription={setBusinessDescription}
            addressLine1={addressLine1} setAddressLine1={setAddressLine1}
            addressLine2={addressLine2} setAddressLine2={setAddressLine2}
            city={city} setCity={setCity}
            state={state} setState={setState}
            zip={zip} setZip={setZip}
            country={country} setCountry={setCountry}
            industryCategory={industryCategory} setIndustryCategory={setIndustryCategory}
            annualRevenue={annualRevenue} setAnnualRevenue={setAnnualRevenue}
            numberOfEmployees={numberOfEmployees} setNumberOfEmployees={setNumberOfEmployees}
            sensitiveFieldsLocked={maxReachedStep > 0}
            errors={fieldErrors}
          />
        )}
        {step === 1 && (
          <EntityDetailsStep
            entityType={entityType}
            dateOfBirth={dateOfBirth} setDateOfBirth={setDateOfBirth}
            ssnLast4={ssnLast4} setSsnLast4={setSsnLast4}
            ein={ein} setEin={setEin}
            stateOfIncorporation={stateOfIncorporation} setStateOfIncorporation={setStateOfIncorporation}
            formationDate={formationDate} setFormationDate={setFormationDate}
            dbaName={dbaName} setDbaName={setDbaName}
            principals={principals} setPrincipals={setPrincipals}
            sensitiveFieldsLocked={maxReachedStep > 1}
            errors={fieldErrors}
          />
        )}
        {step === 2 && (
          <StoreStep
            storeName={storeName} setStoreName={setStoreName}
            storeDescription={storeDescription} setStoreDescription={setStoreDescription}
            logoUrl={logoUrl} setLogoUrl={setLogoUrl}
            bannerUrl={bannerUrl} setBannerUrl={setBannerUrl}
            deliveryRadius={deliveryRadius} setDeliveryRadius={setDeliveryRadius}
          />
        )}
        {step === 3 && (
          <DocumentsStep
            entityType={entityType}
            documents={progress?.documents ?? []}
            onDocumentUploaded={handleDocumentUploaded}
            onRemove={handleDocumentRemove}
          />
        )}
        {step === 4 && (
          <SubscriptionStep
            plans={plans}
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            currentPlan={progress?.subscription?.planSlug ?? null}
          />
        )}
        {step === 5 && (
          <PaymentSetupStep
            stripe={progress?.stripe ?? null}
            onSetupConnect={saveStripe}
            onConfirmPaymentMethod={handleConfirmPaymentMethod}
            saving={saving}
          />
        )}
        </fieldset>
        {step === 6 && (
          <ReviewStep
            businessName={businessName} entityType={entityType} businessType={businessType}
            taxId={taxId} contactPhone={contactPhone} contactEmail={contactEmail}
            website={website} businessDescription={businessDescription}
            addressLine1={addressLine1} addressLine2={addressLine2}
            city={city} state={state} zip={zip} country={country}
            industryCategory={industryCategory} annualRevenue={annualRevenue}
            numberOfEmployees={numberOfEmployees}
            dateOfBirth={dateOfBirth} ssnLast4={ssnLast4} ein={ein}
            stateOfIncorporation={stateOfIncorporation} formationDate={formationDate} dbaName={dbaName}
            principals={principals}
            storeName={storeName} storeDescription={storeDescription}
            logoUrl={logoUrl} bannerUrl={bannerUrl} deliveryRadius={deliveryRadius}
            documents={progress?.documents ?? []}
            subscription={progress?.subscription}
            stripe={progress?.stripe ?? null}
            completionChecks={completionChecks}
          />
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 order-2 sm:order-1">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          <button
            onClick={handleSaveLater}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Save className="h-4 w-4" /> Save & Continue Later
          </button>
        </div>

        <div className="order-1 sm:order-2">
          {submitted ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-5 py-2.5 text-sm font-medium text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Application Submitted
            </span>
          ) : step < 6 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <>Next <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allComplete || submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                <>Submit Application <CheckCircle2 className="h-4 w-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step Indicator ──

function StepIndicator({
  currentStep,
  maxReachedStep,
  onStepClick,
  completionChecks,
}: {
  currentStep: number
  maxReachedStep: number
  onStepClick: (step: number) => void
  completionChecks: Record<string, boolean>
}) {
  const checkKeys = ["business", "entity", "store", "documents", "subscription", "payment"]
  return (
    <div className="flex items-center justify-between relative">
      <div
        className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 hidden sm:block"
        style={{ left: "2rem", right: "2rem" }}
      />
      {STEPS.map((s, i) => {
        const done = i < 6 ? completionChecks[checkKeys[i]] : false
        const active = i === currentStep
        const locked = i > maxReachedStep
        const Icon = s.icon
        return (
          <button
            key={i}
            onClick={() => { if (!locked) onStepClick(i) }}
            disabled={locked}
            className={`relative z-10 flex flex-col items-center gap-1.5 group ${locked ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-green-500 bg-green-500/10 text-green-500"
                    : "border-gray-300 bg-gray-50 text-gray-500"
              } group-hover:scale-110`}
            >
              {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span
              className={`text-xs font-medium hidden sm:block ${
                active ? "text-primary" : done ? "text-green-500" : "text-gray-500"
              }`}
            >
              {s.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
  )
}

function RequiredDot() {
  return <span className="text-red-600 ml-0.5">*</span>
}

// ── Step 0: Business Information ──

function BusinessStep({
  businessName, setBusinessName, entityType, setEntityType,
  businessType, setBusinessType, taxId, setTaxId,
  contactPhone, setContactPhone, contactEmail, setContactEmail,
  website, setWebsite, businessDescription, setBusinessDescription,
  addressLine1, setAddressLine1, addressLine2, setAddressLine2,
  city, setCity, state, setState, zip, setZip, country, setCountry,
  industryCategory, setIndustryCategory,
  annualRevenue, setAnnualRevenue,
  numberOfEmployees, setNumberOfEmployees,
  sensitiveFieldsLocked = false,
  errors = {},
}: {
  businessName: string; setBusinessName: (v: string) => void
  entityType: string; setEntityType: (v: string) => void
  businessType: string; setBusinessType: (v: string) => void
  taxId: string; setTaxId: (v: string) => void
  contactPhone: string; setContactPhone: (v: string) => void
  contactEmail: string; setContactEmail: (v: string) => void
  website: string; setWebsite: (v: string) => void
  businessDescription: string; setBusinessDescription: (v: string) => void
  addressLine1: string; setAddressLine1: (v: string) => void
  addressLine2: string; setAddressLine2: (v: string) => void
  city: string; setCity: (v: string) => void
  state: string; setState: (v: string) => void
  zip: string; setZip: (v: string) => void
  country: string; setCountry: (v: string) => void
  industryCategory: string; setIndustryCategory: (v: string) => void
  annualRevenue: string; setAnnualRevenue: (v: string) => void
  numberOfEmployees: string; setNumberOfEmployees: (v: string) => void
  sensitiveFieldsLocked?: boolean
  errors?: Record<string, string>
}) {
  const locked = sensitiveFieldsLocked
  return (
    <div>
      <SectionTitle icon={Building2} title="Business Information" />
      <p className="text-sm text-gray-500 mb-6">Tell us about your business. This information is used for verification and compliance.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Legal Business Name<RequiredDot />{locked && businessName && <span className="ml-2 text-[10px] text-yellow-500/70">(locked)</span>}</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={errors.businessName ? inputErrCls : inputCls} placeholder="Your registered business name" disabled={locked && !!businessName} />
          <FieldError error={errors.businessName} />
        </div>
        <div>
          <label className={labelCls}>Entity Type<RequiredDot />{locked && entityType && <span className="ml-2 text-[10px] text-yellow-500/70">(locked)</span>}</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={errors.entityType ? selectErrCls : selectCls} disabled={locked && !!entityType}>
            <option value="" className="bg-white">Select type…</option>
            {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-white">{t.label}</option>)}
          </select>
          <FieldError error={errors.entityType} />
        </div>
        <div>
          <label className={labelCls}>What do you sell?</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={selectCls}>
            <option value="" className="bg-white">Select…</option>
            {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-white">{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Industry Category</label>
          <select value={industryCategory} onChange={(e) => setIndustryCategory(e.target.value)} className={selectCls}>
            <option value="" className="bg-white">Select…</option>
            {INDUSTRY_CATEGORIES.map((c) => <option key={c} value={c} className="bg-white">{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tax ID / EIN{locked && taxId && <span className="ml-2 text-[10px] text-yellow-500/70">(locked)</span>}</label>
          <input value={taxId} onChange={(e) => { const v = e.target.value.replace(/[^\d-]/g, ""); setTaxId(v) }} className={inputCls} placeholder="XX-XXXXXXX" maxLength={10} disabled={locked && !!taxId} />
        </div>
        <div>
          <label className={labelCls}>Contact Phone<RequiredDot /></label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={errors.contactPhone ? inputErrCls : inputCls} placeholder="(555) 123-4567" type="tel" />
          <FieldError error={errors.contactPhone} />
        </div>
        <div>
          <label className={labelCls}>Contact Email<RequiredDot /></label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={errors.contactEmail ? inputErrCls : inputCls} placeholder="business@example.com" type="email" />
          <FieldError error={errors.contactEmail} />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className={errors.website ? inputErrCls : inputCls} placeholder="https://example.com" type="url" />
          <FieldError error={errors.website} />
        </div>
        <div>
          <label className={labelCls}>Annual Revenue (approx.)</label>
          <select value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} className={selectCls}>
            <option value="" className="bg-white">Select…</option>
            <option value="< $50K" className="bg-white">Less than $50,000</option>
            <option value="$50K - $100K" className="bg-white">$50,000 - $100,000</option>
            <option value="$100K - $500K" className="bg-white">$100,000 - $500,000</option>
            <option value="$500K - $1M" className="bg-white">$500,000 - $1,000,000</option>
            <option value="> $1M" className="bg-white">More than $1,000,000</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Number of Employees</label>
          <input value={numberOfEmployees} onChange={(e) => setNumberOfEmployees(e.target.value)} className={inputCls} placeholder="e.g. 5" type="number" min="0" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Business Description</label>
          <textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            className={`${inputCls} min-h-[80px] resize-y`}
            placeholder="Describe what your business sells and your target market…"
            rows={3}
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Business Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Address Line 1<RequiredDot /></label>
            <AddressAutocomplete
              value={addressLine1}
              onChange={setAddressLine1}
              onSelect={(parts) => {
                setAddressLine1(parts.line1)
                if (parts.line2) setAddressLine2(parts.line2)
                if (parts.city) setCity(parts.city)
                if (parts.state) setState(parts.state)
                if (parts.zip) setZip(parts.zip)
                if (parts.country) setCountry(parts.country)
              }}
              placeholder="Start typing your address…"
            />
            <FieldError error={errors.addressLine1} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address Line 2</label>
            <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputCls} placeholder="Suite, unit, etc." />
          </div>
          <div>
            <label className={labelCls}>City<RequiredDot /></label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={errors.city ? inputErrCls : inputCls} placeholder="City" />
            <FieldError error={errors.city} />
          </div>
          <div>
            <label className={labelCls}>State<RequiredDot /></label>
            <select value={state} onChange={(e) => setState(e.target.value)} className={errors.state ? selectErrCls : selectCls}>
              <option value="" className="bg-white">Select…</option>
              {US_STATES.map((s) => <option key={s} value={s} className="bg-white">{s}</option>)}
            </select>
            <FieldError error={errors.state} />
          </div>
          <div>
            <label className={labelCls}>ZIP Code<RequiredDot /></label>
            <input value={zip} onChange={(e) => setZip(e.target.value)} className={errors.zip ? inputErrCls : inputCls} placeholder="12345" maxLength={10} />
            <FieldError error={errors.zip} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="US" disabled />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Entity Details + Principals ──

function EntityDetailsStep({
  entityType,
  dateOfBirth, setDateOfBirth,
  ssnLast4, setSsnLast4,
  ein, setEin,
  stateOfIncorporation, setStateOfIncorporation,
  formationDate, setFormationDate,
  dbaName, setDbaName,
  principals, setPrincipals,
  sensitiveFieldsLocked = false,
  errors = {},
}: {
  entityType: string
  dateOfBirth: string; setDateOfBirth: (v: string) => void
  ssnLast4: string; setSsnLast4: (v: string) => void
  ein: string; setEin: (v: string) => void
  stateOfIncorporation: string; setStateOfIncorporation: (v: string) => void
  formationDate: string; setFormationDate: (v: string) => void
  dbaName: string; setDbaName: (v: string) => void
  principals: Principal[]; setPrincipals: (v: Principal[]) => void
  sensitiveFieldsLocked?: boolean
  errors?: Record<string, string>
}) {
  if (!entityType) {
    return (
      <div>
        <SectionTitle icon={Users} title="Entity Details" />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500/60 mb-4" />
          <p className="text-gray-500 text-sm">Please go back to Step 1 and select your entity type first.</p>
        </div>
      </div>
    )
  }

  const et = entityType.toLowerCase()
  const isIndividual = ["individual", "sole_proprietorship"].includes(et)
  const showEIN = needsEIN(et)
  const showPrincipals = needsPrincipals(et)

  function addPrincipal() {
    setPrincipals([...principals, emptyPrincipal()])
  }

  function removePrincipal(id: string) {
    setPrincipals(principals.filter((p) => p.id !== id))
  }

  function updatePrincipal(id: string, field: keyof Principal, value: string | number) {
    setPrincipals(principals.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  return (
    <div>
      <SectionTitle icon={Users} title="Entity & Identity Verification" />
      <p className="text-sm text-gray-500 mb-6">
        Provide identity and entity information required for{" "}
        <span className="text-gray-900 font-medium">{ENTITY_TYPES.find((t) => t.value === entityType)?.label}</span> sellers.
        This is required for KYC compliance.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isIndividual && (
          <>
            <div>
              <label className={labelCls}>Date of Birth<RequiredDot />{sensitiveFieldsLocked && dateOfBirth && <span className="ml-2 text-[10px] text-yellow-500/70">(locked)</span>}</label>
              <input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={errors.dateOfBirth ? inputErrCls : inputCls} type="date" disabled={sensitiveFieldsLocked && !!dateOfBirth} />
              <FieldError error={errors.dateOfBirth} />
            </div>
            <div>
              <label className={labelCls}>SSN (last 4 digits)<RequiredDot />{sensitiveFieldsLocked && ssnLast4 && <span className="ml-2 text-[10px] text-yellow-500/70">(locked)</span>}</label>
              <input
                value={ssnLast4}
                onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className={errors.ssnLast4 ? inputErrCls : inputCls}
                placeholder="••••"
                maxLength={4}
                inputMode="numeric"
                pattern="\d{4}"
                disabled={sensitiveFieldsLocked && !!ssnLast4}
              />
              <FieldError error={errors.ssnLast4} />
              {!errors.ssnLast4 && <p className="text-xs text-gray-500 mt-1">Encrypted and stored securely. Used for identity verification only.</p>}
            </div>
          </>
        )}

        {showEIN && (
          <>
            <div>
              <label className={labelCls}>EIN (Employer Identification Number)<RequiredDot />{sensitiveFieldsLocked && ein && <span className="ml-2 text-[10px] text-yellow-500/70">(locked)</span>}</label>
              <input
                value={ein}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d-]/g, "")
                  if (v.length === 2 && !v.includes("-") && ein.length < v.length) v += "-"
                  setEin(v.slice(0, 10))
                }}
                className={errors.ein ? inputErrCls : inputCls}
                placeholder="XX-XXXXXXX"
                maxLength={10}
                disabled={sensitiveFieldsLocked && !!ein}
              />
              <FieldError error={errors.ein} />
            </div>
            <div>
              <label className={labelCls}>State of Incorporation</label>
              <select value={stateOfIncorporation} onChange={(e) => setStateOfIncorporation(e.target.value)} className={selectCls}>
                <option value="" className="bg-white">Select…</option>
                {US_STATES.map((s) => <option key={s} value={s} className="bg-white">{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Formation Date</label>
              <input value={formationDate} onChange={(e) => setFormationDate(e.target.value)} className={inputCls} type="date" />
            </div>
          </>
        )}

        {et === "sole_proprietorship" && (
          <>
            <div>
              <label className={labelCls}>DBA Name (if different from business name)</label>
              <input value={dbaName} onChange={(e) => setDbaName(e.target.value)} className={inputCls} placeholder="Doing Business As name" />
            </div>
          </>
        )}
      </div>

      {showPrincipals && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Beneficial Owners & Officers</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                List all individuals with 25%+ ownership or significant management control. Required for compliance.
              </p>
            </div>
            <button
              onClick={addPrincipal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add Person
            </button>
          </div>

          {principals.length === 0 && (
            <div className={`rounded-xl border border-dashed p-8 text-center ${errors.principals ? "border-red-500/40 bg-red-500/5" : "border-gray-200"}`}>
              <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No owners or officers added yet.</p>
              <FieldError error={errors.principals} />
              <button
                onClick={addPrincipal}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <UserPlus className="h-4 w-4" /> Add First Person
              </button>
            </div>
          )}
          {errors.totalOwnership && <FieldError error={errors.totalOwnership} />}

          <div className="space-y-4">
            {principals.map((pr, idx) => {
              const pe = (f: string) => errors[`p${idx}_${f}`]
              const hasErrors = !!(pe("firstName") || pe("lastName") || pe("email") || pe("dob") || pe("ssn") || pe("ownership") || pe("address") || pe("city") || pe("state") || pe("zip"))
              return (
                <div
                  key={pr.id}
                  className={`rounded-xl border p-4 ${hasErrors ? "border-red-500/40" : BORDER}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Person {idx + 1}</h4>
                    <button
                      onClick={() => removePrincipal(pr.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>First Name<RequiredDot /></label>
                      <input value={pr.firstName} onChange={(e) => updatePrincipal(pr.id, "firstName", e.target.value)} className={pe("firstName") ? inputErrCls : inputCls} placeholder="First name" />
                      <FieldError error={pe("firstName")} />
                    </div>
                    <div>
                      <label className={labelCls}>Last Name<RequiredDot /></label>
                      <input value={pr.lastName} onChange={(e) => updatePrincipal(pr.id, "lastName", e.target.value)} className={pe("lastName") ? inputErrCls : inputCls} placeholder="Last name" />
                      <FieldError error={pe("lastName")} />
                    </div>
                    <div>
                      <label className={labelCls}>Title / Role</label>
                      <input value={pr.title} onChange={(e) => updatePrincipal(pr.id, "title", e.target.value)} className={inputCls} placeholder="e.g. CEO, Managing Member" />
                    </div>
                    <div>
                      <label className={labelCls}>Role</label>
                      <select value={pr.role} onChange={(e) => updatePrincipal(pr.id, "role", e.target.value)} className={selectCls}>
                        <option value="owner" className="bg-white">Owner</option>
                        <option value="officer" className="bg-white">Officer</option>
                        <option value="director" className="bg-white">Director</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Ownership %</label>
                      <input value={pr.ownershipPct} onChange={(e) => updatePrincipal(pr.id, "ownershipPct", Number(e.target.value))} className={pe("ownership") ? inputErrCls : inputCls} type="number" min="0" max="100" placeholder="25" />
                      <FieldError error={pe("ownership")} />
                    </div>
                    <div>
                      <label className={labelCls}>Email<RequiredDot /></label>
                      <input value={pr.email} onChange={(e) => updatePrincipal(pr.id, "email", e.target.value)} className={pe("email") ? inputErrCls : inputCls} type="email" placeholder="email@example.com" />
                      <FieldError error={pe("email")} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input value={pr.phone} onChange={(e) => updatePrincipal(pr.id, "phone", e.target.value)} className={inputCls} type="tel" placeholder="(555) 123-4567" />
                    </div>
                    <div>
                      <label className={labelCls}>Date of Birth<RequiredDot /></label>
                      <input value={pr.dateOfBirth} onChange={(e) => updatePrincipal(pr.id, "dateOfBirth", e.target.value)} className={pe("dob") ? inputErrCls : inputCls} type="date" />
                      <FieldError error={pe("dob")} />
                    </div>
                    <div>
                      <label className={labelCls}>SSN (last 4)</label>
                      <input
                        value={pr.ssnLast4}
                        onChange={(e) => updatePrincipal(pr.id, "ssnLast4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className={pe("ssn") ? inputErrCls : inputCls}
                        maxLength={4}
                        placeholder="••••"
                      />
                      <FieldError error={pe("ssn")} />
                    </div>
                    <div className="sm:col-span-3">
                      <label className={labelCls}>Address<RequiredDot /></label>
                      <AddressAutocomplete
                        value={pr.addressLine1}
                        onChange={(v) => updatePrincipal(pr.id, "addressLine1", v)}
                        onSelect={(parts) => {
                          updatePrincipal(pr.id, "addressLine1", parts.line1)
                          if (parts.city) updatePrincipal(pr.id, "city", parts.city)
                          if (parts.state) updatePrincipal(pr.id, "state", parts.state)
                          if (parts.zip) updatePrincipal(pr.id, "zip", parts.zip)
                        }}
                        placeholder="Start typing address…"
                      />
                      <FieldError error={pe("address")} />
                    </div>
                    <div>
                      <label className={labelCls}>City<RequiredDot /></label>
                      <input value={pr.city} onChange={(e) => updatePrincipal(pr.id, "city", e.target.value)} className={pe("city") ? inputErrCls : inputCls} placeholder="City" disabled={!!pr.city && !!pr.state} />
                      <FieldError error={pe("city")} />
                    </div>
                    <div>
                      <label className={labelCls}>State<RequiredDot /></label>
                      <select value={pr.state} onChange={(e) => updatePrincipal(pr.id, "state", e.target.value)} className={pe("state") ? selectErrCls : selectCls} disabled={!!pr.state && !!pr.city}>
                        <option value="" className="bg-white">…</option>
                        {US_STATES.map((s) => <option key={s} value={s} className="bg-white">{s}</option>)}
                      </select>
                      <FieldError error={pe("state")} />
                    </div>
                    <div>
                      <label className={labelCls}>ZIP<RequiredDot /></label>
                      <input value={pr.zip} onChange={(e) => updatePrincipal(pr.id, "zip", e.target.value)} className={pe("zip") ? inputErrCls : inputCls} placeholder="12345" disabled={!!pr.zip && !!pr.city} />
                      <FieldError error={pe("zip")} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Store Setup ──

function StoreStep({
  storeName, setStoreName, storeDescription, setStoreDescription,
  logoUrl, setLogoUrl, bannerUrl, setBannerUrl,
  deliveryRadius, setDeliveryRadius,
}: {
  storeName: string; setStoreName: (v: string) => void
  storeDescription: string; setStoreDescription: (v: string) => void
  logoUrl: string; setLogoUrl: (v: string) => void
  bannerUrl: string; setBannerUrl: (v: string) => void
  deliveryRadius: string; setDeliveryRadius: (v: string) => void
}) {
  const { startUpload: uploadLogo, isUploading: logoUploading } = useUploadThing("storeLogo")
  const { startUpload: uploadBanner, isUploading: bannerUploading } = useUploadThing("storeBanner")
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  function resolveUploadUrl(uploaded: { ufsUrl?: string; url?: string; key?: string; appUrl?: string }): string {
    if (uploaded.ufsUrl) return uploaded.ufsUrl
    if (uploaded.appUrl) return uploaded.appUrl
    if (uploaded.key) return `https://utfs.io/f/${uploaded.key}`
    return uploaded.url ?? ""
  }

  async function handleLogoUpload(file: File) {
    try {
      const res = await uploadLogo([file])
      const uploaded = res?.[0]
      if (uploaded) {
        setLogoUrl(resolveUploadUrl(uploaded))
        toast.success("Logo uploaded")
      }
    } catch (e) {
      logError(e, "uploading logo")
      toast.error("Logo upload failed")
    }
  }

  async function handleBannerUpload(file: File) {
    try {
      const res = await uploadBanner([file])
      const uploaded = res?.[0]
      if (uploaded) {
        setBannerUrl(resolveUploadUrl(uploaded))
        toast.success("Banner uploaded")
      }
    } catch (e) {
      logError(e, "uploading banner")
      toast.error("Banner upload failed")
    }
  }

  return (
    <div>
      <SectionTitle icon={Store} title="Store Setup" />
      <p className="text-sm text-gray-500 mb-6">Create your first store. You can add more stores later from your dashboard.</p>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className={labelCls}>Store Name<RequiredDot /></label>
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inputCls} placeholder="Your store's public name" />
        </div>
        <div>
          <label className={labelCls}>Store Description</label>
          <textarea
            value={storeDescription}
            onChange={(e) => setStoreDescription(e.target.value)}
            className={`${inputCls} min-h-[100px] resize-y`}
            placeholder="Describe what your store offers…"
            rows={4}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Store Logo</label>
            {logoUrl ? (
              <div className="mt-1 flex items-center gap-3">
                <div className="relative h-16 w-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                  <Image src={logoUrl} alt="Logo" fill sizes="64px" className="object-cover" />
                </div>
                <button onClick={() => setLogoUrl("")} className="text-xs text-red-600 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="mt-1 flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/40 bg-gray-50 transition-colors cursor-pointer"
              >
                {logoUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <>
                    <ImageIcon className="h-6 w-6 text-gray-500 mb-1" />
                    <span className="text-xs text-gray-500">Click to upload logo</span>
                    <span className="text-[10px] text-gray-600">PNG, JPG up to 2MB</span>
                  </>
                )}
              </button>
            )}
            <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = "" }} />
          </div>
          <div>
            <label className={labelCls}>Store Banner</label>
            {bannerUrl ? (
              <div className="mt-1">
                <div className="relative h-24 w-full rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  <Image src={bannerUrl} alt="Banner" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
                </div>
                <button onClick={() => setBannerUrl("")} className="mt-1 text-xs text-red-600 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
                className="mt-1 flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/40 bg-gray-50 transition-colors cursor-pointer"
              >
                {bannerUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <>
                    <ImageIcon className="h-6 w-6 text-gray-500 mb-1" />
                    <span className="text-xs text-gray-500">Click to upload banner</span>
                    <span className="text-[10px] text-gray-600">PNG, JPG up to 4MB</span>
                  </>
                )}
              </button>
            )}
            <input ref={bannerInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); e.target.value = "" }} />
          </div>
        </div>
        <div className="max-w-xs">
          <label className={labelCls}>Delivery Radius (miles)</label>
          <input
            value={deliveryRadius}
            onChange={(e) => setDeliveryRadius(e.target.value)}
            className={inputCls}
            placeholder="25"
            type="number"
            min="0"
            max="500"
          />
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Documents ──

function DocumentsStep({
  entityType,
  documents,
  onDocumentUploaded,
  onRemove,
}: {
  entityType: string
  documents: OnboardingDocument[]
  onDocumentUploaded: (docType: string, fileUrl: string, fileName: string, fileSize: number, mimeType: string) => void
  onRemove: (id: string) => void
}) {
  const slots = getRequiredDocuments(entityType)
  const { startUpload, isUploading: _isUploading } = useUploadThing("sellerDocument")
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)

  if (!entityType) {
    return (
      <div>
        <SectionTitle icon={FileText} title="Verification Documents" />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500/60 mb-4" />
          <p className="text-gray-500 text-sm">
            Please go back to Step 1 and select your entity type first.
          </p>
        </div>
      </div>
    )
  }

  const enrichedSlots = slots.map((slot) => ({
    ...slot,
    uploaded: documents.find((d) => d.documentType === slot.type),
  }))

  function resolveUrl(u: { ufsUrl?: string; url?: string; key?: string; appUrl?: string }): string {
    if (u.ufsUrl) return u.ufsUrl
    if (u.appUrl) return u.appUrl
    if (u.key) return `https://utfs.io/f/${u.key}`
    return u.url ?? ""
  }

  async function handleUpload(docType: string, file: File) {
    setUploadingSlot(docType)
    try {
      const res = await startUpload([file])
      const uploaded = res?.[0]
      if (uploaded) {
        onDocumentUploaded(docType, resolveUrl(uploaded), uploaded.name, uploaded.size, uploaded.type ?? "application/octet-stream")
      }
    } catch (e) {
      logError(e, "uploading document")
      toast.error("Upload failed")
    } finally {
      setUploadingSlot(null)
    }
  }

  return (
    <div>
      <SectionTitle icon={FileText} title="Verification Documents" />
      <p className="text-sm text-gray-500 mb-2">
        Upload the required documents for your{" "}
        <span className="text-gray-900 font-medium">{ENTITY_TYPES.find((t) => t.value === entityType)?.label}</span> entity.
      </p>
      <p className="text-xs text-gray-500 mb-6">
        Documents are used for KYC verification by our admin team. Stripe Connect will also verify your identity separately.
      </p>

      <div className="space-y-4">
        {enrichedSlots.map((slot) => {
          const isImage = slot.uploaded?.mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(slot.uploaded?.fileName ?? "")
          return (
            <div
              key={slot.type}
              className={`rounded-xl border p-4 ${slot.uploaded ? "border-green-500/30 bg-green-500/[0.03]" : BORDER}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{slot.label}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${slot.required ? "bg-red-500/10 text-red-600" : "bg-gray-50 text-gray-500"}`}>
                      {slot.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  {slot.uploaded && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span className="text-xs text-green-400 truncate">{slot.uploaded.fileName}</span>
                      <a href={slot.uploaded.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-1">View</a>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {slot.uploaded ? (
                    <button
                      onClick={() => onRemove(slot.uploaded!.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  ) : (
                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                      {uploadingSlot === slot.type ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload className="h-3 w-3" /> Upload</>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        disabled={uploadingSlot === slot.type}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(slot.type, file)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              {slot.uploaded && isImage && slot.uploaded.fileUrl && (
                <div className="mt-3">
                  <div className="relative h-40 w-full">
                    <Image
                      src={slot.uploaded.fileUrl}
                      alt={slot.uploaded.fileName}
                      fill
                      sizes="(max-width: 768px) 100vw, 640px"
                      className="rounded-lg border border-gray-200 object-contain bg-black/20"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 4: Subscription Plan ──

function SubscriptionStep({
  plans,
  selectedPlan,
  setSelectedPlan,
  currentPlan,
}: {
  plans: SubscriptionPlan[]
  selectedPlan: string
  setSelectedPlan: (v: string) => void
  currentPlan: string | null
}) {
  const activePlan = selectedPlan || currentPlan

  return (
    <div>
      <SectionTitle icon={CreditCard} title="Choose Your Plan" />
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-400">Your first month is free!</p>
            <p className="text-xs text-green-400/70 mt-0.5">
              List 9+ products in your first month and get your second month free too.
              Billing begins after the trial period using the payment method you set up in the next step.
            </p>
          </div>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500 mr-2" />
          <span className="text-sm text-gray-500">Loading plans…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isSelected = activePlan === plan.slug
            const isPopular = plan.slug === "growth"
            const priceDisplay = `$${(plan.priceCentsPerMonth / 100).toFixed(2)}`
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.slug)}
                className={`relative rounded-2xl border p-5 text-left transition-all hover:scale-[1.02] ${
                  isSelected ? "border-primary ring-1 ring-primary" : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ background: isSelected ? "rgba(var(--primary-rgb, 124,58,237),0.05)" : undefined }}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                    <Sparkles className="h-3 w-3" /> Popular
                  </div>
                )}
                <div className="mb-4 mt-1">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  {plan.description && <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>}
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-extrabold text-gray-900">{priceDisplay}</span>
                  <span className="text-sm text-gray-500">/mo</span>
                </div>
                <p className="text-[10px] text-green-400 mb-4">Free for your first month</p>
                <ul className="space-y-2 mb-5">
                  <li className="flex items-center gap-2 text-xs text-gray-500">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    Up to {plan.maxProducts.toLocaleString()} products
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-500">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {plan.maxStores} store{plan.maxStores > 1 ? "s" : ""}
                  </li>
                  {plan.commissionRateOverride !== null && (
                    <li className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      {plan.commissionRateOverride}% commission rate
                    </li>
                  )}
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div
                  className={`w-full rounded-xl py-2 text-center text-sm font-bold transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {isSelected ? "Selected" : "Choose Plan"}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Step 5: Payment Setup (Stripe Connect + Payment Method) ──

function PaymentSetupStep({
  stripe,
  onSetupConnect,
  onConfirmPaymentMethod,
  saving,
}: {
  stripe: OnboardingProgress["stripe"] | null
  onSetupConnect: () => Promise<boolean>
  onConfirmPaymentMethod: (pmId: string) => void
  saving: boolean
}) {
  const connectDone = stripe?.chargesEnabled && stripe?.payoutsEnabled
  const hasPaymentMethod = stripe?.hasPaymentMethod

  return (
    <div>
      <SectionTitle icon={Wallet} title="Payment Setup" />
      <p className="text-sm text-gray-500 mb-6">
        Two things are needed: (1) a Stripe Connect account so you can <strong className="text-gray-900">receive payouts</strong> from sales,
        and (2) a payment method so we can <strong className="text-gray-900">bill your subscription</strong> after the free trial.
      </p>

      {/* Section 1: Stripe Connect */}
      <div
        className={`rounded-xl border p-6 mb-6 ${connectDone ? "border-green-500/30" : BORDER}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${connectDone ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"}`}>
            {connectDone ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <h3 className="text-base font-semibold text-gray-900">Stripe Connect — Receive Payouts</h3>
        </div>

        {connectDone ? (
          <div className="flex flex-wrap gap-3 pl-11">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Charges Enabled
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Payouts Enabled
            </span>
          </div>
        ) : (
          <div className="pl-11">
            <p className="text-sm text-gray-500 mb-4">
              You&apos;ll be redirected to Stripe to complete identity verification and bank account details.
            </p>

            {stripe?.stripeAccountId && (
              <div className="flex flex-wrap gap-3 mb-4">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${stripe.chargesEnabled ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  {stripe.chargesEnabled ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  Charges {stripe.chargesEnabled ? "Enabled" : "Pending"}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${stripe.payoutsEnabled ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  {stripe.payoutsEnabled ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  Payouts {stripe.payoutsEnabled ? "Enabled" : "Pending"}
                </span>
              </div>
            )}

            <button
              onClick={onSetupConnect}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#635BFF] px-6 py-3 text-sm font-bold text-white hover:bg-[#5851DB] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
              ) : (
                <>{stripe?.stripeAccountId ? "Continue Stripe Setup" : "Connect Stripe Account"} <ExternalLink className="h-4 w-4" /></>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Payment Method */}
      <div
        className={`rounded-xl border p-6 ${hasPaymentMethod ? "border-green-500/30" : BORDER}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${hasPaymentMethod ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"}`}>
            {hasPaymentMethod ? <Check className="h-4 w-4" /> : "2"}
          </div>
          <h3 className="text-base font-semibold text-gray-900">Payment Method — Subscription Billing</h3>
        </div>

        {hasPaymentMethod ? (
          <div className="pl-11">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-400">Payment method saved. Your card will be charged after the free trial period ends.</p>
            </div>
          </div>
        ) : (
          <div className="pl-11">
            {!stripe?.stripeCustomerId ? (
              <p className="text-sm text-gray-500">
                Complete Stripe Connect setup first. A payment form will appear here once your account is ready.
              </p>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  Add a card that will be charged for your subscription after the free trial period.
                  Your card will <strong className="text-gray-900">not</strong> be charged during the trial.
                </p>
                <PaymentMethodForm
                  setupIntentSecret={stripe?.setupIntentClientSecret ?? null}
                  onConfirm={onConfirmPaymentMethod}
                  saving={saving}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// ── Step 6: Review & Submit ──

function ReviewStep({
  businessName, entityType, businessType, taxId, contactPhone, contactEmail,
  website, businessDescription, addressLine1, addressLine2, city, state, zip, country,
  industryCategory, annualRevenue, numberOfEmployees,
  dateOfBirth, ssnLast4, ein, stateOfIncorporation, formationDate, dbaName,
  principals,
  storeName, storeDescription, logoUrl, bannerUrl, deliveryRadius,
  documents, subscription, stripe, completionChecks,
}: {
  businessName: string; entityType: string; businessType: string; taxId: string
  contactPhone: string; contactEmail: string; website: string; businessDescription: string
  addressLine1: string; addressLine2: string; city: string; state: string; zip: string; country: string
  industryCategory: string; annualRevenue: string; numberOfEmployees: string
  dateOfBirth: string; ssnLast4: string; ein: string
  stateOfIncorporation: string; formationDate: string; dbaName: string
  principals: Principal[]
  storeName: string; storeDescription: string; logoUrl: string; bannerUrl: string; deliveryRadius: string
  documents: OnboardingDocument[]
  subscription: OnboardingProgress["subscription"] | undefined | null
  stripe: OnboardingProgress["stripe"] | null
  completionChecks: Record<string, boolean>
}) {
  const checks = [
    { key: "business", label: "Business Information", done: completionChecks.business },
    { key: "entity", label: "Entity & Identity Verification", done: completionChecks.entity },
    { key: "store", label: "Store Setup", done: completionChecks.store },
    { key: "documents", label: "Verification Documents", done: completionChecks.documents },
    { key: "subscription", label: "Subscription Plan", done: completionChecks.subscription },
    { key: "payment", label: "Payment Setup", done: completionChecks.stripe || completionChecks.payment },
  ]

  const allComplete = checks.every((c) => c.done)

  return (
    <div>
      <SectionTitle icon={CheckCircle2} title="Review & Submit" />

      <div className={`rounded-xl border ${BORDER} p-4 mb-6`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Completion Checklist</h3>
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.key} className="flex items-center gap-2.5">
              {c.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
              )}
              <span className={`text-sm ${c.done ? "text-gray-600" : "text-yellow-400"}`}>{c.label}</span>
              {!c.done && <span className="text-[10px] text-yellow-500/70 font-medium uppercase tracking-wider">Incomplete</span>}
            </div>
          ))}
        </div>
        {!allComplete && (
          <p className="mt-3 text-xs text-yellow-500/80 border-t border-gray-100 pt-3">
            Please complete all required steps before submitting your application.
          </p>
        )}
      </div>

      <div className="space-y-6">
        <ReviewSection title="Business Information">
          <ReviewRow label="Business Name" value={businessName} />
          <ReviewRow label="Entity Type" value={ENTITY_TYPES.find((t) => t.value === entityType)?.label ?? entityType} />
          <ReviewRow label="Business Type" value={BUSINESS_TYPES.find((t) => t.value === businessType)?.label} />
          <ReviewRow label="Industry" value={industryCategory} />
          <ReviewRow label="Tax ID" value={taxId} />
          <ReviewRow label="Phone" value={contactPhone} />
          <ReviewRow label="Email" value={contactEmail} />
          <ReviewRow label="Website" value={website} />
          <ReviewRow label="Description" value={businessDescription} />
          <ReviewRow label="Annual Revenue" value={annualRevenue} />
          <ReviewRow label="Employees" value={numberOfEmployees} />
          <ReviewRow
            label="Address"
            value={[addressLine1, addressLine2, [city, state, zip].filter(Boolean).join(", "), country].filter(Boolean).join(", ")}
          />
        </ReviewSection>

        <ReviewSection title="Entity & Identity">
          {dateOfBirth && <ReviewRow label="Date of Birth" value={dateOfBirth} />}
          {ssnLast4 && <ReviewRow label="SSN (last 4)" value={`••••${ssnLast4}`} />}
          {ein && <ReviewRow label="EIN" value={ein} />}
          {stateOfIncorporation && <ReviewRow label="State of Incorporation" value={stateOfIncorporation} />}
          {formationDate && <ReviewRow label="Formation Date" value={formationDate} />}
          {dbaName && <ReviewRow label="DBA Name" value={dbaName} />}
          {principals.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-2">Beneficial Owners / Officers:</p>
              {principals.map((pr, i) => (
                <div key={pr.id} className="text-xs text-gray-500 mb-1">
                  {i + 1}. {pr.firstName} {pr.lastName} — {pr.title || pr.role} ({pr.ownershipPct}%)
                </div>
              ))}
            </div>
          )}
        </ReviewSection>

        <ReviewSection title="Store">
          <ReviewRow label="Store Name" value={storeName} />
          <ReviewRow label="Description" value={storeDescription} />
          <ReviewRow label="Logo" value={logoUrl} />
          <ReviewRow label="Banner" value={bannerUrl} />
          <ReviewRow label="Delivery Radius" value={deliveryRadius ? `${deliveryRadius} miles` : undefined} />
        </ReviewSection>

        <ReviewSection title="Documents">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded</p>
          ) : (
            documents.map((d) => (
              <ReviewRow key={d.id} label={d.documentType.replace(/_/g, " ")} value={d.fileName} />
            ))
          )}
        </ReviewSection>

        <ReviewSection title="Subscription">
          <ReviewRow label="Plan" value={subscription?.planName ?? "Not selected"} />
          {subscription && (
            <ReviewRow
              label="Monthly Price"
              value={`$${(subscription.priceCentsPerMonth / 100).toFixed(2)} (first month free)`}
            />
          )}
        </ReviewSection>

        <ReviewSection title="Payment Setup">
          <ReviewRow label="Stripe Connect" value={stripe?.chargesEnabled ? "Connected" : "Pending"} />
          <ReviewRow label="Payment Method" value={stripe?.hasPaymentMethod ? "Card on file" : "Not added"} />
        </ReviewSection>
      </div>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border ${BORDER} p-4`}>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 text-sm">
      <span className="text-gray-500 sm:w-40 shrink-0">{label}</span>
      <span className="text-gray-600 break-all">{value}</span>
    </div>
  )
}
