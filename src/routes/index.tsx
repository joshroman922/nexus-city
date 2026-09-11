import { createFileRoute } from "@tanstack/react-router";
import { StationApp } from "@/components/station/StationApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <StationApp />;
}
