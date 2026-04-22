import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { get_ } from "../api";
import { productImageUrl } from "../imageUtils";

export default function ReceiptView() {
  const { saleId } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const printRef = useRef();

  useEffect(() => {
    get_(`/sales/${saleId}/receipt`)
      .then(setReceipt)
      .catch(e => setError(e.message));
  }, [saleId]);

  const print = () => {
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Receipt #${saleId}</title>
      <style>
        body { font-family: monospace; max-width: 320px; margin: 0 auto; padding: 1rem; font-size: 13px; }
        h2, p { margin: 0.25rem 0; text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 0.5rem 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        td:last-child { text-align: right; }
        .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; }
        .footer { text-align: center; margin-top: 1rem; font-size: 11px; }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  if (error) return (
    <div>
      <div className="alert alert-error">{error}</div>
      <Link to="/receipts" className="btn btn-outline">← Back to Receipts</Link>
    </div>
  );

  if (!receipt) return <div className="loading">Loading receipt…</div>;

  const date = new Date(receipt.timestamp);

  return (
    <div>
      <div className="page-header no-print">
        <Link to="/receipts" className="btn btn-outline">← Receipts</Link>
        <button className="btn btn-primary" onClick={print}>🖨 Print Receipt</button>
      </div>

      <div className="receipt-wrapper">
        <div className="receipt" ref={printRef}>
          <h2>SPARK PERFUMES</h2>
          <p>Official Receipt</p>
          <div className="divider" />

          <p><strong>Receipt #:</strong> {receipt.sale_id}</p>
          {receipt.receipt_number && <p><strong>M-Pesa Ref:</strong> {receipt.receipt_number}</p>}
          <p><strong>Date:</strong> {date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}</p>
          <p><strong>Time:</strong> {date.toLocaleTimeString("en-KE")}</p>
          <p><strong>Cashier:</strong> {receipt.cashier_name}</p>
          {receipt.customer_ref && <p><strong>Customer:</strong> {receipt.customer_ref}</p>}
          <p><strong>Payment:</strong> {receipt.payment_method?.toUpperCase()}</p>

          <div className="divider" />

          <table>
            <thead>
              <tr>
                <td><strong>Item</strong></td>
                <td style={{ textAlign: "center" }}><strong>Qty</strong></td>
                <td style={{ textAlign: "right" }}><strong>Price</strong></td>
                <td style={{ textAlign: "right" }}><strong>Subtotal</strong></td>
              </tr>
            </thead>
            <tbody>
              {receipt.items?.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <img src={productImageUrl(item.product_name)} alt={item.product_name} style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }} />
                      {item.product_name}
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>{parseFloat(item.price).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right" }}>{parseFloat(item.subtotal).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={3}><strong>TOTAL (KES)</strong></td>
                <td style={{ textAlign: "right" }}><strong>{parseFloat(receipt.total_amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>

          <div className="divider" />
          {receipt.notes && <p><em>Note: {receipt.notes}</em></p>}
          <p className="footer">Thank you for shopping with us!<br />Come again 🌸</p>
        </div>
      </div>
    </div>
  );
}
