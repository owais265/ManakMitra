import { createFileRoute } from "@tanstack/react-router";
import { HuidPage } from "@/components/guide-pages";

export const Route = createFileRoute("/huid")({
  component: HuidRoute,
});

function HuidRoute() {
  return <HuidPage />;
}
