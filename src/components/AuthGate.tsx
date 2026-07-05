import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useUser } from "@/hooks/useUser";

/**
 * Sanitizes a would-be redirect target so it can never be a login/signup
 * URL (which produces a redirect loop) and never carries a nested
 * `redirect=` param. Returns a clean pathname (+ safe search string).
 */
function safeRedirectTarget(href: string): string | undefined {
  if (!href) return undefined;
  // Reject anything obviously unsafe.
  if (href.startsWith("http")) return undefined;
  // Normalize.
  try {
    const url = new URL(href, "http://x");
    const path = url.pathname;
    if (path === "/login" || path === "/signup" || path === "/forgot-password" || path === "/reset-password") {
      return undefined;
    }
    // Drop nested redirect params.
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

  useEffect(() => {
    if (!loading && !session) {
      const target = safeRedirectTarget(location.href);
      navigate({
        to: "/login",
        search: target ? { redirect: target } : {},
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
