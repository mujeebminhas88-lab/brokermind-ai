import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useUser } from "@/hooks/useUser";

function safeRedirectTarget(href: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http")) return undefined;
  try {
    const url = new URL(href, "http://x");
    const path = url.pathname;
    if (path === "/login" || path === "/signup" || path === "/forgot-password" || path === "/reset-password") {
      return undefined;
    }
    url.searchParams.delete("redirect");
    const search = url.searchParams.toString();
    return search ? `${path}?${search}` : path;
  } catch {
    return undefined;
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useUser();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !session) {
      const target = safeRedirectTarget(location.href);
      navigate({
        to: "/login",
        search: target ? { redirect: target } : {},
        replace: true,
      });
    }
  }, [mounted, loading, session, navigate, location.href]);

  // Always render the same thing during SSR and first client render
  // to avoid hydration mismatch. Only redirect after mount.
  if (!mounted) {
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
