import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      // We are fetching from 'mortgage_applications'
      const { data, error } = await supabase
        .from('mortgage_applications')
        .select('*');
      
      if (error) {
        // This will print the actual error text to the console
        console.error("Full Supabase Error:", error);
        setError(`Error ${error.code}: ${error.message}`);
      } else {
        setData(data);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-20 text-center font-mono">Connecting to Database...</div>;
  if (error) return <div className="p-20 text-center text-red-600 font-mono">Connection Failed: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Successfully Connected</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
