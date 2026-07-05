/**
 * Team & Roles — role-based access management.
 *
 * Roles map:
 *   admin     → Broker Admin (full access)
 *   moderator → Read-Only (view files, no edit / no dossier)
 *   user      → Broker Agent (default; own files only)
 *
 * Only admins can change roles (enforced by RLS on public.user_roles).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { supabase } from "@/supabase/client";
import { useUser } from "@/hooks/useUser";

type AppRole = "admin" | "moderator" | "user";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Broker Admin",
  user: "Broker Agent",
  moderator: "Read-Only",
};

const ROLE_DESCRIPTION: Record<AppRole, string> = {
  admin: "Full access — files, users, billing, and settings.",
  user: "Access to own files only.",
  moderator: "Can view files but cannot edit, upload, or generate dossier.",
};

interface RoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export function TeamPanel() {
  const { user } = useUser();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("user");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [rolesRes, adminRes] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: true }),
      user
        ? supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
        : Promise.resolve({ data: false, error: null }),
    ]);
    if (rolesRes.data) setRows(rolesRes.data as unknown as RoleRow[]);
    setIsAdmin(Boolean(adminRes.data));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upsertRole(userId: string, role: AppRole) {
    setSaving(true);
    // Delete other roles first so a user only has one active role at a time.
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Role set to ${ROLE_LABEL[role]}`);
    void load();
  }

  async function addMember() {
    if (!newUserId.trim()) {
      toast.error("User ID required");
      return;
    }
    await upsertRole(newUserId.trim(), newRole);
    setNewUserId("");
  }

  async function deactivate(row: RoleRow) {
    if (!confirm(`Remove ${ROLE_LABEL[row.role]} role for this user? Their files and audit trail remain intact.`)) return;
    setSaving(true);
    const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("User deactivated.");
    void load();
  }

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <Users className="h-4 w-4 text-primary" />
        <div>
          <h2 className="font-display text-base font-bold tracking-tight">Team & Access</h2>
          <p className="text-xs text-muted-foreground">
            Role-based access for the brokerage. Deactivating a user preserves their files and audit trail.
          </p>
        </div>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
          <div key={r} className="rounded-sm border border-border bg-background p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <ShieldCheck className="h-3 w-3 text-chart-2" />
              {ROLE_LABEL[r]}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <div className="mb-3 rounded-sm border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Only Broker Admins can invite or modify roles.
        </div>
      )}

      {isAdmin && (
        <div className="mb-4 rounded-sm border border-dashed border-border bg-background p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <UserPlus className="h-3 w-3 text-chart-2" /> Assign role
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block flex-1">
              <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">User ID (UUID)</div>
              <input
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="w-full rounded-sm border border-input bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">Role</div>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppRole)}
                className="rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
              >
                {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => void addMember()}
              disabled={saving}
              className="rounded-sm border border-primary bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
            >
              Assign
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            Email-based invites require the platform Admin API. For now, ask the new user to sign up first, then paste their user ID here.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Since</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No roles assigned yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {r.user_id === user?.id ? (
                      <span>
                        {r.user_id.slice(0, 8)}… <span className="text-chart-2">(you)</span>
                      </span>
                    ) : (
                      r.user_id
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <select
                        value={r.role}
                        onChange={(e) => void upsertRole(r.user_id, e.target.value as AppRole)}
                        className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
                      >
                        {(Object.keys(ROLE_LABEL) as AppRole[]).map((role) => (
                          <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                        {ROLE_LABEL[r.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10.5px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isAdmin && r.user_id !== user?.id && (
                      <button
                        onClick={() => void deactivate(r)}
                        className="text-[10.5px] uppercase tracking-wider text-destructive hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
