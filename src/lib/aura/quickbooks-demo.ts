/**
 * Simulated QuickBooks business dataset + deterministic answer engine.
 *
 * Everything here is fictional demonstration data. Nothing in this module
 * talks to QuickBooks, to a real connector, or to any AI service.
 */

import type { DemoAnswer, DemoQuestion } from "./tally-demo";

const USD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/** Fictional company used across the demo. */
export const QB_DEMO_COMPANY = {
  name: "Harbor Lane Supply Co.",
  fiscalYear: "FY 2026",
  lastMonth: "August 2026",
  quarter: "Q3 2026",
};

export const QB_MONTHLY_REVENUE: { month: string; revenue: number }[] = [
  { month: "Mar", revenue: 218400 },
  { month: "Apr", revenue: 241900 },
  { month: "May", revenue: 233600 },
  { month: "Jun", revenue: 264800 },
  { month: "Jul", revenue: 279300 },
  { month: "Aug", revenue: 302150 },
];

export const QB_CUSTOMERS: {
  name: string;
  revenueYtd: number;
  openBalance: number;
  overdueDays: number;
}[] = [
  { name: "Bridgeport Interiors", revenueYtd: 312500, openBalance: 48200, overdueDays: 37 },
  { name: "Coastline Cafés LLC", revenueYtd: 246800, openBalance: 15400, overdueDays: 0 },
  { name: "Ridgeway Contracting", revenueYtd: 198300, openBalance: 33750, overdueDays: 12 },
  { name: "Alder & Finch Studio", revenueYtd: 141200, openBalance: 0, overdueDays: 0 },
  { name: "Summit Fitness Group", revenueYtd: 96700, openBalance: 21900, overdueDays: 54 },
];

export const QB_EXPENSES: { account: string; amount: number }[] = [
  { account: "Cost of goods sold", amount: 148600 },
  { account: "Payroll & benefits", amount: 62400 },
  { account: "Rent & utilities", amount: 14800 },
  { account: "Shipping & freight", amount: 11250 },
  { account: "Software subscriptions", amount: 6480 },
  { account: "Marketing & advertising", amount: 5920 },
];

export const QB_VENDORS: { vendor: string; openBalance: number; dueInDays: number }[] = [
  { vendor: "Northgate Wholesale", openBalance: 42300, dueInDays: 11 },
  { vendor: "Pallet & Crate Co.", openBalance: 18750, dueInDays: 5 },
  { vendor: "Lakeshore Freight", openBalance: 9400, dueInDays: 21 },
];

export const QB_PROFIT_AND_LOSS = {
  quarterRevenue: 846250,
  quarterExpenses: 671400,
  quarterNetIncome: 174850,
  grossMarginPct: 41,
};

export const QB_CASH = {
  operatingBalance: 186400,
  savingsBalance: 95000,
  inflowsLastMonth: 288700,
  outflowsLastMonth: 251300,
};

export const QB_INVOICE_SUMMARY = {
  lastMonthInvoiced: 302150,
  previousMonthInvoiced: 279300,
  invoiceCount: 168,
  averageInvoice: 1799,
  openInvoices: 41,
  yearToDateRevenue: 1540150,
};

export const QB_SAMPLE_QUESTIONS: DemoQuestion[] = [
  { id: "qb-invoiced-last-month", question: "How much did we invoice last month?", topic: "sales" },
  { id: "qb-owes-most", question: "Which customers owe us the most?", topic: "receivables" },
  { id: "qb-overdue", question: "Show me our overdue invoices.", topic: "receivables" },
  { id: "qb-expenses", question: "What were our biggest expenses last month?", topic: "expenses" },
  { id: "qb-ytd", question: "How much revenue have we made this year?", topic: "sales" },
  { id: "qb-profit", question: "What is our profit this quarter?", topic: "sales" },
  { id: "qb-vendors", question: "How much do we owe our vendors?", topic: "expenses" },
  { id: "qb-trend", question: "Show me our monthly revenue trend.", topic: "sales" },
  { id: "qb-cash", question: "How is our cash flow looking?", topic: "sales" },
];

