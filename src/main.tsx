import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Progressive enhancement hooks for CSS (scroll reveal, etc).
document.documentElement.dataset.ssJs = "true";
// Remove non-JS fallback heading once the app bootstraps.
document.getElementById("ss-fallback-h1")?.remove();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
