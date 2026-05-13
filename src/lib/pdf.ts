import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import logoUrl from "@/assets/eurosom-logo-mark.png";

export type DocItem = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
  section?: string;
};

export type DocOrg = {
  name?: string | null;
  address?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type DocPayload = {
  kind: "quote" | "invoice";
  number: string;
  issue_date?: string | null;
  due_date?: string | null;
  title?: string | null;
  client_name?: string | null;
  client_tax_id?: string | null;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  terms?: string | null;
  vat_rate?: number;
  items: DocItem[];
  org?: DocOrg;
  included?: string[];
  excluded?: string[];
  tiers?: { label: string; amount: number; description?: string }[];
  group_by_section?: boolean;
};

const fmtEur = (n: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);

const fmtDate = (d?: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy", { locale: pt }) : "—";

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateDocPdf(p: DocPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  const logo = await loadLogo();
  if (logo) {
    try { doc.addImage(logo, "PNG", M, 30, 70, 30); } catch { /* noop */ }
  }

  // Header right — org block
  doc.setFontSize(10);
  doc.setTextColor(80);
  const org = p.org ?? {};
  const orgLines = [
    org.name ?? "Eurosom",
    org.address ?? "",
    [org.tax_id ? `NIF ${org.tax_id}` : "", org.phone ?? ""].filter(Boolean).join(" · "),
    org.email ?? "",
  ].filter(Boolean);
  orgLines.forEach((line, i) => doc.text(line, W - M, 38 + i * 12, { align: "right" }));

  // Title
  doc.setFontSize(20);
  doc.setTextColor(20);
  const docTitle = p.kind === "quote" ? "ORÇAMENTO" : "FATURA";
  doc.text(docTitle, M, 100);

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Nº ${p.number}`, M, 116);
  doc.text(`Emissão: ${fmtDate(p.issue_date ?? new Date().toISOString())}`, M, 130);
  if (p.due_date) doc.text(`Vencimento: ${fmtDate(p.due_date)}`, M, 144);

  // Client block
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("CLIENTE", W - 240, 100);
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(p.client_name ?? "—", W - 240, 116);
  if (p.client_tax_id) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`NIF ${p.client_tax_id}`, W - 240, 130);
  }

  // Project meta
  let y = 170;
  if (p.title || p.venue || p.start_date || p.end_date) {
    doc.setFontSize(10);
    doc.setTextColor(20);
    if (p.title) { doc.text(`Projeto: ${p.title}`, M, y); y += 14; }
    if (p.venue) { doc.text(`Local: ${p.venue}`, M, y); y += 14; }
    if (p.start_date || p.end_date) {
      doc.text(`Datas: ${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}`, M, y);
      y += 14;
    }
    y += 6;
  }

  // Items table — optionally grouped by section
  const vatRate = p.vat_rate ?? 23;
  const SECTION_LABELS: Record<string, string> = {
    pa: "Sistema PA",
    monitor: "Monitorização",
    lighting: "Iluminação",
    backline: "Backline",
    video: "Vídeo",
    rigging: "Estruturas / Rigging",
    transport: "Transporte e logística",
    crew: "Equipa técnica",
    other: "Outros",
  };
  const groups: Record<string, DocItem[]> = {};
  if (p.group_by_section) {
    p.items.forEach((it) => {
      const k = it.section || "other";
      (groups[k] ||= []).push(it);
    });
  } else {
    groups["__all__"] = p.items;
  }
  const orderedKeys = ["pa","monitor","lighting","backline","video","rigging","crew","transport","other"]
    .filter((k) => groups[k]?.length)
    .concat(p.group_by_section ? [] : ["__all__"]);

  let runningY = y;
  for (const key of orderedKeys) {
    const arr = groups[key];
    if (!arr?.length) continue;
    if (p.group_by_section) {
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(SECTION_LABELS[key] ?? key, M, runningY);
      doc.setFont("helvetica", "normal");
      runningY += 6;
    }
    const rows = arr.map((it) => [
      it.description,
      it.quantity.toString(),
      fmtEur(it.unit_price),
      fmtEur(it.quantity * it.unit_price),
    ]);
    autoTable(doc, {
      startY: runningY,
      head: [["Descrição", "Qtd", "Preço unit.", "Total"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [232, 185, 35], textColor: 20, fontStyle: "bold" },
      columnStyles: {
        1: { halign: "right", cellWidth: 50 },
        2: { halign: "right", cellWidth: 90 },
        3: { halign: "right", cellWidth: 90 },
      },
    });
    runningY = (doc as any).lastAutoTable.finalY + 12;
  }

  const subtotal = p.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const vat = +(subtotal * (vatRate / 100)).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);

  let ty = runningY + 4;

  doc.setFontSize(10);
  doc.setTextColor(20);
  const labelX = W - 220;
  const valueX = W - M;
  doc.text("Subtotal", labelX, ty); doc.text(fmtEur(subtotal), valueX, ty, { align: "right" });
  ty += 14;
  doc.text(`IVA (${vatRate}%)`, labelX, ty); doc.text(fmtEur(vat), valueX, ty, { align: "right" });
  ty += 14;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", labelX, ty); doc.text(fmtEur(total), valueX, ty, { align: "right" });
  doc.setFont("helvetica", "normal");
  ty += 28;

  // Tiers comparison
  if (p.tiers && p.tiers.length) {
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text("Opções disponíveis", M, ty);
    doc.setFont("helvetica", "normal");
    ty += 8;
    autoTable(doc, {
      startY: ty,
      head: [["Pacote", "Descrição", "Investimento (s/IVA)"]],
      body: p.tiers.map((t) => [t.label, t.description ?? "", fmtEur(t.amount)]),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [40, 40, 40], textColor: 240, fontStyle: "bold" },
      columnStyles: { 2: { halign: "right", cellWidth: 110 } },
    });
    ty = (doc as any).lastAutoTable.finalY + 16;
  }

  // Included / Excluded
  if ((p.included && p.included.length) || (p.excluded && p.excluded.length)) {
    const colW = (W - M * 2 - 16) / 2;
    const startY = ty;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    if (p.included?.length) {
      doc.setTextColor(20, 110, 60);
      doc.text("✓ Inclui", M, startY);
    }
    if (p.excluded?.length) {
      doc.setTextColor(150, 50, 40);
      doc.text("✗ Não inclui", M + colW + 16, startY);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.setFontSize(9);
    let leftY = startY + 14;
    let rightY = startY + 14;
    (p.included ?? []).forEach((s) => {
      const lines = doc.splitTextToSize(`• ${s}`, colW);
      doc.text(lines, M, leftY);
      leftY += lines.length * 11 + 2;
    });
    (p.excluded ?? []).forEach((s) => {
      const lines = doc.splitTextToSize(`• ${s}`, colW);
      doc.text(lines, M + colW + 16, rightY);
      rightY += lines.length * 11 + 2;
    });
    ty = Math.max(leftY, rightY) + 12;
  }

  // Notes / terms
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (p.notes) {
    doc.text("Notas:", M, ty); ty += 12;
    const lines = doc.splitTextToSize(p.notes, W - M * 2);
    doc.text(lines, M, ty); ty += lines.length * 11 + 8;
  }
  const defaultTerms = p.kind === "quote"
    ? "Orçamento válido por 30 dias. Preços em euros, IVA à taxa legal em vigor. Material sob reserva de disponibilidade até confirmação."
    : "Pagamento por transferência bancária no prazo indicado. Após data de vencimento serão aplicados juros de mora à taxa legal.";
  const termsText = p.terms || defaultTerms;
  const tlines = doc.splitTextToSize(termsText, W - M * 2);
  doc.text(tlines, M, ty);

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`${org.name ?? "Eurosom"} · ${org.email ?? ""}`.trim(), W / 2, pageH - 20, { align: "center" });

  const filename = `${p.kind === "quote" ? "orcamento" : "fatura"}_${p.number.replace(/[^a-z0-9]/gi, "_")}.pdf`;
  doc.save(filename);
}