export type Equipment = {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  daily_rate: number;
  quantity: number;
  status: string;
  condition: string;
  notes: string | null;
  image_url: string | null;
  manual_url: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  created_at: string;
};

export type Maintenance = {
  id: string;
  equipment_id: string;
  organization_id: string;
  type: string;
  performed_at: string;
  next_due: string | null;
  cost: number;
  description: string | null;
  created_at: string;
};

export type Kit = {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  daily_rate: number;
  active: boolean;
};

export type KitItem = {
  id: string;
  kit_id: string;
  equipment_id: string;
  quantity: number;
};