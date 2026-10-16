"use strict";

/*
 * love-cal — page logic.
 *
 * Two halves: a real calculator (state machine + history tape) and "us
 * counters" — numbers that only go up: days together, the kilometres between
 * Karachi and Bucharest, pizza slices and sunrises. Everything stays on this
 * device.
 */

(function () {
  var STORE = "mena-cal";

  // Symbolic always-together anchor (same date loveformymena counts from).
  var START = 1704067200000; // Date.UTC(2024, 0, 1)

  var KARACHI = { lat: 24.8607, lng: 67.0011 };
  var BUCHAREST = { lat: 44.4268, lng: 26.1025 };

  var OP_SYMBOL = { "+": "+", "-": "\u2212", "*": "\u00D7", "/": "\u00F7" };

  /* ---------------- state ---------------- */

  var current = "0";        // digits being typed (or the last result)
  var previous = null;      // left-hand operand of a pending operator
  var op = null;            // pending operator: + - * /
  var overwrite = true;     // next digit replaces `current`
  var error = false;        // division by zero latched until next input
  var expression = "";      // what the tape shows above the result
  var lastOp = null;        // repeat-equals memory
  var lastOperand = null;
  var history = [];         // [{expr, result}]
  var rate = 1;             // pizza slices per day

  /* ---------------- storage ---------------- */

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE); } catch (e) { raw = null; }
    var s = null;
    if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
    if (s && Array.isArray(s.history)) {
      history = s.history.filter(function (h) {
        return h && typeof h.expr === "string" && typeof h.result === "string";
      }).slice(0, 8);
    }
    if (s && typeof s.rate === "number" && s.rate >= 0 && s.rate <= 50) rate = s.rate;
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ history: history, rate: rate })); } catch (e) { /* ignore */ }
  }

  /* ---------------- helpers ---------------- */

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function note(msg) { setText("save-note", msg); }

  function fmtNum(n) {
    if (typeof n !== "number" || isNaN(n)) return "Error";
    if (!isFinite(n)) return n > 0 ? "\u221E" : "-\u221E";
    var s = String(Number(n.toPrecision(12)));
    if (s.length > 14) s = n.toExponential(6);
    return s;
  }

  function toNum(str) {
    var n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  }

  function apply(a, b, operator) {
    if (operator === "+") return a + b;
    if (operator === "-") return a - b;
    if (operator === "*") return a * b;
    if (operator === "/") return b === 0 ? NaN : a / b;
    return b;
  }

  function haversineKm(a, b) {
    var rad = function (d) { return (d * Math.PI) / 180; };
    var dLat = rad(b.lat - a.lat);
    var dLng = rad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* ---------------- calculator engine ---------------- */

  function render() {
    setText("calc-expression", expression ? expression : "\u00A0");
    setText("calc-result", error ? "Error" : current);
  }

  function resetAll() {
    current = "0";
    previous = null;
    op = null;
    overwrite = true;
    error = false;
    expression = "";
    lastOp = null;
    lastOperand = null;
  }

  function clearError() {
    if (error) {
      error = false;
      current = "0";
      previous = null;
      op = null;
      overwrite = true;
      expression = "";
    }
  }

  function inputDigit(d) {
    clearError();
    if (overwrite) {
      current = d;
      overwrite = false;
      return;
    }
    if (current === "0") {
      current = d === "0" ? "0" : d;
      return;
    }
    if (current.replace(/[-.]/g, "").length >= 12) return;
    current += d;
  }

  function inputDot() {
    clearError();
    if (overwrite) {
      current = "0.";
      overwrite = false;
      return;
    }
    if (current.indexOf(".") < 0) current += ".";
  }

  function setOperator(next) {
    clearError();
    if (op !== null && previous !== null && !overwrite) {
      var result = apply(previous, toNum(current), op);
      if (isNaN(result)) { fail(); return; }
      previous = result;
      current = fmtNum(result);
    } else if (previous === null) {
      previous = toNum(current);
    }
    op = next;
    overwrite = true;
    expression = fmtNum(previous) + " " + OP_SYMBOL[next];
  }

  function fail() {
    error = true;
    current = "0";
    previous = null;
    op = null;
    overwrite = true;
    expression = "";
  }

  function pushHistory(expr, result) {
    history.unshift({ expr: expr, result: result });
    if (history.length > 8) history.length = 8;
    save();
    renderHistory();
  }

  function equals() {
    if (error) return;
    if (op !== null && previous !== null) {
      var b = toNum(current);
      var expr = fmtNum(previous) + " " + OP_SYMBOL[op] + " " + fmtNum(b) + " =";
      var result = apply(previous, b, op);
      if (isNaN(result)) { fail(); return; }
      lastOp = op;
      lastOperand = b;
      previous = null;
      op = null;
      current = fmtNum(result);
      overwrite = true;
      expression = expr;
      pushHistory(expr, current);
      render();
      return;
    }
    if (lastOp !== null) {
      var left = toNum(current);
      var expr2 = fmtNum(left) + " " + OP_SYMBOL[lastOp] + " " + fmtNum(lastOperand) + " =";
      var result2 = apply(left, lastOperand, lastOp);
      if (isNaN(result2)) { fail(); return; }
      current = fmtNum(result2);
      overwrite = true;
      expression = expr2;
      pushHistory(expr2, current);
      render();
    }
  }

  function percent() {
    clearError();
    var v = toNum(current);
    var out;
    if ((op === "+" || op === "-") && previous !== null) out = (previous * v) / 100;
    else out = v / 100;
    current = fmtNum(out);
    overwrite = true;
  }

  function toggleSign() {
    clearError();
    if (current === "0" || current === "0.") return;
    if (current.charAt(0) === "-") current = current.slice(1);
    else current = "-" + current;
  }

  function backspace() {
    clearError();
    if (overwrite) return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    if (current === "-" || current === "") current = "0";
  }

  function doAction(action) {
    if (action === "clear") { resetAll(); render(); return; }
    if (action === "back") { backspace(); render(); return; }
    if (action === "percent") { percent(); render(); return; }
    if (action === "sign") { toggleSign(); render(); return; }
    if (action === "dot") { inputDot(); render(); return; }
    if (action === "equals") { equals(); render(); return; }
  }

  /* ---------------- history tape ---------------- */

  function renderHistory() {
    var wrap = document.getElementById("calc-history-wrap");
    var list = document.getElementById("calc-history");
    if (wrap) wrap.hidden = history.length === 0;
    if (!list) return;
    list.textContent = "";
    history.forEach(function (h) {
      var li = document.createElement("li");
      var expr = document.createElement("span");
      expr.className = "h-expr";
      expr.textContent = h.expr;
      var result = document.createElement("span");
      result.className = "h-result";
      result.textContent = " " + h.result;
      li.appendChild(expr);
      li.appendChild(result);
      li.addEventListener("click", function () {
        clearError();
        current = h.result;
        overwrite = true;
        render();
        note("Result loaded \u2665");
      });
      list.appendChild(li);
    });
  }

  function clearHistory() {
    history = [];
    save();
    renderHistory();
    note("History cleared.");
  }

  /* ---------------- us counters ---------------- */

  function tick() {
    var ms = Date.now() - START;
    if (ms < 0) ms = 0;
    var days = Math.floor(ms / 86400000);
    var hours = Math.floor(ms / 3600000) % 24;
    var mins = Math.floor(ms / 60000) % 60;
    setText("c-days", days);
    setText("c-days-sub", hours + " hours, " + mins + " minutes");
    setText("c-pizza", Math.floor(days * rate));
    setText("c-sunrises", days);
  }

  function setRate(value) {
    var n = parseFloat(value);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 50) n = 50;
    rate = n;
    save();
    tick();
  }

  /* ---------------- wiring ---------------- */

  function wire() {
    var keys = document.getElementById("calc-keys");
    if (keys) {
      keys.addEventListener("click", function (ev) {
        var target = ev && ev.target ? ev.target : null;
        while (target && target !== keys && target.getAttribute && !target.getAttribute("data-num") &&
               !target.getAttribute("data-op") && !target.getAttribute("data-action")) {
          target = target.parentNode;
        }
        if (!target || target === keys || !target.getAttribute) return;
        var num = target.getAttribute("data-num");
        var oper = target.getAttribute("data-op");
        var action = target.getAttribute("data-action");
        if (num !== null) { inputDigit(num); render(); return; }
        if (oper !== null) { setOperator(oper); render(); return; }
        if (action) doAction(action);
      });
    }

    document.addEventListener("keydown", function (ev) {
      var key = ev.key;
      if (/^[0-9]$/.test(key)) { inputDigit(key); render(); ev.preventDefault(); return; }
      if (key === "." || key === ",") { inputDot(); render(); ev.preventDefault(); return; }
      if (key === "+" || key === "-" || key === "*" || key === "/") { setOperator(key); render(); ev.preventDefault(); return; }
      if (key === "%") { percent(); render(); ev.preventDefault(); return; }
      if (key === "Enter" || key === "=") { equals(); render(); ev.preventDefault(); return; }
      if (key === "Escape" || key === "c" || key === "C") { resetAll(); render(); ev.preventDefault(); return; }
      if (key === "Backspace") { backspace(); render(); ev.preventDefault(); return; }
    });

    var rateInput = document.getElementById("pizza-rate");
    if (rateInput) {
      rateInput.value = String(rate);
      rateInput.addEventListener("change", function () {
        setRate(rateInput.value);
        rateInput.value = String(rate);
        note("Pizza rate saved \u2665");
      });
    }

    var clearBtn = document.getElementById("clear-history");
    if (clearBtn) clearBtn.addEventListener("click", clearHistory);

    var share = document.getElementById("share-button");
    if (share) share.addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { note("Link copied \u2665"); })
          .catch(function () { note(url); });
        return;
      }
      note(url);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    load();
    render();
    renderHistory();
    tick();
    setText("c-km", Math.round(haversineKm(KARACHI, BUCHAREST)));
    wire();
    setInterval(tick, 1000);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  });
})();
