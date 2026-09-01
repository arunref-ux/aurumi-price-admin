/**
 * Simulated Tally business dataset + deterministic answer engine.
 *
 * Everything here is fictional demonstration data. Nothing in this module
 * talks to Tally, to a real connector, or to any AI service.
 */

export interface DemoAnswer {
  headline: string;
  detail: string;
  metric?: { label: string; value: string }[];
  table?: { columns: string[]; rows: string[][] };
  chart?: { label: string; value: number }[];
}

export interface DemoQuestion {
  id: string;
  question: string;
  topic: "sales" | "customers" | "receivables" | "expenses" | "gst";
}

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** Fictional company used across the demo. */
export const DEMO_COMPANY = {
  name: "Meridian Traders Pvt Ltd",
  financialYear: "FY 2025-26",
  lastMonth: "August 2025",
};

export const MONTHLY_SALES: { month: string; sales: number }[] = [
  { month: "Apr", sales: 3820000 },
  { month: "May", sales: 4140000 },
  { month: "Jun", sales: 3960000 },
  { month: "Jul", sales: 4580000 },
  { month: "Aug", sales: 5120000 },
];

export const CUSTOMERS: {
  name: string;
  salesYtd: number;
  outstanding: number;
  overdueDays: number;
}[] = [
  { name: "Nandi Industrial Supplies", salesYtd: 4260000, outstanding: 682000, overdueDays: 46 },
  { name: "Chetak Retail LLP", salesYtd: 3480000, outstanding: 214000, overdueDays: 0 },
  { name: "Vayu Electricals", salesYtd: 2910000, outstanding: 395000, overdueDays: 22 },
  { name: "Sundara Textiles", salesYtd: 2340000, outstanding: 0, overdueDays: 0 },
  { name: "Kaveri Agro Foods", salesYtd: 1870000, outstanding: 128000, overdueDays: 61 },
];

export const EXPENSES: { head: string; amount: number }[] = [
  { head: "Purchases — trading stock", amount: 2860000 },
  { head: "Salaries & wages", amount: 742000 },
  { head: "Freight & transport", amount: 268000 },
  { head: "Rent", amount: 180000 },
  { head: "Power & fuel", amount: 96000 },
  { head: "Professional fees", amount: 64000 },
];

export const PAYABLES: { supplier: string; outstanding: number; dueInDays: number }[] = [
  { supplier: "Orient Metals Co", outstanding: 512000, dueInDays: 9 },
  { supplier: "Deccan Packaging", outstanding: 226000, dueInDays: 18 },
  { supplier: "Sahyadri Logistics", outstanding: 94000, dueInDays: 4 },
];

export const GST_SUMMARY = {
  outputTax: 921600,
  inputCredit: 548400,
  netPayable: 373200,
  period: "August 2025",
};

export const SALES_SUMMARY = {
  lastMonth: 5120000,
  previousMonth: 4580000,
  invoiceCount: 214,
  averageInvoice: 23925,
};

export const SAMPLE_QUESTIONS: DemoQuestion[] = [
  { id: "sales-last-month", question: "How much did we sell last month?", topic: "sales" },
  { id: "top-customers", question: "Who are our top customers?", topic: "customers" },
  { id: "outstanding", question: "Which customers have outstanding payments?", topic: "receivables" },
  { id: "expenses", question: "What were our biggest expenses last month?", topic: "expenses" },
  { id: "trend", question: "Show me our sales trend this year.", topic: "sales" },
  { id: "overdue", question: "Which customers have overdue payments?", topic: "receivables" },
  { id: "gst", question: "How much GST did we collect last month?", topic: "gst" },
];

const totalOutstanding = CUSTOMERS.reduce((s, c) => s + c.outstanding, 0);
const totalPayables = PAYABLES.reduce((s, p) => s + p.outstanding, 0);

function salesLastMonth(): DemoAnswer {
  const change = Math.round(
    ((SALES_SUMMARY.lastMonth - SALES_SUMMARY.previousMonth) / SALES_SUMMARY.previousMonth) * 100,
  );
  return {
    headline: `You sold ${INR(SALES_SUMMARY.lastMonth)} in ${DEMO_COMPANY.lastMonth}.`,
    detail: `That's ${change}% higher than July, across ${SALES_SUMMARY.invoiceCount} invoices with an average invoice value of ${INR(SALES_SUMMARY.averageInvoice)}.`,
    metric: [
      { label: "August sales", value: INR(SALES_SUMMARY.lastMonth) },
      { label: "vs July", value: `+${change}%` },
      { label: "Invoices", value: String(SALES_SUMMARY.invoiceCount) },
    ],
  };
}

