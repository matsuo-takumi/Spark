import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import Popup from "./Popup";

if (window.location.pathname === "/popup") {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <Popup />
        </React.StrictMode>,
    );
} else {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}
