import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authRequest } from "../api";

export default function Reports({ defaultReportType = "daily" }) {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState(defaultReportType);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(10);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);

  const topProducts = useMemo(() => {
    if (!report?.length) return [];
    return report;
  }, [report]);

  const paymentBreakdown = useMemo(() => {
    if (!report || reportType === "top-products" || reportType === "cashflow") return null;
    const cash = report.breakdown?.cash?.total ?? 0;
    const mpesa = report.breakdown?.mpesa?.total ?? 0;
    const total = cash + mpesa;
    return {
      cash,
      mpesa,
      cashShare: total ? Math.round((cash / total) * 100) : 0,
      mpesaShare: total ? Math.round((mpesa / total) * 100) : 0,
    };
  }, [report, reportType]);

  const cashflowData = useMemo(() => {
    if (reportType !== "cashflow" || !report?.daily_totals) return [];
    return Object.entries(report.daily_totals).map(([date, totals]) => ({
      date,
      cash: totals.cash,
      mpesa: totals.mpesa,
      total: totals.cash + totals.mpesa,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [report, reportType]);

  useEffect(() => {
    setReportType(defaultReportType);
  }, [defaultReportType]);

  useEffect(() => {
    fetchReport();
    fetchSettings();
  }, [reportType]);

  const fetchSettings = async () => {
    try {
      const data = await authRequest("/settings", { method: "GET" });
      setSettings(data);
    } catch (err) {
      setSettings({ currency: "KES" });
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/reports/${reportType}`;
      if (reportType === "daily" || reportType === "weekly" || reportType === "monthly") {
        url += `?date=${date}`;
      } else if (reportType === "cashflow") {
        url += `?days=${days}`;
      } else if (reportType === "top-products") {
        url += `?limit=${limit}`;
      }
      const data = await authRequest(url, { method: "GET" });
      setReport(data);
    } catch (err) {
      setError(err.message || "Unable to load report");
    } finally {
      setLoading(false);
    }
  };

  const handleReportTypeChange = (type) => {
    setReportType(type);
    setReport(null);
    if (type === "daily") navigate("/reports/daily");
    else if (type === "weekly") navigate("/reports/weekly");
    else if (type === "monthly") navigate("/reports/monthly");
    else if (type === "cashflow") navigate("/reports/cashflow");
    else if (type === "top-products") navigate("/reports/top-products");
  };

  const handleDateChange = (event) => {
    setDate(event.target.value);
  };


  const handleDaysChange = (event) => {
    setDays(parseInt(event.target.value));
  };

  const handleLimitChange = (event) => {
    setLimit(parseInt(event.target.value));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchReport();
  };

  return (
    <div className="card">
      <h1 className="heading">Reports</h1>

      <div className="field" style={{ marginBottom: "1rem" }}>
        <label>Report Type</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["daily", "weekly", "monthly", "top-products", "cashflow"].map((type) => (
            <button
              key={type}
              type="button"
              className={reportType === type ? "primary" : ""}
              onClick={() => handleReportTypeChange(type)}
              style={{ textTransform: "capitalize" }}
            >
              {type.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        {(reportType === "daily" || reportType === "weekly" || reportType === "monthly") && (
          <div className="field" style={{ maxWidth: "18rem" }}>
            <label htmlFor="report_date">Date</label>
            <input id="report_date" type="date" value={date} onChange={handleDateChange} />
          </div>
        )}
        {reportType === "cashflow" && (
          <div className="field" style={{ maxWidth: "18rem" }}>
            <label htmlFor="days">Days</label>
            <input id="days" type="number" min="1" max="365" value={days} onChange={handleDaysChange} />
          </div>
        )}
        {reportType === "top-products" && (
          <div className="field" style={{ maxWidth: "18rem" }}>
            <label htmlFor="limit">Limit</label>
            <input id="limit" type="number" min="1" max="100" value={limit} onChange={handleLimitChange} />
          </div>
        )}
        <button type="submit" className="primary">Load Report</button>
      </form>

      {error && <div className="alert error">{error}</div>}
      {loading ? (
        <p>Loading report…</p>
      ) : report ? (
        <>
          {reportType === "top-products" ? (
            <div className="card">
              <h2>Top Products</h2>
              {topProducts.length ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Units sold</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product, index) => (
                        <tr key={index}>
                          <td>{product.name}</td>
                          <td>{product.total_quantity}</td>
                          <td>{settings?.currency || "KES"} {product.total_revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small">No data available.</p>
              )}
            </div>
          ) : reportType === "cashflow" ? (
            <div className="card">
              <h2>Cashflow (Last {days} days)</h2>
              {cashflowData.length ? (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Cash</th>
                        <th>M-Pesa</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashflowData.map((day) => (
                        <tr key={day.date}>
                          <td>{day.date}</td>
                          <td>{settings?.currency || "KES"} {day.cash.toFixed(2)}</td>
                          <td>{settings?.currency || "KES"} {day.mpesa.toFixed(2)}</td>
                          <td>{settings?.currency || "KES"} {day.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small">No data available.</p>
              )}
            </div>
          ) : (
            <>
              <div className="stat-grid" style={{ marginTop: "1rem" }}>
                <div className="stat-card">
                  <h3>Total revenue</h3>
                  <p>{settings?.currency || "KES"} {report.total_revenue?.toFixed(2) ?? "0.00"}</p>
                </div>
                <div className="stat-card">
                  <h3>Items sold</h3>
                  <p>{report.items_sold ?? 0}</p>
                </div>
                <div className="stat-card">
                  <h3>Cash share</h3>
                  <p>{paymentBreakdown?.cashShare ?? 0}%</p>
                  <small>{settings?.currency || "KES"} {paymentBreakdown?.cash?.toFixed(2) ?? "0.00"}</small>
                </div>
                <div className="stat-card">
                  <h3>M-Pesa share</h3>
                  <p>{paymentBreakdown?.mpesaShare ?? 0}%</p>
                  <small>{settings?.currency || "KES"} {paymentBreakdown?.mpesa?.toFixed(2) ?? "0.00"}</small>
                </div>
              </div>

              <div className="card" style={{ marginTop: "1rem" }}>
                <h2>Period Summary</h2>
                <p><strong>Period:</strong> {report.start_date || report.date} to {report.end_date || report.date}</p>
                <p><strong>Total Sales:</strong> {report.total_sales}</p>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="small">Load a report to view data.</p>
      )}
    </div>
  );
}
