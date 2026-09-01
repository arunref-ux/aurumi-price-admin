# Aurumi Price Admin — RDBMS Schema (Postgres)

Derived from an end-to-end audit of the running prototype: `src/lib/commerce/types.ts`
(authoritative model), `seed.ts` (data conventions), `store.tsx` (persistence + draft/
published scoping), `pricing.ts`, `cart.ts`, `aura.ts`, `bundles.ts`, `entitlements.ts`,
`validation.ts`, and the Aura/Bundle offer providers.

## Modelling decisions

1. **Catalogue is versioned as a whole.** The app keeps two `Catalogue` objects
   (`draft`, `published`) and stamps subscriptions with `catalogueVersion`. So every
   catalogue entity is a child of a `catalogue` row, and immutability applies to
   published catalogues.
2. **Arrays become junction tables** (`eligibleMarkets`, `eligiblePlans`,
   `enabledAddOnIds`, `connectorIds`, `appIds`, `premiumAppIds`, ...).
3. **Entitlements are derived, never stored** for plans/add-ons (see
   `entitlements.ts`). Only *declared* entitlements that exist as catalogue data
   (app entitlements, add-on entitlement) are tables; tenant entitlements are a view.
4. **Prices are one table** keyed `(catalogue, product_id, market)`; `product_id` is a
   polymorphic catalogue key (`plan.*`, `app.*`, `conn.*`, `conn.*:setup`, `addon.*`,
   `aura.*`, `bundle.*`, `bundle.*:setup-us`). One-time charges reuse the `monthly`
   column, as the code does (`treatment = 'one_time'` reads `rule.monthly`).
5. **Payments stay provider-agnostic**: `payment_provider` is text and payment status
   is the simulated enum used today; a Stripe adapter adds columns, not a new model.

---

## 1. Enums

```sql
CREATE TYPE billing_cycle       AS ENUM ('monthly','annual');
CREATE TYPE market_id           AS ENUM ('IN','SG','AE','US','INTL');
CREATE TYPE catalogue_scope     AS ENUM ('draft','published');
CREATE TYPE support_level       AS ENUM ('Standard','Priority','Premium','Dedicated');
CREATE TYPE app_category        AS ENUM ('Core','Sales','Finance','Stores','Security','IT','Aurumi Internal');
CREATE TYPE app_classification  AS ENUM ('Standard','Premium');
CREATE TYPE connector_category  AS ENUM ('Accounting','Commerce','Payments','Productivity','Logistics','Data','Custom');
CREATE TYPE connector_status    AS ENUM ('Available','Beta','Planned','Deprecated');
CREATE TYPE connector_class     AS ENUM ('Standard','Additional','Custom');
CREATE TYPE impact_level        AS ENUM ('Low','Medium','High');
CREATE TYPE setup_complexity    AS ENUM ('Low','Medium','High');
CREATE TYPE setup_mode          AS ENUM ('Self-service','Aurumi-assisted');
CREATE TYPE offer_status        AS ENUM ('Draft','Available','Retired');
CREATE TYPE commercial_treatment AS ENUM ('recurring','one_time','included','quote_required');
CREATE TYPE aura_component_kind  AS ENUM ('aura','connector','setup','professional_services','other');
CREATE TYPE bundle_component_kind AS ENUM ('bundle','aura','connector','setup','professional_services','other');
CREATE TYPE addon_unit          AS ENUM ('user','GB','AIC','TB');
CREATE TYPE promotion_type      AS ENUM ('percentage','fixed','first_period');
CREATE TYPE change_timing       AS ENUM ('immediate','next_cycle');
CREATE TYPE cancellation_timing AS ENUM ('immediate','end_of_term');
CREATE TYPE entitlement_key     AS ENUM (
  'users.included','apps.standard.all','apps.premium',
  'connectors.standard.quantity','connectors.additional.quantity',
  'capacity.intelligence','capacity.storage','capacity.transfer',
  'support.level','governance.advanced','sla',
  'aura.capability','aura.connector');
CREATE TYPE product_line        AS ENUM ('workspace','aura');
CREATE TYPE subscription_status AS ENUM (
  'draft','quote_required','pending_payment','active',
  'payment_failed','pending_cancellation','cancelled','expired');
CREATE TYPE simulated_payment_status AS ENUM (
  'not_required','quote_pending','awaiting_simulated_payment',
  'simulated_paid','simulated_failed');
CREATE TYPE cart_line_kind      AS ENUM ('plan','premium_app','connector','connector_setup','addon','service');
CREATE TYPE charge_class        AS ENUM ('included','add_on','additional_charge','custom_quote');
CREATE TYPE bundle_addition_status AS ENUM ('quote_required','pending_payment','active');
CREATE TYPE subscription_change_type AS ENUM (
  'upgrade','downgrade','add_users','remove_users','add_premium_app','remove_premium_app',
  'add_connector','remove_connector','add_capacity','cancel','reactivate',
  'payment_simulated','payment_failed','activated','expired','created','quote_requested');
```

