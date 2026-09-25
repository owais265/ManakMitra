import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
});

function PrivacyRoute() {
  return <LegalPage kind="privacy" />;
}
