import { createFileRoute } from "@tanstack/react-router";
import { ComplaintPage } from "@/components/guide-pages";

export const Route = createFileRoute("/complaint")({
  component: ComplaintRoute,
});

function ComplaintRoute() {
  return <ComplaintPage />;
}
