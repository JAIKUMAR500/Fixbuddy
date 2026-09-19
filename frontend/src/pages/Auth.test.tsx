import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "./Auth";

const { login, signup } = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
}));

vi.mock("../api/AppContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/AppContext")>();
  return {
    ...actual,
    useApp: () => ({
      login,
      signup,
      googleLogin: vi.fn(),
      routeAfterAuth: vi.fn(),
    }),
    useFetch: () => ({ data: { supportEmail: "help@test.com" } }),
  };
});

describe("Auth", () => {
  it("lets the visitor pick a role before signup", async () => {
    render(<Auth mode="signup" navigate={() => {}} />);
    expect(screen.getByRole("button", { name: /worker/i })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: /worker/i }));
    expect(screen.getByRole("button", { name: /worker/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not submit an empty login form", async () => {
    render(<Auth mode="login" navigate={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^login$/i }));
    expect(login).not.toHaveBeenCalled();
  });

  it("submits login with the entered credentials", async () => {
    login.mockResolvedValueOnce({ id: "u1", role: "customer" });
    render(<Auth mode="login" navigate={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/email you used/i), "cust@test.com");
    const password = document.querySelector('input[type="password"]');
    expect(password).toBeTruthy();
    await userEvent.type(password as HTMLInputElement, "secret1");
    await userEvent.click(screen.getByRole("button", { name: /^login$/i }));
    expect(login).toHaveBeenCalledWith("cust@test.com", "secret1");
  });

  it("opens the OTP reset flow from forgot password", async () => {
    render(<Auth mode="login" navigate={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.getByRole("button", { name: /send otp/i })).toBeInTheDocument();
  });
});
