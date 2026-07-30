export const staffPageHtml: string = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Pinch Staff Orders</title>
    <style>
      :root {
        --ink: #141812;
        --paper: #f4f0e6;
        --surface: #fffdf8;
        --oat: #e6decc;
        --signal: #ff5a36;
        --leaf: #315a43;
        color: var(--ink);
        background: var(--paper);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-width: 320px;
        margin: 0;
        background: var(--paper);
      }

      button,
      input {
        font: inherit;
      }

      .page {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 24px 0 56px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 42px;
        color: rgb(244 240 230 / 72%);
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .brand-mark {
        width: 38px;
        height: 28px;
        border: 3px solid var(--paper);
        border-radius: 11px;
        background: var(--signal);
        box-shadow: inset 0 0 0 2px rgb(20 24 18 / 12%);
      }

      .hero {
        padding: clamp(24px, 5vw, 52px);
        border-radius: 30px;
        background: var(--ink);
        color: var(--paper);
        box-shadow:
          0 0 0 1px rgb(20 24 18 / 6%),
          0 16px 40px rgb(20 24 18 / 10%);
      }

      .hero-grid {
        display: grid;
        gap: 32px;
      }

      .eyebrow,
      .order-meta,
      .stat-label {
        font-size: 12px;
        font-weight: 650;
      }

      .eyebrow {
        margin-bottom: 8px;
        color: var(--signal);
      }

      h1 {
        margin: 0;
        font-size: clamp(38px, 7vw, 62px);
        font-weight: 650;
        letter-spacing: -0.045em;
        line-height: 1;
      }

      .lede {
        max-width: 520px;
        margin: 14px 0 0;
        color: rgb(244 240 230 / 58%);
        font-size: 15px;
        line-height: 1.55;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .stat {
        min-height: 104px;
        padding: 18px;
        border-radius: 20px;
        background: rgb(244 240 230 / 8%);
        box-shadow: inset 0 0 0 1px rgb(244 240 230 / 8%);
      }

      .stat-label {
        color: rgb(244 240 230 / 48%);
      }

      .stat-value {
        display: block;
        margin-top: 14px;
        font-size: clamp(28px, 5vw, 36px);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      .section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 24px;
        margin: 34px 2px 14px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 24px;
        letter-spacing: -0.025em;
      }

      .status {
        margin: 0;
        color: rgb(20 24 18 / 48%);
        font-size: 12px;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
      }

      .search {
        width: 100%;
        min-height: 50px;
        border: 1px solid rgb(20 24 18 / 14%);
        border-radius: 999px;
        outline: none;
        background: var(--surface);
        padding: 0 18px;
        color: var(--ink);
        box-shadow:
          0 1px 2px rgb(20 24 18 / 4%),
          0 6px 20px rgb(20 24 18 / 3%);
        transition-property: border-color, box-shadow;
        transition-duration: 150ms;
      }

      .search:focus {
        border-color: var(--signal);
        box-shadow: 0 0 0 3px rgb(255 90 54 / 14%);
      }

      .refresh {
        min-height: 50px;
        flex: 0 0 auto;
        border: 0;
        border-radius: 999px;
        background: var(--ink);
        padding: 0 22px;
        color: var(--paper);
        cursor: pointer;
        transition-property: transform, opacity, background-color;
        transition-duration: 120ms;
      }

      .refresh:hover {
        background: #252b22;
      }

      .refresh:active {
        transform: scale(0.96);
      }

      .refresh:disabled {
        cursor: wait;
        opacity: 0.55;
      }

      .orders {
        display: grid;
        gap: 12px;
      }

      .order {
        padding: 20px;
        border-radius: 22px;
        background: var(--surface);
        box-shadow:
          0 0 0 1px rgb(20 24 18 / 7%),
          0 2px 4px rgb(20 24 18 / 4%),
          0 10px 28px rgb(20 24 18 / 4%);
      }

      .order-head,
      .order-total,
      .line-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
      }

      .customer {
        margin: 4px 0 0;
        font-size: 25px;
        font-weight: 650;
        letter-spacing: -0.025em;
      }

      .paid {
        border-radius: 999px;
        background: var(--leaf);
        padding: 7px 11px;
        color: #fff;
        font-size: 12px;
        font-weight: 650;
      }

      .items {
        display: grid;
        gap: 9px;
        margin: 16px 0;
        padding: 16px 0;
        border-top: 1px solid rgb(20 24 18 / 9%);
        border-bottom: 1px solid rgb(20 24 18 / 9%);
      }

      .line-item {
        color: rgb(20 24 18 / 68%);
        font-size: 14px;
      }

      .line-item-price,
      .total {
        color: var(--ink);
        font-variant-numeric: tabular-nums;
      }

      .payment {
        min-width: 0;
      }

      .payment-label {
        display: block;
        margin-bottom: 4px;
        color: rgb(20 24 18 / 38%);
        font-size: 11px;
        font-weight: 650;
      }

      .payment-id {
        display: block;
        max-width: 28ch;
        overflow-wrap: anywhere;
        color: rgb(20 24 18 / 45%);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
      }

      .total {
        flex: 0 0 auto;
        font-size: 28px;
      }

      .empty {
        padding: 48px 24px;
        border-radius: 22px;
        background: var(--surface);
        box-shadow: 0 0 0 1px rgb(20 24 18 / 7%);
        color: rgb(20 24 18 / 52%);
        text-align: center;
      }

      .empty strong {
        display: block;
        margin-bottom: 6px;
        color: var(--ink);
        font-size: 16px;
      }

      .clear-search {
        margin-top: 16px;
        border: 0;
        background: transparent;
        color: var(--signal);
        cursor: pointer;
        font-weight: 650;
      }

      @media (min-width: 760px) {
        .hero-grid {
          grid-template-columns: minmax(0, 1fr) 360px;
          align-items: end;
        }

        .orders {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .page {
          width: min(100% - 20px, 1120px);
          padding-top: 10px;
        }

        .hero {
          border-radius: 24px;
        }

        .brand {
          margin-bottom: 32px;
        }

        .section-head {
          align-items: start;
          flex-direction: column;
          gap: 6px;
        }

        .refresh {
          padding: 0 17px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          Pinch staff
        </div>
        <div class="hero-grid">
          <div>
            <div class="eyebrow">Live checkout</div>
            <h1>Paid orders</h1>
            <p class="lede">
              Check the customer, payment and items before handoff.
            </p>
          </div>
          <section class="summary" aria-label="Order summary">
            <article class="stat">
              <span class="stat-label">Orders</span>
              <strong class="stat-value" id="order-count">—</strong>
            </article>
            <article class="stat">
              <span class="stat-label">Sales</span>
              <strong class="stat-value" id="gross-sales">—</strong>
            </article>
          </section>
        </div>
      </header>

      <div class="section-head">
        <h2>Order list</h2>
        <p class="status" id="status" role="status">Loading orders…</p>
      </div>

      <div class="toolbar">
        <input
          class="search"
          id="search"
          type="search"
          placeholder="Search orders"
          aria-label="Search paid orders"
        />
        <button class="refresh" id="refresh" type="button">Refresh</button>
      </div>

      <section class="orders" id="orders" aria-live="polite"></section>
    </main>

    <script>
      const aud = new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      });
      const ordersElement = document.querySelector("#orders");
      const statusElement = document.querySelector("#status");
      const searchElement = document.querySelector("#search");
      const refreshElement = document.querySelector("#refresh");
      const orderCountElement = document.querySelector("#order-count");
      const grossSalesElement = document.querySelector("#gross-sales");
      let orders = [];

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function render() {
        const query = searchElement.value.trim().toLocaleLowerCase();
        const visibleOrders = orders.filter((order) =>
          (order.username + " " + order.pinchPaymentId)
            .toLocaleLowerCase()
            .includes(query),
        );

        orderCountElement.textContent = String(orders.length);
        grossSalesElement.textContent = aud.format(
          orders.reduce((sum, order) => sum + order.totalCents, 0) / 100,
        );

        if (visibleOrders.length === 0) {
          ordersElement.innerHTML =
            '<div class="empty">' +
            (query
              ? '<strong>No matching orders</strong>Try another name or payment ID.<br><button class="clear-search" type="button">Clear search</button>'
              : "<strong>No paid orders yet</strong>New orders will appear here automatically.") +
            "</div>";
          return;
        }

        ordersElement.innerHTML = visibleOrders
          .map((order) => {
            const items = order.items
              .map(
                (item) =>
                  '<div class="line-item"><span>' +
                  escapeHtml(item.name) +
                  " × " +
                  escapeHtml(item.qty) +
                  '</span><span class="line-item-price">' +
                  aud.format((item.priceCents * item.qty) / 100) +
                  "</span></div>",
              )
              .join("");
            const paidAt = new Date(order.createdAt).toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              '<article class="order">' +
              '<div class="order-head"><div>' +
              '<div class="order-meta">' +
              escapeHtml(paidAt) +
              "</div>" +
              '<h2 class="customer">' +
              escapeHtml(order.username) +
              "</h2></div>" +
              '<span class="paid">Paid</span></div>' +
              '<div class="items">' +
              items +
              "</div>" +
              '<div class="order-total">' +
              '<span class="payment"><span class="payment-label">Payment ID</span><span class="payment-id">' +
              escapeHtml(order.pinchPaymentId) +
              "</span></span>" +
              '<strong class="total">' +
              aud.format(order.totalCents / 100) +
              "</strong></div></article>"
            );
          })
          .join("");
      }

      async function loadOrders() {
        refreshElement.disabled = true;
        try {
          const response = await fetch("/api/orders", {
            headers: { accept: "application/json" },
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error("Orders request failed with HTTP " + response.status);
          }
          const payload = await response.json();
          orders = Array.isArray(payload.orders) ? payload.orders : [];
          render();
          statusElement.textContent =
            "Updated " +
            new Date().toLocaleTimeString("en-AU", {
              hour: "2-digit",
              minute: "2-digit",
            });
        } catch (error) {
          statusElement.textContent = "Unable to load orders. Try again.";
        } finally {
          refreshElement.disabled = false;
        }
      }

      searchElement.addEventListener("input", render);
      ordersElement.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.matches(".clear-search")) {
          searchElement.value = "";
          searchElement.focus();
          render();
        }
      });
      refreshElement.addEventListener("click", loadOrders);
      loadOrders();
      setInterval(loadOrders, 5000);
    </script>
  </body>
</html>`;
