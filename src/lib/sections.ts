export const SECTIONS = [
  { value: "pa", label: "Sistema PA" },
  { value: "monitor", label: "Monitorização" },
  { value: "lighting", label: "Iluminação" },
  { value: "backline", label: "Backline" },
  { value: "video", label: "Vídeo" },
  { value: "rigging", label: "Estruturas / Rigging" },
  { value: "crew", label: "Equipa técnica" },
  { value: "transport", label: "Transporte e logística" },
  { value: "other", label: "Outros" },
] as const;

export const sectionLabel = (v?: string | null) =>
  SECTIONS.find((s) => s.value === v)?.label ?? "Outros";

export const EVENT_TYPES = [
  "Casamento",
  "Conferência / Corporativo",
  "Concerto pequeno",
  "Concerto / Festival",
  "Festa privada",
  "Teatro / Espetáculo",
  "Outro",
];

export const DEFAULT_INCLUDED = [
  "Montagem e desmontagem por equipa técnica certificada",
  "Técnico de som em standby durante todo o evento",
  "Transporte do equipamento ida e volta",
  "Seguro de responsabilidade civil",
  "Equipamento de reserva (backup) em local",
  "Reunião técnica prévia e consulta ao rider",
];

export const DEFAULT_EXCLUDED = [
  "Eletricidade / quadros elétricos no local",
  "Refeições e alojamento da equipa técnica",
  "Estadia ou permanência além do horário acordado",
  "Licenças de SPA / direitos de autor",
  "Trabalhos de carpintaria, palco ou estruturas pesadas não previstos",
];