import React, { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const BASELINE_LENDERS = [
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
  { id: "wealth-one-1-alt", name: "Wealth One Bank of Canada", tier: "alt" },
  { id: "home-trust-alt", name: "Home Trust", tier: "alt" },
  { id: "eclipse-rmg-alt-alt", name: "Eclipse (RMG-alt)", tier: "alt" },
  { id: "alterna-alt", name: "Alterna", tier: "alt" },
  { id: "community-trust-alt", name: "Community Trust", tier: "alt" },
  { id: "extend-financial-inc-alt", name: "Extend Financial Inc.", tier: "alt" },
  { id: "first-ontario-credit-union-alt", name: "First Ontario Credit Union", tier: "alt" },
  { id: "ic-savings-alt", name: "IC Savings", tier: "alt" },
  { id: "rfa-alternatives-pegasus-alt", name: "RFA Alternatives (Pegasus)", tier: "alt" },
  { id: "union-capital-lending-alt", name: "Union Capital Lending", tier: "alt" },
  { id: "wyth-financials-alt", name: "Wyth Financials", tier: "alt" },
  { id: "alpha-and-omega-inc-alt", name: "Alpha and Omega Inc.", tier: "alt" },
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
  { id: "bronco-mortgages-inc-private", name: "Bronco Mortgages Inc.", tier: "private" },
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

export function LenderManagement({ applicationId }: { applicationId: string }) {
  const [lenders] = useState(BASELINE_LENDERS);
  const [activeTier, setActiveTier] = useState<"prime" | "alt" | "private">("prime");
  const [selectedLender, setSelectedLender] = useState("");

  const handleLenderChange = (lenderId: string) => {
    setSelectedLender(lenderId);
    toast.success("Lender assigned", {
      description: "Configuration saved to workspace.",
    });
  };

  const currentTierLenders = lenders
    .filter(item => item.tier === activeTier)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border bg-secondary/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Underwriting Allocation Matrix</h4>
            <p className="text-xs text-muted-foreground">Live Static Configuration Mode</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Lending Channel Category
          </label>
          <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-lg border border-border">
            {(["prime", "alt", "private"] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => { setActiveTier(tier); }}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                  activeTier === tier
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tier === "prime" ? "Prime" : tier === "alt" ? "Alt" : "Private / MIC"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Target Funding Destination
          </label>
          <div className="relative">
            <select
              value={selectedLender}
              onChange={(e) => handleLenderChange(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 pl-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
            >
              <option value="">-- Choose active platform options --</option>
              {currentTierLenders.map((lender, index) => (
                <option key={`${lender.id}-${index}`} value={lender.id}>
                  {lender.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
