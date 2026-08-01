import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import { BlockedProvider } from "./store/blocked";
import { FollowsProvider } from "./store/follows";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <BlockedProvider>
        <FollowsProvider>
          <App />
        </FollowsProvider>
      </BlockedProvider>
    </ToastProvider>
  </StrictMode>,
);
