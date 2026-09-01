import type {
  AddOn,
  AuraOffer,
  AurumiApp,
  BundleOffer,
  Catalogue,
  CommerceState,
  Connector,
  Market,
  Plan,
  PriceRule,
  Promotion,
  Tenant,
} from "./types";

export const MARKETS: Market[] = [
  {
    id: "IN",
    name: "India",
    currency: "INR",
    currencySymbol: "₹",
    taxName: "GST",
    taxRatePct: 18,
    taxIncluded: false,
    paymentProvider: "Razorpay",
    paymentMethods: ["UPI", "Cards", "Netbanking"],
    active: true,
  },
  {
    id: "SG",
    name: "Singapore",
    currency: "SGD",
    currencySymbol: "S$",
    taxName: "GST",
    taxRatePct: 9,
    taxIncluded: false,
    paymentProvider: "Stripe",
    paymentMethods: ["Cards", "PayNow", "GrabPay"],
    active: true,
  },
  {
    id: "AE",
    name: "UAE",
    currency: "AED",
    currencySymbol: "AED",
    taxName: "VAT",
    taxRatePct: 5,
    taxIncluded: false,
    paymentProvider: "Telr",
    paymentMethods: ["Cards", "Apple Pay"],
    active: true,
  },
  {
    id: "US",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    taxName: "Sales Tax",
    taxRatePct: 0,
    taxIncluded: false,
    paymentProvider: "Stripe",
    paymentMethods: ["Cards", "ACH", "Apple Pay"],
    active: true,
  },
  {
    id: "INTL",
    name: "International / Rest of World",
    currency: "USD",
    currencySymbol: "$",
    taxName: "Tax",
    taxRatePct: 0,
    taxIncluded: false,
    paymentProvider: "Stripe",
    paymentMethods: ["Cards"],
    active: true,
  },
];

/** USD reference price -> market price multiplier (purchasing-power adjusted). */
const MARKET_FACTOR: Record<string, number> = {
  IN: 45,
  SG: 1.35,
  AE: 3.67,
  US: 1,
  INTL: 1,
};

const PLAN_DEFS: Array<Omit<Plan, "entitlements"> & { usd: number | null }> = [
  {
    id: "plan.starter",
    name: "Starter",
    description: "For small teams getting started on Aurumi.",
    publicVisible: true,
    active: true,
    custom: false,
    includedUsers: 5,
    includedIntelligence: 2000,
    includedStorageGb: 50,
    includedTransferGb: 100,
    includedStandardConnectors: 1,
    supportLevel: "Standard",
    eligibleMarkets: ["IN", "SG", "AE", "US", "INTL"],
    order: 1,
    usd: 29,
  },
  {
    id: "plan.growth",
    name: "Growth",
    description: "For growing businesses that need more capacity and connectors.",
    publicVisible: true,
    active: true,
    custom: false,
    includedUsers: 20,
    includedIntelligence: 10000,
    includedStorageGb: 250,
    includedTransferGb: 500,
    includedStandardConnectors: 3,
    supportLevel: "Priority",
    eligibleMarkets: ["IN", "SG", "AE", "US", "INTL"],
    order: 2,
    usd: 99,
  },
  {
    id: "plan.business",
    name: "Business",
    description: "For established operations running Aurumi across departments.",
    publicVisible: true,
    active: true,
    custom: false,
    includedUsers: 50,
    includedIntelligence: 30000,
    includedStorageGb: 1000,
    includedTransferGb: 2000,
    includedStandardConnectors: 6,
    supportLevel: "Premium",
    eligibleMarkets: ["IN", "SG", "AE", "US", "INTL"],
    order: 3,
    usd: 249,
  },
  {
    id: "plan.enterprise",
    name: "Enterprise",
    description: "Custom capacity, custom apps, governance, SLA and commercial terms.",
    publicVisible: true,
    active: true,
    custom: true,
    includedUsers: null,
    includedIntelligence: null,
    includedStorageGb: null,
    includedTransferGb: null,
    includedStandardConnectors: null,
    supportLevel: "Dedicated",
    eligibleMarkets: ["IN", "SG", "AE", "US", "INTL"],
    order: 4,
    usd: null,
  },
];

