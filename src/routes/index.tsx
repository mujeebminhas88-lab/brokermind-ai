import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";

interface ApplicationRecord {
  application_id: string;
  applicant_full_name: string;
  amortization_months: number;
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [data, setData] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('mortgage_applications')
        .select('application_id, applicant_full_name, amortization_months');
      
      if (error) {
        // This will now show the actual error message in the console
        console.error("Database Fetch Error Details:", JSON.stringify(error, null, 2));
      } else if (data) {
        setData(data as ApplicationRecord[]);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-10 text-center">Connecting to Database...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Underwriter Dashboard</h1>
      {data.length === 0 ? (
        <p>No applications found in database.</p>
      ) : (
        <pre className="text-xs bg-slate-100 p-4">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
