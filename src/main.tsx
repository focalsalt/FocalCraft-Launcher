import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// 隱藏啟動畫面
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    (window as any).__hideSplash?.();
  });
});

