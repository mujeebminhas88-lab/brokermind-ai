import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { useUser } from "@/hooks/useUser";
import { Flag, MessageSquare, Phone, StickyNote } from "lucide-react";

type NoteType = "general" | "flag" | "lender_communication";

interface FileNote {
  id: string;
  application_id: string;
  user_id: string;
  author_name: string | null;
  note_type: NoteType;
  body: string;
  created_at: string;
}

const TYPES: { value: NoteType; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: "general", label: "General", icon: StickyNote, tone: "text-muted-foreground" },
  { value: "flag", label: "Flag", tone: "text-destructive", icon: Flag },
  { value: "lender_communication", label: "Lender call", tone: "text-chart-2", icon: Phone },
];

export function FileNotesPanel({ applicationId }: { applicationId: string | null }) {
  const { user } = useUser();
  const [notes, setNotes] = useState<FileNote[]>([]);
  const [body, setBody] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("general");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId) {
      setNotes([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("file_notes")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });
    setNotes((data as FileNote[] | null) ?? []);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!applicationId || !body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("file_notes").insert({
      application_id: applicationId,
      note_type: noteType,
      body: body.trim(),
      author_name: user?.email ?? null,
    });
    setSaving(false);
    if (!error) {
      setBody("");
      setNoteType("general");
      void load();
    }
  }

  return (
    <section className="rounded-sm border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-chart-2" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em]">File Notes</h3>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            internal · append-only
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Not included in dossier PDF
        </span>
      </header>

      {applicationId ? (
        <div className="border-b border-border p-4">
          <div className="mb-2 flex gap-1">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = noteType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setNoteType(t.value)}
                  className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider ${
                    active ? "border-chart-2 bg-chart-2/10 text-chart-2" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add internal note (context, next action, lender call summary)…"
            rows={3}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => void submit()}
              disabled={saving || !body.trim()}
              className="rounded-sm bg-chart-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black disabled:opacity-40"
            >
              {saving ? "Saving…" : "Add Note"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 text-xs text-muted-foreground">Select an application to add notes.</div>
      )}

      <ul className="max-h-[360px] overflow-y-auto divide-y divide-border">
        {loading ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">Loading notes…</li>
        ) : notes.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">No notes yet.</li>
        ) : (
          notes.map((n) => {
            const t = TYPES.find((x) => x.value === n.note_type) ?? TYPES[0];
            const Icon = t.icon;
            return (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <Icon className={`h-3 w-3 ${t.tone}`} />
                  <span className={`font-semibold ${t.tone}`}>{t.label}</span>
                  <span>·</span>
                  <span className="font-mono">{new Date(n.created_at).toLocaleString()}</span>
                  {n.author_name && (
                    <>
                      <span>·</span>
                      <span className="truncate">{n.author_name}</span>
                    </>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.body}</p>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
