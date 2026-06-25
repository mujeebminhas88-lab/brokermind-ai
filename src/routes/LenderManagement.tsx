import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client"; // This links it directly to your Supabase credentials
import { Building2, Plus, ChevronDown, Check, Loader2 } from "lucide-react";

const BASELINE_LENDERS = [
  // --- Prime (A-Side) ---
  { id: "b2b-bank", name: "B2B Bank", tier: "prime" },
  { id: "bmo-authorized-brokers", name: "BMO (Authorized Brokers Only)", tier: "prime" },
  { id: "cwb-optimum-a", name: "CWB Optimum Mortgage A", tier: "prime" },
  { id: "merix-upfront", name: "Merix Upfront", tier: "prime" },
  { id: "mcap-prime", name: "MCAP Prime", tier: "prime" },
  { id: "rfa-prime", name: "RFA Prime", tier: "prime" },
  { id: "rmg-mortgages-fcx", name: "RMG Mortgages (FCX)", tier: "prime" },
  { id: "scotia-bank-banque-scotia", name: "Scotia Bank / Banque Scotia", tier: "prime" },
  { id: "td-canada-trust", name: "TD Canada Trust", tier: "prime" },
  { id: "wealth-one-bank-of-canada", name: "Wealth One Bank of Canada", tier: "prime" },

  // --- Alternate (B-Side) ---
  { id: "alterna", name: "Alterna", tier: "alt" },
  { id: "community-trust", name: "Community Trust", tier: "alt" },
  { id: "cwb-optimum-alt-a", name: "CWB Optimum Mortgage Alt-A", tier: "alt" },
  { id: "extend-financial-inc", name: "Extend Financial Inc.", tier: "alt" },
  { id: "first-ontario-credit-union", name: "First Ontario Credit Union", tier: "alt" },
  { id: "home-trust-company-classic", name: "Home Trust Company Classic", tier: "alt" },
  { id: "homeequity-bank-chip-max", name: "HomeEquity Bank CHIP Max", tier: "alt" },
  { id: "ic-savings", name: "IC Savings", tier: "alt" },
  { id: "meridian-credit-union-ltd", name: "Meridian Credit Union Ltd", tier: "alt" },
  { id: "oppono-lending-company", name: "Oppono Lending Company", tier: "alt" },
  { id: "rfa-alternatives", name: "RFA Alternatives", tier: "alt" },
  { id: "union-capital-lending", name: "Union Capital Lending", tier: "alt" },
  { id: "wyth-financials", name: "Wyth Financials", tier: "alt" },
  { id: "alpha-and-omega-inc", name: "Alpha and Omega Inc.", tier: "alt" },

  // --- Private / MIC ---
  { id: "advanced-mic", name: "Advanced MIC", tier: "private" },
  { id: "advantage-mortgage-centre-inc", name: "Advantage Mortgage Centre Inc.", tier: "private" },
  { id: "alt-alta-west-capital", name: "Alt- Alta West Capital", tier: "private" },
  { id: "aria-savings", name: "Aria Savings", tier: "private" },
  { id: "armada-mortgage", name: "Armada Mortgage", tier: "private" },
  { id: "atrium-mortgage-invest-corp", name: "Atrium Mortgage Invest. Corp.", tier: "private" },
  { id: "b2-capital-corp", name: "B2 Capital Corp", tier: "private" },
  { id: "bankright-financial-ltd", name: "BankRight Financial Ltd.", tier: "private" },
  { id: "bedrock-group", name: "Bedrock Group", tier: "private" },
  { id: "birch-mountain-group-ltd", name: "Birch Mountain Group Ltd.", tier: "private" },
  { id: "blacksun-mic", name: "Blacksun MIC", tier: "private" },
  { id: "bloom-finance-reverse-mortgage", name: "Bloom Finance Reverse Mortgage", tier: "private" },
  { id: "blossom-capital", name: "Blossom Capital", tier: "private" },
  { id: "bluebridge-mic", name: "Bluebridge MIC", tier: "private" },
  { id: "blueshore-financial-cu", name: "BlueShore Financial CU", tier: "private" },
  { id: "bridgewater-bank", name: "Bridgewater Bank", tier: "private" },
  { id: "bronco-mortgages-inc", name: "Bronco Mortgages Inc.", tier: "private" },
  { id: "brookstreet-mic", name: "Brookstreet MIC", tier: "private" },
  { id: "brunswick-cu", name: "Brunswick CU", tier: "private" },
  { id: "calvert-home-mortgage-inv-corp", name: "Calvert Home Mortgage Inv Corp", tier: "private" },
  { id: "cambridge-mic", name: "Cambridge MIC", tier: "private" },
  { id: "canadian-mortgages-inc", name: "Canadian Mortgages Inc", tier: "private" },
  { id: "capital-direct-lending-corp", name: "Capital Direct Lending Corp", tier: "private" },
  { id: "capital-express", name: "Capital Express", tier: "private" }
];

