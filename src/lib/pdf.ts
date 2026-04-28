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

export type PdfMode = "advice" | "invoice";

function fmtMoneyMinor(amountMinor: number, currency: string): string {
  // Enagh format: plain "1,000.00" with no currency symbol in the number
  // columns — the currency is implied by the surrounding context.
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
  if (!s) return "—";
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
  brandName = "Samwise",
  mode: PdfMode = "advice",
): jsPDF {
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
  // Top left: brand wordmark (we don't have a raster logo bundled — render
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
    (sub.fullName || "—").toUpperCase(),
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
  const taxRef = sub.ppsNumber || "—";
  const paymentRef = "BACS"; // Standard for Irish bank transfers
  const taxLiability = taxLiabilityLabel(sub.rctRate);
  const contractId = headPayment?.reference || inv.invoiceNumber.slice(-8);
  const paymentNotificationId = headPayment?.rctAuthNumber || "—";
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
    lineRows.push(["—", "—", "—", "—", "—"]);
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
  writeLines("This payment is made in accordance with the written terms agreed between us.", pageWidth - margin * 2);
  legalY += 4;
  writeLines(
    "By accepting this payment you acknowledge that you have read, understood and accepted the Contract for Services agreed between us and that they are a true reflection of the agreement between us. In particular that you acknowledge that we can only treat you as self-employed because you have agreed that the following statements are true:",
    pageWidth - margin * 2,
  );
  legalY += 4;
  const clauses = [
    "I.    You are a self-employed Subcontractor.",
    "II.   You have the right to send a suitably qualified substitute to provide the Services.",
    "III.  There is no obligation on you to do work and no obligation on us to provide work.",
    "IV.   You are responsible for the Services provided and that we nor our clients have a right to supervise, direct or control how you provide the Services.",
  ];
  for (const c of clauses) {
    writeLines(c, pageWidth - margin * 2 - 12);
  }
  legalY += 4;
  writeLines(
    "By accepting this payment you warrant that the above statements and the contract (that you have agreed to) in its entirety are true and reflect the agreement between us and that the above statements have been relied upon by us and any future declaration by you that contradicts the above statements or the contract will render you liable for any costs or losses suffered by us as a result of said declaration.",
    pageWidth - margin * 2,
  );

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
      (sub.fullName || "—").toUpperCase(),
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
  const subName = (sub.fullName || "—").toUpperCase();
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

  // Header
  doc.setFillColor(15, 23, 34);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Invoice", margin, 42);

  const headerNumber =
    inv.lines[0]?.invoiceNumber || inv.invoiceNumber;
  doc.setTextColor(245, 158, 11);
  doc.text(headerNumber, pageWidth - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 188, 204);
  doc.text(`Generated by ${brandName}`, margin, 60);
  doc.text(
    `Issued ${new Date(inv.issuedAt).toLocaleDateString("en-IE")}`,
    pageWidth - margin, 60, { align: "right" },
  );

  // Parties — sub as FROM, principal as TO
  let y = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("FROM (SUBCONTRACTOR)", margin, y);
  doc.text("BILL TO (PRINCIPAL)", pageWidth / 2 + 10, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);

  const subBlock = [
    sub.fullName || "—",
    [sub.address1, sub.address2].filter(Boolean).join(", "),
    [sub.town, sub.postcode].filter(Boolean).join(" "),
    sub.email || "",
    sub.ppsNumber ? `PPS: ${sub.ppsNumber}` : "",
    sub.vatNumber ? `VAT: ${sub.vatNumber}` : "",
  ].filter(Boolean);
  const principalBlock = [
    inv.principal.name || "[Principal]",
    inv.principal.address || "",
    inv.principal.vat ? `VAT: ${inv.principal.vat}` : "",
    inv.principal.email || "",
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
  doc.text(`${fmtDate(inv.period.from)} – ${fmtDate(inv.period.to)}`, margin + 12, y + 32);
  doc.text(sub.rctRate ? `${sub.rctRate}%` : "N/A", margin + 200, y + 32);
  doc.text(sub.vatReverseCharge ? "Reverse charge" : "Standard", margin + 320, y + 32);
  y += 60;

  // Lines
  autoTable(doc, {
    head: [["Date", "Period", "Hours", "Site", "Reference", "RCT", "Gross", "Net"]],
    body: inv.lines.map((p) => [
      fmtDate(p.paymentDate),
      p.periodStart && p.periodEnd ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : "—",
      p.hours != null ? p.hours.toFixed(2) : "—",
      p.siteRef || "—",
      p.reference || "—",
      p.rctRate ? `-${fmtMoneyWithSymbol(p.rctDeductionMinor, p.currency)} (${p.rctRate}%)` : "—",
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

  // Totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("TOTALS", margin, afterY);
  afterY += 6;
  for (const [ccy, t] of Object.entries(inv.totalsByCurrency)) {
    afterY += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    const right = pageWidth - margin;
    doc.text(`${t.count} payments • ${t.hours.toFixed(2)} hours`, margin, afterY);
    doc.text(`Gross  ${fmtMoneyWithSymbol(t.gross, ccy)}`, right - 250, afterY);
    doc.text(`RCT  -${fmtMoneyWithSymbol(t.rct, ccy)}`, right - 130, afterY);
    doc.setFont("helvetica", "bold");
    doc.text(`Net  ${fmtMoneyWithSymbol(t.net, ccy)}`, right, afterY, { align: "right" });
  }

  if (sub.vatReverseCharge) {
    afterY += 28;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      "VAT reverse charge applies. The recipient is liable for accounting for VAT (Section 16(2) VATCA 2010).",
      margin, afterY, { maxWidth: pageWidth - margin * 2 },
    );
  }

  // Bank
  if (inv.bank?.iban || inv.bank?.accountNumber) {
    afterY += 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("PAYMENT DETAILS", margin, afterY);
    afterY += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    if (inv.bank.bankName)          { doc.text(`Bank:        ${inv.bank.bankName}`, margin, afterY); afterY += 13; }
    if (inv.bank.accountHolderName) { doc.text(`Account:     ${inv.bank.accountHolderName}`, margin, afterY); afterY += 13; }
    if (inv.bank.iban)              { doc.text(`IBAN:        ${inv.bank.iban}`, margin, afterY); afterY += 13; }
    if (inv.bank.bic)               { doc.text(`BIC/SWIFT:   ${inv.bank.bic}`, margin, afterY); afterY += 13; }
    if (sub.accountantEmail) {
      afterY += 4;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`CC accountant: ${sub.accountantEmail}`, margin, afterY);
    }
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${brandName} · invoice issued by subcontractor under Irish RCT`,
    pageWidth / 2, pageHeight - 24, { align: "center" },
  );

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
  const prefix = mode === "invoice" ? "Invoice" : "PaymentAdvice";
  const filename = `${prefix}_${baseNumber}_${subName}.pdf`;
  doc.save(filename);
}

export function invoiceMailto(
  inv: InvoicePayload,
  brandName = "Samwise",
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
  const subject = `${docName} ${docNumber} — ${inv.subcontractor.fullName || ""}`;
  const totalsLine = Object.entries(inv.totalsByCurrency)
    .map(([c, t]) => `${c} ${(t.gross / 100).toFixed(2)} gross / ${(t.rct / 100).toFixed(2)} RCT / ${(t.net / 100).toFixed(2)} net`)
    .join(" • ");
  const body = [
    "Hi,",
    "",
    `Please find ${docName.toLowerCase()} ${docNumber} for ${inv.subcontractor.fullName || ""} attached.`,
    "",
    `Period: ${inv.period.from} → ${inv.period.to}`,
    `Totals: ${totalsLine}`,
    "",
    "Generated by " + brandName + ".",
  ].join("\n");
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
