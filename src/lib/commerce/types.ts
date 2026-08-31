// Core commercial model for Aurumi.
// CATALOGUE -> PRICING RULES -> SUBSCRIPTION -> ENTITLEMENTS -> USER/ROLE ACCESS

export type BillingCycle = "monthly" | "annual";

export type MarketId = "IN" | "SG" | "AE" | "US" | "INTL";

export type EntitlementKey =
  | "users.included"
  | "apps.standard.all"
  | "apps.premium"
  | "connectors.standard.quantity"
  | "connectors.additional.quantity"
  | "capacity.intelligence"
  | "capacity.storage"
  | "capacity.transfer"
  | "support.level"
  | "governance.advanced"
  | "sla";

export interface Entitlement {
  key: EntitlementKey;
  /** numeric quantity where applicable (users, GB, connectors, AIC) */
  value?: number;
  /** qualitative value where applicable (support tier, app id, sla) */
  label?: string;
  unit?: string;
  source?: string;
}

export interface Money {
  amount: number;
  currency: string;
}

/** Price for one product, in one market, for one billing cycle. */
export interface PriceRule {
  productId: string;
  market: MarketId;
  currency: string;
  monthly: number | null;
  annual: number | null;
  /** percent, e.g. 20 */
  annualDiscountPct: number;
  taxIncluded: boolean;
  quoteOnly?: boolean;
}

export type SupportLevel = "Standard" | "Priority" | "Premium" | "Dedicated";

export interface Plan {
  id: string;
  name: string;
  description: string;
  publicVisible: boolean;
  active: boolean;
  custom: boolean; // Enterprise-style: custom capacity & quoted pricing
  includedUsers: number | null;
  includedIntelligence: number | null; // Aurumi Intelligence Credits (AIC) / month
  includedStorageGb: number | null;
  includedTransferGb: number | null;
  includedStandardConnectors: number | null;
  supportLevel: SupportLevel;
  eligibleMarkets: MarketId[];
  order: number;
}

export type AppCategory =
  | "Core"
  | "Sales"
  | "Finance"
  | "Stores"
  | "Security"
  | "IT"
  | "Aurumi Internal";

export interface AurumiApp {
  id: string;
  name: string;
  category: AppCategory;
  classification: "Standard" | "Premium";
  active: boolean;
  publicVisible: boolean;
  description: string;
  eligiblePlans: string[];
  entitlements: Entitlement[];
}

export type ConnectorCategory =
  | "Accounting"
  | "Commerce"
  | "Payments"
  | "Productivity"
  | "Logistics"
  | "Data"
  | "Custom";

export interface Connector {
  id: string;
  name: string;
  category: ConnectorCategory;
  status: "Available" | "Beta" | "Planned" | "Deprecated";
  classification: "Standard" | "Additional" | "Custom";
  active: boolean;
  publicVisible: boolean;
  description: string;
  setupComplexity: "Low" | "Medium" | "High";
  setupMode: "Self-service" | "Aurumi-assisted";
  professionalServicesRequired: boolean;
  storageImpact: "Low" | "Medium" | "High";
  transferImpact: "Low" | "Medium" | "High";
  intelligenceImpact: "Low" | "Medium" | "High";
  eligiblePlans: string[];
  /** one-time implementation fee product id shares connector id + ":setup" */
  hasRecurringPrice: boolean;
  hasOneTimePrice: boolean;
  quoteOnly: boolean;
}

export type AddOnUnit = "user" | "GB" | "AIC" | "TB";

export interface AddOn {
  id: string;
  name: string;
  description: string;
  unit: AddOnUnit;
  unitLabel: string;
  /** Units of capacity delivered per purchased quantity (e.g. 1 unit = 100 GB). */
  unitSize: number;
  /** Quantity must be a multiple of this (e.g. users sold in 10-user increments). */
  quantityStep: number;
  minQuantity: number;
  maxQuantity: number | null;
  recurring: boolean;
  eligiblePlans: string[];
  eligibleMarkets: MarketId[];
  active: boolean;
  entitlement: Entitlement;
}

export interface Market {
  id: MarketId;
  name: string;
  currency: string;
  currencySymbol: string;
  taxName: string;
  taxRatePct: number;
  taxIncluded: boolean;
  paymentProvider: string;
  paymentMethods: string[];
  active: boolean;
}

