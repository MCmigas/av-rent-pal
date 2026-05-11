import { Check, ChevronsUpDown, Warehouse } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LocationSelector() {
  const { locations, activeLocationId, setActiveLocationId } = usePermissions();
  const active = locations.find((l) => l.id === activeLocationId);

  if (locations.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Sem armazém atribuído
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left text-sm hover:bg-sidebar-accent">
        <span className="flex items-center gap-2 truncate">
          <Warehouse className="h-4 w-4 text-primary" />
          <span className="truncate">{active?.name ?? "Escolher armazém"}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Armazém ativo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locations.map((l) => (
          <DropdownMenuItem key={l.id} onClick={() => setActiveLocationId(l.id)} className="justify-between">
            <span>{l.name}</span>
            {l.id === activeLocationId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}