import { createFileRoute } from "@tanstack/react-router";
import { CertifyPage } from "@/components/guide-pages";

export const Route = createFileRoute("/certify")({
  component: CertifyRoute,
});

function CertifyRoute() {
  return <CertifyPage />;
}
