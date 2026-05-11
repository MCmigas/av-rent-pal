import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

type Props = {
  permission?: string;
  anyOf?: string[];
  adminOnly?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate({ permission, anyOf, adminOnly, fallback = null, children }: Props) {
  const { can, isAdmin, isSuperAdmin } = usePermissions();
  if (adminOnly && !(isAdmin || isSuperAdmin)) return <>{fallback}</>;
  if (permission && !can(permission)) return <>{fallback}</>;
  if (anyOf && !anyOf.some((p) => can(p))) return <>{fallback}</>;
  return <>{children}</>;
}