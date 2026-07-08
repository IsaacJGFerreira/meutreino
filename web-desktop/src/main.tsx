import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./trainingFlowPatch";
import "./removeRecentTrainingHistory";
import "./workoutBuilderDeletionConfirm";
import "./desktopTrainingLayout";
import "./desktopPerformanceLayout";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