## 2. Catalogue container (draft / published / version history)

```sql
CREATE TABLE catalogue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version       integer NOT NULL,
  scope         catalogue_scope NOT NULL,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version)
);
-- exactly one working draft
CREATE UNIQUE INDEX catalogue_one_draft ON catalogue (scope) WHERE scope = 'draft';

-- catalogue-level singletons (Settings + SubscriptionRules)
CREATE TABLE catalogue_settings (
  catalogue_id           uuid PRIMARY KEY REFERENCES catalogue(id) ON DELETE CASCADE,
  show_market_selector   boolean NOT NULL DEFAULT true,
  default_market         market_id NOT NULL,
  intelligence_unit_label text NOT NULL,
  transfer_unit_label     text NOT NULL,
  storage_unit_label      text NOT NULL
);

CREATE TABLE subscription_rules (
  catalogue_id        uuid PRIMARY KEY REFERENCES catalogue(id) ON DELETE CASCADE,
  allow_upgrade       boolean NOT NULL,
  allow_downgrade     boolean NOT NULL,
  upgrade_timing      change_timing NOT NULL,
  downgrade_timing    change_timing NOT NULL,
  prorate_upgrades    boolean NOT NULL,
  prorate_downgrades  boolean NOT NULL,
  cancellation_timing cancellation_timing NOT NULL,
  allow_reactivation  boolean NOT NULL,
  trial_days          integer NOT NULL CHECK (trial_days >= 0),
  grace_period_days   integer NOT NULL CHECK (grace_period_days >= 0)
);

CREATE TABLE market (
  catalogue_id     uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id               market_id NOT NULL,
  name             text NOT NULL,
  currency         char(3) NOT NULL,
  currency_symbol  text NOT NULL,
  tax_name         text NOT NULL,
  tax_rate_pct     numeric(6,3) NOT NULL CHECK (tax_rate_pct >= 0),
  tax_included     boolean NOT NULL,
  payment_provider text NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  PRIMARY KEY (catalogue_id, id)
);

CREATE TABLE market_payment_method (
  catalogue_id uuid NOT NULL,
  market_id    market_id NOT NULL,
  method       text NOT NULL,
  PRIMARY KEY (catalogue_id, market_id, method),
  FOREIGN KEY (catalogue_id, market_id) REFERENCES market(catalogue_id, id) ON DELETE CASCADE
);
```

## 3. Products

