"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerUser } from "@/lib/actions";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      // Register user via Server Action
      await registerUser(email, password, name || undefined);
      setSuccess(true);

      // Auto login
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred during registration. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      {/* Decorative ambient gradients */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-transform hover:scale-105">
            <Clock className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Get started with your digital Cal Newport time-block planner
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/30 p-3.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-950/30 p-3.5 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Account created! Logging you in...</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Full Name <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Cal Newport"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Min. 6 characters"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || success}
              className="relative w-full rounded-xl bg-indigo-600 py-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
