import { createFileRoute } from "@tanstack/react-router";
import { StandardsPage } from "@/components/guide-pages";

export const Route = createFileRoute("/standards")({
  component: StandardsRoute,
});

function StandardsRoute() {
  return <StandardsPage />;
}