export const PLANS: Plan[] = PLAN_DEFS.map((p) => {
  const { usd: _usd, ...plan } = p;
  return plan;
});

const ALL_PLAN_IDS = PLANS.map((p) => p.id);
const ALL_MARKET_IDS = MARKETS.map((m) => m.id);

type AppSeed = [string, string, AurumiApp["category"], AurumiApp["classification"], string, number?];

const APP_SEEDS: AppSeed[] = [
  ["app.workspace", "Workspace", "Core", "Standard", "Tenant workspace, records and shared context."],
  ["app.tasks", "Tasks", "Core", "Standard", "Work items, assignments and follow-ups."],
  ["app.documents", "Documents", "Core", "Standard", "Document library with versioning."],
  ["app.messaging", "Messaging", "Core", "Standard", "Internal conversations tied to records."],
  ["app.intelligence", "Intelligence Studio", "Core", "Premium", "Custom assistants and automations.", 39],
  ["app.crm", "CRM", "Sales", "Standard", "Accounts, contacts and pipeline."],
  ["app.quotes", "Quotes & Orders", "Sales", "Standard", "Quotations, orders and approvals."],
  ["app.fieldsales", "Field Sales", "Sales", "Premium", "Route planning and field rep execution.", 25],
  ["app.invoicing", "Invoicing", "Finance", "Standard", "Customer invoices and credit notes."],
  ["app.expenses", "Expenses", "Finance", "Standard", "Expense capture and approval."],
  ["app.revenue", "Revenue Intelligence", "Finance", "Premium", "Revenue forecasting and margin analytics.", 45],
  ["app.pos", "Store POS", "Stores", "Standard", "Point of sale for retail counters."],
  ["app.inventory", "Inventory", "Stores", "Standard", "Stock, transfers and stock takes."],
  ["app.merchandising", "Merchandising", "Stores", "Premium", "Planograms and assortment planning.", 29],
  ["app.access", "Access Control", "Security", "Standard", "Roles, permissions and app access."],
  ["app.audit", "Audit Trail", "Security", "Standard", "Immutable activity history."],
  ["app.compliance", "Compliance Vault", "Security", "Premium", "Retention policies and evidence packs.", 35],
  ["app.devicehub", "Device Hub", "IT", "Standard", "Registered devices and sessions."],
  ["app.integrations", "Integration Console", "IT", "Standard", "Connector configuration and health."],
  ["app.observability", "Observability", "IT", "Premium", "Usage, latency and error telemetry.", 19],
  ["app.tenantadmin", "Tenant Administration", "Aurumi Internal", "Standard", "Internal tenant lifecycle tooling."],
  ["app.commercialadmin", "Commercial Admin", "Aurumi Internal", "Standard", "Internal catalogue & subscription tooling."],
];

export const APPS: AurumiApp[] = APP_SEEDS.map(([id, name, category, classification, description]) => ({
  id,
  name,
  category,
  classification,
  active: true,
  publicVisible: category !== "Aurumi Internal",
  description,
  eligiblePlans: classification === "Premium" ? ALL_PLAN_IDS.filter((p) => p !== "plan.starter") : ALL_PLAN_IDS,
  entitlements: [{ key: "apps.premium", label: name, source: id }],
}));

const APP_USD: Record<string, number> = Object.fromEntries(
  APP_SEEDS.filter((s) => s[5] !== undefined).map((s) => [s[0], s[5] as number]),
);

type ConnSeed = [
  string,
  string,
  Connector["category"],
  Connector["classification"],
  string,
  number | null,
  number | null,
  Connector["setupComplexity"],
];