```sql
CREATE TABLE plan (
  catalogue_id  uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id            text NOT NULL,                    -- 'plan.starter'
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  public_visible boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  custom        boolean NOT NULL DEFAULT false,   -- enterprise: quoted, custom capacity
  included_users               integer CHECK (included_users >= 0),
  included_intelligence        integer CHECK (included_intelligence >= 0),
  included_storage_gb          integer CHECK (included_storage_gb >= 0),
  included_transfer_gb         integer CHECK (included_transfer_gb >= 0),
  included_standard_connectors integer CHECK (included_standard_connectors >= 0),
  support_level support_level NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (catalogue_id, id),
  -- custom plans carry NULL capacity; non-custom plans must be quantified
  CHECK (custom OR included_users IS NOT NULL)
);

CREATE TABLE plan_market (
  catalogue_id uuid NOT NULL, plan_id text NOT NULL, market_id market_id NOT NULL,
  PRIMARY KEY (catalogue_id, plan_id, market_id),
  FOREIGN KEY (catalogue_id, plan_id) REFERENCES plan(catalogue_id, id) ON DELETE CASCADE
);

CREATE TABLE app (
  catalogue_id   uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id             text NOT NULL,                   -- 'app.crm'
  name           text NOT NULL,
  category       app_category NOT NULL,
  classification app_classification NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  public_visible boolean NOT NULL DEFAULT true,
  description    text NOT NULL DEFAULT '',
  PRIMARY KEY (catalogue_id, id)
);

CREATE TABLE app_plan_eligibility (
  catalogue_id uuid NOT NULL, app_id text NOT NULL, plan_id text NOT NULL,
  PRIMARY KEY (catalogue_id, app_id, plan_id),
  FOREIGN KEY (catalogue_id, app_id)  REFERENCES app(catalogue_id, id)  ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, plan_id) REFERENCES plan(catalogue_id, id) ON DELETE CASCADE
);

-- declared (catalogue) entitlements shipped by an app
CREATE TABLE app_entitlement (
  id           bigserial PRIMARY KEY,
  catalogue_id uuid NOT NULL, app_id text NOT NULL,
  key          entitlement_key NOT NULL,
  value        numeric,
  label        text,
  unit         text,
  source       text,
  FOREIGN KEY (catalogue_id, app_id) REFERENCES app(catalogue_id, id) ON DELETE CASCADE
);

CREATE TABLE connector (
  catalogue_id   uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id             text NOT NULL,                   -- 'conn.tally'
  name           text NOT NULL,
  category       connector_category NOT NULL,
  status         connector_status NOT NULL,
  classification connector_class NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  public_visible boolean NOT NULL DEFAULT true,
  description    text NOT NULL DEFAULT '',
  setup_complexity setup_complexity NOT NULL,
  setup_mode       setup_mode NOT NULL,
  professional_services_required boolean NOT NULL DEFAULT false,
  storage_impact      impact_level NOT NULL,
  transfer_impact     impact_level NOT NULL,
  intelligence_impact impact_level NOT NULL,
  has_recurring_price boolean NOT NULL DEFAULT false,
  has_one_time_price  boolean NOT NULL DEFAULT false,   -- price row id = '<id>:setup'
  quote_only          boolean NOT NULL DEFAULT false,
  standalone_aura_offering boolean NOT NULL DEFAULT false,
  custom_commercial_treatment text,                      -- bespoke terms => quote when unpriced
  PRIMARY KEY (catalogue_id, id)
);

CREATE TABLE connector_plan_eligibility (
  catalogue_id uuid NOT NULL, connector_id text NOT NULL, plan_id text NOT NULL,
  PRIMARY KEY (catalogue_id, connector_id, plan_id),
  FOREIGN KEY (catalogue_id, connector_id) REFERENCES connector(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, plan_id)      REFERENCES plan(catalogue_id, id)      ON DELETE CASCADE
);

CREATE TABLE addon (
  catalogue_id  uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id            text NOT NULL,                    -- 'addon.storage'
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  unit          addon_unit NOT NULL,
  unit_label    text NOT NULL,
  unit_size     integer NOT NULL CHECK (unit_size > 0),      -- capacity per purchased qty
  quantity_step integer NOT NULL CHECK (quantity_step > 0),
  min_quantity  integer NOT NULL CHECK (min_quantity >= 0),
  max_quantity  integer CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  recurring     boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  -- single declared entitlement delivered per add-on
  ent_key   entitlement_key NOT NULL,
  ent_value numeric, ent_label text, ent_unit text, ent_source text,
  PRIMARY KEY (catalogue_id, id)
);

CREATE TABLE addon_plan_eligibility (
  catalogue_id uuid NOT NULL, addon_id text NOT NULL, plan_id text NOT NULL,
  PRIMARY KEY (catalogue_id, addon_id, plan_id),
  FOREIGN KEY (catalogue_id, addon_id) REFERENCES addon(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, plan_id)  REFERENCES plan(catalogue_id, id)  ON DELETE CASCADE
);

CREATE TABLE addon_market (
  catalogue_id uuid NOT NULL, addon_id text NOT NULL, market_id market_id NOT NULL,
  PRIMARY KEY (catalogue_id, addon_id, market_id),
  FOREIGN KEY (catalogue_id, addon_id) REFERENCES addon(catalogue_id, id) ON DELETE CASCADE
);
```

## 4. Standalone Aura offers

