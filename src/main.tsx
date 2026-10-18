import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { convex } from "./lib/convex";
import { ServerClockProvider } from "./lib/clock";
import { EventDisplay } from "./routes/EventDisplay";
import { JoinPage } from "./routes/JoinPage";
import { RejoinPage } from "./routes/RejoinPage";
import { VotePage } from "./routes/VotePage";
import { AdminPage } from "./routes/AdminPage";
import { HomePage } from "./routes/HomePage";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ServerClockProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/event" element={<EventDisplay />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/vote" element={<VotePage />} />
            <Route path="/rejoin/:code" element={<RejoinPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/:token" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ServerClockProvider>
    </ConvexProvider>
  </StrictMode>,
);