const CONNECTOR_SEEDS: ConnSeed[] = [
  ["conn.xero", "Xero", "Accounting", "Standard", "Two-way sync of invoices, contacts and payments.", null, null, "Low"],
  ["conn.quickbooks", "QuickBooks", "Accounting", "Standard", "Ledger, invoice and customer sync.", null, null, "Low"],
  ["conn.tally", "Tally", "Accounting", "Additional", "On-premise ledger bridge for Indian operations.", 25, 400, "High"],
  ["conn.shopify", "Shopify", "Commerce", "Standard", "Orders, products and inventory sync.", null, null, "Low"],
  ["conn.amazon", "Amazon Marketplace", "Commerce", "Additional", "Marketplace orders and settlements.", 39, 250, "Medium"],
  ["conn.stripe", "Stripe", "Payments", "Standard", "Payments, payouts and reconciliation.", null, null, "Low"],
  ["conn.razorpay", "Razorpay", "Payments", "Standard", "Payments and settlement reconciliation.", null, null, "Low"],
  ["conn.gworkspace", "Google Workspace", "Productivity", "Standard", "Identity, calendar and drive sync.", null, null, "Low"],
  ["conn.gsheets", "Google Sheets", "Productivity", "Standard", "Spreadsheet-based business data, trackers and reporting.", null, null, "Low"],
  ["conn.m365", "Microsoft 365", "Productivity", "Standard", "Identity, mail and files sync.", null, null, "Low"],
  ["conn.delhivery", "Delhivery", "Logistics", "Additional", "Shipment booking and tracking.", 19, null, "Medium"],
  ["conn.sap", "SAP ECC / S4", "Data", "Custom", "Bespoke master-data and document integration.", null, null, "High"],
  ["conn.custom", "Custom Connector", "Custom", "Custom", "Aurumi-built integration to a bespoke system.", null, null, "High"],
  ["conn.legacy-erp", "Legacy ERP Bridge", "Data", "Additional", "Bespoke bridge to a tenant's legacy ERP. Commercially negotiated per tenant.", null, null, "High"],
];

export const CONNECTORS: Connector[] = CONNECTOR_SEEDS.map(
  ([id, name, category, classification, description, rec, once, complexity]) => ({
    id,
    name,
    category,
    status: id === "conn.sap" ? "Beta" : "Available",
    classification,
    active: true,
    publicVisible: true,
    description,
    setupComplexity: complexity,
    setupMode: classification === "Standard" ? "Self-service" : "Aurumi-assisted",
    professionalServicesRequired: classification === "Custom" || complexity === "High",
    storageImpact: complexity === "High" ? "High" : classification === "Standard" ? "Low" : "Medium",
    transferImpact: complexity === "High" ? "High" : "Medium",
    intelligenceImpact: category === "Data" ? "High" : "Low",
    eligiblePlans: classification === "Standard" ? ALL_PLAN_IDS : ALL_PLAN_IDS.filter((p) => p !== "plan.starter"),
    hasRecurringPrice: rec !== null,
    hasOneTimePrice: once !== null,
    quoteOnly: classification === "Custom",
    // Commercial availability as a standalone Aura offering. Every connector
    // still works with Aura; only Tally may currently be sold with Aura alone.
    standaloneAuraOffering: id === "conn.tally",
    ...(id === "conn.legacy-erp"
      ? {
          customCommercialTreatment:
            "Negotiated per tenant based on ERP version, document volume and integration scope.",
        }
      : {}),
  }),
);

const CONN_USD: Record<string, { rec: number | null; once: number | null }> = Object.fromEntries(
  CONNECTOR_SEEDS.map((s) => [s[0], { rec: s[5], once: s[6] }]),
);

