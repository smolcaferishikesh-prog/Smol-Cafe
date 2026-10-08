/**
 * Utility for printing HTML documents via an isolated hidden iframe.
 * Prevents screen style collapse, modal backdrop clipping, and blank printouts.
 */

export interface ReceiptItemData {
  name: string;
  qty: number;
  priceRupees: number;
  subtotalRupees: number;
  modifiers?: string[];
  notes?: string;
}

export interface InvoiceReceiptData {
  orderId: string;
  orderNo?: number;
  tableLabel: string;
  locationName?: string;
  guestName?: string;
  items: ReceiptItemData[];
  subtotalRupees: number;
  taxRupees: number;
  totalRupees: number;
  paymentMethod: "UPI" | "CASH" | "CARD";
  transactionId?: string;
  paidAt: string;
  gstin?: string;
  fssaiLic?: string;
  orderStatus?: string;
}

export function printHtmlContent(htmlContent: string, title: string = "smol café Invoice") {
  if (typeof window === "undefined") return;

  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.style.visibility = "hidden";
  document.body.appendChild(printFrame);

  const doc = printFrame.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Inter:wght@400;500;600;700;900&family=Noto+Sans+Mono:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 80mm;
            max-width: 80mm;
            background: #ffffff !important;
            color: #241F1C;
            padding: 4mm;
            margin: 0 auto;
            overflow: visible;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          .font-serif {
            font-family: 'EB Garamond', Georgia, serif;
          }
          .font-mono {
            font-family: 'Noto Sans Mono', monospace, Courier, monospace;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    } catch {
      // Ignore cleanup error
    }
  }, 10000);
}

export function generateThermalReceiptHtml(receipt: InvoiceReceiptData): string {
  const orderNumStr = receipt.orderNo ? `#SMOL ${receipt.orderNo.toString().padStart(4, "0")}` : `#${receipt.orderId.slice(0, 8).toUpperCase()}`;
  const dateStr = new Date(receipt.paidAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const itemsHtml = receipt.items.map((item) => `
    <tr style="border-bottom: 1px dashed #e2d7c7;">
      <td style="padding: 6px 0; vertical-align: top; text-align: left;">
        <div style="font-weight: 600; color: #241F1C; font-size: 12px;">${item.name}</div>
        ${item.modifiers && item.modifiers.length > 0 ? `<div style="font-size: 10px; color: #725039; font-style: italic;">${item.modifiers.join(", ")}</div>` : ""}
      </td>
      <td style="padding: 6px 4px; vertical-align: top; text-align: center; font-size: 12px; font-weight: 600;">${item.qty}</td>
      <td style="padding: 6px 4px; vertical-align: top; text-align: right; font-size: 12px;">₹${item.priceRupees}</td>
      <td style="padding: 6px 0; vertical-align: top; text-align: right; font-size: 12px; font-weight: 700; color: #241F1C;">₹${item.subtotalRupees}</td>
    </tr>
  `).join("");

  return `
    <div style="max-width: 320px; margin: 0 auto; font-family: 'Noto Sans Mono', monospace; font-size: 11px; color: #241F1C; line-height: 1.4;">
      <!-- Cafe Header -->
      <div style="text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px dashed #241F1C;">
        <div style="font-family: 'EB Garamond', Georgia, serif; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #B72E35;">smol café</div>
        <div style="font-size: 11px; font-weight: 600; color: #725039; margin-top: 2px;">artisanal coffee &amp; slow bakes</div>
        <div style="font-size: 10px; color: #555; margin-top: 4px;">Tapovan, Rishikesh, Uttarakhand 249192</div>
        <div style="font-size: 9px; color: #777; margin-top: 2px;">GSTIN: ${receipt.gstin || "05AAECS1482M1ZB"} | FSSAI: ${receipt.fssaiLic || "22624039000124"}</div>
      </div>

      <!-- Bill Metadata -->
      <div style="margin-bottom: 12px; font-size: 11px; padding-bottom: 8px; border-bottom: 1px dashed #999;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #666;">Tax Invoice:</span>
          <span style="font-weight: 700; color: #241F1C;">${orderNumStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #666;">Table:</span>
          <span style="font-weight: 700; color: #B72E35;">Table ${receipt.tableLabel}</span>
        </div>
        ${receipt.guestName ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #666;">Guest:</span>
          <span style="font-weight: 600;">${receipt.guestName}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #666;">Date &amp; Time:</span>
          <span>${dateStr}</span>
        </div>
        ${receipt.transactionId ? `
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #777; margin-top: 3px;">
          <span>Ref / UPI Txn:</span>
          <span style="font-family: monospace;">${receipt.transactionId}</span>
        </div>` : ""}
      </div>

      <!-- Line Items -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <thead>
          <tr style="border-bottom: 1px solid #241F1C; font-size: 10px; text-transform: uppercase; color: #666;">
            <th style="padding: 4px 0; text-align: left;">Item</th>
            <th style="padding: 4px; text-align: center;">Qty</th>
            <th style="padding: 4px; text-align: right;">Rate</th>
            <th style="padding: 4px 0; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Totals & Taxes -->
      <div style="border-top: 1px solid #241F1C; padding-top: 8px; margin-bottom: 12px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Subtotal:</span>
          <span style="font-weight: 600;">₹${receipt.subtotalRupees}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #666; font-size: 10px;">
          <span>CGST (2.5%):</span>
          <span>₹${(receipt.taxRupees / 2).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #666; font-size: 10px;">
          <span>SGST (2.5%):</span>
          <span>₹${(receipt.taxRupees / 2).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 2px solid #241F1C; border-bottom: 2px solid #241F1C; font-size: 15px; font-weight: 800;">
          <span>TOTAL PAID:</span>
          <span style="color: #B72E35;">₹${receipt.totalRupees}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: #15803d; font-weight: 700;">
          <span>PAYMENT STATUS:</span>
          <span>PAID (${receipt.paymentMethod})</span>
        </div>
      </div>

      <!-- Footer Message -->
      <div style="text-align: center; margin-top: 16px; padding-top: 10px; border-top: 1px dashed #999; font-size: 10px; color: #725039;">
        <div style="font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 14px; font-weight: 700; color: #241F1C; margin-bottom: 2px;">Thank you for your visit!</div>
        <div>small place • slow coffee • warm conversations</div>
        <div style="margin-top: 8px; font-size: 9px; color: #999;">Scan QR at table anytime for refills or review us on Google Maps</div>
      </div>
    </div>
  `;
}
