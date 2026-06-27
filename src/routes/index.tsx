import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/supabase/client";

// This interface mirrors the underwriting_applications table exactly
interface ApplicationRecord {
  id: string;
  application_number: string;
  taxpayer_name: string;
  aggregate_risk_score: number;
  line_15000_total_income: number;
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchApplications = async () => {
      setLoading(true);
      setError(null);

      // Order deterministically (newest first) so dedupe keeps the latest
      // committed version of each application_number.
      const { data, error } = await supabase
        .from('underwriting_applications')
        .select('id, application_number, taxpayer_name, aggregate_risk_score, line_15000_total_income, created_at')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Supabase Error:", error);
        setError(error.message);
      } else if (data) {
        // The ledger stores an immutable audit trail: each "Commit to
        // Underwriting Log" insert appends a new row for the same
        // application_number, so the same App ID / taxpayer surfaced
        // multiple times with different risk scores. Collapse to one row
        // per application_number — the most recently committed version
        // wins, giving a deterministic score per record.
        const seen = new Set<string>();
        const deduped: ApplicationRecord[] = [];
        for (const row of data as unknown as ApplicationRecord[]) {
          if (seen.has(row.application_number)) continue;
          seen.add(row.application_number);
          deduped.push(row);
        }
        setApplications(deduped);
      }
      setLoading(false);
    };

    fetchApplications();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="p-20 text-center">Loading from Database...</div>;
  if (error) return <div className="p-20 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">BrokerMind AI - Underwriter Workspace</h1>
      
      <div className="grid gap-4">
        {applications.length === 0 ? (
          <p>No applications found. Add a record in your database.</p>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="p-4 border rounded-lg bg-card shadow-sm">
              <h2 className="font-bold">{app.taxpayer_name}</h2>
              <p className="text-sm text-muted-foreground">App: {app.application_number}</p>
              <p className="text-sm text-muted-foreground">Risk Score: {app.aggregate_risk_score}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