```sql
CREATE TABLE aura_offer (
  catalogue_id uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id           text NOT NULL,                     -- 'aura.tally'
  name         text NOT NULL,
  product      text NOT NULL DEFAULT 'aura' CHECK (product = 'aura'),
  connector_id text NOT NULL,
  description  text NOT NULL DEFAULT '',
  status       offer_status NOT NULL,
  included_users         integer,
  included_intelligence  integer,
  included_storage_gb    integer,
  connector_commercial_terms text NOT NULL DEFAULT '',
  professional_services_required boolean NOT NULL DEFAULT false,
  quote_only   boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (catalogue_id, id),
  FOREIGN KEY (catalogue_id, connector_id) REFERENCES connector(catalogue_id, id)
);

CREATE TABLE aura_offer_market (
  catalogue_id uuid NOT NULL, offer_id text NOT NULL, market_id market_id NOT NULL,
  PRIMARY KEY (catalogue_id, offer_id, market_id),
  FOREIGN KEY (catalogue_id, offer_id) REFERENCES aura_offer(catalogue_id, id) ON DELETE CASCADE
);

CREATE TABLE aura_offer_addon (            -- enabledAddOnIds
  catalogue_id uuid NOT NULL, offer_id text NOT NULL, addon_id text NOT NULL,
  PRIMARY KEY (catalogue_id, offer_id, addon_id),
  FOREIGN KEY (catalogue_id, offer_id) REFERENCES aura_offer(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, addon_id) REFERENCES addon(catalogue_id, id)
);

CREATE TABLE aura_offer_component (
  catalogue_id uuid NOT NULL, offer_id text NOT NULL,
  id         text NOT NULL,                       -- 'aura.tally:setup'
  label      text NOT NULL,
  kind       aura_component_kind NOT NULL,
  treatment  commercial_treatment NOT NULL,
  product_id text,                                -- price key; required when priced
  note       text,
  required   boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (catalogue_id, offer_id, id),
  FOREIGN KEY (catalogue_id, offer_id) REFERENCES aura_offer(catalogue_id, id) ON DELETE CASCADE,
  CHECK (treatment IN ('included','quote_required') OR product_id IS NOT NULL)
);
```

## 5. Bundles

```sql
CREATE TABLE bundle (
  catalogue_id uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id           text NOT NULL,                     -- 'bundle.finance-cash-flow'
  slug         text NOT NULL,                     -- public URL segment
  name         text NOT NULL,
  positioning  text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  commercial_terms text NOT NULL DEFAULT '',
  included_users        integer,
  included_intelligence integer,
  included_storage_gb   integer,
  status       offer_status NOT NULL,
  quote_only   boolean NOT NULL DEFAULT false,
  available_directly_with_aura boolean NOT NULL DEFAULT true,
  available_as_workspace_addon boolean NOT NULL DEFAULT true,
  active       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (catalogue_id, id),
  UNIQUE (catalogue_id, slug)
);
-- requires_workspace is DERIVED, never stored:
CREATE VIEW bundle_derived AS
SELECT catalogue_id, id,
       (NOT available_directly_with_aura AND available_as_workspace_addon) AS requires_workspace
FROM bundle;

CREATE TABLE bundle_market (
  catalogue_id uuid NOT NULL, bundle_id text NOT NULL, market_id market_id NOT NULL,
  PRIMARY KEY (catalogue_id, bundle_id, market_id),
  FOREIGN KEY (catalogue_id, bundle_id) REFERENCES bundle(catalogue_id, id) ON DELETE CASCADE
);

CREATE TABLE bundle_connector (            -- connectorIds (bundle-wide default set)
  catalogue_id uuid NOT NULL, bundle_id text NOT NULL, connector_id text NOT NULL,
  PRIMARY KEY (catalogue_id, bundle_id, connector_id),
  FOREIGN KEY (catalogue_id, bundle_id)    REFERENCES bundle(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, connector_id) REFERENCES connector(catalogue_id, id)
);

CREATE TABLE bundle_app (                  -- appIds (reserved for later)
  catalogue_id uuid NOT NULL, bundle_id text NOT NULL, app_id text NOT NULL,
  PRIMARY KEY (catalogue_id, bundle_id, app_id),
  FOREIGN KEY (catalogue_id, bundle_id) REFERENCES bundle(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, app_id)    REFERENCES app(catalogue_id, id)
);

CREATE TABLE bundle_addon (                -- enabledAddOnIds
  catalogue_id uuid NOT NULL, bundle_id text NOT NULL, addon_id text NOT NULL,
  PRIMARY KEY (catalogue_id, bundle_id, addon_id),
  FOREIGN KEY (catalogue_id, bundle_id) REFERENCES bundle(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, addon_id)  REFERENCES addon(catalogue_id, id)
);

CREATE TABLE bundle_component (
  catalogue_id uuid NOT NULL, bundle_id text NOT NULL,
  id         text NOT NULL,                       -- 'bundle.finance-cash-flow:conn.tally'
  label      text NOT NULL,
  kind       bundle_component_kind NOT NULL,
  treatment  commercial_treatment NOT NULL,
  product_id text,                                -- price key when priced
  connector_id text,                              -- set when kind='connector'
  note       text,
  required   boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (catalogue_id, bundle_id, id),
  FOREIGN KEY (catalogue_id, bundle_id)    REFERENCES bundle(catalogue_id, id) ON DELETE CASCADE,
  FOREIGN KEY (catalogue_id, connector_id) REFERENCES connector(catalogue_id, id),
  CHECK (treatment IN ('included','quote_required') OR product_id IS NOT NULL),
  CHECK (kind <> 'connector' OR connector_id IS NOT NULL)
);

-- per-market composition: empty set = applies in every market the bundle is offered in
CREATE TABLE bundle_component_market (
  catalogue_id uuid NOT NULL, bundle_id text NOT NULL, component_id text NOT NULL,
  market_id market_id NOT NULL,
  PRIMARY KEY (catalogue_id, bundle_id, component_id, market_id),
  FOREIGN KEY (catalogue_id, bundle_id, component_id)
    REFERENCES bundle_component(catalogue_id, bundle_id, id) ON DELETE CASCADE
);
```

