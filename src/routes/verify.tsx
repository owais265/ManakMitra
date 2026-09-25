import { createFileRoute } from "@tanstack/react-router";
import VerifyPage from "@/components/verify-page";

export const Route = createFileRoute("/verify")({
  component: VerifyRoute,
});

function VerifyRoute() {
  return <VerifyPage />;
}
