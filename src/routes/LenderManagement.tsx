import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus, ChevronDown, Check, Loader2 } from "lucide-react";

const BASELINE_LENDERS = [
  // --- Prime / A / Monolines (11 Lenders) ---
  { id: "b2b-bank-prime", name: "B2B Bank", tier: "prime" },
  { id: "bmo-authorized-brokers-prime", name: "BMO (Authorized Brokers Only)", tier: "prime" },
  { id: "cwb-optimum-a-prime", name: "CWB Optimum Mortgage A", tier: "prime" },
  { id: "merix-upfront-prime", name: "Merix Upfront", tier: "prime" },
  { id: "mcap-prime-prime", name: "MCAP Prime", tier: "prime" },
  { id: "rfa-prime-kraken-prime", name: "RFA Prime (Kraken)", tier: "prime" },
  { id: "rmg-mortgages-fcx-prime", name: "RMG Mortgages (FCX)", tier: "prime" },
  { id: "scotia-bank-banque-scotia-prime", name: "Scotia Bank / Banque Scotia", tier: "prime" },
  { id: "td-canada-trust-prime", name: "TD Canada Trust", tier: "prime" },
  { id: "meridian-credit-union-ltd-prime", name: "Meridian Credit Union Ltd", tier: "prime" },
  { id: "cibc-prime", name: "CIBC", tier: "prime" },

  // --- Alternate / B Side (13 Lenders) ---
  { id: "wealth-one-1-alt", name: "Wealth One Bank of Canada", tier: "alt" },
  { id: "home-trust-alt", name: "Home Trust", tier: "alt" },
  { id: "eclipse-rmg-alt-alt", name: "Eclipse (RMG-alt)", tier: "alt" },
  { id: "wealth-one-2-alt", name: "Wealth One Bank of Canada", tier: "alt" },
  { id: "alterna-alt", name: "Alterna", tier: "alt" },
  { id: "community-trust-alt", name: "Community Trust", tier: "alt" },
  { id: "extend-financial-inc-alt", name: "Extend Financial Inc.", tier: "alt" },
  { id: "first-ontario-credit-union-alt", name: "First Ontario Credit Union", tier: "alt" },
  { id: "ic-savings-alt", name: "IC Savings", tier: "alt" },
  { id: "rfa-alternatives-pegasus-alt", name: "RFA Alternatives (Pegasus)", tier: "alt" },
  { id: "union-capital-lending-alt", name: "Union Capital Lending", tier: "alt" },
  { id: "wyth-financials-alt", name: "Wyth Financials", tier: "alt" },
  { id: "alpha-and-omega-inc-alt", name: "Alpha and Omega Inc.", tier: "alt" },

  // --- Private (29 Lenders) ---
  { id: "advanced-mic-private", name: "Advanced MIC", tier: "private" },
  { id: "alta-west-capital-private", name: "Alta West Capital", tier: "private" },
  { id: "aria-savings-private", name: "Aria Savings", tier: "private" },
  { id: "armada-mortgage-private", name: "Armada Mortgage", tier: "private" },
  { id: "atrium-mortgage-invest-corp-private", name: "Atrium Mortgage Invest. Corp.", tier: "private" },
  { id: "b2-capital-corp-private", name: "B2 Capital Corp", tier: "private" },
  { id: "bankright-financial-ltd-private", name: "BankRight Financial Ltd.", tier: "private" },
  { id: "bedrock-group-private", name: "Bedrock Group", tier: "private" },
  { id: "birch-mountain-group-ltd-private", name: "Birch Mountain Group Ltd.", tier: "private" },
  { id: "blacksun-mic-private", name: "Blacksun MIC", tier: "private" },
  { id: "bloom-finance-reverse-mortgage-private", name: "Bloom Finance Reverse Mortgage", tier: "private" },
  { id: "blossom-capital-private", name: "Blossom Capital", tier: "private" },
  { id: "bluebridge-mic-private", name: "Bluebridge MIC", tier: "private" },
  { id: "blueshore-financial-cu-private", name: "BlueShore Financial CU", tier: "private" },
  { id: "bridgewater-bank-private", name: "Bridgewater Bank", tier: "private" },
  { id: "bronco-mortgages-inc-private", name: "Bronco Mortagages Inc.", tier: "private" },
  { id: "brookstreet-mic-private", name: "Brookstreet MIC", tier: "private" },
  { id: "brunswick-cu-private", name: "Brunswick CU", tier: "private" },
  { id: "calvert-home-mortgage-inv-corp-private", name: "Calvert Home Mortgage Inv Corp", tier: "private" },
  { id: "cambridge-mic-private", name: "Cambridge MIC", tier: "private" },
  { id: "canadian-mortgages-inc-private", name: "Canadian Mortgages Inc", tier: "private" },
  { id: "capital-direct-lending-corp-private", name: "Capital Direct Lending Corp", tier: "private" },
  { id: "capital-express-private", name: "Capital Express", tier: "private" },
  { id: "oppono-lending-company-private", name: "Oppono Lending Company", tier: "private" },
  { id: "new-haven-lending-private", name: "New Haven Lending", tier: "private" },
  { id: "gingko-private", name: "Gingko", tier: "private" },
  { id: "hosper-lending-private", name: "Hosper Lending", tier: "private" },
  { id: "vault-private", name: "Vault", tier: "private" },
  { id: "resco-private", name: "Resco", tier: "private" }
];