export const ADDONS: AddOn[] = [
  {
    id: "addon.users",
    name: "Extra Team Members",
    description: "Additional named users beyond the plan allowance.",
    unit: "user",
    unitLabel: "per user / month, sold in 10-user increments",
    unitSize: 1,
    quantityStep: 10,
    recurring: true,
    minQuantity: 1,
    maxQuantity: 500,
    eligiblePlans: ALL_PLAN_IDS,
    eligibleMarkets: ALL_MARKET_IDS,
    active: true,
    entitlement: { key: "users.included", unit: "users", source: "addon.users" },
  },
  {
    id: "addon.storage",
    name: "Extra Storage",
    description: "Additional workspace storage capacity.",
    unit: "GB",
    unitLabel: "per 100 GB / month",
    unitSize: 100,
    quantityStep: 1,
    recurring: true,
    minQuantity: 1,
    maxQuantity: 200,
    eligiblePlans: ALL_PLAN_IDS,
    eligibleMarkets: ALL_MARKET_IDS,
    active: true,
    entitlement: { key: "capacity.storage", unit: "GB", source: "addon.storage" },
  },
  {
    id: "addon.intelligence",
    name: "Extra Intelligence Capacity",
    description: "Additional Aurumi Intelligence Credits (AIC) per month.",
    unit: "AIC",
    unitLabel: "per 5,000 AIC / month",
    unitSize: 5000,
    quantityStep: 1,
    recurring: true,
    minQuantity: 1,
    maxQuantity: 100,
    eligiblePlans: ALL_PLAN_IDS,
    eligibleMarkets: ALL_MARKET_IDS,
    active: true,
    entitlement: { key: "capacity.intelligence", unit: "AIC/mo", source: "addon.intelligence" },
  },
  {
    id: "addon.transfer",
    name: "Extra Data Transfer",
    description: "Additional monthly data-transfer capacity.",
    unit: "GB",
    unitLabel: "per 500 GB / month",
    unitSize: 500,
    quantityStep: 1,
    recurring: true,
    minQuantity: 1,
    maxQuantity: 100,
    eligiblePlans: ALL_PLAN_IDS,
    eligibleMarkets: ALL_MARKET_IDS,
    active: true,
    entitlement: { key: "capacity.transfer", unit: "GB/mo", source: "addon.transfer" },
  },
];

/**
 * Derived from the catalogue — the add-on record is the single source of truth
 * for how much capacity one purchased unit delivers.
 */
export const ADDON_UNIT_SIZE: Record<string, number> = Object.fromEntries(
  ADDONS.map((a) => [a.id, a.unitSize]),
);

const ADDON_USD: Record<string, number> = {
  "addon.users": 6,
  "addon.storage": 8,
  "addon.intelligence": 20,
  "addon.transfer": 10,
};

export const AURA_OFFERS: AuraOffer[] = [
  {
    id: "aura.tally",
    name: "Aura + Tally",
    product: "aura",
    connectorId: "conn.tally",
    description:
      "Talk to Your Business on top of Tally data — sold directly, without an Aurumi Workspace plan.",
    status: "Available",
    eligibleMarkets: ALL_MARKET_IDS,
    includedUsers: 5,
    includedIntelligence: 5000,
    includedStorageGb: 25,
    enabledAddOnIds: ["addon.users", "addon.intelligence", "addon.storage"],
    // Explicit commercial treatment: Aura recurring, Tally connection and
    // setup included in the offer price. No one-time and no quoted component.
    components: [
      {
        id: "aura.tally:aura",
        label: "Aura",
        kind: "aura",
        treatment: "recurring",
        productId: "aura.tally",
        required: true,
      },
      {
        id: "aura.tally:connector",
        label: "Tally connection",
        kind: "connector",
        treatment: "included",
        note: "No separate Workspace connector fee applies.",
        required: true,
      },
      {
        id: "aura.tally:setup",
        label: "Setup",
        kind: "setup",
        treatment: "included",
        note: "Aurumi-assisted Tally bridge setup is included in the offer price.",
        required: true,
      },
    ],
    connectorCommercialTerms:
      "Tally bridge setup is Aurumi-assisted and included in the offer price; no separate Workspace connector fee applies.",
    professionalServicesRequired: false,
    quoteOnly: false,
    active: true,
  },
];

/** Offer price is set commercially — not Aura base price + connector price. */
const AURA_OFFER_USD: Record<string, number | null> = {
  "aura.tally": 29,
};

const PLAN_USD: Record<string, number | null> = Object.fromEntries(PLAN_DEFS.map((p) => [p.id, p.usd]));

function round(value: number, currency: string) {
  if (currency === "INR") return Math.round(value / 10) * 10;
  return Math.round(value);
}

