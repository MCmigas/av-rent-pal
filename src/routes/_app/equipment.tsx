import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EquipmentInventory } from "@/components/equipment/EquipmentInventory";
import { KitsView } from "@/components/equipment/KitsView";
import { MaintenanceView } from "@/components/equipment/MaintenanceView";

export const Route = createFileRoute("/_app/equipment")({
  head: () => ({ meta: [{ title: "Equipamento — Eurosom" }] }),
  component: EquipmentPage,
});

function EquipmentPage() {
  return (
    <>
      <PageHeader title="Equipamento" subtitle="Inventário, kits e manutenção" />
      <Tabs defaultValue="inventory">
        <TabsList className="mb-4">
          <TabsTrigger value="inventory">Inventário</TabsTrigger>
          <TabsTrigger value="kits">Kits</TabsTrigger>
          <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory"><EquipmentInventory /></TabsContent>
        <TabsContent value="kits"><KitsView /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceView /></TabsContent>
      </Tabs>
    </>
  );
}
