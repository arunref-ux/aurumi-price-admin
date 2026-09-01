/**
 * Simulated CROSS-CONNECTOR business dataset + deterministic answer engine for
 * the Finance & Cash Flow Bundle.
 *
 * Everything here is fictional demonstration data. Nothing talks to
 * QuickBooks, Tally, Razorpay, Google Sheets, any real connector, or any AI
 * service. The point of this dataset is that a single answer combines several
 * business systems — which is what a bundle demonstrates.
 */
import type { DemoAnswer } from "@/lib/aura/tally-demo";

export interface BundleDemoQuestion {
  id: string;
  question: string;
  topic: "cash" | "receivables" | "sales" | "payments" | "expenses" | "health";
}

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const BUNDLE_DEMO_COMPANY = {
  name: "Harbourline Commerce Pvt Ltd",
  financialYear: "FY 2025-26",
  currentMonth: "August 2025",
  previousMonth: "July 2025",
};

/** Sources are named in answers so the connected context is visible. */
export const SOURCES = {
  quickbooks: "QuickBooks",
  tally: "Tally",
  razorpay: "Razorpay",
  sheets: "Google Sheets",
} as const;

const COLLECTIONS = {
  razorpayThisMonth: 4180000,
  bankTransfersThisMonth: 1620000,
  previousMonthTotal: 4960000,
};

const REVENUE = [
  { month: "Apr", value: 5240000 },
  { month: "May", value: 5610000 },
  { month: "Jun", value: 5380000 },
  { month: "Jul", value: 6120000 },
  { month: "Aug", value: 6890000 },
];

const OUTSTANDING = [
  { customer: "Nandi Industrial Supplies", amount: 682000, days: 46, source: SOURCES.quickbooks },
  { customer: "Vayu Electricals", amount: 395000, days: 22, source: SOURCES.quickbooks },
  { customer: "Chetak Retail LLP", amount: 214000, days: 8, source: SOURCES.tally },
  { customer: "Kaveri Agro Foods", amount: 128000, days: 61, source: SOURCES.tally },
];

const PAYMENTS = [
  { reference: "rzp_8841", customer: "Chetak Retail LLP", amount: 486000, method: "UPI", date: "22 Aug" },
  { reference: "rzp_8837", customer: "Vayu Electricals", amount: 312000, method: "Card", date: "19 Aug" },
  { reference: "rzp_8829", customer: "Sundara Textiles", amount: 264000, method: "Netbanking", date: "14 Aug" },
  { reference: "neft_5512", customer: "Nandi Industrial Supplies", amount: 720000, method: "Bank transfer", date: "11 Aug" },
];

const EXPENSES = [
  { head: "Purchases — trading stock", amount: 3120000, source: SOURCES.quickbooks },
  { head: "Salaries & wages", amount: 864000, source: SOURCES.quickbooks },
  { head: "Marketing & campaigns", amount: 342000, source: SOURCES.sheets },
  { head: "Freight & transport", amount: 286000, source: SOURCES.tally },
  { head: "Rent & utilities", amount: 214000, source: SOURCES.tally },
  { head: "Payment gateway fees", amount: 78000, source: SOURCES.razorpay },
];

const totalOutstanding = OUTSTANDING.reduce((s, o) => s + o.amount, 0);
const totalCollected = COLLECTIONS.razorpayThisMonth + COLLECTIONS.bankTransfersThisMonth;
const totalExpenses = EXPENSES.reduce((s, e) => s + e.amount, 0);

export const BUNDLE_SAMPLE_QUESTIONS: BundleDemoQuestion[] = [
  { id: "q1", question: "How much cash did we collect this month?", topic: "cash" },
  { id: "q2", question: "Which invoices are still outstanding?", topic: "receivables" },
  { id: "q3", question: "How are sales compared with last month?", topic: "sales" },
  { id: "q4", question: "Which payments have been received?", topic: "payments" },
  { id: "q5", question: "What are our biggest expenses?", topic: "expenses" },
  { id: "q6", question: "Show me our revenue and payment trend.", topic: "sales" },
  { id: "q7", question: "Which customers owe us money?", topic: "receivables" },
  { id: "q8", question: "Give me a quick financial health summary.", topic: "health" },
];

function has(text: string, ...words: string[]) {
  return words.some((w) => text.includes(w));
}

