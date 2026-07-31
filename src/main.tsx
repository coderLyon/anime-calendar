import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import { FollowsProvider } from "./store/follows";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <FollowsProvider>
        <App />
      </FollowsProvider>
    </ToastProvider>
  </StrictMode>,
);
