import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useUser } from "@/hooks/useUser";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useUser();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (!loading && !session) {
      navigate({
        to: "/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  }, [loading, session, navigate, location.href]);

  if (loading || !session) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#07070d" }}
      >
        <div
          className="font-display text-xs font-semibold uppercase tracking-[0.24em]"
          style={{ color: "#00BCD4" }}
        >
          Authenticating…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
