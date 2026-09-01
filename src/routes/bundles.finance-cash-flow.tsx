import { createFileRoute } from "@tanstack/react-router";
import { BundleProductPage, type BundlePageConfig } from "@/components/bundle/BundleProductPage";
import {
  answerFinanceBundleQuestion,
  BUNDLE_DEMO_COMPANY,
  BUNDLE_SAMPLE_QUESTIONS,
} from "@/lib/bundle/finance-demo";

const title = "Finance & Cash Flow Bundle — Know your numbers, improve cash flow";
const description =
  "One Aurumi bundle connecting QuickBooks, Tally, Razorpay and Google Sheets, so you can ask about cash, invoices, payments and expenses in plain language. Try the simulated demo and see pricing.";

const FINANCE_BUNDLE: BundlePageConfig = {
  slug: "finance-cash-flow",
  headline: "Know your numbers. Improve your cash flow.",
  supporting:
    "Your finance picture is spread across accounting, payments and spreadsheets. This bundle connects them all to Aurumi's Talk to Your Business, so one question gets one answer.",
  demoCompanyName: BUNDLE_DEMO_COMPANY.name,
  demoDisclaimer:
    "Representative demo data only — no real accounting, payment or spreadsheet system is contacted.",
  sampleQuestions: BUNDLE_SAMPLE_QUESTIONS,
  answer: answerFinanceBundleQuestion,
};

export const Route = createFileRoute("/bundles/finance-cash-flow")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinanceBundlePage,
});

function FinanceBundlePage() {
  return <BundleProductPage config={FINANCE_BUNDLE} />;
}
