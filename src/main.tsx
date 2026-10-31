import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OfflineInstall from "./components/OfflineInstall";
import "./styles.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("MWECau GUIDER service worker registration failed:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OfflineInstall />
    <App />
  </React.StrictMode>
);