function salesTrend(): DemoAnswer {
  return {
    headline: `Sales are trending up through ${DEMO_COMPANY.financialYear}.`,
    detail:
      "April to August shows steady growth, with a dip in June followed by two strong months. August is your best month so far this year.",
    chart: MONTHLY_SALES.map((m) => ({ label: m.month, value: m.sales })),
  };
}

function topCustomers(): DemoAnswer {
  const sorted = [...CUSTOMERS].sort((a, b) => b.salesYtd - a.salesYtd);
  return {
    headline: `${sorted[0]!.name} is your largest customer this year.`,
    detail: `Your top five customers account for ${INR(sorted.reduce((s, c) => s + c.salesYtd, 0))} of sales in ${DEMO_COMPANY.financialYear}.`,
    table: {
      columns: ["Customer", "Sales YTD", "Outstanding"],
      rows: sorted.map((c) => [c.name, INR(c.salesYtd), c.outstanding ? INR(c.outstanding) : "—"]),
    },
  };
}

function receivables(overdueOnly: boolean): DemoAnswer {
  const list = CUSTOMERS.filter((c) => c.outstanding > 0 && (!overdueOnly || c.overdueDays > 0)).sort(
    (a, b) => b.outstanding - a.outstanding,
  );
  const total = list.reduce((s, c) => s + c.outstanding, 0);
  return {
    headline: overdueOnly
      ? `${list.length} customers are overdue, totalling ${INR(total)}.`
      : `${INR(totalOutstanding)} is outstanding across ${list.length} customers.`,
    detail: overdueOnly
      ? "Kaveri Agro Foods is the oldest at 61 days. Nandi Industrial Supplies carries the largest overdue balance."
      : "Balances shown are as at the end of August. Overdue days are counted from the invoice due date.",
    table: {
      columns: ["Customer", "Outstanding", "Overdue by"],
      rows: list.map((c) => [c.name, INR(c.outstanding), c.overdueDays ? `${c.overdueDays} days` : "Not due"]),
    },
  };
}

function expenses(): DemoAnswer {
  const sorted = [...EXPENSES].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, e) => s + e.amount, 0);
  return {
    headline: `Your biggest expense in ${DEMO_COMPANY.lastMonth} was ${sorted[0]!.head.toLowerCase()} at ${INR(sorted[0]!.amount)}.`,
    detail: `Total expenses for the month were ${INR(total)} across ${sorted.length} major heads.`,
    table: {
      columns: ["Expense head", "Amount"],
      rows: sorted.map((e) => [e.head, INR(e.amount)]),
    },
  };
}

function gst(): DemoAnswer {
  return {
    headline: `You collected ${INR(GST_SUMMARY.outputTax)} of GST in ${GST_SUMMARY.period}.`,
    detail: `After input credit of ${INR(GST_SUMMARY.inputCredit)}, your net GST payable for the month is ${INR(GST_SUMMARY.netPayable)}.`,
    metric: [
      { label: "Output tax", value: INR(GST_SUMMARY.outputTax) },
      { label: "Input credit", value: INR(GST_SUMMARY.inputCredit) },
      { label: "Net payable", value: INR(GST_SUMMARY.netPayable) },
    ],
  };
}

function payables(): DemoAnswer {
  const sorted = [...PAYABLES].sort((a, b) => a.dueInDays - b.dueInDays);
  return {
    headline: `You owe ${INR(totalPayables)} to suppliers.`,
    detail: "Sahyadri Logistics is due first, in 4 days.",
    table: {
      columns: ["Supplier", "Outstanding", "Due in"],
      rows: sorted.map((p) => [p.supplier, INR(p.outstanding), `${p.dueInDays} days`]),
    },
  };
}

const FALLBACK: DemoAnswer = {
  headline: "That one's outside this demo's business context.",
  detail:
    "I can demonstrate questions based on the Tally business context available in this demo. Try asking about sales, customers, receivables, expenses or GST.",
};

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

/** Deterministic, local answer engine over the simulated Tally dataset. */
export function answerTallyQuestion(raw: string): DemoAnswer {
  const q = raw.toLowerCase().trim();
  if (!q) return FALLBACK;

  if (has(q, "gst", "tax")) return gst();
  if (has(q, "overdue", "late", "aging", "ageing")) return receivables(true);
  if (has(q, "outstanding", "receivable", "owes us", "unpaid", "pending payment", "collect from"))
    return receivables(false);
  if (has(q, "payable", "supplier", "vendor", "we owe")) return payables();
  if (has(q, "expense", "spend", "cost", "purchase")) return expenses();
  if (has(q, "trend", "this year", "month by month", "growth", "chart")) return salesTrend();
  if (has(q, "top customer", "best customer", "biggest customer", "customer")) return topCustomers();
  if (has(q, "sell", "sales", "revenue", "turnover", "sold", "billed")) return salesLastMonth();

  return FALLBACK;
}