export default function LenderManagement() {
  const [lenders, setLenders] = useState(BASELINE_LENDERS);
  const [activeTier, setActiveTier] = useState<"prime" | "alt" | "private">("prime");
  const [selectedLender, setSelectedLender] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newLenderName, setNewLenderName] = useState("");
  const [newLenderTier, setNewLenderTier] = useState<"prime" | "alt" | "private">("prime");

  // Fetch from Supabase when the component loads
  useEffect(() => {
    async function fetchLenders() {
      const { data, error } = await supabase.from("custom_lenders").select("*");
      if (!error && data) {
        // Combine our core excel baseline with whatever is in Supabase
        const combined = [...BASELINE_LENDERS, ...data];
        // Deduplicate elements
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        setLenders(unique);
      }
    }
    fetchLenders();
  }, []);

  const handleCreateLender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLenderName.trim()) return;

    setLoading(true);
    const formattedId = newLenderName.toLowerCase().trim().replace(/[^a-z0-9]/g, "-");
    
    // Insert row right into your Supabase database table
    const { error } = await supabase
      .from("custom_lenders")
      .insert([{ id: formattedId, name: newLenderName.trim(), tier: newLenderTier }]);

    if (error) {
      alert("Error adding item to database: " + error.message);
      setLoading(false);
      return;
    }

    // Update local visual state
    const updatedList = [...lenders, { id: formattedId, name: newLenderName.trim(), tier: newLenderTier }];
    setLenders(updatedList);
    setActiveTier(newLenderTier);
    setSelectedLender(formattedId);
    newLenderName("");
    setIsFormOpen(false);
    setLoading(false);
  };

  // Filter items by tier, then strictly sort alphabetical A-Z by name
  const currentTierLenders = lenders
    .filter(item => item.tier === activeTier)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-950">Underwriting Allocation Matrix</h4>
            <p className="text-xs text-slate-500">Connected to live Supabase cloud database</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Lending Channel Category
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/40">
            {(["prime", "alt", "private"] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => { setActiveTier(tier); setSelectedLender(""); }}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                  activeTier === tier
                    ? "bg-white text-slate-950 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tier === "prime" ? "Prime" : tier === "alt" ? "Alt" : "Private / MIC"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Target Funding Destination
          </label>
          <div className="relative">
            <select
              value={selectedLender}
              onChange={(e) => setSelectedLender(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 appearance-none"
            >
              <option value="">-- Choose active platform options --</option>
              {currentTierLenders.map((lender) => (
                <option key={lender.id} value={lender.id}>
                  {lender.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {!isFormOpen ? (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Append Custom Institution
          </button>
        ) : (
          <form onSubmit={handleCreateLender} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Institution Legal Name</label>
              <input
                type="text"
                value={newLenderName}
                onChange={(e) => setNewLenderName(e.target.value)}
                placeholder="e.g. Pacific Northwest Credit Union"
                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-950"
              />
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Target Allocation</label>
                <select
                  value={newLenderTier}
                  onChange={(e) => setNewLenderTier(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-md py-1 px-2 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="prime">Prime (A-Side)</option>
                  <option value="alt">Alternative (B-Side)</option>
                  <option value="private">Private / MIC</option>
                </select>
              </div>

              <div className="flex items-center gap-2 self-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-slate-900 text-white px-3 py-1 text-xs rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
