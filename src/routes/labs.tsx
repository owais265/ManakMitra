import { createFileRoute } from "@tanstack/react-router";
import LabsPage from "@/components/labs-page";

export const Route = createFileRoute("/labs")({
  component: LabsRoute,
});

function LabsRoute() {
  return <LabsPage />;
}