const totalOpenBalance = QB_CUSTOMERS.reduce((s, c) => s + c.openBalance, 0);
const totalPayables = QB_VENDORS.reduce((s, v) => s + v.openBalance, 0);

function invoicedLastMonth(): DemoAnswer {
  const change = Math.round(
    ((QB_INVOICE_SUMMARY.lastMonthInvoiced - QB_INVOICE_SUMMARY.previousMonthInvoiced) /
      QB_INVOICE_SUMMARY.previousMonthInvoiced) *
      100,
  );
  return {
    headline: `You invoiced ${USD(QB_INVOICE_SUMMARY.lastMonthInvoiced)} in ${QB_DEMO_COMPANY.lastMonth}.`,
    detail: `That's ${change}% higher than July, across ${QB_INVOICE_SUMMARY.invoiceCount} invoices with an average invoice of ${USD(QB_INVOICE_SUMMARY.averageInvoice)}.`,
    metric: [
      { label: "August invoiced", value: USD(QB_INVOICE_SUMMARY.lastMonthInvoiced) },
      { label: "vs July", value: `+${change}%` },
      { label: "Invoices", value: String(QB_INVOICE_SUMMARY.invoiceCount) },
    ],
  };
}

function revenueYtd(): DemoAnswer {
  return {
    headline: `Revenue for ${QB_DEMO_COMPANY.fiscalYear} to date is ${USD(QB_INVOICE_SUMMARY.yearToDateRevenue)}.`,
    detail: `August was your strongest month at ${USD(QB_INVOICE_SUMMARY.lastMonthInvoiced)}, and revenue has grown in four of the last six months.`,
    chart: QB_MONTHLY_REVENUE.map((m) => ({ label: m.month, value: m.revenue })),
  };
}

function revenueTrend(): DemoAnswer {
  return {
    headline: "Monthly revenue is trending upward.",
    detail:
      "March through August shows steady growth, with a small dip in May followed by three consecutive record months.",
    chart: QB_MONTHLY_REVENUE.map((m) => ({ label: m.month, value: m.revenue })),
  };
}

function topCustomers(): DemoAnswer {
  const sorted = [...QB_CUSTOMERS].sort((a, b) => b.revenueYtd - a.revenueYtd);
  return {
    headline: `${sorted[0]!.name} is your largest customer this year.`,
    detail: `Your top five customers account for ${USD(sorted.reduce((s, c) => s + c.revenueYtd, 0))} of revenue in ${QB_DEMO_COMPANY.fiscalYear}.`,
    table: {
      columns: ["Customer", "Revenue YTD", "Open balance"],
      rows: sorted.map((c) => [c.name, USD(c.revenueYtd), c.openBalance ? USD(c.openBalance) : "—"]),
    },
  };
}

function receivables(overdueOnly: boolean): DemoAnswer {
  const list = QB_CUSTOMERS.filter((c) => c.openBalance > 0 && (!overdueOnly || c.overdueDays > 0)).sort(
    (a, b) => b.openBalance - a.openBalance,
  );
  const total = list.reduce((s, c) => s + c.openBalance, 0);
  return {
    headline: overdueOnly
      ? `${list.length} customers have overdue invoices, totalling ${USD(total)}.`
      : `${USD(totalOpenBalance)} is outstanding across ${list.length} customers.`,
    detail: overdueOnly
      ? "Summit Fitness Group is the oldest at 54 days. Bridgeport Interiors carries the largest overdue balance."
      : `You have ${QB_INVOICE_SUMMARY.openInvoices} open invoices as at the end of ${QB_DEMO_COMPANY.lastMonth}.`,
    table: {
      columns: ["Customer", "Open balance", "Overdue by"],
      rows: list.map((c) => [c.name, USD(c.openBalance), c.overdueDays ? `${c.overdueDays} days` : "Not due"]),
    },
  };
}

