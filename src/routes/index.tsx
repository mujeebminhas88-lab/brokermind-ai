import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Building2, Users, Sliders, Save, FilePlus, Trash2, Search, ChevronRight, ShieldAlert
} from "lucide-react";

// THIS INTERFACE MUST MATCH YOUR SUPABASE COLUMN NAMES EXACTLY
interface ApplicationRecord {
  id: string; // Ensure your DB column is named 'id'
  taxpayer_name: string; // Rename to match your DB column (likely snake_case)
  amortization: number;
  // Add other fields as they exist in your 'mortgage_applications' table
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('mortgage_applications')
        .select('*'); // Be explicit with columns if this fails
      
      if (error) {
        console.error("Database Fetch Error:", error);
      } else if (data) {
        setApplications(data as ApplicationRecord[]);
      }
      setLoading(false);
    };
    fetchApplications();
  }, []);

  if (loading) return <div className="p-20 text-center">Connecting to Database...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">BrokerMind AI - Underwriter Workspace</h1>
      {/* Build your UI using the 'applications' state here */}
    </div>
  );
}
