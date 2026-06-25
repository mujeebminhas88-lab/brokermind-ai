import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Building2, Users, Sliders, Save, FilePlus, Trash2, Search, ChevronRight, ShieldAlert
} from "lucide-react";

// Keep your interfaces here at the top level, outside the component
interface ApplicationRecord {
  application_id: string; // Maps to your UUID primary key
  applicant_full_name: string;
  amortization_months: number;
  requested_loan_amount: number;
  property_appraised_value: number;
  // Add other fields here as you map them:
  // e.g., gds_ratio, tds_ratio, ltv_ratio, etc.
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Adjudication");
  const [applications, setApplications] = useState<any[]>([]);
  const [activeAppId, setActiveAppId] = useState<string>("");

  useEffect(() => {
    const fetchApplications = async () => {
      const { data, error } = await supabase.from('mortgage_applications').select('*');
      if (data) {
        setApplications(data);
        if (data.length > 0) setActiveAppId(data[0].id);
      }
    };
    fetchApplications();
  }, []);

  // Ensure this function is inside the component
  const updateCurrentApp = async (fields: Partial<ApplicationRecord>) => {
    // Logic for updating state and Supabase...
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Your Header and main UI structure */}
      <h1>BrokerMind AI Dashboard</h1>
    </div>
  );
}
// NO EXTRA CLOSING BRACE HERE
