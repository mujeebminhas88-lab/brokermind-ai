import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client"; // Your new client
import {
  FileText, Building2, Users, Sliders, Save, FilePlus, Trash2, Search, ChevronRight, ShieldAlert
} from "lucide-react";
// ... (Keep your existing imports for components/utils)

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Adjudication");
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [activeAppId, setActiveAppId] = useState<string>("");
  const [selectedAppIdsForDeletion, setSelectedAppIdsForDeletion] = useState<string[]>([]);

  // 1. Load from Supabase on Mount
  useEffect(() => {
    const fetchApplications = async () => {
      const { data, error } = await supabase.from('mortgage_applications').select('*');
      if (error) {
        console.error("Supabase fetch error:", error);
      } else if (data && data.length > 0) {
        setApplications(data as any);
        setActiveAppId(data[0].id);
      } else {
        handleCreateNewApplication();
      }
    };
    fetchApplications();
  }, []);

  const currentApp = applications.find(app => app.id === activeAppId) || applications[0];

  // 2. Direct Sync Update
  const updateCurrentApp = async (fields: Partial<ApplicationRecord>) => {
    if (!currentApp) return;

    // Optimistic UI update
    setApplications(prev => prev.map(app => app.id === activeAppId ? { ...app, ...fields } : app));

    // Database Sync
    const { error } = await supabase
      .from('mortgage_applications')
      .update(fields)
      .eq('id', activeAppId);
      
    if (error) console.error("Sync error:", error);
  };

  const handleCreateNewApplication = async () => {
    const newRecord = createBlankRecord(`APP-${Date.now()}`, "New Primary Applicant");
    
    // Add to DB
    const { error } = await supabase.from('mortgage_applications').insert([newRecord]);
    if (!error) {
      setApplications([...applications, newRecord]);
      setActiveAppId(newRecord.id);
    }
  };

  const handleBatchDeleteSelected = async () => {
    const idsToDelete = selectedAppIdsForDeletion;
    
    // Delete from DB
    const { error } = await supabase.from('mortgage_applications').delete().in('id', idsToDelete);
    
    if (!error) {
      const remaining = applications.filter(app => !idsToDelete.includes(app.id));
      setApplications(remaining);
      if (idsToDelete.includes(activeAppId)) setActiveAppId(remaining[0]?.id || "");
      setSelectedAppIdsForDeletion([]);
    }
  };

  if (!currentApp) return <div className="p-20 text-center">Loading Data...</div>;

  // ... (Rest of your UI remains the same, but the updateCurrentApp calls now trigger DB writes automatically)
  
  // NOTE: Ensure your <input /> fields look like this:
  // <input value={currentApp.taxpayerName} onChange={(e) => updateCurrentApp({ taxpayerName: e.target.value })} />
  
  return (
    // ... UI JSX ...
  );
}
