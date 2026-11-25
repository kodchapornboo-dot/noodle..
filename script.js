/* Body Scent — shared script (product.html, order.html, admin.html)
   Each section runs only if the page contains its elements. */

(function () {
  "use strict";

  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbzQydKU9_DhTtTEy2soGxIf0h5Z7hWIf1W-COsJVy8fnm9PygE5JXE2FOihhL7r4sqsmQ/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnAiOBLGutPNsrhkT9JGLmcZ6TKV4C3ZTwmHgLZSxS9CpWTIKuppWMl-HYcp6xYB5PVHYXxGd9mzN8/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("product-list")) initProductPage();
    if (document.getElementById("orderForm")) initOrderPage();
    if (document.getElementById("ordersTable")) initAdminPage();
  });

  /* ---------------------------------------------------------------
     1) product.html
  --------------------------------------------------------------- */

  function initProductPage() {
    var list = document.getElementById("product-list");
    var filterBar = document.getElementById("filter-bar");
    var products = [];

    var params = new URLSearchParams(window.location.search);
    var requested = (params.get("mood") || "all").toLowerCase();
    var currentMood = MOODS.some(function (m) { return m.key === requested; })
      ? requested
      : "all";

    buildFilterBar();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (error) {
        console.error(error);
        showMessage("โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
      });

    function buildFilterBar() {
      if (!filterBar) return;
      filterBar.innerHTML = "";
      MOODS.forEach(function (m) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-btn";
        btn.dataset.mood = m.key;
        btn.textContent = m.label;
        btn.addEventListener("click", function () {
          currentMood = m.key;
          render();
        });
        filterBar.appendChild(btn);
      });
    }

    function updateFilterState() {
      if (!filterBar) return;
      Array.prototype.forEach.call(filterBar.querySelectorAll("button"), function (btn) {
        var active = btn.dataset.mood === currentMood;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function render() {
      updateFilterState();
      list.innerHTML = "";

      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (shown.length === 0) {
        showMessage("ยังไม่มีสินค้าในหมวดนี้");
        return;
      }

      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function showMessage(text) {
      list.innerHTML = "";
      var div = document.createElement("div");
      div.className = "product-empty";
      div.textContent = text;
      list.appendChild(div);
    }

    function buildCard(p) {
      var itemName = p.name + (p.size ? " " + p.size : "");

      var card = document.createElement("article");
      card.className = "product-card";
      card.dataset.mood = p.mood;

      var img = document.createElement("img");
      img.className = "product-image";
      img.src = p.image;
      img.alt = itemName;
      img.loading = "lazy";
      card.appendChild(img);

      var mood = document.createElement("div");
      mood.className = "product-mood";
      var dot = document.createElement("span");
      dot.className = "mood-dot";
      mood.appendChild(dot);
      mood.appendChild(document.createTextNode(capitalize(p.mood)));
      card.appendChild(mood);

      var title = document.createElement("h3");
      title.textContent = p.name;
      card.appendChild(title);

      if (p.size) {
        var meta = document.createElement("div");
        meta.className = "product-meta";
        meta.textContent = p.size;
        card.appendChild(meta);
      }

      var price = document.createElement("div");
      price.className = "product-price";
      price.textContent = formatPrice(p.price);
      card.appendChild(price);

      var buy = document.createElement("a");
      buy.className = "btn btn-primary";
      buy.textContent = "สั่งซื้อ";
      buy.href =
        "order.html?item=" + encodeURIComponent(itemName) +
        "&price=" + encodeURIComponent(p.price);
      card.appendChild(buy);

      return card;
    }
  }

  /* ---------------------------------------------------------------
     2) order.html
  --------------------------------------------------------------- */

  function initOrderPage() {
    var form = document.getElementById("orderForm");
    var itemsField = document.getElementById("items");
    var totalField = document.getElementById("total");

    // Fill items and total from the URL as soon as the page loads
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");

    if (item !== null && itemsField) itemsField.value = item;
    if (price !== null && totalField) totalField.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var payload = {
        customerName: document.getElementById("customerName").value,
        contact: document.getElementById("contact").value,
        items: document.getElementById("items").value,
        total: document.getElementById("total").value,
        note: document.getElementById("note").value
      };

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = "thankyou.html"; })
        .catch(error => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------------------------------------------------------------
     3) admin.html
  --------------------------------------------------------------- */

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    setMessageRow("กำลังโหลดข้อมูล...");

    // timestamp query avoids a stale cached copy of the published CSV
    var url = ORDERS_CSV_URL + "&_=" + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ""; });
        });

        // skip a header row if the first cell holds no digits (a date always does)
        if (rows.length && !/\d/.test(rows[0][0])) rows.shift();

        // rows are appended in time order, so reversing puts the newest first
        rows.reverse();

        if (rows.length === 0) {
          setMessageRow("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        tbody.innerHTML = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < 6; i++) {
            var td = document.createElement("td");
            td.textContent = r[i] !== undefined ? r[i] : "";
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        setMessageRow("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
      });

    function setMessageRow(text) {
      tbody.innerHTML = "";
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  // Minimal CSV parser: handles quoted fields, "" escapes, commas and
  // line breaks inside quotes, and both \n and \r\n line endings.
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  /* ---------------------------------------------------------------
     helpers
  --------------------------------------------------------------- */

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  function formatPrice(n) {
    return Number(n).toLocaleString("th-TH") + " บาท";
  }
})();
