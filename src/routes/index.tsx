import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Building2, Users, Sliders, Save, FilePlus, Trash2, Search, ChevronRight, ShieldAlert
} from "lucide-react";

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
      const { data, error } = await supabase
        .from('mortgage_applications')
        .select('application_id, applicant_full_name, amortization_months, requested_loan_amount, property_appraised_value');
      
      if (data) {
        setApplications(data as ApplicationRecord[]);
        if (data.length > 0) setActiveAppId(data[0].application_id);
      }
    };
    fetchApplications();
  }, []);

  const updateCurrentApp = async (fields: Partial<ApplicationRecord>) => {
    setApplications(prev => prev.map(app => 
      app.application_id === activeAppId ? { ...app, ...fields } : app
    ));

    const { error } = await supabase
      .from('mortgage_applications')
      .update(fields)
      .eq('application_id', activeAppId);
      
    if (error) console.error("Sync error:", error);
  };

  const currentApp = applications.find(a => a.application_id === activeAppId);

  if (!currentApp) return <div className="p-20 text-center">Loading Application Data...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">BrokerMind AI - Underwriter Workspace</h1>
      <div className="bg-card p-4 rounded-xl border">
        <label className="block text-xs text-muted-foreground">Applicant Name</label>
        <input 
          value={currentApp.applicant_full_name}
          onChange={(e) => updateCurrentApp({ applicant_full_name: e.target.value })}
          className="w-full border p-2 rounded"
        />
        
        <label className="block text-xs text-muted-foreground mt-4">Amortization (Months)</label>
        <input 
          type="number"
          value={currentApp.amortization_months}
          onChange={(e) => updateCurrentApp({ amortization_months: Number(e.target.value) })}
          className="w-full border p-2 rounded"
        />
      </div>
    </div>
  );
}
