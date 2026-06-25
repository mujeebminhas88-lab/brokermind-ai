import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Building2, Users, Save, FilePlus, Trash2, Search, ChevronRight
} from "lucide-react";

// This interface now exactly matches your Supabase table columns
interface ApplicationRecord {
  application_id: string;
  applicant_full_name: string;
  amortization_months: number;
  requested_loan_amount: number;
  property_appraised_value: number;
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [activeAppId, setActiveAppId] = useState<string>("");

  useEffect(() => {
    const fetchApplications = async () => {
      // Fetching strictly by the columns that exist in your DB
      const { data, error } = await supabase
        .from('mortgage_applications')
        .select('application_id, applicant_full_name, amortization_months, requested_loan_amount, property_appraised_value');
      
      if (error) {
        console.error("Database Fetch Error:", error);
      } else if (data) {
        setApplications(data as ApplicationRecord[]);
        if (data.length > 0) setActiveAppId(data[0].application_id);
      }
    };
    fetchApplications();
  }, []);

  const updateCurrentApp = async (fields: Partial<ApplicationRecord>) => {
    // 1. Optimistic Update (Local State)
    setApplications(prev => prev.map(app => 
      app.application_id === activeAppId ? { ...app, ...fields } : app
    ));

    // 2. Database Sync
    const { error } = await supabase
      .from('mortgage_applications')
      .update(fields)
      .eq('application_id', activeAppId);
      
    if (error) console.error("Database Update Error:", error);
  };

  const currentApp = applications.find(a => a.application_id === activeAppId);

  if (!currentApp) {
    return <div className="p-20 text-center font-mono">Connecting to Database...</div>;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <h1 className="text-xl font-bold">BrokerMind AI - Underwriter Workspace</h1>
      
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
        <div>
          <label className="block text-xs text-muted-foreground uppercase mb-1">Applicant Full Name</label>
          <input 
            value={currentApp.applicant_full_name}
            onChange={(e) => updateCurrentApp({ applicant_full_name: e.target.value })}
            className="w-full border p-2 rounded bg-background"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground uppercase mb-1">Amortization (Months)</label>
          <input 
            type="number"
            value={currentApp.amortization_months}
            onChange={(e) => updateCurrentApp({ amortization_months: Number(e.target.value) })}
            className="w-full border p-2 rounded bg-background"
          />
        </div>
      </div>
    </div>
  );
}
