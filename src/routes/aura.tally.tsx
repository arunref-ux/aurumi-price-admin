import { createFileRoute } from "@tanstack/react-router";
import { AuraProductPage } from "@/components/aura/AuraProductPage";
import { TALLY_CONNECTOR } from "@/lib/aura/connectors";

const title = "Aura + Tally — Talk to your Tally business data";
const description =
  "Connect Aura to Tally and ask questions about sales, customers, receivables, expenses and GST in plain language. Try the simulated demo and see pricing.";

export const Route = createFileRoute("/aura/tally")({
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
  component: AuraTallyPage,
});

function AuraTallyPage() {
  return <AuraProductPage connector={TALLY_CONNECTOR} />;
}
