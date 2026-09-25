import { createFileRoute } from "@tanstack/react-router";
import { HallmarkPage } from "@/components/guide-pages";

export const Route = createFileRoute("/hallmark")({
  component: HallmarkRoute,
});

function HallmarkRoute() {
  return <HallmarkPage />;
}