## 6. Pricing & promotions

```sql
CREATE TABLE price_rule (
  catalogue_id uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  product_id   text NOT NULL,        -- plan.* | app.* | conn.* | conn.*:setup | addon.* | aura.* | bundle.*
  market_id    market_id NOT NULL,
  currency     char(3) NOT NULL,
  monthly      numeric(12,2) CHECK (monthly >= 0),   -- also holds the one-time amount
  annual       numeric(12,2) CHECK (annual  >= 0),
  annual_discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (annual_discount_pct BETWEEN 0 AND 100),
  tax_included boolean NOT NULL DEFAULT false,
  quote_only   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (catalogue_id, product_id, market_id),
  FOREIGN KEY (catalogue_id, market_id) REFERENCES market(catalogue_id, id),
  CHECK (quote_only OR monthly IS NOT NULL OR annual IS NOT NULL)
);

CREATE TABLE promotion (
  catalogue_id uuid NOT NULL REFERENCES catalogue(id) ON DELETE CASCADE,
  id    text NOT NULL,                              -- 'promo.launch'
  name  text NOT NULL,
  code  text NOT NULL,
  type  promotion_type NOT NULL,
  value numeric(12,2) NOT NULL CHECK (value >= 0),
  annual_only boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date   date NOT NULL CHECK (end_date >= start_date),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (catalogue_id, id),
  UNIQUE (catalogue_id, upper(code)),
  CHECK (type <> 'percentage' OR value <= 100)
);

CREATE TABLE promotion_plan  (catalogue_id uuid, promotion_id text, plan_id text,
  PRIMARY KEY (catalogue_id, promotion_id, plan_id),
  FOREIGN KEY (catalogue_id, promotion_id) REFERENCES promotion(catalogue_id, id) ON DELETE CASCADE);
CREATE TABLE promotion_market(catalogue_id uuid, promotion_id text, market_id market_id,
  PRIMARY KEY (catalogue_id, promotion_id, market_id),
  FOREIGN KEY (catalogue_id, promotion_id) REFERENCES promotion(catalogue_id, id) ON DELETE CASCADE);
```

## 7. Tenants & subscriptions