function priceRows(productId: string, usdMonthly: number | null, annualDiscountPct = 20, quoteOnly = false): PriceRule[] {
  return MARKETS.map((m) => {
    const monthly = usdMonthly === null ? null : round(usdMonthly * (MARKET_FACTOR[m.id] ?? 1), m.currency);
    const annual = monthly === null ? null : round(monthly * 12 * (1 - annualDiscountPct / 100), m.currency);
    return {
      productId,
      market: m.id,
      currency: m.currency,
      monthly,
      annual,
      annualDiscountPct,
      taxIncluded: m.taxIncluded,
      quoteOnly,
    };
  });
}

export const PRICES: PriceRule[] = [
  ...PLANS.flatMap((p) => priceRows(p.id, PLAN_USD[p.id] ?? null, 20, p.custom)),
  ...APPS.filter((a) => a.classification === "Premium").flatMap((a) => priceRows(a.id, APP_USD[a.id] ?? null, 15)),
  ...CONNECTORS.flatMap((c) => {
    const rows: PriceRule[] = [];
    const usd = CONN_USD[c.id];
    if (c.hasRecurringPrice) rows.push(...priceRows(c.id, usd?.rec ?? null, 10));
    if (c.hasOneTimePrice) rows.push(...priceRows(`${c.id}:setup`, usd?.once ?? null, 0));
    if (c.quoteOnly) rows.push(...priceRows(c.id, null, 0, true));
    return rows;
  }),
  ...ADDONS.flatMap((a) => priceRows(a.id, ADDON_USD[a.id] ?? null, 15)),
  ...AURA_OFFERS.flatMap((o) => priceRows(o.id, AURA_OFFER_USD[o.id] ?? null, 20, o.quoteOnly)),
];

export const PROMOTIONS: Promotion[] = [
  {
    id: "promo.launch",
    name: "Launch Offer — 20% off first year",
    code: "AURUMI20",
    type: "percentage",
    value: 20,
    annualOnly: true,
    eligiblePlans: ["plan.starter", "plan.growth", "plan.business"],
    eligibleMarkets: ["IN", "SG", "AE", "US", "INTL"],
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    active: true,
  },
  {
    id: "promo.india",
    name: "India first-month discount",
    code: "INDIA1",
    type: "first_period",
    value: 50,
    annualOnly: false,
    eligiblePlans: ["plan.starter", "plan.growth"],
    eligibleMarkets: ["IN"],
    startDate: "2026-01-01",
    endDate: "2026-09-30",
    active: false,
  },
];

export const TENANTS: Tenant[] = [
  { id: "tnt.northwind", name: "Northwind Retail", primaryMarket: "IN", contactEmail: "ops@northwind.example" },
  { id: "tnt.helios", name: "Helios Trading", primaryMarket: "AE", contactEmail: "finance@helios.example" },
  { id: "tnt.marina", name: "Marina Foods", primaryMarket: "SG", contactEmail: "admin@marina.example" },
  { id: "tnt.pinecrest", name: "Pinecrest Labs", primaryMarket: "US", contactEmail: "it@pinecrest.example" },
];

export function seedCatalogue(): Catalogue {
  return {
    version: 1,
    plans: PLANS,
    apps: APPS,
    connectors: CONNECTORS,
    addOns: ADDONS,
    auraOffers: AURA_OFFERS,
    markets: MARKETS,
    promotions: PROMOTIONS,
    prices: PRICES,
    rules: {
      allowUpgrade: true,
      allowDowngrade: true,
      upgradeTiming: "immediate",
      downgradeTiming: "next_cycle",
      prorateUpgrades: true,
      prorateDowngrades: false,
      cancellationTiming: "end_of_term",
      allowReactivation: true,
      trialDays: 14,
      gracePeriodDays: 7,
    },
    settings: {
      showMarketSelector: true,
      defaultMarket: "US",
      intelligenceUnitLabel: "Aurumi Intelligence Credits (AIC)",
      transferUnitLabel: "Data Transfer (GB / month)",
      storageUnitLabel: "Storage (GB)",
    },
  };
}

export function seedState(): CommerceState {
  return {
    draft: seedCatalogue(),
    published: seedCatalogue(),
    tenants: TENANTS,
    subscriptions: [],
    lastPublishedAt: null,
    changeLog: [],
  };
}
