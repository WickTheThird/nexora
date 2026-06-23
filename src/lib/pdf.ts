// Dual-mode PDF generator modelled on Enagh Contracts' Subcontractor
// Payment Advice (the de-facto standard for Irish RCT subcontracting):
//
//   mode = "advice"  → 2-page Subcontractor Payment Advice issued by the
//                       principal (BC) to the subcontractor. Page 1 is the
//                       advice itself with line items + RCT calc; page 2 is
//                       the Payment Notification Acknowledgement (Revenue
//                       Commissioners record).
//   mode = "invoice" → 1-page Invoice issued BY the subcontractor TO the
//                       principal. Same numbers, party direction flipped.
//                       This is the legal billing document (sub is the
//                       issuer).
//
// Source data: an InvoicePayload computed by the worker /admin/.../invoice
// endpoint (or assembled client-side for the sub-side preview).

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { InvoicePayload, PaymentRecord } from "./types";

export type PdfMode = "advice" | "invoice" | "bc_invoice";

function fmtMoneyMinor(amountMinor: number, currency: string): string {
  // Enagh format: plain "1,000.00" with no currency symbol in the number
  // columns - the currency is implied by the surrounding context.
  return (amountMinor / 100).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtMoneyWithSymbol(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "-";
  try {
    const d = new Date(s);
    // Enagh uses dd/mm/yyyy.
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  } catch {
    return s;
  }
}

// Map RCT rate → "Tax Liability" label that matches Revenue terminology.
function taxLiabilityLabel(rate: string | null): string {
  if (rate === "0") return "Zero Rate";
  if (rate === "20") return "Standard Rate";
  if (rate === "35") return "Higher Rate";
  return "Standard Rate";
}

export function generateInvoicePdf(
  inv: InvoicePayload,
  brandName = "Fintrex Contractors",
  mode: PdfMode = "advice",
): jsPDF {
  if (mode === "bc_invoice") return generateBcInvoicePdf(inv, brandName);
  if (mode === "invoice") return generateSubInvoicePdf(inv, brandName);
  return generatePaymentAdvicePdf(inv, brandName);
}

// =====================================================================
// Mode 1: Subcontractor Payment Advice (principal → subcontractor)
// 2-page layout matching Enagh Contracts.
// =====================================================================
function generatePaymentAdvicePdf(inv: InvoicePayload, brandName: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const sub = inv.subcontractor;
  const totals = inv.totals;
  const currency = totals.currency || "EUR";

  // ---- HEADER ----
  // Top left: brand wordmark (we don't have a raster logo bundled - render
  // the text mark in a styled box for now). Top right: principal info.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(15, 23, 34);
  doc.text(brandName, margin, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("· bc", margin + doc.getTextWidth(brandName) + 4, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 34);
  doc.text("Subcontractor Payment Advice", pageWidth - margin, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const principalLines = [
    inv.principal.name || "[Principal name not set]",
    inv.principal.address || "",
    inv.principal.email ? `Email: ${inv.principal.email}` : "",
    inv.principal.vat ? `VAT Registration Number: ${inv.principal.vat}` : "",
  ].filter(Boolean);
  let py = 70;
  for (const line of principalLines) {
    const wrapped = doc.splitTextToSize(line, 240);
    for (const w of wrapped) {
      doc.text(w, pageWidth - margin, py, { align: "right" });
      py += 11;
    }
  }

  // ---- SUBCONTRACTOR ADDRESS BLOCK ----
  let y = Math.max(py + 18, 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const subAddrLines = [
    (sub.fullName || "-").toUpperCase(),
    [sub.address1, sub.address2].filter(Boolean).join(", "),
    sub.town || "",
    sub.postcode || "",
  ].filter(Boolean);
  for (const line of subAddrLines) {
    doc.text(line, margin, y);
    y += 13;
  }

  // ---- FIELD ROW (two columns of label/value pairs) ----
  y += 24;
  const colLeftLabel = margin;
  const colLeftValue = margin + 110;
  const colRightLabel = pageWidth / 2 + 20;
  const colRightValue = pageWidth - margin - 90;

  // We need a representative payment for the per-line context. For an advice
  // covering one period there is typically one payment record; if multiple,
  // we use the most recent for the header fields and aggregate the line items
  // below.
  const headPayment: PaymentRecord | undefined = inv.lines[0];
  const subRef = sub.subcontractorRef || sub.clientRef || sub.id.slice(0, 8).toUpperCase();
  const taxRef = sub.ppsNumber || "-";
  const paymentRef = "BACS"; // Standard for Irish bank transfers
  const taxLiability = taxLiabilityLabel(sub.rctRate);
  const contractId = headPayment?.reference || inv.invoiceNumber.slice(-8);
  const paymentNotificationId = headPayment?.rctAuthNumber || "-";
  const paymentDate = fmtDate(headPayment?.paymentDate || inv.issuedAt.slice(0, 10));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Subcontractor", colLeftLabel, y);
  doc.text("Tax Liability", colRightLabel, y);
  doc.setFont("helvetica", "normal");
  doc.text(subRef, colLeftValue, y);
  doc.text(taxLiability, colRightValue, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text("Tax Reference", colLeftLabel, y);
  doc.text("Contract ID", colRightLabel, y);
  doc.setFont("helvetica", "normal");
  doc.text(taxRef, colLeftValue, y);
  doc.text(contractId, colRightValue, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text("Payment Reference", colLeftLabel, y);
  doc.text("Payment Notification ID", colRightLabel, y);
  doc.setFont("helvetica", "normal");
  doc.text(paymentRef, colLeftValue, y);
  doc.text(String(paymentNotificationId), colRightValue, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text("", colLeftLabel, y);
  doc.text("Payment Date", colRightLabel, y);
  doc.setFont("helvetica", "normal");
  doc.text(paymentDate, colRightValue, y, { align: "right" });

  // ---- LINE ITEMS ----
  // Enagh layout: Quantity | Rate | Labour | Material | Gross
  // For us: Labour = Quantity × Rate; Material defaults to 0 unless we
  // start tracking material costs.
  y += 36;
  const lineRows = inv.lines.map((p) => {
    const qty = p.hours ?? 1;
    const rate = qty && p.grossMinor ? (p.grossMinor / qty) : (p.grossMinor / 100);
    const labour = p.grossMinor;
    const material = 0;
    return [
      qty.toFixed(2),
      (rate / 100).toFixed(2),
      fmtMoneyMinor(labour, currency),
      fmtMoneyMinor(material, currency),
      fmtMoneyMinor(labour + material, currency),
    ];
  });
  // Aggregate for the case where there's only one summary row
  if (lineRows.length === 0) {
    lineRows.push(["-", "-", "-", "-", "-"]);
  }

  autoTable(doc, {
    head: [["Quantity", "Rate", "Labour", "Material", "Gross"]],
    body: lineRows,
    startY: y,
    margin: { left: margin + 180, right: margin },
    theme: "plain",
    headStyles: {
      fontStyle: "bold",
      fontSize: 9,
      textColor: [80, 80, 80],
      halign: "right",
    },
    styles: { fontSize: 10, cellPadding: { top: 4, right: 6, bottom: 4, left: 6 }, halign: "right" },
    columnStyles: {
      0: { halign: "right" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  // @ts-expect-error autoTable mutates doc
  let afterY: number = doc.lastAutoTable?.finalY ?? y + 30;

  // ---- TOTALS BLOCK ----
  // Enagh format:
  //   Net Certified Value           (gross)
  //   Plus VAT at X.XX% on X         (vatAmt)
  //   Less Tax at X% on X            (rctAmt)
  //   Payment Total                  (final)
  afterY += 6;
  const labelX = pageWidth - margin - 220;
  const valueX = pageWidth - margin;
  const drawSummary = (label: string, value: string, opts: { bold?: boolean; underline?: boolean } = {}) => {
    if (opts.bold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(label, labelX, afterY);
    doc.text(value, valueX, afterY, { align: "right" });
    if (opts.underline) {
      doc.setLineWidth(0.5);
      doc.line(valueX - 80, afterY + 2, valueX, afterY + 2);
    }
    afterY += 16;
  };

  const netCertified = totals.gross;
  const vatRate = sub.vatReverseCharge ? 0 : 0; // VAT reverse charge → 0%; standard subcontractors usually 0% on RCT services
  const vatAmt = Math.floor((netCertified * vatRate) / 100);
  drawSummary("Net Certified Value", fmtMoneyMinor(netCertified, currency), { bold: true });
  drawSummary(
    `Plus VAT at  ${vatRate.toFixed(2)}% on ${fmtMoneyMinor(netCertified, currency)}`,
    fmtMoneyMinor(vatAmt, currency),
  );
  if (sub.rctRate) {
    drawSummary(
      `Less Tax at ${sub.rctRate}%% on ${fmtMoneyMinor(netCertified, currency)}`,
      fmtMoneyMinor(totals.rct, currency),
    );
  }
  afterY += 4;
  doc.setLineWidth(0.7);
  doc.line(labelX, afterY - 10, valueX, afterY - 10);
  drawSummary("Payment Total", fmtMoneyMinor(totals.net + vatAmt, currency), { bold: true });
  doc.setLineWidth(0.7);
  doc.line(valueX - 90, afterY - 10, valueX, afterY - 10);
  doc.line(valueX - 90, afterY - 8,  valueX, afterY - 8);

  // ---- VAT REVERSE-CHARGE NOTICE (Revenue-mandated wording) ----
  // Required on every payment advice for construction services subject
  // to RCT. Revenue's TDM Part 11 (Construction Services) prescribes
  // exactly this wording. Sits above the legal block so it reads as a
  // tax disclosure rather than a contract clause.
  afterY += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(
    "VAT on this supply to be accounted for by the Principal Contractor.",
    margin, afterY, { maxWidth: pageWidth - margin * 2 },
  );
  afterY += 11;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Reverse charge basis under Section 16(2) VATCA 2010 - construction services subject to RCT.",
    margin, afterY, { maxWidth: pageWidth - margin * 2 },
  );

  // ---- LEGAL TEXT (Enagh's exact 4 statements) ----
  const pageHeight = doc.internal.pageSize.getHeight();
  let legalY = pageHeight - 230;
  doc.setLineWidth(0.5);
  doc.setDrawColor(120, 120, 120);
  doc.line(margin, legalY, pageWidth - margin, legalY);

  legalY += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const wrap = (text: string, w: number) => doc.splitTextToSize(text, w);
  const writeLines = (text: string, w: number) => {
    for (const line of wrap(text, w)) {
      doc.text(line, margin, legalY);
      legalY += 10;
    }
  };
  // Canonical acceptance clause - user's verbatim wording, with the
  // contractor name interpolated from the payload + the contract URL.
  const contractorName = inv.principal.name || `${brandName} Contractors Ltd`;
  // Strip protocol from the URL for the rendered clause.
  const contractUrl = "fintrexcontractors.com/legal/contract";
  writeLines(
    `By accepting this payment, and by continuing to provide services to ${contractorName} or its clients, you acknowledge that you have had the opportunity to review the Contract for Services available at ${contractUrl}, and agree to be bound by its terms in respect of all services provided.`,
    pageWidth - margin * 2,
  );
  legalY += 4;
  writeLines(
    "In particular you acknowledge that we can only treat you as self-employed because the following statements are true:",
    pageWidth - margin * 2,
  );
  legalY += 4;
  const clauses = [
    "I.    You are a self-employed Subcontractor.",
    "II.   You have the right to send a suitably qualified substitute to provide the Services.",
    "III.  There is no obligation on you to do work and no obligation on us to provide work.",
    "IV.   You are responsible for the Services provided and neither we nor our clients have a right to supervise, direct or control how you provide the Services.",
  ];
  for (const c of clauses) {
    writeLines(c, pageWidth - margin * 2 - 12);
  }

  // ---- "DO NOT DESTROY" banner ----
  doc.setFillColor(15, 23, 34);
  doc.rect(margin, pageHeight - 36, pageWidth - margin * 2, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "** DO NOT DESTROY - PLEASE KEEP FOR YOUR RECORDS AS IT MAY HAVE TO BE PRODUCED IF REQUESTED BY REVENUE COMMISSIONERS. **",
    pageWidth / 2,
    pageHeight - 24,
    { align: "center" },
  );

  // =====================================================================
  // PAGE 2: Payment Notification Acknowledgement
  // =====================================================================
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Payment Notification Acknowledgement", margin, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("The following payment notifications will be input", margin, 78);

  // Row table
  autoTable(doc, {
    head: [["Payment Notification ID", "Sub Tax Ref", "Subcontractor Name", "Date Input", "Gross Payment", "Net Payment", "Deduction Amount"]],
    body: [[
      String(paymentNotificationId),
      String(taxRef),
      (sub.fullName || "-").toUpperCase(),
      paymentDate,
      fmtMoneyMinor(netCertified, currency),
      fmtMoneyMinor(totals.net, currency),
      fmtMoneyMinor(totals.rct, currency),
    ]],
    startY: 92,
    margin: { left: margin, right: margin },
    theme: "plain",
    headStyles: { fontStyle: "bold", fontSize: 8, textColor: [80, 80, 80], halign: "left" },
    styles: { fontSize: 9, cellPadding: { top: 4, right: 4, bottom: 4, left: 4 } },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  // @ts-expect-error
  let p2y: number = doc.lastAutoTable?.finalY ?? 130;
  p2y += 12;
  doc.setLineWidth(0.5);
  doc.line(margin, p2y, pageWidth - margin, p2y);

  p2y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  const principalLine = inv.principal.name && inv.principal.vat
    ? `${inv.principal.name.toUpperCase()}: ${inv.principal.vat}`
    : (inv.principal.name || "[Principal]").toUpperCase();
  doc.text(principalLine, margin, p2y);

  p2y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const grossText = fmtMoneyMinor(netCertified, currency);
  const taxText = fmtMoneyMinor(totals.rct, currency);
  const subName = (sub.fullName || "-").toUpperCase();
  const noteLines = [
    `You have notified the Revenue Commissioners that you are about to make a relevant payment of ${grossText} to the below subcontractor`,
    "",
    `${subName} : ${taxRef}`,
    "",
    `You are hereby authorised to deduct from this payment, tax at the rate of ${sub.rctRate || "0"}%, which based on ${grossText}, results in a tax amount of ${taxText}`,
    "",
    "If you do not make this payment, you must withdraw the Payment Notification in your return for the period, or earlier.",
    "",
    "Revenue Commissioners.",
  ];
  for (const ln of noteLines) {
    if (ln === "") { p2y += 12; continue; }
    const wrapped = doc.splitTextToSize(ln, pageWidth - margin * 2);
    for (const w of wrapped) {
      doc.text(w, margin, p2y);
      p2y += 13;
    }
  }

  return doc;
}

// =====================================================================
// Mode 2: Subcontractor Invoice (sub → principal)
// 1-page layout with sub as issuer.
// =====================================================================
function generateSubInvoicePdf(inv: InvoicePayload, brandName: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const sub = inv.subcontractor;
  const totals = inv.totals;
  const currency = totals.currency || "EUR";

  // Admin-controlled template (header tagline, payment terms, footer note,
  // visible-section toggles). Worker pre-populates this on the invoice
  // payload; absence falls back to sensible defaults.
  const tpl = inv.template;
  const tplShowVat = tpl?.showVat ?? true;
  const tplShowBank = tpl?.showBank ?? true;
  const tplShowContact = tpl?.showContact ?? true;
  const tplShowPrincipalRef = tpl?.showPrincipalRef ?? true;

  // Header - heading + optional tagline beneath
  const headerHeight = tpl?.headerTagline ? 86 : 70;
  doc.setFillColor(15, 23, 34);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Invoice", margin, 42);
  if (tpl?.headerTagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(220, 220, 220);
    doc.text(tpl.headerTagline, margin, 64);
  }

  const headerNumber =
    inv.lines[0]?.invoiceNumber || inv.invoiceNumber;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11);
  doc.text(headerNumber, pageWidth - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 188, 204);
  doc.text(
    `Issued ${new Date(inv.issuedAt).toLocaleDateString("en-IE")}`,
    pageWidth - margin, 60, { align: "right" },
  );

  // Parties - neutral labels so the same layout works for both
  // sub→principal and BC→primary directions. The actual company name
  // identifies who is who. Start position shifts down when there's a
  // tagline above (taller header bar).
  let y = headerHeight + 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("FROM", margin, y);
  doc.text("BILL TO", pageWidth / 2 + 10, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);

  // Conditional sections come from the admin template. showContact hides
  // phone/email; showVat hides VAT lines (rare, but useful for non-VAT
  // contractors who don't want a "VAT: -" line on every invoice).
  const subBlock = [
    sub.fullName || "-",
    [sub.address1, sub.address2].filter(Boolean).join(", "),
    [sub.town, sub.postcode].filter(Boolean).join(" "),
    tplShowContact ? (sub.email || "") : "",
    sub.ppsNumber ? `PPS: ${sub.ppsNumber}` : "",
    tplShowVat && sub.vatNumber ? `VAT: ${sub.vatNumber}` : "",
  ].filter(Boolean);
  const principalBlock = [
    inv.principal.name || "[Principal]",
    inv.principal.address || "",
    tplShowVat && inv.principal.vat ? `VAT: ${inv.principal.vat}` : "",
    tplShowContact ? (inv.principal.email || "") : "",
  ].filter(Boolean);

  const colW = pageWidth / 2 - margin - 10;
  const fromTextLines: string[] = [];
  for (const ln of subBlock) fromTextLines.push(...doc.splitTextToSize(ln, colW));
  const toTextLines: string[] = [];
  for (const ln of principalBlock) toTextLines.push(...doc.splitTextToSize(ln, colW));
  fromTextLines.forEach((ln, i) => doc.text(ln, margin, y + i * 13));
  toTextLines.forEach((ln, i) => doc.text(ln, pageWidth / 2 + 10, y + i * 13));
  y += Math.max(fromTextLines.length, toTextLines.length) * 13 + 24;

  // Period / RCT band
  doc.setFillColor(247, 248, 250);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("PERIOD", margin + 12, y + 16);
  doc.text("RCT RATE", margin + 200, y + 16);
  doc.text("VAT", margin + 320, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`${fmtDate(inv.period.from)} to ${fmtDate(inv.period.to)}`, margin + 12, y + 32);
  doc.text(sub.rctRate ? `${sub.rctRate}%` : "N/A", margin + 200, y + 32);
  doc.text(sub.vatReverseCharge ? "Reverse charge" : "Standard", margin + 320, y + 32);
  y += 60;

  // Lines
  autoTable(doc, {
    head: [["Date", "Period", "Hours", "Site", "Reference", "RCT", "Gross", "Net"]],
    body: inv.lines.map((p) => [
      fmtDate(p.paymentDate),
      p.periodStart && p.periodEnd ? `${fmtDate(p.periodStart)} to ${fmtDate(p.periodEnd)}` : "-",
      p.hours != null ? p.hours.toFixed(2) : "-",
      p.siteRef || "-",
      p.reference || "-",
      p.rctRate ? `-${fmtMoneyWithSymbol(p.rctDeductionMinor, p.currency)} (${p.rctRate}%)` : "-",
      fmtMoneyWithSymbol(p.grossMinor, p.currency),
      fmtMoneyWithSymbol(p.netMinor, p.currency),
    ]),
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fillColor: [15, 23, 34], textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: {
      2: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
      7: { halign: "right", fontStyle: "bold" },
    },
  });
  // @ts-expect-error
  let afterY: number = doc.lastAutoTable?.finalY ?? y + 30;
  afterY += 18;

  // Totals - right-aligned in three explicit columns to avoid overlap when
  // numbers run wide. Gap of >= 24pt between columns; right-align each value
  // on its own column boundary so the totals always look like a tidy stack.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("TOTALS", margin, afterY);
  afterY += 6;
  const right = pageWidth - margin;
  // Column boundaries (right edges) for the value cells.
  const colNet = right;
  const colRct = right - 140;
  const colGross = right - 280;
  for (const [ccy, t] of Object.entries(inv.totalsByCurrency)) {
    afterY += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(`${t.count} payments • ${t.hours.toFixed(2)} hours`, margin, afterY);

    // Each label/value pair as label-left-of / value-right-aligned. Labels
    // sit a fixed offset left of their value's right edge.
    doc.setTextColor(80, 80, 80);
    doc.text("Gross", colGross - 90, afterY);
    doc.text("RCT",   colRct   - 90, afterY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("Net",   colNet   - 90, afterY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(fmtMoneyWithSymbol(t.gross, ccy), colGross, afterY, { align: "right" });
    doc.setTextColor(185, 28, 28);
    doc.text(`-${fmtMoneyWithSymbol(t.rct, ccy)}`, colRct, afterY, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(fmtMoneyWithSymbol(t.net, ccy), colNet, afterY, { align: "right" });
  }

  // Revenue mandates this exact wording on every subcontractor invoice
  // for relevant construction services (RCT) - see Revenue VAT TDM Part
  // 11 (Construction Services). The principal self-accounts for VAT at
  // 13.5% in their VAT3 return; the subcontractor invoices net of VAT.
  // We always show this on any RCT-eligible invoice (construction
  // services in Ireland), with the VATCA cite kept on a second line as
  // the legal basis. The `vatReverseCharge` flag remains as a per-sub
  // toggle for edge cases (e.g. a non-construction service line).
  if (sub.vatReverseCharge !== false) {
    afterY += 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(
      "VAT on this supply to be accounted for by the Principal Contractor.",
      margin, afterY, { maxWidth: pageWidth - margin * 2 },
    );
    afterY += 12;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(
      "Reverse charge basis under Section 16(2) VATCA 2010 - construction services subject to RCT.",
      margin, afterY, { maxWidth: pageWidth - margin * 2 },
    );
  }

  // Payment terms (admin-controlled freeform). Sits above the PAY TO block
  // since it usually says "Payment due within X days" - the recipient should
  // see the deadline before the bank details.
  if (tpl?.paymentTerms) {
    afterY += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("PAYMENT TERMS", margin, afterY);
    afterY += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(tpl.paymentTerms, pageWidth - margin * 2);
    for (const line of lines) {
      doc.text(line, margin, afterY);
      afterY += 13;
    }
  }

  // Bank - tightened to one line where possible. IBAN + BIC together is the
  // minimum a payer needs in the SEPA zone; the account holder name on the
  // same row confirms identity. Bank name is shown only if present.
  if (tplShowBank && (inv.bank?.iban || inv.bank?.accountNumber)) {
    afterY += 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("PAY TO", margin, afterY);
    afterY += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    if (inv.bank.accountHolderName) {
      doc.text(inv.bank.accountHolderName, margin, afterY);
      afterY += 14;
    }
    if (inv.bank.iban) {
      const bicSuffix = inv.bank.bic ? `   BIC ${inv.bank.bic}` : "";
      doc.setFont("courier", "normal");
      doc.text(`IBAN ${inv.bank.iban}${bicSuffix}`, margin, afterY);
      doc.setFont("helvetica", "normal");
      afterY += 14;
    }
    if (inv.bank.bankName) {
      doc.setTextColor(110, 110, 110);
      doc.setFontSize(9);
      doc.text(inv.bank.bankName, margin, afterY);
      afterY += 12;
    }
  }

  // Admin-controlled footer note (centered, 60pt above the legal banner so
  // it has breathing room and doesn't clash with the wordmark line).
  const pageHeight = doc.internal.pageSize.getHeight();
  if (tpl?.footerNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(tpl.footerNote, pageWidth - margin * 2);
    let footerNoteY = pageHeight - 50 - (noteLines.length * 11);
    for (const line of noteLines) {
      doc.text(line, pageWidth / 2, footerNoteY, { align: "center" });
      footerNoteY += 11;
    }
  }

  // Page footer (legal banner)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${brandName} · invoice issued by subcontractor under Irish RCT`,
    pageWidth / 2, pageHeight - 24, { align: "center" },
  );

  return doc;
}

// =====================================================================
// Mode 3: BC-issued Invoice (BC -> Principal) - Enagh-style layout
// =====================================================================
// Renders the two BC-side invoices (labour pass-through + service fee).
// Layout matches the Enagh reference: brand top-left, BC address
// top-right, customer details mid-left, invoice metadata mid-right,
// line items table with VAT column, summary block, payment details
// box, footer with contact + registered office.
function generateBcInvoicePdf(inv: InvoicePayload, brandName: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const rightX = pageWidth - margin;
  const currency = inv.totals.currency || "EUR";
  const bc = inv.bc || {} as Partial<NonNullable<InvoicePayload["bc"]>>;

  // Header: brand left, BC address right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(15, 23, 34);
  doc.text(brandName, margin, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const bcAddrLines = [
    inv.subcontractor.fullName || brandName,
    ...(inv.subcontractor.address1 ? inv.subcontractor.address1.split("\n") : []),
  ];
  let y = 30;
  for (const line of bcAddrLines) {
    doc.text(line, rightX, y, { align: "right" });
    y += 13;
  }

  // "Invoice" title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 34);
  doc.text("Invoice", rightX, 130, { align: "right" });

  // VAT Reg No (BC's)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  if (inv.subcontractor.vatNumber) {
    doc.text(`VAT Reg No: ${inv.subcontractor.vatNumber}`, rightX, 150, { align: "right" });
  }

  // Customer Details (left) + Invoice metadata (right) - top of body
  let bodyY = 190;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 34);
  doc.text("Customer Details", margin, bodyY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const customerLines = [
    inv.principal.name || "[Customer]",
    ...(inv.principal.address ? inv.principal.address.split("\n") : []),
  ].filter(Boolean);
  let cy = bodyY + 14;
  for (const line of customerLines) {
    doc.text(line, margin, cy);
    cy += 13;
  }

  // Invoice metadata block (right)
  const metaLabelX = rightX - 130;
  const metaValueX = rightX;
  const issuedDate = new Date(inv.issuedAt).toLocaleDateString("en-IE");
  const meta: Array<[string, string]> = [
    ["Invoice No:", inv.invoiceNumber],
    ["Date:", issuedDate],
  ];
  if (inv.principal.vat) meta.push(["Customer Acc. Re:", inv.principal.vat]);
  if (inv.jobCardType) {
    const jct = inv.jobCardType.charAt(0).toUpperCase() + inv.jobCardType.slice(1);
    meta.push(["Job Card Type:", jct]);
  }
  doc.setFontSize(10);
  let my = bodyY;
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(label, metaLabelX, my, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(value, metaValueX, my, { align: "right" });
    my += 16;
  }

  // Line items table
  const tableTop = Math.max(cy, my) + 26;
  const gross = inv.grossAmountMinor != null ? inv.grossAmountMinor : inv.totals.gross;
  const vat = inv.vatAmountMinor != null ? inv.vatAmountMinor : 0;
  const net = inv.netAmountMinor != null ? inv.netAmountMinor : gross + vat;
  // VAT rate display logic:
  //  - If VAT was actually charged (service invoices, admin fees, etc.)
  //    derive the percent from the amounts.
  //  - If VAT is 0 (the standard labour pass-through case under RCT
  //    reverse-charge), show the headline snapshot rate so the principal
  //    sees what they need to account for on their VAT3 return. Falls
  //    back to 13.5% which is the Irish reduced rate for construction.
  const vatRateForDisplay = vat > 0
    ? (gross > 0 ? Math.round((vat / gross) * 1000) / 10 : 0)
    : (inv.vatRatePercent != null ? inv.vatRatePercent : 13.5);
  const vatRateLabel = `${vatRateForDisplay}%`;

  const detailLines: string[] = [];
  if (inv.invoiceKind === "service") {
    detailLines.push("BC service fee");
  } else {
    detailLines.push(". for the following site IDs:");
    if (inv.siteCodes && inv.siteCodes.length > 0) {
      for (const code of inv.siteCodes) detailLines.push(`- ${code}`);
    }
  }

  autoTable(doc, {
    startY: tableTop,
    head: [["Details", "Unit Price", "Net Amount", "VAT Rate"]],
    body: [[
      detailLines.join("\n"),
      fmtMoneyMinor(gross, currency),
      fmtMoneyMinor(gross, currency),
      vatRateLabel,
    ]],
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6, valign: "top" },
    headStyles: { fillColor: [255, 255, 255], textColor: [80, 80, 80], fontStyle: "normal", lineWidth: 0 },
    bodyStyles: { textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 80 },
      2: { halign: "right", cellWidth: 80 },
      3: { halign: "right", cellWidth: 70 },
    },
    theme: "plain",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = (doc as any).lastAutoTable.finalY + 30;

  // Invoice Summary block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 34);
  doc.text("Invoice Summary", margin, afterTableY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("The principal must account for the VAT on this supply", margin, afterTableY + 22);

  // Totals on the right
  const totalsLabelX = rightX - 90;
  const totalsValueX = rightX;
  let ty = afterTableY;
  for (const [label, value] of [
    ["Net", fmtMoneyMinor(gross, currency)],
    ["VAT", fmtMoneyMinor(vat, currency)],
    ["Gross", fmtMoneyMinor(net, currency)],
  ]) {
    doc.setFont("helvetica", "bold");
    doc.text(label, totalsLabelX, ty, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(value, totalsValueX, ty, { align: "right" });
    ty += 18;
  }

  // Payment Details block
  const payY = Math.max(ty, afterTableY + 60) + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 34);
  doc.text("Payment Details:", margin, payY);
  doc.setFont("helvetica", "normal");
  doc.text("Payment to be made ASAP", margin + 100, payY);

  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const payLines: Array<[string, string]> = [];
  if (bc.bankAccountName) payLines.push(["Account Name:", bc.bankAccountName]);
  if (bc.bankBic) payLines.push(["BIC:", bc.bankBic]);
  if (bc.bankIban) payLines.push(["IBAN:", bc.bankIban]);
  let py = payY + 16;
  for (const [label, value] of payLines) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, py);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 95, py);
    py += 14;
  }
  if (bc.bankAccountAddress) {
    py += 4;
    doc.setFont("helvetica", "normal");
    for (const line of bc.bankAccountAddress.split("\n")) {
      doc.text(line, margin, py);
      py += 13;
    }
  }

  // Footer (bottom of page): phones + website + email + registered office
  const footerTop = pageHeight - 90;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerTop - 10, rightX, footerTop - 10);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const phoneParts: string[] = [];
  if (bc.phoneRoi) phoneParts.push(`ROI: ${bc.phoneRoi}`);
  if (bc.phoneNi) phoneParts.push(`NI: ${bc.phoneNi}`);
  if (phoneParts.length) doc.text(phoneParts.join("  |  "), margin, footerTop + 2);
  if (bc.registeredNumber) {
    doc.text(`Registered in Ireland - Number: ${bc.registeredNumber}`, margin, footerTop + 16);
  }
  if (bc.website) doc.text(bc.website, rightX, footerTop + 2, { align: "right" });
  if (inv.subcontractor.email) doc.text(inv.subcontractor.email, rightX, footerTop + 16, { align: "right" });

  // Registered office (centred, last line)
  if (inv.subcontractor.address1 || inv.subcontractor.fullName) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const tradingLine = `${brandName} is a trading name of ${inv.subcontractor.fullName || brandName}`;
    doc.text(tradingLine, pageWidth / 2, pageHeight - 36, { align: "center" });
    if (inv.subcontractor.address1) {
      const addrOneLine = inv.subcontractor.address1.replace(/\n/g, ", ");
      doc.text(`Registered Office: ${addrOneLine}`, pageWidth / 2, pageHeight - 22, { align: "center" });
    }
  }

  return doc;
}

export function downloadInvoicePdf(
  inv: InvoicePayload,
  brandName?: string,
  mode: PdfMode = "advice",
): void {
  const doc = generateInvoicePdf(inv, brandName, mode);
  const subName = inv.subcontractor.fullName?.replace(/\s+/g, "_") || inv.subcontractor.id.slice(0, 6);
  const baseNumber =
    mode === "invoice" && inv.lines[0]?.invoiceNumber
      ? inv.lines[0].invoiceNumber
      : inv.invoiceNumber;
  const prefix = mode === "invoice" ? "Invoice" : mode === "bc_invoice" ? "BC-Invoice" : "PaymentAdvice";
  const filename = `${prefix}_${baseNumber}_${subName}.pdf`;
  doc.save(filename);
}

// =====================================================================
//  Year-end RCT Summary (helper for the subcontractor's Form 11)
// =====================================================================
// Subcontractors filing their annual self-assessment (Form 11) need a
// statement showing the total gross paid, total RCT withheld, and a
// per-payment breakdown for the relevant tax year (calendar year in
// Ireland). They paste the totals into Form 11's RCT credit section
// to claim the withheld RCT against their final tax bill.
//
// This generator takes the sub's full payment history + tax year and
// produces a single-page printable PDF. Pure client-side - no new
// worker endpoint needed; the Payments page already has the data.

export interface RctSummaryPayload {
  taxYear: number;
  brandName: string;
  subcontractor: {
    fullName: string | null;
    email: string | null;
    subcontractorRef: string | null;
    ppsn?: string | null;
    rctRate: string | null;
  };
  payments: Array<Pick<PaymentRecord,
    "paymentDate" | "periodStart" | "periodEnd" | "grossMinor" | "rctDeductionMinor"
    | "netMinor" | "currency" | "rctRate" | "rctAuthNumber" | "invoiceNumber">>;
  generatedAt: string;
}

export function generateRctSummaryPdf(p: RctSummaryPayload): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin + 10;

  // Defensive: every input could be null/undefined depending on the
  // sub's profile completeness. Coerce so jsPDF.text never gets undefined.
  const safe = (v: unknown, fallback = "-") =>
    v === null || v === undefined || v === "" ? fallback : String(v);
  const safeNum = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const brand = safe(p.brandName, "Fintrex Contractors");
  const generatedAt = safe(p.generatedAt, new Date().toLocaleDateString("en-IE"));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(`Annual RCT Summary - ${p.taxYear}`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `For inclusion with the subcontractor\u2019s Form 11 self-assessment return. Issued by ${brand} on ${generatedAt}.`,
    margin, y, { maxWidth: pageWidth - margin * 2 },
  );
  y += 24;

  // Subcontractor block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Subcontractor", margin, y);
  y += 13;
  doc.setFont("helvetica", "normal");
  const subInfo = p.subcontractor || ({} as RctSummaryPayload["subcontractor"]);
  const lines = [
    `Name: ${safe(subInfo.fullName)}`,
    subInfo.subcontractorRef ? `Sub code: ${subInfo.subcontractorRef}` : null,
    subInfo.ppsn ? `PPSN: ${subInfo.ppsn}` : null,
    subInfo.email ? `Email: ${subInfo.email}` : null,
    subInfo.rctRate ? `RCT rate on file: ${subInfo.rctRate}%` : null,
  ].filter(Boolean) as string[];
  for (const line of lines) {
    doc.text(line, margin, y);
    y += 12;
  }
  y += 8;

  // Filter payments to the tax year (calendar year for Ireland)
  const yearStart = new Date(`${p.taxYear}-01-01T00:00:00Z`).getTime();
  const yearEnd   = new Date(`${p.taxYear + 1}-01-01T00:00:00Z`).getTime();
  const payments = Array.isArray(p.payments) ? p.payments : [];
  const inYear = payments.filter(pay => {
    if (!pay || !pay.paymentDate) return false;
    const t = new Date(pay.paymentDate).getTime();
    return Number.isFinite(t) && t >= yearStart && t < yearEnd;
  });

  // Group totals by currency (almost always EUR but be safe)
  const totals: Record<string, { gross: number; rct: number; net: number; n: number }> = {};
  for (const pay of inYear) {
    const c = pay.currency || "EUR";
    if (!totals[c]) totals[c] = { gross: 0, rct: 0, net: 0, n: 0 };
    totals[c].gross += safeNum(pay.grossMinor);
    totals[c].rct   += safeNum(pay.rctDeductionMinor);
    totals[c].net   += safeNum(pay.netMinor);
    totals[c].n     += 1;
  }

  // Totals box (the numbers that go on Form 11)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Annual totals (${inYear.length} payment${inYear.length === 1 ? "" : "s"})`, margin, y);
  y += 14;
  for (const [ccy, t] of Object.entries(totals)) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Currency", "Gross paid", "RCT withheld", "Net paid"]],
      body: [[
        ccy,
        fmtMoneyMinor(t.gross, ccy),
        fmtMoneyMinor(t.rct, ccy),
        fmtMoneyMinor(t.net, ccy),
      ]],
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 10, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      theme: "grid",
    });
    // @ts-expect-error jspdf-autotable adds .lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 14;
  }

  // Per-payment breakdown
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Per-payment breakdown", margin, y);
  y += 12;

  if (inYear.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`No payments recorded for ${p.taxYear}.`, margin, y + 6);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Period", "Invoice #", "Rate", "Auth #", "Gross", "RCT", "Net"]],
      body: inYear
        .sort((a, b) => (a.paymentDate || "").localeCompare(b.paymentDate || ""))
        .map(pay => [
          safe(fmtDate(pay.paymentDate)),
          pay.periodStart && pay.periodEnd ? `${fmtDate(pay.periodStart)}\u2192${fmtDate(pay.periodEnd)}` : "-",
          safe(pay.invoiceNumber),
          pay.rctRate ? `${pay.rctRate}%` : "-",
          safe(pay.rctAuthNumber),
          fmtMoneyMinor(safeNum(pay.grossMinor), pay.currency || "EUR"),
          fmtMoneyMinor(safeNum(pay.rctDeductionMinor), pay.currency || "EUR"),
          fmtMoneyMinor(safeNum(pay.netMinor), pay.currency || "EUR"),
        ]),
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
      },
      theme: "grid",
    });
  }

  // Footer note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "RCT credits should be reclaimed via your Form 11 self-assessment. The RCT amounts above can also be cross-checked against your Revenue ROS \"My Documents\" RCT statements.",
    margin, pageHeight - 36, { maxWidth: pageWidth - margin * 2 },
  );
  return doc;
}

export function downloadRctSummaryPdf(payload: RctSummaryPayload): void {
  const doc = generateRctSummaryPdf(payload);
  const subName = payload.subcontractor.fullName?.replace(/\s+/g, "_") || "subcontractor";
  doc.save(`RCT_Summary_${payload.taxYear}_${subName}.pdf`);
}

export function invoiceMailto(
  inv: InvoicePayload,
  brandName = "Fintrex Contractors",
  mode: PdfMode = "advice",
): string {
  const isInvoice = mode === "invoice";
  const to = isInvoice
    ? (inv.accountantEmail || inv.principal.email || "")
    : (inv.subcontractor.accountantEmail || inv.subcontractor.email || "");
  const docName = isInvoice ? "Invoice" : "Subcontractor Payment Advice";
  const docNumber =
    isInvoice && inv.lines[0]?.invoiceNumber
      ? inv.lines[0].invoiceNumber
      : inv.invoiceNumber;
  const subject = `${docName} ${docNumber} - ${inv.subcontractor.fullName || ""}`;
  const totalsLine = Object.entries(inv.totalsByCurrency)
    .map(([c, t]) => `${c} ${(t.gross / 100).toFixed(2)} gross / ${(t.rct / 100).toFixed(2)} RCT / ${(t.net / 100).toFixed(2)} net`)
    .join(" • ");
  const body = [
    "Hi,",
    "",
    `Please find ${docName.toLowerCase()} ${docNumber} for ${inv.subcontractor.fullName || ""} attached.`,
    "",
    `Period: ${inv.period.from} to ${inv.period.to}`,
    `Totals: ${totalsLine}`,
  ].join("\n");
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
