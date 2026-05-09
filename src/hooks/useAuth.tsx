import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRowId = useRef<string | null>(null);
  const heartbeat = useRef<number | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // safety: never stay loading forever
    const t = window.setTimeout(() => setLoading(false), 8000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  // session tracking (auth_sessions)
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      heartbeat.current = null;
      sessionRowId.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("auth_sessions")
        .insert({ user_id: userId, user_agent: navigator.userAgent.slice(0, 255) })
        .select("id")
        .single();
      if (cancelled || error || !data) return;
      sessionRowId.current = data.id;
      heartbeat.current = window.setInterval(async () => {
        if (!sessionRowId.current) return;
        await supabase.from("auth_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionRowId.current);
      }, 60_000);
    })();
    const onUnload = () => {
      if (sessionRowId.current) {
        // best-effort; fire-and-forget
        supabase.from("auth_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionRowId.current);
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onUnload);
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      onUnload();
    };
  }, [session?.user?.id]);

  const signOut = async () => {
    if (sessionRowId.current) {
      await supabase.from("auth_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionRowId.current);
    }
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
