import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Building2, Users, Sliders, Save, FilePlus, Trash2, Search, ChevronRight, ShieldAlert
} from "lucide-react";
import { NoaUploader } from "@/components/NoaUploader";
import { SandboxPanel } from "@/components/SandboxPanel";
import { LiabilitiesPanel, DEFAULT_LIABILITIES } from "@/components/LiabilitiesPanel";
import { CollateralPanel, DEFAULT_COLLATERAL, computeLtv } from "@/components/CollateralPanel";
import { EmploymentIntakePanel, DEFAULT_EMPLOYMENT } from "@/components/EmploymentIntakePanel";
import { LenderManagement } from "@/components/LenderManagement";
import { calculateDebtService } from "@/utils/debtService";

// Note: Ensure your interfaces and helper functions (like createBlankRecord) 
// remain defined outside of the Dashboard component function.

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

  // ... (Your Dashboard rendering logic here)
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* UI Code */}
      <h1>Dashboard</h1>
    </div>
  );
}

// Ensure there is only one export default or component export structure here
