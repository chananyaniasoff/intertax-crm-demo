import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import CrmModulesHome from "@crm-demo";
import { SuggestionLayer } from "./temp-suggestions/layer";
import "./index.css";

class DemoErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { message };
  }

  render() {
    if (this.state.message) {
      return (
        <pre style={{ padding: 24, whiteSpace: "pre-wrap", fontFamily: "Segoe UI, sans-serif" }}>
          {this.state.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <>
      <DemoErrorBoundary>
        <CrmModulesHome />
      </DemoErrorBoundary>
      <a className="itx-demo-jump" href={`${import.meta.env.BASE_URL}portal.html`}>
        See client portal
      </a>
      {/* TEMPORARY review-only overlay. Remove this line and temp-suggestions/ to drop it. */}
      <SuggestionLayer />
    </>,
  );
}
