/**
 * Connector-driven configuration for the standalone Aura product pages.
 * Adding /aura/<connector> later means adding one entry here plus a route file.
 */
import { SAMPLE_QUESTIONS, answerTallyQuestion, DEMO_COMPANY, type DemoAnswer, type DemoQuestion } from "./tally-demo";

export interface AuraConnectorConfig {
  /** URL segment for /aura/<id>. */
  id: string;
  /** Connector id in the published commercial catalogue (authoritative source). */
  catalogueConnectorId: string;
  name: string;
  /** Short phrase for "Your business runs on X". */
  systemNoun: string;
  heroSupporting: string;
  demoCompanyName: string;
  demoDisclaimer: string;
  sampleQuestions: DemoQuestion[];
  answer: (question: string) => DemoAnswer;
}

export const TALLY_CONNECTOR: AuraConnectorConfig = {
  id: "tally",
  catalogueConnectorId: "conn.tally",
  name: "Tally",
  systemNoun: "Tally",
  heroSupporting:
    "Connect Aura to Tally and ask questions about your business in natural language — without navigating reports, menus or spreadsheets.",
  demoCompanyName: DEMO_COMPANY.name,
  demoDisclaimer: "Demo powered by representative Tally business data.",
  sampleQuestions: SAMPLE_QUESTIONS,
  answer: answerTallyQuestion,
};
