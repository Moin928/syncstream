import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";

// renders the main app inside the root element
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);