export interface Promotion {
  id: string;
  name: string;
  code: string;
  type: "percentage" | "fixed" | "first_period";
  value: number;
  annualOnly: boolean;
  eligiblePlans: string[];
  eligibleMarkets: MarketId[];
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface SubscriptionRules {
  allowUpgrade: boolean;
  allowDowngrade: boolean;
  upgradeTiming: "immediate" | "next_cycle";
  downgradeTiming: "immediate" | "next_cycle";
  prorateUpgrades: boolean;
  prorateDowngrades: boolean;
  cancellationTiming: "immediate" | "end_of_term";
  allowReactivation: boolean;
  trialDays: number;
  gracePeriodDays: number;
}

export interface Settings {
  showMarketSelector: boolean; // dev-only simulator, disable before launch
  defaultMarket: MarketId;
  intelligenceUnitLabel: string;
  transferUnitLabel: string;
  storageUnitLabel: string;
}

export interface Catalogue {
  /** Simulated catalogue version — incremented on every publish. */
  version: number;
  plans: Plan[];
  apps: AurumiApp[];
  connectors: Connector[];
  addOns: AddOn[];
  markets: Market[];
  promotions: Promotion[];
  prices: PriceRule[];
  rules: SubscriptionRules;
  settings: Settings;
}

/* ---------------- Tenant subscription ---------------- */

export interface Tenant {
  id: string;
  name: string;
  primaryMarket: MarketId;
  contactEmail: string;
}

export interface CartLine {
  id: string;
  productId: string;
  kind: "plan" | "premium_app" | "connector" | "connector_setup" | "addon" | "service";
  label: string;
  quantity: number;
  unitAmount: number; // per billing cycle for recurring, absolute for one-time
  recurring: boolean;
  quoteOnly?: boolean;
}

export interface OrderTotals {
  currency: string;
  recurringSubtotal: number;
  oneTimeSubtotal: number;
  discount: number;
  taxableBase: number;
  tax: number;
  recurringTotal: number;
  oneTimeTotal: number;
  total: number;
  taxRatePct: number;
  taxName: string;
  billedAnnually?: number;
  monthlyEquivalent?: number;
  annualSavePct?: number;
}

export type SubscriptionStatus =
  | "draft"
  | "pending_payment"
  | "active"
  | "payment_failed"
  | "pending_cancellation"
  | "cancelled"
  | "expired";

/**
 * Simulated payment only. A real payment provider will own this state in a
 * later phase — nothing here represents a verified real-world payment.
 */
export type SimulatedPaymentStatus =
  | "not_required"
  | "awaiting_simulated_payment"
  | "simulated_paid"
  | "simulated_failed";

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  market: MarketId;
  currency: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  includedUsers: number | null;
  additionalUsers: number;
  standardAppsEntitled: boolean;
  premiumAppIds: string[];
  standardConnectorIds: string[];
  additionalConnectorIds: string[];
  additionalIntelligence: number;
  additionalStorageGb: number;
  additionalTransferGb: number;
  lines: CartLine[];
  totals: OrderTotals;
  promotionCode: string | null;
  /** Catalogue version this subscription was created from. */
  catalogueVersion: number;
  paymentProvider: string;
  /** Always "simulated" in this prototype. */
  paymentMode: "simulated";
  paymentStatus: SimulatedPaymentStatus;
  startDate: string;
  renewalDate: string;
  cancellationRequested: boolean;
  cancellationEffective: string | null;
  entitlements: Entitlement[];
  changeLog: SubscriptionChange[];
}

export interface SubscriptionChange {
  id: string;
  type:
    | "upgrade"
    | "downgrade"
    | "add_users"
    | "remove_users"
    | "add_premium_app"
    | "remove_premium_app"
    | "add_connector"
    | "remove_connector"
    | "add_capacity"
    | "cancel"
    | "reactivate"
    | "payment_simulated"
    | "payment_failed"
    | "activated"
    | "expired"
    | "created";
  description: string;
  timing: "immediate" | "next_cycle";
  prorated: boolean;
  effectiveDate: string;
  createdAt: string;
}

export interface CommerceState {
  draft: Catalogue;
  published: Catalogue;
  tenants: Tenant[];
  subscriptions: TenantSubscription[];
  lastPublishedAt: string | null;
  changeLog: { id: string; at: string; entity: string; summary: string }[];
}
