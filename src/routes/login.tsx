import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { useUser } from "@/hooks/useUser";
import logoUrl from "@/assets/brokermind-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — BrokerMind AI" },
      { name: "description", content: "Secure sign-in to BrokerMind AI underwriting workspace." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useUser();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: (redirect as "/dashboard" | undefined) ?? "/dashboard", replace: true });
    }
  }, [loading, session, redirect, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setError(error.message);
  }

  return <AuthShell title="Sign In" subtitle="Access your underwriting workspace">
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
      {error ? <div className="text-xs" style={{ color: "#E91E8C" }}>{error}</div> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-sm py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-black disabled:opacity-50"
        style={{ background: "#00BCD4" }}
      >
        {submitting ? "Signing in…" : "Sign In"}
      </button>
    </form>
    <div className="mt-5 flex items-center justify-between text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
      <Link to="/forgot-password" className="hover:underline" style={{ color: "#00BCD4" }}>
        Forgot password?
      </Link>
      <Link to="/signup" className="hover:underline" style={{ color: "#E91E8C" }}>
        Create account
      </Link>
    </div>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(1000px 500px at 20% 10%, rgba(0,188,212,0.10), transparent 60%), radial-gradient(900px 500px at 80% 90%, rgba(233,30,140,0.12), transparent 60%), #07070d",
      }}
    >
      <div
        className="w-[420px] rounded-sm border p-8"
        style={{
          background: "rgba(11,11,22,0.9)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 0 60px rgba(0,188,212,0.08)",
        }}
      >
        <div className="mb-6 flex justify-center">
          <img src={logoUrl} alt="BrokerMind AI" className="h-12 w-auto" style={{ filter: "drop-shadow(0 0 10px rgba(0,188,212,0.3))" }} />
        </div>
        <h1
          className="font-display text-xl font-bold uppercase tracking-[0.14em] text-center"
          style={{ color: "#ffffff" }}
        >
          {title}
        </h1>
        <p className="mt-1 text-center text-[11px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.5)" }}>
          {subtitle}
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label, type, value, onChange, autoComplete, required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.6)" }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-sm border bg-transparent px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#00BCD4]"
        style={{ borderColor: "rgba(255,255,255,0.12)", fontFamily: "Inter, sans-serif" }}
      />
    </label>
  );
}
