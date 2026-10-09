import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StationApp } from "@/components/station/StationApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StationApp />
  </StrictMode>,
);
