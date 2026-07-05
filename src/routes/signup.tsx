import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { useUser } from "@/hooks/useUser";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create account — BrokerMind AI" },
      { name: "description", content: "Create your BrokerMind AI underwriting workspace account." },
    ],
  }),
});

function SignupPage() {
  const navigate = useNavigate();
  const { session, loading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard", replace: true });
    } else {
      setNotice("Check your email to confirm your account before signing in.");
    }
  }

  return (
    <AuthShell title="Create Account" subtitle="Provision your workspace access">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        {error ? <div className="text-xs" style={{ color: "#E91E8C" }}>{error}</div> : null}
        {notice ? <div className="text-xs" style={{ color: "#00BCD4" }}>{notice}</div> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-sm py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-white disabled:opacity-50"
          style={{ background: "#E91E8C" }}
        >
          {submitting ? "Creating…" : "Create Account"}
        </button>
      </form>
      <div className="mt-5 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
        Already have an account?{" "}
        <Link to="/login" className="hover:underline" style={{ color: "#00BCD4" }}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