```sql
CREATE TABLE tenant (
  id             text PRIMARY KEY,                 -- 'tnt.northwind'
  name           text NOT NULL,
  primary_market market_id NOT NULL,
  contact_email  text NOT NULL
);

CREATE TABLE tenant_subscription (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES tenant(id) ON DELETE RESTRICT,
  product_line  product_line NOT NULL,
  plan_id       text,                               -- NULL for standalone Aura
  aura_offer_id text,                               -- set only for standalone Aura
  catalogue_version integer NOT NULL REFERENCES catalogue(version),
  market        market_id NOT NULL,
  currency      char(3) NOT NULL,
  billing_cycle billing_cycle NOT NULL,
  status        subscription_status NOT NULL,
  included_users        integer,
  additional_users      integer NOT NULL DEFAULT 0 CHECK (additional_users >= 0),
  standard_apps_entitled boolean NOT NULL DEFAULT true,
  additional_intelligence integer NOT NULL DEFAULT 0,
  additional_storage_gb   integer NOT NULL DEFAULT 0,
  additional_transfer_gb  integer NOT NULL DEFAULT 0,
  promotion_code text,
  payment_provider text NOT NULL,
  payment_mode   text NOT NULL DEFAULT 'simulated',
  payment_status simulated_payment_status NOT NULL,
  start_date     date NOT NULL,
  renewal_date   date NOT NULL,
  cancellation_requested boolean NOT NULL DEFAULT false,
  cancellation_effective date,
  -- OrderTotals (snapshot at configuration time)
  totals_recurring_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  totals_one_time_subtotal  numeric(12,2) NOT NULL DEFAULT 0,
  totals_discount           numeric(12,2) NOT NULL DEFAULT 0,
  totals_taxable_base       numeric(12,2) NOT NULL DEFAULT 0,
  totals_tax                numeric(12,2) NOT NULL DEFAULT 0,
  totals_recurring_total    numeric(12,2) NOT NULL DEFAULT 0,
  totals_one_time_total     numeric(12,2) NOT NULL DEFAULT 0,
  totals_total              numeric(12,2) NOT NULL DEFAULT 0,
  totals_tax_rate_pct       numeric(6,3)  NOT NULL DEFAULT 0,
  totals_tax_name           text NOT NULL DEFAULT '',
  totals_billed_annually    numeric(12,2),
  totals_monthly_equivalent numeric(12,2),
  totals_annual_save_pct    numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((product_line = 'workspace' AND plan_id IS NOT NULL AND aura_offer_id IS NULL)
      OR (product_line = 'aura'      AND aura_offer_id IS NOT NULL))
);

-- selections (arrays on TenantSubscription)
CREATE TABLE subscription_premium_app (
  subscription_id text REFERENCES tenant_subscription(id) ON DELETE CASCADE,
  app_id text, PRIMARY KEY (subscription_id, app_id));
CREATE TABLE subscription_connector (
  subscription_id text REFERENCES tenant_subscription(id) ON DELETE CASCADE,
  connector_id text,
  allocation connector_class NOT NULL,        -- 'Standard' (included) | 'Additional' (charged)
  PRIMARY KEY (subscription_id, connector_id));

-- priced cart lines frozen onto the subscription
CREATE TABLE subscription_line (
  id           text NOT NULL,
  subscription_id text NOT NULL REFERENCES tenant_subscription(id) ON DELETE CASCADE,
  product_id   text NOT NULL,
  kind         cart_line_kind NOT NULL,
  label        text NOT NULL,
  quantity     integer NOT NULL CHECK (quantity > 0),
  unit_amount  numeric(12,2) NOT NULL,
  recurring    boolean NOT NULL,
  quote_only   boolean NOT NULL DEFAULT false,
  charge_class charge_class,                  -- computed by cart.ts, persisted for audit
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subscription_id, id)
);

-- entitlement SNAPSHOT frozen onto the subscription (TenantSubscription.entitlements).
-- Live entitlements are still recomputed by deriveEntitlements(); this row set is
-- the "as sold" record against the stamped catalogue version.
CREATE TABLE subscription_entitlement (
  id bigserial PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES tenant_subscription(id) ON DELETE CASCADE,
  key    entitlement_key NOT NULL,
  value  numeric,
  label  text,
  unit   text,
  source text                                  -- free-text provenance (plan/addon/app/offer id)
);

CREATE TABLE subscription_change (
  id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES tenant_subscription(id) ON DELETE CASCADE,
  type subscription_change_type NOT NULL,
  description text NOT NULL,
  timing change_timing NOT NULL,
  prorated boolean NOT NULL DEFAULT false,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 8. Workspace bundle additions

```sql
CREATE TABLE workspace_bundle_addition (
  id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES tenant_subscription(id) ON DELETE CASCADE,
  bundle_id   text NOT NULL,
  bundle_name text NOT NULL,                  -- snapshot
  catalogue_version integer NOT NULL REFERENCES catalogue(version),
  market        market_id NOT NULL,
  billing_cycle billing_cycle NOT NULL,
  currency      char(3) NOT NULL,
  recurring_amount numeric(12,2) NOT NULL DEFAULT 0,
  one_time_amount  numeric(12,2) NOT NULL DEFAULT 0,
  status bundle_addition_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bundle_addition_connector (
  addition_id text REFERENCES workspace_bundle_addition(id) ON DELETE CASCADE,
  connector_id text, PRIMARY KEY (addition_id, connector_id));

CREATE TABLE bundle_addition_addon (
  addition_id text REFERENCES workspace_bundle_addition(id) ON DELETE CASCADE,
  addon_id text,
  quantity integer NOT NULL CHECK (quantity > 0),
  units    integer NOT NULL CHECK (units > 0),   -- quantity * addon.unit_size
  PRIMARY KEY (addition_id, addon_id));

CREATE TABLE bundle_addition_line (
  id text NOT NULL,
  addition_id text NOT NULL REFERENCES workspace_bundle_addition(id) ON DELETE CASCADE,
  label text NOT NULL,
  treatment commercial_treatment NOT NULL,
  amount numeric(12,2),                        -- NULL when quote_required
  recurring boolean NOT NULL,
  PRIMARY KEY (addition_id, id)
);

CREATE TABLE bundle_addition_quote_reason (
  addition_id text REFERENCES workspace_bundle_addition(id) ON DELETE CASCADE,
  seq integer, reason text NOT NULL, PRIMARY KEY (addition_id, seq));
```

## 9. Audit log

```sql
-- catalogue edit trail (CommerceState.changeLog)
CREATE TABLE catalogue_change_log (
  id text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  entity text NOT NULL,
  summary text NOT NULL
);
```

## 10. Derived, not stored

| Concept | Source |
|---|---|
| Tenant entitlements | `deriveEntitlements()` — plan capacity + add-on units + premium apps + connectors + bundle additions |
| `requiresWorkspace` | `!availableDirectlyWithAura && availableAsWorkspaceAddon` |
| Quote-required status | any **required** component/line with no calculable price |
| Annual price | `price_rule.annual`, or monthly × 12 less `annual_discount_pct` |
| Cart lines / totals | recomputed by `cart.ts` + `pricing.ts`; persisted only as a snapshot on a saved subscription |
| Effective connector set for a bundle in a market | `bundle_component_market`, falling back to `bundle_connector` |

## 11. Out of scope (by design)

Users, roles, RBAC, usage metering, tenant health, and demo datasets
(`tally-demo`, `quickbooks-demo`, `finance-demo`) are presentation/other-suite
concerns and have no tables here.

## 12. Audit notes (second pass against the code)

Verified table-by-table against every declared interface. Findings folded in:

- `TenantSubscription.entitlements` **is** persisted in the app (a snapshot), so
  `subscription_entitlement` exists alongside the derived view — earlier drafts of this
  schema wrongly treated it as purely derived.
- `AddOn.entitlement` is a **single embedded** entitlement, not an array → inlined as
  `ent_*` columns rather than a child table. `AurumiApp.entitlements` **is** an array →
  child table `app_entitlement`.
- `Market.id` is itself the enum (`IN/SG/AE/US/INTL`), so market rows are catalogue-scoped
  with `(catalogue_id, id)` and no surrogate key.
- `Promotion.id` (`promo.*`) and `Promotion.code` (`AURUMI20`) are distinct;
  `tenant_subscription.promotion_code` references the **code**, matching the model.
- One-time prices are stored on the same `price_rule` row via `monthly`, keyed by the
  `:setup` / `:setup-us` product-id convention (`validation.ts` strips `/:setup$/`).
- `BundleOffer.appIds` is declared but unused in seed data — `bundle_app` is retained
  because the model declares it.
- `Money` in `types.ts` is declared but referenced nowhere → intentionally no table.
- `CommerceState.changeLog` is capped at 50 entries in the prototype; the SQL table has
  no cap (retention is a policy, not a schema, concern).
- Aura/Bundle `offer.ts` types (`AuraOfferView`, `BundleQuote`, `*PurchaseIntent`, demo
  datasets) are **computed view models**, never persisted → no tables.
- localStorage keys `aurumi.commerce.v2` (current) / `v1` (legacy migration source) map to
  the `catalogue` + `tenant*` + `catalogue_change_log` trees above; `lastPublishedAt`
  becomes `catalogue.published_at` on the latest published row.
