
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./App.css";

const API_URL = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws/trades";

function App() {

  // --------------------------------
  // 1. Dashboard states
  // --------------------------------

  const [trades, setTrades] = useState([]);
  const [totalTrades, setTotalTrades] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  const [wsStatus, setWsStatus] = useState("connecting");

  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  // --------------------------------
  // 2. Pull job states
  // --------------------------------

  const [pullJobId, setPullJobId] = useState(null);

  const [pullStatus, setPullStatus] = useState("not_started");

  const [pullRecordsFetched, setPullRecordsFetched] = useState(0);

  const [pullTotalRecords, setPullTotalRecords] = useState(3000);

  const [pullProgress, setPullProgress] = useState(0);

  const [pullMessage, setPullMessage] = useState(
    "Waiting for a pull to start."
  );

  const [pullError, setPullError] = useState("");

  const [startingPull, setStartingPull] = useState(false);

  const [notice, setNotice] = useState("");

  const rowsPerPage = 5;


  // --------------------------------
  // 3. Fetch all trades in batches
  // --------------------------------

  const fetchTrades = useCallback(async () => {

    try {

      setLoading(true);
      setError("");

      const allTrades = [];

      const batchSize = 100;

      let offset = 0;
      let hasMore = true;
      let databaseTotal = 0;

      while (hasMore) {

        const response = await fetch(
          `${API_URL}/api/trades?offset=${offset}&limit=${batchSize}`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch trades. Status: ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.trades)) {
          throw new Error("Invalid trade data received.");
        }

        allTrades.push(...data.trades);

        databaseTotal = Number(data.total) || 0;

        offset += data.trades.length;

        hasMore = data.has_more === true;

        if (data.trades.length === 0) {
          hasMore = false;
        }

      }

      setTrades(allTrades);
      setTotalTrades(databaseTotal);
      setCurrentPage(1);
      setLastUpdated(new Date());

      console.log("Total trades loaded:", allTrades.length);

    } catch (err) {

      console.error("Error fetching trades:", err);
      setError(err.message || "Unable to load trades.");

    } finally {

      setLoading(false);

    }

  }, []);


  // Load trades when dashboard opens
  useEffect(() => {

    fetchTrades();

  }, [fetchTrades]);


  // --------------------------------
  // 4. Apply progress updates
  // --------------------------------

  const applyPullUpdate = useCallback((data) => {

    if (data.pull_id) {
      setPullJobId(data.pull_id);
    }

    if (data.status) {
      setPullStatus(data.status);
    }

    const fetched = Number(data.records_fetched);

    if (Number.isFinite(fetched)) {
      setPullRecordsFetched(fetched);
    }

    const total = Number(data.total_records);

    if (Number.isFinite(total) && total > 0) {
      setPullTotalRecords(total);
    }

    const percentage = Number(data.progress_percent);

    if (Number.isFinite(percentage)) {
      setPullProgress(
        Math.min(100, Math.max(0, percentage))
      );
    }

    if (data.message) {
      setPullMessage(data.message);
    }

    if (data.status === "completed") {

      setPullProgress(100);

      setPullMessage(
        "Trade pull completed successfully."
      );

      setNotice(
        `Pull job #${data.pull_id} completed. ${data.records_fetched} records processed.`
      );

      fetchTrades();

    }

    if (data.status === "failed") {

      setPullError(data.message || "Trade pull failed.");

      setPullMessage("Trade pull failed.");

      setNotice(
        `Pull job #${data.pull_id} failed.`
      );

      // Refresh to show any batches saved before the failure
      fetchTrades();

    }

  }, [fetchTrades]);


  // --------------------------------
  // 5. WebSocket connection
  // --------------------------------

  useEffect(() => {

    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const connectWebSocket = () => {

      if (!shouldReconnect) return;

      setWsStatus("connecting");

      socket = new WebSocket(WS_URL);

      socket.onopen = () => {

        console.log("WebSocket connected.");

        setWsStatus("connected");

      };

      socket.onmessage = (event) => {

        try {

          const data = JSON.parse(event.data);

          console.log("WebSocket message:", data);

          if (
            data.event === "pull_started" ||
            data.event === "pull_progress" ||
            data.event === "pull_completed" ||
            data.event === "pull_failed"
          ) {
            applyPullUpdate(data);
          }

        } catch (err) {

          console.error("Invalid WebSocket message:", err);

        }

      };

      socket.onerror = (event) => {

        console.error("WebSocket error:", event);

      };

      socket.onclose = () => {

        if (!shouldReconnect) return;

        setWsStatus("reconnecting");

        reconnectTimer = setTimeout(
          connectWebSocket,
          3000
        );

      };

    };

    connectWebSocket();

    return () => {

      shouldReconnect = false;

      clearTimeout(reconnectTimer);

      if (socket) {
        socket.close();
      }

    };

  }, [applyPullUpdate]);


  // --------------------------------
  // 6. Start a real trade pull
  // --------------------------------

  async function handleStartPull() {

    if (startingPull || pullStatus === "running") {
      return;
    }

    try {

      setStartingPull(true);

      setPullError("");
      setNotice("");

      setPullJobId(null);
      setPullRecordsFetched(0);
      setPullTotalRecords(3000);
      setPullProgress(0);
      setPullStatus("pending");

      setPullMessage("Creating a new trade pull job...");

      const response = await fetch(
        `${API_URL}/api/pulls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail || "Unable to start trade pull."
        );

      }

      setPullJobId(data.pull_id);
      setPullStatus(data.status || "pending");

      setPullMessage(
        `Pull job #${data.pull_id} has been created.`
      );

      setNotice(
        `Trade pull job #${data.pull_id} started.`
      );

      console.log("Pull job started:", data);

      // Retrieve current status in case an event arrived
      // before the browser received the POST response.
      fetchPullStatus(data.pull_id);

    } catch (err) {

      console.error("Error starting pull:", err);

      setPullStatus("failed");

      setPullError(err.message);

      setPullMessage("Unable to start trade pull.");

    } finally {

      setStartingPull(false);

    }

  }


  // --------------------------------
  // 7. Get pull status from REST API
  // --------------------------------

  async function fetchPullStatus(id) {

    try {

      const response = await fetch(
        `${API_URL}/api/pulls/${id}`
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve pull status.");
      }

      const data = await response.json();

      applyPullUpdate({
        ...data,
        event: "pull_status",
        records_fetched: data.records_fetched,
      });

      if (data.error_message) {
        setPullError(data.error_message);
      }

    } catch (err) {

      console.error("Pull status error:", err);

    }

  }


  // --------------------------------
  // 8. Search, filter and sort
  // --------------------------------

  const filteredTrades = useMemo(() => {

    let result = [...trades];

    if (search.trim()) {

      const searchText = search.toLowerCase();

      result = result.filter((trade) =>

        String(trade.trade_id || "")
          .toLowerCase()
          .includes(searchText) ||

        String(trade.client || "")
          .toLowerCase()
          .includes(searchText) ||

        String(trade.symbol || "")
          .toLowerCase()
          .includes(searchText)

      );

    }

    if (selectedSymbol !== "All") {

      result = result.filter(
        (trade) => trade.symbol === selectedSymbol
      );

    }

    result.sort((a, b) => {

      const difference =
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime();

      return sortOrder === "newest"
        ? -difference
        : difference;

    });

    return result;

  }, [trades, search, selectedSymbol, sortOrder]);


  // --------------------------------
  // 9. Pagination
  // --------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrades.length / rowsPerPage)
  );

  const startIndex =
    (currentPage - 1) * rowsPerPage;

  const visibleTrades = filteredTrades.slice(
    startIndex,
    startIndex + rowsPerPage
  );


  // --------------------------------
  // 10. Dashboard statistics
  // --------------------------------

  const totalQuantity = trades.reduce(
    (total, trade) =>
      total + Number(trade.quantity || 0),
    0
  );

  const averagePrice = trades.length > 0
    ? trades.reduce(
        (total, trade) =>
          total + Number(trade.price || 0),
        0
      ) / trades.length
    : 0;

  const availableSymbols = useMemo(() => {

    return [
      ...new Set(
        trades
          .map((trade) => trade.symbol)
          .filter(Boolean)
      ),
    ].sort();

  }, [trades]);


  // --------------------------------
  // 11. Format timestamp
  // --------------------------------

  function formatDate(dateString) {

    if (!dateString) return "--";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  }


  // --------------------------------
  // 12. Dashboard UI
  // --------------------------------

  const isPullRunning =
    pullStatus === "running" ||
    pullStatus === "pending";

  const pullStatusLabel = {
    not_started: "Not started",
    pending: "Pending",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
  }[pullStatus] || pullStatus;


  return (

    <div className="dashboard">

      {/* Header */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-logo">AF</div>

          <div>
            <h1>Arham Fintech</h1>
            <p>Trade Monitoring Dashboard</p>
          </div>

        </div>

        <div className="header-right">

          <div className="connection-status">

            <span className={`status-dot ${wsStatus}`}></span>

            {wsStatus === "connected"
              ? "WebSocket connected"
              : wsStatus === "reconnecting"
                ? "Reconnecting..."
                : "Connecting to WebSocket..."}

          </div>

          <div className="user-profile">
            <div className="avatar">A</div>
            <span>Admin</span>
          </div>

        </div>

      </header>


      <main className="main-content">

        {/* Page heading */}

        <section className="page-heading">

          <div>
            <h2>Trade Dashboard</h2>
            <p>
              Monitor trade activity and manage trade data pulls.
            </p>
          </div>

          <button
            className="pull-button"
            onClick={handleStartPull}
            disabled={startingPull || isPullRunning}
          >
            {startingPull
              ? "Starting..."
              : isPullRunning
                ? "Pull Running..."
                : "＋ Start Trade Pull"}
          </button>

        </section>


        {/* Notification */}

        {notice && (

          <div className="notice">
            {notice}

            <button onClick={() => setNotice("")}>
              ×
            </button>
          </div>

        )}


        {/* Statistics */}

        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon blue">▤</div>

            <div>
              <p className="stat-label">Total Trades</p>

              <h3>{totalTrades.toLocaleString("en-IN")}</h3>

              <span className="stat-description">
                Total records in database
              </span>
            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon purple">⇅</div>

            <div>
              <p className="stat-label">Total Quantity</p>

              <h3>
                {totalQuantity.toLocaleString("en-IN")}
              </h3>

              <span className="stat-description">
                Across loaded records
              </span>
            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon green">₹</div>

            <div>
              <p className="stat-label">Average Price</p>

              <h3>
                ₹{averagePrice.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h3>

              <span className="stat-description">
                Average of loaded records
              </span>
            </div>

          </div>


          <div className="stat-card">

            <div className="stat-icon orange">◷</div>

            <div>
              <p className="stat-label">Last Updated</p>

              <h3 className="last-updated">
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "--"}
              </h3>

              <span className="stat-description">
                Last successful data refresh
              </span>
            </div>

          </div>

        </section>


        {/* REAL TRADE PULL STATUS */}

        <section className="panel pull-progress-panel">

          <div className="panel-heading">

            <div>
              <h3>Trade Pull Status</h3>

              <p>
                Monitor the progress of your data pull.
              </p>
            </div>

            <span className={`status-badge ${pullStatus}`}>
              {pullStatusLabel}
            </span>

          </div>


          <div className="progress-details">

            <div className="progress-count">

              <span>Records fetched</span>

              <strong>
                {pullRecordsFetched.toLocaleString("en-IN")}
                {" / "}
                {pullTotalRecords.toLocaleString("en-IN")}
              </strong>

            </div>


            <div className="progress-track">

              <div
                className="progress-fill"
                style={{
                  width: `${pullProgress}%`,
                  transition: "width 0.3s ease",
                }}
              ></div>

            </div>


            <div className="progress-footer">

              <span>
                {pullError || pullMessage}
              </span>

              <span>
                {pullProgress.toFixed(2)}%
              </span>

            </div>


            {pullJobId && (

              <p className="pull-job-id">
                Pull Job ID: #{pullJobId}
              </p>

            )}

          </div>

        </section>


        {/* Recent Trades */}

        <section className="panel trades-panel">

          <div className="panel-heading">

            <div>
              <h3>Recent Trades</h3>

              <p>
                View and manage available trade records.
              </p>
            </div>

            <span className="record-count">
              {trades.length.toLocaleString("en-IN")} loaded records
            </span>

          </div>


          {loading && (
            <div className="loading-message">
              Loading trade records...
            </div>
          )}


          {error && (
            <div className="error-message">
              {error}

              <button onClick={fetchTrades}>
                Retry
              </button>
            </div>
          )}


          <div className="table-controls">

            <div className="search-box">

              <span>⌕</span>

              <input
                type="text"
                placeholder="Search by trade ID, client or symbol..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
              />

            </div>


            <select
              value={selectedSymbol}
              onChange={(event) => {
                setSelectedSymbol(event.target.value);
                setCurrentPage(1);
              }}
            >

              <option value="All">All Symbols</option>

              {availableSymbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}

            </select>


            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setCurrentPage(1);
              }}
            >

              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>

            </select>

          </div>


          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Client</th>
                  <th>Symbol</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Timestamp</th>
                </tr>
              </thead>


              <tbody>

                {loading ? (

                  <tr>
                    <td colSpan="6" className="empty-state">
                      Loading trades...
                    </td>
                  </tr>

                ) : error ? (

                  <tr>
                    <td colSpan="6" className="empty-state">
                      Trades could not be loaded.
                    </td>
                  </tr>

                ) : visibleTrades.length > 0 ? (

                  visibleTrades.map((trade) => (

                    <tr key={trade.id}>

                      <td className="trade-id">
                        {trade.trade_id}
                      </td>

                      <td>{trade.client}</td>

                      <td>
                        <span className="symbol-tag">
                          {trade.symbol}
                        </span>
                      </td>

                      <td>
                        {Number(trade.quantity).toLocaleString("en-IN")}
                      </td>

                      <td>
                        ₹{Number(trade.price).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td>{formatDate(trade.timestamp)}</td>

                    </tr>

                  ))

                ) : (

                  <tr>
                    <td colSpan="6" className="empty-state">
                      No trades match your search.
                    </td>
                  </tr>

                )}

              </tbody>

            </table>

          </div>


          {/* Pagination */}

          <div className="pagination">

            <span>

              Showing{" "}
              {filteredTrades.length === 0
                ? 0
                : startIndex + 1}

              {" "}to{" "}

              {Math.min(
                startIndex + rowsPerPage,
                filteredTrades.length
              )}

              {" "}of{" "}

              {filteredTrades.length.toLocaleString("en-IN")}

              {" "}records

            </span>


            <div className="pagination-buttons">

              <button
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
                disabled={currentPage === 1}
              >
                Previous
              </button>


              <span className="page-number">
                {currentPage} / {totalPages}
              </span>


              <button
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>

            </div>

          </div>

        </section>


        <footer className="dashboard-footer">
          Arham Fintech Trade Dashboard · Development Preview
        </footer>

      </main>

    </div>

  );

}

export default App;
