import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => {
    useEffect(() => {
      window.location.replace("/app");
    }, []);
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Redirecting…
      </div>
    );
  },
});
