import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/supabase/client";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
  head: () => ({
    meta: [
      { title: "Set new password — BrokerMind AI" },
      { name: "description", content: "Set a new password for your BrokerMind AI account." },
    ],
  }),
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Password updated. Redirecting…");
    setTimeout(() => navigate({ to: "/", replace: true }), 1200);
  }

  return (
    <AuthShell title="New Password" subtitle="Set a new password for your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        {error ? <div className="text-xs" style={{ color: "#E91E8C" }}>{error}</div> : null}
        {notice ? <div className="text-xs" style={{ color: "#00BCD4" }}>{notice}</div> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-sm py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-white disabled:opacity-50"
          style={{ background: "#E91E8C" }}
        >
          {submitting ? "Saving…" : "Update Password"}
        </button>
      </form>
    </AuthShell>
  );
}