function expenses(): DemoAnswer {
  const sorted = [...QB_EXPENSES].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, e) => s + e.amount, 0);
  return {
    headline: `Your biggest expense in ${QB_DEMO_COMPANY.lastMonth} was ${sorted[0]!.account.toLowerCase()} at ${USD(sorted[0]!.amount)}.`,
    detail: `Total expenses for the month were ${USD(total)} across ${sorted.length} accounts.`,
    table: {
      columns: ["Expense account", "Amount"],
      rows: sorted.map((e) => [e.account, USD(e.amount)]),
    },
  };
}

function payables(): DemoAnswer {
  const sorted = [...QB_VENDORS].sort((a, b) => a.dueInDays - b.dueInDays);
  return {
    headline: `You owe ${USD(totalPayables)} to vendors.`,
    detail: "Pallet & Crate Co. is due first, in 5 days.",
    table: {
      columns: ["Vendor", "Open balance", "Due in"],
      rows: sorted.map((v) => [v.vendor, USD(v.openBalance), `${v.dueInDays} days`]),
    },
  };
}

function profitAndLoss(): DemoAnswer {
  return {
    headline: `Net income for ${QB_DEMO_COMPANY.quarter} is ${USD(QB_PROFIT_AND_LOSS.quarterNetIncome)}.`,
    detail: `On revenue of ${USD(QB_PROFIT_AND_LOSS.quarterRevenue)} and expenses of ${USD(QB_PROFIT_AND_LOSS.quarterExpenses)}, gross margin is ${QB_PROFIT_AND_LOSS.grossMarginPct}%.`,
    metric: [
      { label: "Revenue", value: USD(QB_PROFIT_AND_LOSS.quarterRevenue) },
      { label: "Expenses", value: USD(QB_PROFIT_AND_LOSS.quarterExpenses) },
      { label: "Net income", value: USD(QB_PROFIT_AND_LOSS.quarterNetIncome) },
    ],
  };
}

function cashFlow(): DemoAnswer {
  const net = QB_CASH.inflowsLastMonth - QB_CASH.outflowsLastMonth;
  return {
    headline: `You hold ${USD(QB_CASH.operatingBalance + QB_CASH.savingsBalance)} across your bank accounts.`,
    detail: `In ${QB_DEMO_COMPANY.lastMonth}, ${USD(QB_CASH.inflowsLastMonth)} came in and ${USD(QB_CASH.outflowsLastMonth)} went out — a net movement of ${USD(net)}.`,
    metric: [
      { label: "Operating", value: USD(QB_CASH.operatingBalance) },
      { label: "Savings", value: USD(QB_CASH.savingsBalance) },
      { label: "Net movement", value: USD(net) },
    ],
  };
}

const FALLBACK: DemoAnswer = {
  headline: "That one's outside this demo's business context.",
  detail:
    "I can demonstrate questions based on the QuickBooks business context available in this demo. Try asking about revenue, customers, invoices, expenses, vendors, payables or cash flow.",
};

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

/** Deterministic, local answer engine over the simulated QuickBooks dataset. */
export function answerQuickBooksQuestion(raw: string): DemoAnswer {
  const q = raw.toLowerCase().trim();
  if (!q) return FALLBACK;

  if (has(q, "cash flow", "cash", "bank", "balance in")) return cashFlow();
  if (has(q, "profit", "net income", "p&l", "profit and loss", "margin")) return profitAndLoss();
  if (has(q, "overdue", "late", "aging", "ageing", "past due")) return receivables(true);
  if (has(q, "owe us", "outstanding", "receivable", "unpaid", "open invoice", "owes"))
    return receivables(false);
  if (has(q, "vendor", "payable", "bill", "supplier", "we owe")) return payables();
  if (has(q, "expense", "spend", "spent", "cost", "cogs")) return expenses();
  if (has(q, "trend", "month by month", "monthly revenue", "chart", "growth")) return revenueTrend();
  if (has(q, "this year", "year to date", "ytd", "annual revenue")) return revenueYtd();
  if (has(q, "top customer", "best customer", "biggest customer", "customer")) return topCustomers();
  if (has(q, "invoice", "sales", "revenue", "billed", "sold", "sell")) return invoicedLastMonth();

  return FALLBACK;
}
