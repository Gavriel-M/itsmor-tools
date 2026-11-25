import "@fontsource-variable/inter/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./styles.css";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function mount(page: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{page}</StrictMode>
  );
}
