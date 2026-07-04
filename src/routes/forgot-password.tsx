import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/supabase/client";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
  head: () => ({
    meta: [
      { title: "Reset password — BrokerMind AI" },
      { name: "description", content: "Request a password reset for your BrokerMind AI account." },
    ],
  }),
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    setSubmitting(false);
    if (error) setError(error.message);
    else setNotice("If an account exists, a reset link has been sent.");
  }

  return (
    <AuthShell title="Reset Password" subtitle="We'll email you a reset link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        {error ? <div className="text-xs" style={{ color: "#E91E8C" }}>{error}</div> : null}
        {notice ? <div className="text-xs" style={{ color: "#00BCD4" }}>{notice}</div> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-sm py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-black disabled:opacity-50"
          style={{ background: "#00BCD4" }}
        >
          {submitting ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
      <div className="mt-5 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
        <Link to="/login" className="hover:underline" style={{ color: "#00BCD4" }}>
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
