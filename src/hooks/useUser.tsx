import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";



interface UserContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 2 * 60 * 1000; // warn 2 minutes before

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_MS / 1000);

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    await logAuditEvent({ action_type: "LOGOUT" });
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);


  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    warnTimer.current = null;
    logoutTimer.current = null;
    tickTimer.current = null;
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    setWarning(false);
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      setCountdown(WARNING_MS / 1000);
      tickTimer.current = setInterval(() => {
        setCountdown((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    }, INACTIVITY_MS - WARNING_MS);
    logoutTimer.current = setTimeout(() => {
      void signOut();
    }, INACTIVITY_MS);
  }, [clearTimers, signOut]);

  const resetActivity = useCallback(() => {
    if (!session) return;
    startTimers();
  }, [session, startTimers]);

  // Initial session + auth listener
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Activity listeners (only when authenticated)
  useEffect(() => {
    if (!session) {
      clearTimers();
      setWarning(false);
      return;
    }
    startTimers();
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => resetActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimers();
    };
  }, [session, startTimers, resetActivity, clearTimers]);

  const value = useMemo<UserContextValue>(
    () => ({ user: session?.user ?? null, session, loading, signOut }),
    [session, loading, signOut],
  );

  return (
    <UserContext.Provider value={value}>
      {children}
      {warning && session ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="w-[420px] rounded-sm border p-6"
            style={{
              background: "#0b0b16",
              borderColor: "#E91E8C",
              boxShadow: "0 0 40px rgba(233,30,140,0.25)",
            }}
          >
            <h2
              className="font-display text-lg font-bold uppercase tracking-[0.12em]"
              style={{ color: "#E91E8C" }}
            >
              Session expiring
            </h2>
            <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              You will be signed out in{" "}
              <span style={{ color: "#00BCD4", fontWeight: 700 }}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </span>{" "}
              due to inactivity.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => void signOut()}
                className="rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]"
                style={{
                  color: "rgba(255,255,255,0.7)",
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                Sign out
              </button>
              <button
                onClick={() => resetActivity()}
                className="rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-black"
                style={{ background: "#00BCD4" }}
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
