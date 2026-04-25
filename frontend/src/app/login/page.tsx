"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import EarthGlobe from "@/components/EarthGlobe";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Account created! Check your email to confirm, then log in.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <EarthGlobe size={56} />
          <h1 className="font-headline font-bold text-3xl text-tertiary tracking-tighter">PathFinder</h1>
          <p className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Eco Route Intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
          {/* Tab toggle */}
          <div className="flex rounded-lg overflow-hidden border border-outline-variant mb-6">
            <button
              onClick={() => { setMode("login"); setError(null); setMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                mode === "login"
                  ? "bg-tertiary text-on-primary"
                  : "bg-transparent text-on-surface-variant hover:bg-surface-variant"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                mode === "signup"
                  ? "bg-tertiary text-on-primary"
                  : "bg-transparent text-on-surface-variant hover:bg-surface-variant"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-background border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-background border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-error bg-error-container/40 border border-error/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-xs text-secondary bg-secondary-container/30 border border-secondary/30 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-tertiary text-on-primary font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="material-symbols-outlined text-lg"
                >
                  autorenew
                </motion.span>
              ) : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