/** Deterministic keyword-matched answers across the four connected systems. */
export function answerFinanceBundleQuestion(question: string): DemoAnswer {
  const q = question.toLowerCase();

  if (has(q, "collect", "cash in", "cash did", "received this month", "collection")) {
    return {
      headline: `${INR(totalCollected)} collected in ${BUNDLE_DEMO_COMPANY.currentMonth}`,
      detail: `Based on your ${SOURCES.razorpay} settlements and bank receipts recorded in ${SOURCES.quickbooks}, collections are up ${Math.round(((totalCollected - COLLECTIONS.previousMonthTotal) / COLLECTIONS.previousMonthTotal) * 100)}% on ${BUNDLE_DEMO_COMPANY.previousMonth}.`,
      metric: [
        { label: `${SOURCES.razorpay} settlements`, value: INR(COLLECTIONS.razorpayThisMonth) },
        { label: "Bank transfers", value: INR(COLLECTIONS.bankTransfersThisMonth) },
        { label: `${BUNDLE_DEMO_COMPANY.previousMonth}`, value: INR(COLLECTIONS.previousMonthTotal) },
      ],
    };
  }

  if (has(q, "outstanding", "owe", "receivable", "unpaid", "overdue", "invoices still")) {
    return {
      headline: `${INR(totalOutstanding)} outstanding across ${OUTSTANDING.length} customers`,
      detail: `Looking across ${SOURCES.quickbooks} invoices and ${SOURCES.tally} ledgers, and netting off payments already settled through ${SOURCES.razorpay}.`,
      table: {
        columns: ["Customer", "Outstanding", "Age", "Source"],
        rows: OUTSTANDING.map((o) => [o.customer, INR(o.amount), `${o.days} days`, o.source]),
      },
    };
  }

  if (has(q, "payment", "paid", "settle", "razorpay")) {
    return {
      headline: `${PAYMENTS.length} payments received in ${BUNDLE_DEMO_COMPANY.currentMonth}`,
      detail: `Based on your ${SOURCES.razorpay} payments matched to ${SOURCES.quickbooks} invoices.`,
      table: {
        columns: ["Reference", "Customer", "Amount", "Method", "Date"],
        rows: PAYMENTS.map((p) => [p.reference, p.customer, INR(p.amount), p.method, p.date]),
      },
    };
  }

  if (has(q, "expense", "cost", "spend", "spending")) {
    return {
      headline: `${INR(totalExpenses)} in expenses this month`,
      detail: `Combining expense heads from ${SOURCES.quickbooks} and ${SOURCES.tally}, campaign spend tracked in ${SOURCES.sheets}, and gateway fees from ${SOURCES.razorpay}.`,
      table: {
        columns: ["Expense head", "Amount", "Source"],
        rows: EXPENSES.map((e) => [e.head, INR(e.amount), e.source]),
      },
    };
  }

  if (has(q, "sales", "revenue", "trend", "compared", "growth")) {
    const last = REVENUE[REVENUE.length - 1]!;
    const prev = REVENUE[REVENUE.length - 2]!;
    return {
      headline: `${INR(last.value)} revenue in ${BUNDLE_DEMO_COMPANY.currentMonth}`,
      detail: `Revenue recognised in ${SOURCES.quickbooks} and ${SOURCES.tally}, up ${Math.round(((last.value - prev.value) / prev.value) * 100)}% on ${BUNDLE_DEMO_COMPANY.previousMonth}. Collections through ${SOURCES.razorpay} are tracking the same direction.`,
      chart: REVENUE.map((r) => ({ label: r.month, value: r.value })),
      metric: [
        { label: "This month", value: INR(last.value) },
        { label: "Last month", value: INR(prev.value) },
        { label: "Collected", value: INR(totalCollected) },
      ],
    };
  }

  if (has(q, "health", "summary", "overview", "how are we doing", "position")) {
    return {
      headline: "Healthy month, receivables need attention",
      detail: `Across ${SOURCES.quickbooks}, ${SOURCES.tally}, ${SOURCES.razorpay} and ${SOURCES.sheets}: revenue and collections are both growing, but ${INR(OUTSTANDING.filter((o) => o.days > 30).reduce((s, o) => s + o.amount, 0))} is more than 30 days old.`,
      metric: [
        { label: "Revenue", value: INR(REVENUE[REVENUE.length - 1]!.value) },
        { label: "Collected", value: INR(totalCollected) },
        { label: "Outstanding", value: INR(totalOutstanding) },
        { label: "Expenses", value: INR(totalExpenses) },
        { label: "Net movement", value: INR(totalCollected - totalExpenses) },
        { label: "Ageing > 30 days", value: `${OUTSTANDING.filter((o) => o.days > 30).length} customers` },
      ],
    };
  }

  return {
    headline: "Ask about cash, invoices, payments, sales or expenses",
    detail: `This demo answers across ${SOURCES.quickbooks}, ${SOURCES.tally}, ${SOURCES.razorpay} and ${SOURCES.sheets} for ${BUNDLE_DEMO_COMPANY.name}. Try one of the suggested questions below.`,
  };
}
