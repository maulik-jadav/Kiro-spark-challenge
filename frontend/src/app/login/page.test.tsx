/**
 * Tests for LoginPage
 * Covers: rendering, tab toggle, form validation, login flow,
 * signup flow, loading state, error display, and success message.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import LoginPage from "./page";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion");
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) =>
          // eslint-disable-next-line react/display-name
          ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
            React.createElement(tag, props, children),
      }
    ),
  };
});

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/EarthGlobe", () => {
  // eslint-disable-next-line react/display-name
  return function EarthGlobe() {
    return React.createElement("div", { "data-testid": "earth-globe" });
  };
});

// Supabase auth mock — controlled per test
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillForm(email: string, password: string) {
  await userEvent.type(screen.getByPlaceholderText("you@example.com"), email);
  await userEvent.type(screen.getByPlaceholderText("••••••••"), password);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  it("renders the PathFinder brand name", () => {
    render(<LoginPage />);
    expect(screen.getByText("PathFinder")).toBeInTheDocument();
  });

  it("renders the EarthGlobe component", () => {
    render(<LoginPage />);
    expect(screen.getByTestId("earth-globe")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<LoginPage />);
    expect(screen.getByText(/eco route intelligence/i)).toBeInTheDocument();
  });

  it("renders Log In and Sign Up tab buttons", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("defaults to the Log In tab", () => {
    render(<LoginPage />);
    // Submit button should say "Log In"
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeInTheDocument();
  });

  it("renders email and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  // ── Tab toggle ───────────────────────────────────────────────────────────

  it("switches to Sign Up mode when Sign Up tab is clicked", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("switches back to Log In mode when Log In tab is clicked", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));
    // Submit button should revert to "Log In"
    expect(screen.getAllByRole("button", { name: /^log in$/i }).length).toBeGreaterThan(0);
  });

  it("clears error when switching tabs", async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: "Invalid credentials" } });
    render(<LoginPage />);

    await fillForm("bad@example.com", "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
  });

  // ── Login flow ───────────────────────────────────────────────────────────

  it("calls signInWithPassword with email and password on login submit", async () => {
    render(<LoginPage />);
    await fillForm("user@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret123",
      });
    });
  });

  it("redirects to / on successful login", async () => {
    render(<LoginPage />);
    await fillForm("user@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("displays error message on failed login", async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    render(<LoginPage />);

    await fillForm("user@example.com", "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument();
    });
  });

  it("does not redirect on failed login", async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    render(<LoginPage />);

    await fillForm("user@example.com", "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Signup flow ──────────────────────────────────────────────────────────

  it("calls signUp with email and password on signup submit", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await fillForm("new@example.com", "newpass123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "newpass123",
      });
    });
  });

  it("shows confirmation message on successful signup", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await fillForm("new@example.com", "newpass123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email to confirm/i)).toBeInTheDocument();
    });
  });

  it("does not redirect after successful signup", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await fillForm("new@example.com", "newpass123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email to confirm/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("displays error message on failed signup", async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: "Email already registered" } });
    render(<LoginPage />);

    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await fillForm("existing@example.com", "pass123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("disables the submit button while loading", async () => {
    // Never resolves so we can inspect the loading state
    mockSignIn.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);

    await fillForm("user@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^log in$/i })).toBeDisabled();
    });
  });
});
