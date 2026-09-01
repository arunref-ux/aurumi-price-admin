import { createFileRoute } from "@tanstack/react-router";
import { AuraProductPage } from "@/components/aura/AuraProductPage";
import { QUICKBOOKS_CONNECTOR } from "@/lib/aura/connectors";

const title = "Aura + QuickBooks — Talk to your QuickBooks business data";
const description =
  "Connect Aura to QuickBooks and ask questions about revenue, customers, invoices, expenses, vendors and cash flow in plain language. Try the simulated demo.";

export const Route = createFileRoute("/aura/quickbooks")({
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
  component: AuraQuickBooksPage,
});

function AuraQuickBooksPage() {
  return <AuraProductPage connector={QUICKBOOKS_CONNECTOR} />;
}
