import { createFileRoute } from "@tanstack/react-router";
import ReadinessPage from "@/components/readiness-page";

export const Route = createFileRoute("/product-file")({
  component: ProductFileRoute,
});

function ProductFileRoute() {
  return <ReadinessPage />;
}
