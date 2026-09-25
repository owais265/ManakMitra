import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/readiness")({
  beforeLoad: () => {
    throw redirect({ to: "/product-file" });
  },
});
