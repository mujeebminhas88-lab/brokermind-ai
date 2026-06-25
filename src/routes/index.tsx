import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";

// This interface mirrors your database columns exactly
interface ApplicationRecord {
  application_id: string;
  applicant_full_name: string;
  amortization_months: number;
  requested_loan_amount: number;
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('mortgage_applications')
        .select('application_id, applicant_full_name, amortization_months, requested_loan_amount');
      
      if (error) {
        console.error("Supabase Error:", error);
        setError(error.message);
      } else if (data) {
        setApplications(data as ApplicationRecord[]);
      }
      setLoading(false);
    };
    
    fetchApplications();
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
            <div key={app.application_id} className="p-4 border rounded-lg bg-card shadow-sm">
              <h2 className="font-bold">{app.applicant_full_name}</h2>
              <p className="text-sm text-muted-foreground">Loan: ${app.requested_loan_amount}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
