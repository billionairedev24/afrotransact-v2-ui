# AfroTransact AI Integration Plan

## Vision

AfroTransact becomes the first African diaspora marketplace with a truly intelligent shopping experience. Customers speak, type, or describe what they want in any language — the AI understands, finds it, and handles the entire journey from discovery to checkout. Sellers get an AI business partner that helps them grow.

---

## 1. Architecture Overview

### New Service: `services/ai`

A dedicated **Python FastAPI** microservice added to the existing stack, sitting alongside `search` and `review` (both already Python). It is the single brain of all AI features — all UI-facing AI calls flow through it.

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js UI (port 3001)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  AI Widget  │  │  AI Search  │  │  Voice Input    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────────┘ │
│         └────────────────┼────────────────┘             │
│                          ▼                               │
│           Next.js API route /api/ai/*                    │
│           (thin proxy, injects auth token)               │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP/SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│               AI Service  (port 8091)                   │
│               Python FastAPI                            │
│                                                         │
│  ┌───────────────────┐   ┌───────────────────────────┐ │
│  │  Chat Engine      │   │  Voice Pipeline           │ │
│  │  (Gemini Tools)   │   │  (Gemini Live API /       │ │
│  │                   │   │   Web Speech fallback)    │ │
│  └─────────┬─────────┘   └───────────────────────────┘ │
│            │                                            │
│  ┌─────────▼──────────────────────────────────────┐    │
│  │          Tool Executor                          │    │
│  │  searchProducts · addToCart · getOrder          │    │
│  │  getProductDetail · getDeals · trackOrder       │    │
│  │  getSuggestions · getReviews · validateCoupon   │    │
│  └─────────┬───────────────────────────────────────┘    │
│            │                                            │
│  ┌─────────▼──────────┐   ┌────────────────────────┐   │
│  │  Memory Store      │   │  Embeddings Engine     │   │
│  │  Redis (session)   │   │  pgvector + Google     │   │
│  │  PG (prefs long)   │   │  text-embedding-004    │   │
│  └────────────────────┘   └────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                     │ calls existing APIs
                     ▼
        ┌─────────── API Gateway (port 8080) ────────────┐
        │  search · catalog · order · cart · review      │
        └────────────────────────────────────────────────┘
```

### Why Python FastAPI?
- Consistent with existing `search` (Python) and `review` (Python async) services
- Native async support — essential for LLM streaming
- First-class `google-genai` SDK support
- SSE streaming via FastAPI's `StreamingResponse`
- pgvector Python client for embeddings

### Database Additions
- `ai` PostgreSQL schema (same PG instance, new schema)
- Tables: `conversations`, `messages`, `user_preferences`, `product_embeddings`, `price_alerts`, `usage_log`
- Redis namespace `ai:` for ephemeral conversation context (24h TTL)
- `pgvector` extension on PostgreSQL for semantic product search

---

## 2. Google AI Studio

### What It Is

**Google AI Studio** (`aistudio.google.com`) is Google's browser-based developer platform for building with Gemini models. It is **not** a library or an SDK — it is the control plane and development environment for the entire AI feature set. Think of it as the cockpit before any code is written.

### Role in This Project

#### 2.1 API Key Management

Every call the AI service makes to Gemini goes through a `GOOGLE_API_KEY`. This key is created and managed in Google AI Studio:

```
aistudio.google.com → "Get API key" → Create key in project
→ GOOGLE_API_KEY=AIza...  (goes into services/ai/.env)
```

There is no other way to obtain a Gemini API key for local/production use. Google AI Studio is the sole issuer.

#### 2.2 Prompt & System Instruction Prototyping

Before writing a single line of Python, every Afrobi prompt is developed and validated in the AI Studio playground:

- **System instruction editor** — write and iterate Afrobi's personality, rules, and user context template with live Gemini responses
- **Multi-turn conversation tester** — simulate a full shopping conversation, including tool calls, before committing to code
- **Model switcher** — compare Flash vs Flash-Lite vs Pro 2.5 responses side by side for the same prompt, then pick the right model per feature

This means the system prompt and tool schemas in the codebase start as validated AI Studio exports, not guesses.

#### 2.3 Function Calling (Tool) Schema Editor

AI Studio has a drag-and-drop tool schema builder under the "Tools" tab of the playground. All 12 Afrobi tools (search, cart, orders, etc.) are built and tested here first:

- Define function name, description, and parameters
- Run live calls against Gemini in the playground
- See exactly what JSON the model returns for each tool invocation
- Validate that Gemini reliably picks the right tool for each type of user message
- Export the validated schema as Python code — paste directly into `engine/tools.py`

#### 2.4 Grounding with Google Search

Gemini has a built-in **Google Search grounding** feature. When enabled, it automatically pulls real-time web results to supplement its answers. For Afrobi this is useful for:

- *"Is ogiri vegan?"* → grounds with food/nutrition sources
- *"Is this ingredient halal?"* → grounds with authoritative Islamic food guidance
- *"What is dawadawa used for in cooking?"* → grounds with recipe/food databases

Grounding is toggled per request in AI Studio and in the SDK call. We enable it specifically for the `ask_about_product` feature (product page Q&A) where factual accuracy about food/ingredients matters most. It is turned off for cart/order tool-calling flows (no need for web search when calling our own APIs).

#### 2.5 Audio & Multimodal Testing

Before implementing the voice shopping pipeline, the full voice flow is tested in AI Studio's multimodal playground:

- Upload a voice recording in French, Amharic, or accented English → verify Gemini transcribes and responds correctly
- Test image input (future: visual product search — upload a photo, find similar products) in the playground before building the feature

This de-risks the voice pipeline before any integration work is done.

#### 2.6 Fine-Tuning (Phase 3+)

AI Studio provides a supervised fine-tuning UI. After launch, we can fine-tune a Flash model on:

- AfroTransact-specific product query/response pairs (e.g., correct handling of African ingredient names, diaspora slang for products)
- High-quality seller product descriptions (teach the model to write like our best sellers)
- Platform-specific conversation examples (tone, cultural expressions)

Fine-tuned models are hosted by Google and called with a tuned model ID — no infrastructure change needed.

#### 2.7 Usage Dashboard & Cost Monitoring

AI Studio's dashboard shows:
- Token usage per model per day
- Request counts and latency
- Error rates by endpoint
- Cost estimates (before committing to Google Cloud billing)

During development, this replaces the need for a custom `ai.usage_log` table — switch to the PostgreSQL log only in production for per-user granularity.

#### 2.8 Workflow: AI Studio → Code

```
AI Studio (prototype)          →     services/ai (production)
─────────────────────────────────────────────────────────────
System instruction editor      →     engine/gemini.py SYSTEM_PROMPT
Function schema builder        →     engine/tools.py TOOLS list
Playground conversation tests  →     integration tests in tests/
Model comparison               →     config.py MODEL_ROUTING dict
Grounding config               →     per-request grounding flag
Fine-tuned model ID            →     config.py TUNED_MODEL_ID
API key                        →     .env GOOGLE_API_KEY
```

---

## 3. Core AI Engine

### Models: Gemini 2.0 Flash Family

All AI features run on a single provider (Google). Model selection is routed by task complexity:

| Task | Model | Reason |
|------|-------|--------|
| Simple tool-only queries (search, cart check, track order) | `gemini-2.0-flash-lite` | Cheapest, fastest, sufficient for structured tool calls |
| Main conversational chat (Afrobi widget, smart search) | `gemini-2.0-flash` | Primary workhorse — fast, intelligent, multimodal |
| Voice input (real-time audio) | `gemini-2.0-flash` Live API | Handles raw audio natively, no separate transcription step |
| Seller coach, pricing analysis, complex reasoning | `gemini-2.5-pro` | When depth and multi-step reasoning matter |
| Embeddings (all features) | `text-embedding-004` | Google's best embedding model, generous free tier |

**No Whisper API needed.** Gemini 2.0 Flash accepts audio directly — one fewer external dependency, one fewer API key, lower latency on voice.

### SDK

```python
# requirements.txt
google-genai>=1.0.0       # Unified Google AI SDK (replaces google-generativeai)
```

```python
# engine/gemini.py
from google import genai
from google.genai import types

client = genai.Client(api_key=settings.GOOGLE_API_KEY)
```

### Gemini Tool Calling

The AI engine is tool-enabled. Gemini decides which tools to invoke based on user intent. Tools are thin wrappers around the existing API gateway.

```python
# engine/tools.py

TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="search_products",
            description=(
                "Search AfroTransact for products by keyword, category, price range, "
                "dietary needs, or cultural preference. Use this whenever the user wants "
                "to find, browse, or compare products."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query":        types.Schema(type="STRING"),
                    "category":     types.Schema(type="STRING"),
                    "min_price":    types.Schema(type="NUMBER"),
                    "max_price":    types.Schema(type="NUMBER"),
                    "in_stock_only":types.Schema(type="BOOLEAN"),
                    "sort_by":      types.Schema(type="STRING",
                                        enum=["relevance","price_asc","price_desc","rating","newest"]),
                    "size":         types.Schema(type="INTEGER"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="get_product_detail",
            description="Fetch full details of a specific product including variants, images, and store info.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"product_id": types.Schema(type="STRING")},
                required=["product_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="add_to_cart",
            description="Add a product variant to the user's cart. Always confirm product name and price with the user before calling this.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "product_id":  types.Schema(type="STRING"),
                    "variant_id":  types.Schema(type="STRING"),
                    "quantity":    types.Schema(type="INTEGER"),
                },
                required=["product_id", "variant_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_cart",
            description="Get the user's current cart contents and total.",
        ),
        types.FunctionDeclaration(
            name="get_orders",
            description="Retrieve the user's order history.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "page":          types.Schema(type="INTEGER"),
                    "status_filter": types.Schema(type="STRING"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="track_order",
            description="Get real-time tracking status for a specific order by order number.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"order_number": types.Schema(type="STRING")},
                required=["order_number"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_deals",
            description="Fetch current active deals and promotions on the platform.",
        ),
        types.FunctionDeclaration(
            name="get_stores",
            description="Find stores by name, location, or category. Good for discovering immigrant-owned stores.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query":    types.Schema(type="STRING"),
                    "category": types.Schema(type="STRING"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="get_product_reviews",
            description="Get reviews for a specific product to help the user make a purchase decision.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"product_id": types.Schema(type="STRING")},
                required=["product_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="validate_coupon",
            description="Check if a coupon code is valid and what discount it applies.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"code": types.Schema(type="STRING")},
                required=["code"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_shipping_quote",
            description="Get shipping cost and estimated delivery time for the user's cart to their address.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"address_id": types.Schema(type="STRING")},
            ),
        ),
        types.FunctionDeclaration(
            name="save_preference",
            description="Save a long-term preference for the user, like dietary needs, cultural preferences, or favorite categories.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "key":   types.Schema(type="STRING"),
                    "value": types.Schema(type="STRING"),
                },
                required=["key", "value"],
            ),
        ),
    ]
)
```

### System Instruction (Base)

```
You are Afrobi — the AI shopping assistant for AfroTransact, the marketplace for African and immigrant-owned stores.

You help customers:
- Find products (groceries, spices, clothing, beauty, home goods — authentic African and diaspora products)
- Make purchase decisions with honest, helpful advice
- Manage their cart and orders
- Discover stores and deals

PERSONALITY:
- Warm, enthusiastic, culturally aware
- Use light Afro-cultural expressions naturally ("Oya, let's find that!", "No wahala!")
- Never condescending — match the user's tone and language
- Proactive: when you find products, show them. Don't just describe — act.

RULES:
- Never invent product names, prices, or availability — always use tools
- When adding to cart, confirm product name + price before calling add_to_cart
- If unsure what the user wants, ask ONE clarifying question
- Respond in whatever language the user writes in (English, French, Amharic, Somali, Arabic, Yoruba, etc.)
- For logged-out users, still help with search and discovery — just tell them they'll need to sign in to add to cart or view orders

USER CONTEXT:
{user_context}

USER PREFERENCES:
{user_preferences}
```

> This exact system instruction is developed and validated in Google AI Studio before being committed to code.

### Streaming Chat Loop

```python
# engine/gemini.py

async def stream_chat(
    user_message: str,
    history: list[dict],
    user_id: str | None,
    grounding: bool = False,
) -> AsyncIterator[dict]:
    config = types.GenerateContentConfig(
        system_instruction=build_system_prompt(user_id),
        tools=[TOOLS] + ([types.Tool(google_search=types.GoogleSearch())] if grounding else []),
        temperature=0.7,
    )

    contents = history_to_contents(history) + [
        types.Content(role="user", parts=[types.Part(text=user_message)])
    ]

    async for chunk in await client.aio.models.generate_content_stream(
        model=route_model(user_message),
        contents=contents,
        config=config,
    ):
        if chunk.candidates[0].content.parts[0].function_call:
            fc = chunk.candidates[0].content.parts[0].function_call
            result = await execute_tool(fc.name, fc.args, user_id)
            yield {"type": "tool_result", "tool": fc.name, "data": result}
        else:
            yield {"type": "text_delta", "delta": chunk.text}
```

---

## 4. Feature Set

### 4.1 Text Shopping (AI Chat Widget)

**Where:** Floating widget, bottom-right of every page on the main storefront layout.

**What it does:**
- Natural language product search: *"I need suya spice and some zobo leaves"*
- Cart management: *"Add the second one to my cart"*
- Order tracking: *"Where is my last order?"*
- Price hunting: *"Find me palm oil under $10"*
- Dietary/cultural filters: *"Show me only halal snacks"*
- Store discovery: *"Which stores sell Ethiopian injera?"*
- Deal hunting: *"Is there anything on sale from Nigerian stores?"*
- Checkout help: *"What coupon codes work right now?"*
- Post-purchase: *"Can I return the item I ordered last Tuesday?"*

**UI Design:**
- Minimized: pulsing Afrobi avatar badge, bottom-right corner
- Expanded: slide-up panel (400px wide on desktop, full-width drawer on mobile)
- Chat bubbles with product cards rendered inline (image, title, price, "Add to Cart" button)
- Typing indicator while Gemini processes
- Streaming responses (characters appear in real time via SSE)
- Message history persisted per session (Redis, 24h)
- Quick-reply chips: *"Find deals" · "Track my order" · "What's popular?"*

**Product cards in chat:** When Gemini calls `search_products`, the tool result includes rich product data. The UI renders these as mini-cards inline in the chat — tappable, with add-to-cart directly from the chat panel.

---

### 4.2 Voice Shopping

**Where:**
1. Search bar (mic button alongside the text field)
2. AI chat widget (mic button to speak instead of type)
3. Dedicated voice-first page: `/shop/voice` (immersive fullscreen experience)

**Pipeline:**

```
User speaks
    ↓
Browser Web Speech API (instant, zero latency, no API cost — primary path)
    ↓ [fallback when browser API unavailable or accuracy matters]
Gemini 2.0 Flash Live API (raw audio stream → real-time response)
— no separate transcription step, no Whisper needed —
    ↓
Response rendered as text + optional text-to-speech
    ↓
Browser Web Speech Synthesis API (reads response aloud in voice mode)
OR Gemini native audio output (experimental — Flash can generate audio directly)
```

**Why no Whisper:** Gemini 2.0 Flash accepts raw audio as a native input modality. It transcribes and reasons in a single model call. The Gemini Live API also supports real-time bidirectional audio streaming — send audio chunks as they are recorded, receive response chunks as they are generated. This is lower latency than Whisper → separate LLM call.

**Voice modes:**
1. **Tap-to-speak:** User taps mic, speaks, releases — standard voice input replacement
2. **Hands-free mode:** On `/shop/voice`, continuous listening with wake phrase *"Hey Afrobi"* via Web Speech API continuous recognition
3. **Ambient voice shopping:** Full voice loop — Gemini speaks results aloud, user responds by voice, no screen interaction needed

**Language detection:** Gemini auto-detects the spoken language and responds in kind. Supports 100+ languages including French, Somali, Amharic, Arabic, Yoruba, Hausa.

**The `/shop/voice` experience:**
- Dark, immersive full-screen page
- Large animated Afrobi avatar (waveform-reactive via Framer Motion)
- *"Tell me what you're looking for"* spoken prompt on load
- Spoken response + visual product grid appears simultaneously
- User says *"add the first one"* → cart update confirmed verbally + visually
- *"Checkout"* → navigates to `/checkout`

---

### 4.3 AI-Enhanced Search Bar (Smart Search)

Enhances the existing search bar (`/search` page) with Gemini interpretation — not replacement.

**Features:**
- **Intent parsing:** *"cheap jollof rice ingredients"* → parses into category + max_price + multiple keywords → runs optimized Elasticsearch query
- **Spelling tolerance beyond Elasticsearch:** *"suya spise"* → Gemini normalizes before querying
- **Cultural synonym mapping:** *"egusi"* ↔ *"melon seeds"*, *"dawadawa"* ↔ *"locust beans"* — Gemini knows African ingredient names and maps them to how sellers may have listed products
- **Suggested refinements:** After results load, AI chips appear: *"Only in-stock" · "Under $15" · "From Nigerian stores"* — clicking re-runs with added filters
- **Zero-results recovery:** If Elasticsearch returns nothing, Gemini re-interprets and tries an alternative query, then explains what it searched for

**Implementation:** `POST /api/ai/search/enhance` takes the raw query and returns structured search params + alternative queries. Adds ~150ms but dramatically improves zero-result rates.

---

### 4.4 AI Product Page Features

**Review Summaries**

On every product page, below the reviews section:

```
┌──────────────────────────────────────────────────┐
│  ✦ AI Summary  (based on 47 reviews)             │
│                                                   │
│  ★ Customers love the authentic flavor and       │
│    quick shipping from this store.                │
│  ⚠  A few noted the packaging could be better    │
│    for preventing spills.                         │
│  ✓  91% would recommend this product.            │
└──────────────────────────────────────────────────┘
```

Generated server-side on first request, cached in Redis (24h), invalidated when new reviews arrive (Kafka event from review service triggers regeneration).

**"Ask About This Product" (with Google Search Grounding)**

On every product page, a button that opens the AI widget pre-loaded with context about the current product. Google Search grounding is enabled for this mode:

- *"Is this halal?"* → Gemini grounds with Islamic food authority sources
- *"Is ogiri vegan?"* → grounds with food/nutrition databases
- *"How do I use dawadawa in cooking?"* → grounds with recipe sites
- *"How spicy is this compared to regular cayenne?"* → grounds + uses product description

**"Pairs With" Recommendations**

Below product images: *"Afrobi suggests pairing with:"* — semantic recommendations using `text-embedding-004` pgvector cosine similarity. Complementary category mapping + same-store products.

---

### 4.5 Personalization Engine

**User preference learning:**
- First AI chat session: *"Quick question — any dietary preferences? (Halal, Vegan, Kosher, etc.)"*
- Preferences stored in `ai.user_preferences`, loaded into every system instruction
- Implicit learning: track which search results the user clicks → feed into next session's context

**Personalized homepage AI section:**

```
┌─────────────────────────────────────────────────┐
│  Picked for you, [Name]                         │
│  Based on your recent orders and preferences    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │    │ │    │ │    │ │    │ │    │            │
│  └────┘ └────┘ └────┘ └────┘ └────┘            │
└─────────────────────────────────────────────────┘
```

Powered by: order history → extract product IDs → `text-embedding-004` similarity → ranked by preference match.

---

### 4.6 AI Price Alert / Wishlist Intelligence

On any product page, logged-in users can click *"Alert me"*:
- *"Notify me when this drops below $[X]"*
- *"Tell me when this is back in stock"*
- Gemini writes the alert email in the user's preferred language with Afrobi's tone

Stored in `ai.price_alerts`. A Kafka consumer in the AI service checks alerts when `ProductUpdated` / `InventoryUpdated` events fire. Sends via the existing notification service.

---

### 4.7 AI Checkout Assistant

Inline hint bar during checkout steps — dismissible info cards, not modals:

**Address step:** *"Based on your last 3 orders, you usually ship to Austin, TX. Want to use that?"*

**Shipping step:** *"Standard shipping (3–5 days) saves you $8 vs express for this cart. Recommend it?"*

**Review step:** *"You have a valid coupon WELCOME10 that saves you $4.72. Apply it?"* — auto-surfaced via `validate_coupon` tool.

---

### 4.8 Seller AI Assistant

Available in the seller dashboard (`/dashboard`) for approved sellers.

1. **AI Product Writer:** Seller fills in basic product details → Gemini writes a compelling title, SEO-optimized description, and suggests the right categories. Inline in the create/edit product form — one click, editable before saving.

2. **Pricing Intelligence:** *"Your Suya Spice Mix is priced $2 below the category average. 8 similar products sell for $8–$12. Consider adjusting?"*

3. **Sales Coach (AI Chat):**
   - *"Why are my sales down this week?"* → Gemini (Pro) analyzes seller analytics
   - *"What products should I add?"* → based on platform search trends
   - *"Write a deal description for my weekend sale"* → copy generation

4. **Inventory Velocity Alerts:** *"3 products will go out of stock in under 2 weeks at current sales rate"*

5. **Review Response Drafter:** One-click AI draft response to any customer review — seller edits and posts.

---

### 4.9 Multilingual Support

- Gemini natively handles 100+ languages: English, French, Arabic, Amharic, Somali, Yoruba, Hausa, Swahili, and more
- Gemini Live API transcribes spoken audio in any of these languages
- System instruction tells Gemini to respond in the user's detected language
- `Accept-Language` header passed as a context hint to the AI service
- No hardcoded translation files — Gemini adapts dynamically

---

### 4.10 Admin AI

The admin dashboard (`/admin`) gets a dedicated AI layer purpose-built for platform operators. Unlike buyer and seller AI which is customer-facing, admin AI is an **operations intelligence** tool — it turns raw platform data into decisions.

#### 4.10.1 Platform Analytics Chat

**Where:** Persistent chat panel in the admin dashboard sidebar, available on all `/admin` routes.

Admins ask questions in plain English against the full platform dataset:

- *"Why did revenue drop 23% in Austin last week?"*
- *"Which sellers have the highest refund rates this month?"*
- *"What is the conversion rate difference between buyers who used the AI widget vs those who didn't?"*
- *"Show me the top 10 products by revenue in Q1"*
- *"Which regions are growing fastest?"*

Gemini Pro is used here — multi-step reasoning over analytics API data is the task that most justifies it. The AI calls admin analytics tools, cross-references the results, and responds with a structured answer + follow-up suggestions.

**Admin-specific tools added to the tool executor:**
```
get_platform_analytics   → revenue, GMV, orders, conversion by date range / region
get_seller_performance   → per-seller revenue, refund rate, order count, review score
get_search_gaps          → zero-result search queries grouped by theme
get_admin_alerts         → unresolved fraud and anomaly alerts
get_content_flags        → products flagged by moderation worker
resolve_alert            → mark an alert as resolved
```

**UI:** Full-height slide-over panel on the right side of the admin layout. Persists across navigation. Responses include inline data tables and sparkline charts where appropriate (rendered from structured JSON in tool results).

---

#### 4.10.2 Seller Application Pre-Screening

**Where:** Admin seller review page (`/admin/sellers/{id}`) — triggered automatically when a seller submits their application.

When a seller completes onboarding and submits for review, before an admin opens the application, the AI has already:

1. Read the seller's business name, entity type, and description
2. Checked store name and category against existing stores for potential duplicates
3. Reviewed uploaded document metadata (type, filename patterns)
4. Cross-referenced the business address region against active supported regions
5. Checked if the associated Keycloak account is newly created (risk signal)

The result is a **pre-screening card** shown at the top of the seller detail page:

```
┌─────────────────────────────────────────────────────┐
│  ✦ AI Pre-Screen                         Low Risk   │
│                                                     │
│  ✓ Business info complete                           │
│  ✓ Store name unique on platform                    │
│  ✓ Operating region is active (Austin, TX)          │
│  ⚠ Account created 2 hours before submission        │
│  ⚠ No business website or social link provided      │
│                                                     │
│  Suggested action: Approve with standard review     │
│  Confidence: 82%                                    │
└─────────────────────────────────────────────────────┘
```

This is not an auto-approval system — the admin always makes the final decision. The card compresses a 5-minute manual review into a 10-second scan.

**Risk signals Gemini evaluates:**
- Account age vs submission speed (very new account + immediate submission)
- Missing optional but expected fields (website, social, phone)
- Business description quality (template-sounding, very short, or copy-pasted)
- Category mismatch (store name implies food, category is electronics)
- Region availability (submitted from unsupported region)

---

#### 4.10.3 Fraud & Anomaly Detection

**Where:** New *"Alerts"* tab in the admin dashboard. Background Kafka worker, runs continuously.

A dedicated Kafka consumer in the AI service monitors event streams in real time and flags anomalies using Gemini Flash:

| Event Stream | What It Watches | Example Alert |
|---|---|---|
| `OrderPlaced` | Velocity per buyer per hour | *"Buyer X placed 18 orders in 40 minutes — possible credential stuffing"* |
| `ProductCreated` | Bulk upload patterns | *"Seller Y uploaded 340 products in 8 minutes with near-identical descriptions"* |
| `ReviewCreated` | Review velocity + language patterns | *"12 five-star reviews for Store Z from new accounts in the last hour"* |
| `PaymentFailed` | Repeated failures on same card | *"Card ending 4242 failed 9 times across 4 buyers today"* |
| `RefundRequested` | Refund rate spike | *"Store A's refund rate hit 34% today vs 4% weekly average"* |
| `CouponValidated` | Coupon abuse patterns | *"Coupon SAVE20 used 140 times today — daily cap is 50, possible sharing"* |

Alerts are written in plain English by Gemini, stored in `ai.admin_alerts`, and surface as a badge count on the admin sidebar. Each alert links directly to the relevant order/seller/buyer for one-click investigation. Admins can configure sensitivity thresholds (low/medium/high) per alert type in admin config.

---

#### 4.10.4 Product Content Moderation

**Where:** Triggered automatically when a product transitions `draft` → `active` (Kafka `ProductPublished` event).

Before a product listing goes live, the AI service runs a moderation pass:

1. **Prohibited items check** — compares title + description against a configurable prohibited categories list (weapons, counterfeit goods, regulated items)
2. **Misleading claims detection** — flags superlatives without evidence (*"cures diabetes"*, *"100% guaranteed weight loss"*)
3. **Description quality score** — flags listings under 20 words or that appear copy-pasted from another listing
4. **Image moderation** (Phase 6+) — Gemini multimodal checks product images for inappropriate content

Results:
- **Pass** → product goes live immediately, no admin action needed
- **Flag** → product enters *"Pending Review"* state, admin gets an alert with Gemini's reasoning
- **Auto-reject** → only for clear prohibited item matches; seller is notified with the reason

This keeps admin review focused on edge cases rather than every single product submission.

---

#### 4.10.5 Search Gap Intelligence

**Where:** New *"Search Insights"* card on the admin analytics dashboard.

The AI service consumes Elasticsearch query logs (zero-result and low-result searches) and clusters them weekly:

```
┌─────────────────────────────────────────────────────────┐
│  ✦ Search Gaps  (last 7 days)                           │
│                                                         │
│  🔍 "injera" — 312 searches, avg 0 results              │
│     → Recruit Ethiopian food sellers in Austin, Dallas  │
│                                                         │
│  🔍 "halal meat" — 287 searches, 2 results              │
│     → Halal butchers underrepresented. Outreach opp.   │
│                                                         │
│  🔍 "African fabrics" — 201 searches, 4 results         │
│     → Ankara/Kente textile sellers needed               │
│                                                         │
│  [View all 47 gaps →]                                   │
└─────────────────────────────────────────────────────────┘
```

Each gap includes Gemini's suggested action — recruit sellers, create a category, run a targeted campaign. This directly informs the admin's seller acquisition strategy. Run as a weekly background job, results cached in `ai.search_gaps`.

---

#### 4.10.6 Email Template AI Writer

**Where:** Inline in the admin email template editor (`/admin/email-templates`).

A *"Write with AI"* button prompts the admin to describe the email's goal → *"Welcome new sellers who just completed onboarding and encourage them to publish their first product"* → Gemini Flash generates:

- Subject line + A/B variant
- Preview text
- Full email body in AfroTransact's tone
- CTA button text

The admin edits inline before saving. The existing template system (Resend + PostgreSQL-backed templates) is unchanged — AI just populates the fields.

---

#### 4.10.7 Coupon & Deal Optimizer

**Where:** Inline hints on the admin coupon creation form and deal management page.

When creating a platform-wide coupon or deal, the AI analyzes historical performance and surfaces suggestions:

- *"WELCOME10 (10% off) had 68% redemption. SAVE15 had 71% but cost 2.3x more per redemption. WELCOME10 is more efficient for first-time buyer acquisition."*
- *"Friday–Sunday deals in Austin see 2.4x higher redemption than weekday deals."*
- *"African Groceries hasn't had a platform deal in 47 days — higher novelty effect expected."*

Read-only info cards next to the form — admin is never forced to follow them.

---

#### 4.10.8 Admin Tools (Tool Executor additions)

```python
# engine/tools.py — admin-only, gated by role check in executor

types.FunctionDeclaration(
    name="get_platform_analytics",
    description="Get platform-wide revenue, GMV, order count, and conversion metrics for a date range.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "start_date":  types.Schema(type="STRING"),
            "end_date":    types.Schema(type="STRING"),
            "region_code": types.Schema(type="STRING"),
            "group_by":    types.Schema(type="STRING", enum=["day","week","month","region","seller"]),
        },
    ),
),
types.FunctionDeclaration(
    name="get_seller_performance",
    description="Get a seller's revenue, refund rate, order count, and review score.",
    parameters=types.Schema(
        type="OBJECT",
        properties={"seller_id": types.Schema(type="STRING")},
        required=["seller_id"],
    ),
),
types.FunctionDeclaration(
    name="get_search_gaps",
    description="Get the top zero-result or low-result search queries from the past N days.",
    parameters=types.Schema(
        type="OBJECT",
        properties={"days": types.Schema(type="INTEGER")},
    ),
),
types.FunctionDeclaration(
    name="get_admin_alerts",
    description="Get unresolved fraud and anomaly alerts.",
    parameters=types.Schema(
        type="OBJECT",
        properties={"severity": types.Schema(type="STRING", enum=["low","medium","high","all"])},
    ),
),
types.FunctionDeclaration(
    name="get_content_flags",
    description="Get products currently flagged by content moderation and awaiting admin review.",
),
types.FunctionDeclaration(
    name="resolve_alert",
    description="Mark an admin alert as resolved with an optional note.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "alert_id": types.Schema(type="STRING"),
            "note":     types.Schema(type="STRING"),
        },
        required=["alert_id"],
    ),
),
```

**Security:** Admin tools are gated in the tool executor by role. The `X-User-Id` injected by the Next.js proxy is verified against the user's Keycloak roles (`admin` or `realm-admin`) before any admin tool is executed. A buyer or seller hitting the admin chat endpoint receives a 403 before Gemini is ever called.

---

## 5. Technical Implementation

### 5.1 New Service: `services/ai`

**Stack:**
- Python 3.12
- FastAPI (async)
- `google-genai` SDK (unified Google AI SDK)
- `pgvector` + `asyncpg` for embeddings
- `redis.asyncio` for conversation memory
- `aiokafka` for event consumption (price alerts, review summaries)
- `httpx` for internal API gateway calls

**Directory structure:**
```
services/ai/
├── main.py                    # FastAPI app, CORS, lifespan
├── config.py                  # Env vars, model routing config
├── routers/
│   ├── chat.py                # POST /chat/stream (SSE)
│   ├── voice.py               # POST /voice/stream (Gemini Live API)
│   ├── search.py              # POST /search/enhance
│   ├── product.py             # POST /product/{id}/summary, /product/{id}/similar
│   ├── seller.py              # POST /seller/chat/stream, /seller/write-product
│   ├── admin.py               # POST /admin/chat/stream, /admin/prescreen, /admin/moderate
│   └── alerts.py              # POST /alerts, DELETE /alerts/{id}
├── engine/
│   ├── gemini.py              # Gemini client, streaming loop, model routing
│   ├── tools.py               # Tool definitions (FunctionDeclaration) + executor
│   ├── memory.py              # Redis conversation history (40-message window)
│   ├── preferences.py         # User preference load/save (PostgreSQL)
│   └── embeddings.py          # text-embedding-004 + pgvector queries
├── workers/
│   ├── review_summary.py      # Kafka consumer: generate summaries on new reviews
│   ├── price_alerts.py        # Kafka consumer: fire alerts on ProductUpdated events
│   ├── fraud_monitor.py       # Kafka consumer: real-time anomaly detection → admin_alerts
│   ├── content_moderation.py  # Kafka consumer: screen products on ProductPublished
│   └── search_gaps.py         # Weekly job: cluster zero-result queries → search_gaps
├── db/
│   ├── migrations/            # Alembic migrations (ai schema)
│   └── models.py              # SQLAlchemy models
├── Dockerfile
└── requirements.txt
```

**Key endpoints:**
```
POST /chat/stream           → SSE stream (text + tool results)
POST /voice/stream          → WebSocket or SSE, Gemini Live audio
POST /search/enhance        → raw query → structured Elasticsearch params
POST /product/{id}/summary  → AI review summary (cached)
POST /product/{id}/similar  → pgvector cosine similarity results
POST /seller/write          → product info → AI-written title + description
POST /seller/chat/stream    → seller analytics chat (SSE, Gemini Pro)
POST /admin/chat/stream     → admin platform analytics chat (SSE, Gemini Pro)
POST /admin/prescreen/{id}  → seller application pre-screening card
POST /admin/moderate/{id}   → product content moderation result
GET  /admin/search-gaps     → latest search gap clusters
POST /alerts                → create price/stock alert
DELETE /alerts/{id}         → remove alert
```

### 5.2 Model Routing

```python
# config.py

MODEL_ROUTING = {
    "chat_simple":    "gemini-2.0-flash-lite",   # search, cart, track — tool-only
    "chat_default":   "gemini-2.0-flash",         # main conversational chat
    "voice":          "gemini-2.0-flash",         # audio input/output
    "search_enhance": "gemini-2.0-flash-lite",    # query parsing (latency-sensitive)
    "review_summary": "gemini-2.0-flash",         # batch, cached
    "seller_coach":      "gemini-2.5-pro",           # deep reasoning
    "product_write":     "gemini-2.0-flash",         # copy generation
    "admin_chat":        "gemini-2.5-pro",           # platform analytics reasoning
    "admin_prescreen":   "gemini-2.0-flash",         # seller risk scoring
    "admin_moderation":  "gemini-2.0-flash-lite",    # content policy check
    "admin_search_gaps": "gemini-2.0-flash",         # query clustering
    "fraud_monitor":     "gemini-2.0-flash-lite",    # real-time event screening
    "email_writer":      "gemini-2.0-flash",         # template copy generation
    "embeddings":        "text-embedding-004",       # all vector embeddings
}
```

### 5.3 Next.js API Routes (Proxy Layer)

```typescript
// app/api/ai/[...path]/route.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions)
  const path = params.path.join("/")
  const aiServiceUrl = `${process.env.AI_SERVICE_URL}/${path}`

  const body = await req.text()
  const upstreamRes = await fetch(aiServiceUrl, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      ...(session?.user?.id ? { "X-User-Id": session.user.id } : {}),
      ...(session?.accessToken ? { "X-User-Token": session.accessToken as string } : {}),
    },
    body,
  })

  return new Response(upstreamRes.body, {
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") ?? "text/plain",
      "Cache-Control": "no-cache",
    },
  })
}
```

### 5.4 Frontend Components

```
components/ai/
├── AiWidget.tsx               # Floating chat widget (minimized/expanded)
├── AiChatPanel.tsx            # Full chat panel with message list
├── AiMessageBubble.tsx        # Single message (user or assistant)
├── AiProductCards.tsx         # Inline product grid rendered from tool results
├── AiVoiceButton.tsx          # Mic button, waveform animation (Framer Motion)
├── AiSearchEnhancer.tsx       # Wraps search bar with Gemini interpretation
├── AiProductSummary.tsx       # Review summary block on product page
├── AiPairsWith.tsx            # Semantic product recommendations
├── AiCheckoutHint.tsx         # Inline checkout suggestions (coupon, shipping)
├── AiSellerChat.tsx           # Seller dashboard chat panel
└── hooks/
    ├── useAiChat.ts           # Chat state, SSE stream, message history
    ├── useVoiceInput.ts       # Web Speech API primary, Gemini Live fallback
    └── useAiSearch.ts         # Query enhancement hook
```

**Zustand store:**
```typescript
// stores/ai-store.ts
interface AiStore {
  isOpen: boolean
  messages: AiMessage[]
  sessionId: string
  isStreaming: boolean
  open: () => void
  close: () => void
  sendMessage: (text: string) => void
  clearHistory: () => void
}
```

**SSE streaming hook:**
```typescript
// hooks/useAiChat.ts
async function sendMessage(text: string) {
  setIsStreaming(true)
  addMessage({ role: "user", content: text })
  const assistantId = addEmptyAssistantMessage()

  const res = await fetch("/api/ai/chat/stream", {
    method: "POST",
    body: JSON.stringify({ message: text, session_id: sessionId, history: last20Messages }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  for await (const chunk of readStream(reader, decoder)) {
    if (chunk.type === "text_delta") {
      appendToMessage(assistantId, chunk.delta)
    } else if (chunk.type === "tool_result") {
      attachProductCards(assistantId, chunk.data)
    }
  }
  setIsStreaming(false)
}
```

### 5.5 Embeddings & Semantic Search

Kafka consumer in the AI service listens for `ProductCreated` / `ProductUpdated`:

1. Build embedding input: `"{title} {description} {categories joined}"`
2. Call `text-embedding-004` via `google-genai` SDK
3. Store in `ai.product_embeddings(product_id UUID, embedding vector(768))`
4. pgvector `<=>` cosine similarity enables "similar products" and personalized picks

Batch backfill job for existing products runs once at Phase 3 deployment.

### 5.6 Redis Conversation Memory

```
Key:   ai:conv:{session_id}
TTL:   86400s (24 hours)
Value: JSON — last 40 turns [{role, parts: [{text?}, {function_call?}, {function_response?}]}]
```

Rolling 40-message window prevents unbounded token growth. Long-term preferences in PostgreSQL `ai.user_preferences` survive session expiry and are injected into every system instruction.

### 5.7 Environment Variables

**`services/ai/.env`:**
```
GOOGLE_API_KEY=AIza...           # From Google AI Studio → Get API key
DATABASE_URL=postgresql+asyncpg://afrotransact:afrotransact@localhost:5433/afrotransact
REDIS_URL=redis://localhost:6379
INTERNAL_API_URL=http://localhost:8080
KAFKA_BOOTSTRAP_SERVERS=localhost:19092
AI_SERVICE_PORT=8091
```

**`.env.local` additions (Next.js):**
```
AI_SERVICE_URL=http://localhost:8091
NEXT_PUBLIC_AI_ENABLED=true
```

### 5.8 Docker Compose Addition

```yaml
ai:
  build: ./services/ai
  ports:
    - "8091:8091"
  environment:
    - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    - DATABASE_URL=postgresql+asyncpg://afrotransact:afrotransact@postgres:5432/afrotransact
    - REDIS_URL=redis://redis:6379
    - INTERNAL_API_URL=http://gateway:8080
    - KAFKA_BOOTSTRAP_SERVERS=redpanda:9092
  depends_on:
    - postgres
    - redis
    - redpanda
    - gateway
```

---

## 6. Rollout Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Bootstrap `services/ai` (FastAPI, Dockerfile, config)
- [ ] Develop + validate Afrobi system instruction in Google AI Studio
- [ ] Build + test all tool schemas in AI Studio function calling editor
- [ ] Gemini chat engine with search + cart tools
- [ ] Redis conversation memory (40-message rolling window)
- [ ] Next.js proxy route `/api/ai/[...path]`
- [ ] `AiWidget` + `AiChatPanel` + `AiMessageBubble` + `AiProductCards`
- [ ] Deploy behind `NEXT_PUBLIC_AI_ENABLED=true` flag

**Deliverable:** Customers text-chat with Afrobi to search products and manage their cart.

### Phase 2 — Voice (Week 3)
- [ ] `useVoiceInput` hook (Web Speech API primary, Gemini Live API fallback)
- [ ] `AiVoiceButton` with Framer Motion waveform animation
- [ ] Mic button in search bar and AI widget
- [ ] `/shop/voice` full-screen voice experience page
- [ ] Text-to-speech via Web Speech Synthesis (Gemini audio output as upgrade)
- [ ] Language auto-detection → multilingual response

**Deliverable:** Voice shopping end-to-end. Say it, find it, buy it.

### Phase 3 — Smart Search & Product Pages (Week 4)
- [ ] `/search/enhance` endpoint + `useAiSearch` hook
- [ ] African ingredient synonym mapping + intent parsing
- [ ] AI chips on search results page
- [ ] Product review summaries (`AiProductSummary`) with Redis caching
- [ ] "Ask about this product" with Google Search grounding enabled
- [ ] `text-embedding-004` pgvector setup + batch backfill job
- [ ] `AiPairsWith` recommendations component

**Deliverable:** Dramatically improved product discovery for diaspora-specific products.

### Phase 4 — Personalization & Checkout (Week 5)
- [ ] User preference questionnaire (first chat session)
- [ ] Personalized picks section on homepage
- [ ] `AiCheckoutHint` — coupon surfacing + shipping recommendations
- [ ] Price & stock alerts (Kafka worker + notification service integration)
- [ ] Implicit preference learning (click tracking)

**Deliverable:** Every session feels personal. Checkout conversion improves.

### Phase 5 — Seller AI (Week 6)
- [ ] `AiSellerChat` panel (Gemini Pro for deep analytics)
- [ ] AI product description writer inline in create/edit form
- [ ] Pricing intelligence hints on product list
- [ ] Review response drafter
- [ ] Inventory velocity alert worker

**Deliverable:** Sellers grow faster with an AI business partner.

### Phase 6 — Admin AI (Week 7–8)
- [ ] `AiAdminChat` panel — Gemini Pro analytics chat with inline tables + charts
- [ ] Seller pre-screening card on `/admin/sellers/{id}` (auto-triggered on submission)
- [ ] Fraud & anomaly detection Kafka workers (`fraud_monitor.py`)
- [ ] Admin alerts tab with badge count + one-click drill-down
- [ ] Product content moderation worker (`content_moderation.py`) on `ProductPublished`
- [ ] Search gap intelligence weekly job + dashboard widget
- [ ] Email template AI writer inline in `/admin/email-templates`
- [ ] Coupon & deal optimizer hints in admin forms
- [ ] `ai.admin_alerts` + `ai.search_gaps` + `ai.moderation_log` database tables
- [ ] Configurable fraud sensitivity thresholds in admin config

**Deliverable:** Admin operates the platform proactively — fraud caught before it scales, seller approvals faster, inventory gaps turned into acquisition targets.

---

## 7. Security & Cost Controls

### Security
- AI service is **not publicly exposed** — only reachable via the Next.js proxy
- The proxy injects user ID from server-side NextAuth session — never trust client-supplied user identity
- Tool executor enforces user ownership: cannot read another user's orders or cart
- Internal API gateway calls use a service-account JWT, not the end-user's token
- User input is passed to Gemini as conversation data, not injected into the system instruction

### Cost Controls
- **Rate limiting:** 30 chat messages per user per hour (Redis counter `ai:rate:{user_id}`)
- **Input cap:** 500 chars max per user message
- **Model routing:** Flash-Lite for all simple tool-only queries (cheapest), Flash for conversational, Pro only for seller coach
- **Review summaries:** Generated once, cached 24h in Redis — never re-computed per page load
- **Embedding model:** `text-embedding-004` — generous free tier (1M chars/month), competitive pricing beyond
- **Voice:** Web Speech API first — zero API cost for Chrome/Safari users (majority of traffic). Gemini Live only as fallback
- **Grounding:** Enabled only for product Q&A feature (not general chat) to avoid unnecessary Google Search calls

### Monitoring
- `ai.usage_log` table: model, tokens_in, tokens_out, user_id, feature, timestamp
- Alert when daily Google AI cost exceeds configurable threshold
- Tool call success/failure rates tracked for API regression detection
- Kafka dead-letter queue for failed background workers (price alerts, summaries)

---

## 8. Summary of All AI Features

| Feature | User Type | Where | Model | Phase |
|---------|-----------|-------|-------|-------|
| Text chat — Afrobi widget | Buyer | All pages | Gemini Flash | 1 |
| Search + add to cart via chat | Buyer | Chat widget | Gemini Flash + tools | 1 |
| Order tracking via chat | Buyer | Chat widget | Gemini Flash-Lite + tools | 1 |
| Voice search (mic in search bar) | Buyer | Search bar | Web Speech / Gemini Live | 2 |
| Voice shopping (/shop/voice) | Buyer | Dedicated page | Gemini Live + TTS | 2 |
| Smart search — intent parsing | Buyer | Search page | Gemini Flash-Lite | 3 |
| African ingredient synonym mapping | Buyer | Search | Gemini Flash-Lite | 3 |
| Product review AI summaries | Buyer | Product page | Gemini Flash | 3 |
| "Ask about this product" (grounded) | Buyer | Product page | Gemini Flash + Search | 3 |
| "Pairs with" semantic recommendations | Buyer | Product page | text-embedding-004 | 3 |
| Personalized homepage picks | Buyer | Home | text-embedding-004 | 4 |
| Preference learning | Buyer | Chat widget | Gemini Flash | 4 |
| Checkout coupon surfacing | Buyer | Checkout | Gemini Flash-Lite | 4 |
| Checkout shipping suggestions | Buyer | Checkout | Gemini Flash-Lite | 4 |
| Price drop / restock alerts | Buyer | Product page | Kafka worker | 4 |
| AI product description writer | Seller | Dashboard | Gemini Flash | 5 |
| Seller sales coach (chat) | Seller | Dashboard | Gemini Pro | 5 |
| Pricing intelligence | Seller | Dashboard | Gemini Flash | 5 |
| Review response drafter | Seller | Dashboard | Gemini Flash | 5 |
| Inventory velocity alerts | Seller | Dashboard | Kafka worker | 5 |
| Platform analytics chat | Admin | Dashboard | Gemini Pro | 6 |
| Seller application pre-screening | Admin | Seller review page | Gemini Flash | 6 |
| Fraud & anomaly detection alerts | Admin | Alerts tab | Gemini Flash-Lite + Kafka | 6 |
| Product content moderation | Admin | Auto on publish | Gemini Flash-Lite + Kafka | 6 |
| Search gap intelligence | Admin | Analytics dashboard | Gemini Flash + weekly job | 6 |
| Email template AI writer | Admin | Email templates | Gemini Flash | 6 |
| Coupon & deal optimizer hints | Admin | Coupon/deal forms | Gemini Flash | 6 |
| Multilingual (all features) | All | All | Gemini (native) | 1–6 |
