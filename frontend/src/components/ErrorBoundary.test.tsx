import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";

function Boom({ crash }: { crash: boolean }) {
  if (crash) throw new Error("Deliberate render failure");
  return <p>Page content</p>;
}

/** Lets a test flip the child from throwing to healthy, like a real retry. */
function Harness({ crashUntilRetry = false }: { crashUntilRetry?: boolean }) {
  const [crash, setCrash] = React.useState(true);
  return (
    <ErrorBoundary scope="route" onReset={() => crashUntilRetry || setCrash(false)}>
      <Boom crash={crash} />
    </ErrorBoundary>
  );
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Boom crash={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows the FixBuddy fallback instead of a blank screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness crashUntilRetry />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to home/i })).toBeInTheDocument();
  });

  it("recovers and renders the page again after Try Again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("uses the app navigation callback for Back to Home", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onHome = vi.fn();
    render(
      <ErrorBoundary scope="route" onHome={onHome}>
        <Boom crash />
      </ErrorBoundary>
    );

    await userEvent.click(screen.getByRole("button", { name: /back to home/i }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("logs the crash so it is not swallowed", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom crash />
      </ErrorBoundary>
    );
    expect(spy.mock.calls.some((call) => String(call[0]).includes("FixBuddy render error"))).toBe(true);
  });

  it("shows technical details in development only", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom crash />
      </ErrorBoundary>
    );
    const details = screen.queryByText("Technical details");
    if (import.meta.env.DEV) expect(details).toBeInTheDocument();
    else expect(details).not.toBeInTheDocument();
  });
});
