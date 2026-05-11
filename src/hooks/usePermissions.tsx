import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Location = { id: string; name: string; organization_id: string };

type PermissionsCtx = {
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
  can: (perm: string) => boolean;
  locations: Location[];
  activeLocationId: string | null;
  setActiveLocationId: (id: string | null) => void;
  organizationId: string | null;
};

const STORAGE_KEY = "eurosom_selected_location";

const Ctx = createContext<PermissionsCtx>({
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  permissions: [],
  can: () => false,
  locations: [],
  activeLocationId: null,
  setActiveLocationId: () => {},
  organizationId: null,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(null);

  const setActiveLocationId = useCallback((id: string | null) => {
    setActiveLocationIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const q = useQuery({
    enabled: !!user?.id,
    queryKey: ["permissions", user?.id],
    queryFn: async () => {
      const [{ data: upps }, { data: superRows }, { data: locs }] = await Promise.all([
        supabase
          .from("user_permission_profiles")
          .select("organization_id, permission_profiles(name, is_system, permissions)")
          .eq("user_id", user!.id),
        supabase.from("super_admins").select("user_id").eq("user_id", user!.id),
        supabase.from("locations").select("id, name, organization_id"),
      ]);

      const perms = new Set<string>();
      let isAdmin = false;
      let orgId: string | null = null;
      for (const row of upps ?? []) {
        orgId = orgId ?? (row as any).organization_id;
        const p = (row as any).permission_profiles;
        if (!p) continue;
        if (p.is_system && p.name === "Administrador") isAdmin = true;
        for (const perm of (p.permissions ?? []) as string[]) perms.add(perm);
      }
      return {
        permissions: Array.from(perms),
        isAdmin,
        isSuperAdmin: (superRows?.length ?? 0) > 0,
        locations: (locs ?? []) as Location[],
        organizationId: orgId,
      };
    },
  });

  // Initialise active location from storage / first available
  useEffect(() => {
    if (!q.data) return;
    const locs = q.data.locations;
    if (locs.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && locs.some((l) => l.id === stored)) {
      setActiveLocationIdState(stored);
    } else {
      setActiveLocationId(locs[0].id);
    }
  }, [q.data, setActiveLocationId]);

  const can = useCallback(
    (perm: string) => {
      if (!q.data) return false;
      if (q.data.isSuperAdmin) return true;
      const ps = q.data.permissions;
      return ps.includes("*") || ps.includes(perm);
    },
    [q.data],
  );

  const value = useMemo<PermissionsCtx>(
    () => ({
      loading: authLoading || q.isLoading,
      isAdmin: q.data?.isAdmin ?? false,
      isSuperAdmin: q.data?.isSuperAdmin ?? false,
      permissions: q.data?.permissions ?? [],
      can,
      locations: q.data?.locations ?? [],
      activeLocationId,
      setActiveLocationId,
      organizationId: q.data?.organizationId ?? null,
    }),
    [authLoading, q.isLoading, q.data, can, activeLocationId, setActiveLocationId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePermissions = () => useContext(Ctx);