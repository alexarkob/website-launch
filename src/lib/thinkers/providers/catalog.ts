export type ModelProviderId = "gemini" | "claude" | "workers-ai";

export type ProviderCost = "free-tier" | "paid";

export type ProviderSecretKey =
  | "GEMINI_API_KEY"
  | "ANTHROPIC_API_KEY"
  | "CLOUDFLARE_ACCOUNT_ID"
  | "CLOUDFLARE_API_TOKEN";

export type ProviderInfo = {
  id: ModelProviderId;
  label: string;
  model: string;
  cost: ProviderCost;
  /** Short badge for the toggle UI */
  costBadge: string;
  /** Shown under the selected provider */
  costNote: string;
  /** Env / request field names the server needs */
  envKeys: ProviderSecretKey[];
  supportsImages: boolean;
  signupUrl: string;
  whenToUse: string;
  whyNeeded: string;
  setupSteps: string[];
  fieldLabels: Partial<Record<ProviderSecretKey, string>>;
};

/**
 * Client-safe provider catalog. Cost notes explain when a paid key is required.
 */
export const PROVIDERS: Record<ModelProviderId, ProviderInfo> = {
  gemini: {
    id: "gemini",
    label: "Gemini Flash",
    model: "gemini-flash-latest",
    cost: "free-tier",
    costBadge: "Free-tier key",
    costNote:
      "No paid key required for Google’s free tier. Add a Gemini API key from Google AI Studio (free). Usage beyond free limits may require billing.",
    envKeys: ["GEMINI_API_KEY"],
    supportsImages: true,
    signupUrl: "https://aistudio.google.com/apikey",
    whenToUse:
      "Best free starting point for this demo — strong multimodal support and solid long-form reactions without a paid key.",
    whyNeeded:
      "You bring your own Gemini key so model usage is billed to your Google free tier (or your Google Cloud billing), not the site owner.",
    setupSteps: [
      "Open Google AI Studio’s API key page (link below).",
      "Sign in with a Google account.",
      "Click “Create API key”, choose a project if asked, and copy the key.",
      "Paste it into the Gemini API key field below and click Save.",
      "Select Gemini Flash under Model provider above, then try a reaction.",
    ],
    fieldLabels: {
      GEMINI_API_KEY: "Gemini API key",
    },
  },
  claude: {
    id: "claude",
    label: "Claude Sonnet",
    model: "claude-sonnet-5",
    cost: "paid",
    costBadge: "Paid key required",
    costNote:
      "Requires a paid Anthropic API key. Usage is billed per token — there is no free Anthropic API tier for this model.",
    envKeys: ["ANTHROPIC_API_KEY"],
    supportsImages: true,
    signupUrl: "https://console.anthropic.com/",
    whenToUse:
      "Best voice fidelity for Packy / Ben / Benedict essay-style takes when you want the highest-quality persona writing and are willing to pay.",
    whyNeeded:
      "You bring your own Anthropic key so Claude usage is charged to your Anthropic account, not the site owner.",
    setupSteps: [
      "Open the Anthropic Console (link below) and create an account if you don’t have one.",
      "Add billing or credits in Settings → Billing (required — Claude has no free API tier).",
      "Open API Keys in the left sidebar and click “Create Key”.",
      "Copy the key immediately (it is only shown once).",
      "Paste it into the Anthropic API key field below and click Save.",
      "Select Claude Sonnet under Model provider above, then try a reaction.",
    ],
    fieldLabels: {
      ANTHROPIC_API_KEY: "Anthropic API key",
    },
  },
  "workers-ai": {
    id: "workers-ai",
    label: "Workers AI (Llama)",
    model: "@cf/meta/llama-3.2-11b-vision-instruct",
    cost: "free-tier",
    costBadge: "Free-tier allotment",
    costNote:
      "No paid LLM key required within Cloudflare’s free Workers AI allotment. Needs a Cloudflare Account ID + API token (free account OK). Heavy use beyond the free allotment is billed by Cloudflare.",
    envKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    supportsImages: true,
    signupUrl: "https://dash.cloudflare.com/profile/api-tokens",
    whenToUse:
      "Good Cloudflare-native free allotment option if you already use Cloudflare. Expect a weaker essayist voice than Claude or Gemini.",
    whyNeeded:
      "You bring your own Cloudflare credentials so Workers AI usage draws from your free allotment (then your Cloudflare billing), not the site owner’s.",
    setupSteps: [
      "Create or sign in to a free Cloudflare account at dash.cloudflare.com.",
      "On any account overview page, copy Account ID from the right sidebar.",
      "Open API Tokens (link below).",
      "Create a token with Workers AI Read/Run permissions (use a Workers AI template if available, or custom token with Account → Workers AI → Edit).",
      "Paste both the Account ID and API token into the fields below and click Save.",
      "Select Workers AI (Llama) under Model provider above, then try a reaction.",
    ],
    fieldLabels: {
      CLOUDFLARE_ACCOUNT_ID: "Cloudflare Account ID",
      CLOUDFLARE_API_TOKEN: "Cloudflare API token",
    },
  },
};

export const PROVIDER_IDS: ModelProviderId[] = [
  "gemini",
  "claude",
  "workers-ai",
];

export const DEFAULT_PROVIDER: ModelProviderId = "gemini";

export function isModelProviderId(value: unknown): value is ModelProviderId {
  return (
    typeof value === "string" &&
    (PROVIDER_IDS as string[]).includes(value)
  );
}

export function listProviders(): ProviderInfo[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]);
}

export function keysForProvider(
  provider: ModelProviderId,
  all: Partial<Record<ProviderSecretKey, string>>,
): Partial<Record<ProviderSecretKey, string>> {
  const out: Partial<Record<ProviderSecretKey, string>> = {};
  for (const key of PROVIDERS[provider].envKeys) {
    const value = all[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

export function missingProviderFields(
  provider: ModelProviderId,
  all: Partial<Record<ProviderSecretKey, string>>,
): ProviderSecretKey[] {
  return PROVIDERS[provider].envKeys.filter((key) => !all[key]?.trim());
}