export default function LenderManagement() {
  const [lenders, setLenders] = useState(BASELINE_LENDERS);
  const [activeTier, setActiveTier] = useState<"prime" | "alt" | "private">("prime");
  const [selectedLender, setSelectedLender] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newLenderName, setNewLenderName] = useState("");
  const [newLenderTier, setNewLenderTier] = useState<"prime" | "alt" | "private">("prime");

  useEffect(() => {
    async function fetchLenders() {
      const { data, error } = await supabase.from("custom_lenders").select("*");
      if (!error && data && data.length > 0) {
        // Build a fresh dictionary map of everything from the database
        const dbMap = new Map();
        data.forEach(item => dbMap.set(item.id, item));
        
        // Loop baseline items, if database has a variant, it takes precedence
        const rawCombined = [...BASELINE_LENDERS];
        data.forEach(item => {
          if (!rawCombined.some(b => b.id === item.id)) {
            rawCombined.push(item);
          }
        });

        // Map everything accurately and force tier matching from the database schema
        const finalCleaned = rawCombined.map(item => {
          const dbMatch = dbMap.get(item.id);
          return dbMatch ? { id: dbMatch.id, name: dbMatch.name, tier: dbMatch.tier } : item;
        });

        setLenders(finalCleaned);
      } else {
        setLenders(BASELINE_LENDERS);
      }
    }
    fetchLenders();
  }, []);

  const handleCreateLender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLenderName.trim()) return;

    setLoading(true);
    const slug = newLenderName.toLowerCase().trim().replace(/[^a-z0-9]/g, "-");
    const formattedId = `${slug}-${newLenderTier}`;
    
    const { error } = await supabase
      .from("custom_lenders")
      .insert([{ id: formattedId, name: newLenderName.trim(), tier: newLenderTier }]);

    if (error) {
      alert("Error adding item to database: " + error.message);
      setLoading(false);
      return;
    }

    const updatedList = [...lenders, { id: formattedId, name: newLenderName.trim(), tier: newLenderTier }];
    setLenders(updatedList);
    setActiveTier(newLenderTier);
    setSelectedLender(formattedId);
    setNewLenderName("");
    setIsFormOpen(false);
    setLoading(false);
  };

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
              {currentTierLenders.map((lender, index) => (
                <option key={`${lender.id}-${index}`} value={lender.id}>
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
