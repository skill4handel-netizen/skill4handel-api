import { Body, Controller, Delete, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { requireAdmin } from '../auth/admin-auth';
import { enforceThrottle } from '../auth/throttle';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page() {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Skill4Handel Admin</title>
<style>
  :root { --navy:#102a43; --blue:#1f4e79; --gold:#c9a227; --bg:#f4f7fb; --line:#e4ebf3; --muted:#5d6d7e; --ok:#1f7a4d; --warn:#9a6700; --bad:#b42318; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Segoe UI, Arial, sans-serif; background:var(--bg); color:#172033; }
  button, input, select, textarea { font:inherit; }
  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:radial-gradient(circle at top left, #1f4e79, #102a43 55%); }
  .login-card { width:min(440px,100%); background:#fff; border-radius:24px; padding:32px; box-shadow:0 24px 60px rgba(0,0,0,.25); }
  .brand { text-align:center; }
  .brand img { width:72px; height:72px; border-radius:18px; object-fit:cover; background:#fff; }
  .brand h1 { margin:12px 0 4px; color:var(--navy); }
  .brand p { margin:0; color:var(--muted); }
  label { display:block; margin:14px 0 6px; color:var(--muted); font-size:13px; }
  input, select, textarea { width:100%; padding:12px 14px; border:1px solid var(--line); border-radius:12px; background:#fff; }
  .row-btns { display:flex; gap:8px; margin-top:16px; }
  button { border:0; border-radius:12px; padding:11px 14px; cursor:pointer; }
  .primary { background:var(--navy); color:#fff; font-weight:700; }
  .ghost { background:#eef3f8; color:var(--navy); }
  .danger { background:#fff1f0; color:var(--bad); }
  .error { min-height:22px; color:var(--bad); margin-top:10px; }
  .shell { display:grid; grid-template-columns:240px 1fr; min-height:100vh; }
  aside { background:var(--navy); color:#fff; padding:22px 16px; }
  aside img { width:42px; height:42px; border-radius:12px; background:#fff; object-fit:cover; }
  aside h1 { font-size:18px; margin:12px 0 4px; }
  aside p { margin:0 0 22px; color:#c9d7e6; font-size:13px; }
  .tabs { display:flex; flex-direction:column; gap:8px; }
  .tabs button { text-align:left; background:transparent; color:#d7e3ef; }
  .tabs button.on { background:#fff; color:var(--navy); }
  main { padding:24px; }
  header { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:18px; }
  header h2 { margin:0; }
  header p { margin:4px 0 0; color:var(--muted); }
  .actions { display:flex; gap:8px; }
  .actions button { width:auto; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
  .stat, .card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:16px; }
  .stat b { display:block; font-size:28px; color:var(--navy); }
  .stat span { color:var(--muted); font-size:13px; }
  .filters { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; margin:12px 0; }
  .filters button { width:auto; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; color:var(--muted); font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
  th, td { border-bottom:1px solid var(--line); padding:10px 8px; vertical-align:top; }
  .badge { display:inline-block; border-radius:999px; padding:3px 8px; font-size:12px; font-weight:700; background:#eef3f8; color:var(--navy); }
  .badge.ok { background:#e8f6ee; color:var(--ok); }
  .badge.warn { background:#fff7e6; color:var(--warn); }
  .badge.bad { background:#fff1f0; color:var(--bad); }
  .hide { display:none; }
  dialog { border:0; border-radius:18px; padding:22px; width:min(760px,94vw); }
  pre { white-space:pre-wrap; background:#f6f8fb; padding:12px; border-radius:12px; }
  .chart-box h3 { margin:0 0 8px; }
  .line-chart { width:100%; height:180px; }
  @media (max-width:860px) { .shell { grid-template-columns:1fr; } aside { padding-bottom:8px; } .tabs { flex-direction:row; overflow:auto; } }
</style>
</head>
<body>
<div id="login" class="login-wrap">
  <div class="login-card">
    <div class="brand">
      <img src="https://www.skill4handel.com/logo.jpg" alt="Skill4Handel" />
      <h1>Skill4Handel</h1>
      <p>Operations panel for members, exchanges and support.</p>
    </div>
    <div id="loginForm">
      <label>Email</label>
      <input id="email" type="email" autocomplete="username" placeholder="admin@skill4handel.com" />
      <label>Password</label>
      <input id="password" type="password" autocomplete="current-password" placeholder="Password" />
      <div class="row-btns">
        <button id="loginBtn" class="primary" type="button">Sign in</button>
        <button id="forgotBtn" class="ghost" type="button">Reset password</button>
      </div>
      <div id="error" class="error"></div>
    </div>
  </div>
</div>
<div id="app" class="shell hide">
  <aside>
    <img src="https://www.skill4handel.com/logo.jpg" alt="" />
    <h1>Admin</h1>
    <p>Live overview of the exchange.</p>
    <div class="tabs">
      <button type="button" data-tab="overview" class="on">Overview</button>
      <button type="button" data-tab="tickets">Support</button>
      <button type="button" data-tab="users">Members</button>
      <button type="button" data-tab="exchanges">Exchanges</button>
      <button type="button" data-tab="reviews">Reviews</button>
    </div>
  </aside>
  <main>
    <header>
      <div>
        <h2 id="pageTitle">Overview</h2>
        <p id="pageHint">Members, open sessions, support and reviews.</p>
      </div>
      <div class="actions">
        <button id="refreshBtn" class="ghost" type="button">Refresh</button>
        <button id="logoutBtn" class="danger" type="button">Sign out</button>
      </div>
    </header>
    <div id="tab-overview">
      <div class="grid" id="stats"></div>
      <div class="card">
        <h3>Reports</h3>
        <div class="filters">
          <input id="fCity" placeholder="City" />
          <input id="fSkill" placeholder="Skill" />
          <select id="fStatus"><option value="">Any offer status</option><option>PROPOSED</option><option>COUNTERED</option><option>ACCEPTED</option><option>CANCELLED</option><option>SETTLED</option><option>REVIEWED</option></select>
          <select id="fRole"><option value="">Any role</option><option value="user">Member</option><option value="admin">Admin</option></select>
          <button class="primary" type="button" onclick="loadReport()">Apply filters</button>
          <button class="ghost" type="button" onclick="downloadCsv('users')">Export members</button>
          <button class="ghost" type="button" onclick="downloadCsv('exchanges')">Export exchanges</button>
          <button class="ghost" type="button" onclick="downloadCsv('skills')">Export skills</button>
          <button class="ghost" type="button" onclick="downloadCsv('cities')">Export cities</button>
        </div>
        <div class="charts" id="charts"></div>
        <h3>Most requested skills</h3><div id="skillReport"></div>
        <h3>Cities by activity</h3><div id="cityReport"></div>
      </div>
    </div>
    <div id="tab-tickets" class="hide">
      <div class="card">
        <h3>Support tickets</h3>
        <p>Open a ticket to read the full text and save a reply.</p>
        <select id="ticketFilter"><option value="">All</option><option value="open">Open</option><option value="closed">Closed</option></select>
        <div id="tickets"></div>
      </div>
    </div>
    <div id="tab-users" class="hide">
      <div class="card">
        <h3>Members</h3>
        <p>Open a name to see account dates, activity, role and wallet.</p>
        <div class="filters">
          <input id="userQuery" placeholder="Search name, email or city" />
          <button id="searchBtn" class="primary" type="button">Search</button>
        </div>
        <div id="users"></div>
        <div id="userDetail"></div>
      </div>
    </div>
    <div id="tab-exchanges" class="hide">
      <div class="card">
        <h3>Exchanges</h3>
        <p>Accepted sessions stay open until both members mark them done.</p>
        <select id="offerFilter"><option value="">All</option><option value="PROPOSED">Waiting for a reply</option><option value="COUNTERED">Counter-offer</option><option value="ACCEPTED">Accepted, not finished</option><option value="CANCELLED">Cancelled</option><option value="SETTLED">Finished</option><option value="REVIEWED">Reviewed</option></select>
        <div id="exchanges"></div>
      </div>
    </div>
    <div id="tab-reviews" class="hide">
      <div class="card">
        <h3>Reviews</h3>
        <p>Reviews appear only after both members confirm a finished exchange.</p>
        <div id="reviews"></div>
      </div>
    </div>
  </main>
</div>
<dialog id="ticketBox">
  <h2 id="ticketTitle">Ticket</h2>
  <pre id="ticketBody"></pre>
  <textarea id="ticketReply" rows="4" placeholder="Reply to the member"></textarea>
  <div class="row-btns">
    <button id="replyBtn" class="primary" type="button">Save reply and close</button>
    <button id="closeBoxBtn" class="ghost" type="button">Close</button>
  </div>
</dialog>
<script>
const api = "";
let currentTicket = 0;
function token() { return localStorage.getItem("adminToken") || ""; }
function headers() { return { Authorization: "Bearer " + token(), "Content-Type": "application/json" }; }
function $(id) { return document.getElementById(id); }
function showTab(name) {
  ["overview","tickets","users","exchanges","reviews"].forEach(function(id) {
    var el = $("tab-" + id);
    if (el) el.className = id === name ? "" : "hide";
  });
  document.querySelectorAll(".tabs button").forEach(function(el) {
    el.className = el.getAttribute("data-tab") === name ? "on" : "";
  });
  var titles = { overview:"Overview", tickets:"Support", users:"Members", exchanges:"Exchanges", reviews:"Reviews" };
  if ($("pageTitle")) $("pageTitle").textContent = titles[name] || "Admin";
}
async function login() {
  if ($("error")) $("error").textContent = "Signing in...";
  try {
    localStorage.removeItem("adminToken");
    const res = await fetch(api + "/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ($("email").value || "").trim(), password: $("password").value })
    });
    const data = await res.json().catch(function() { return {}; });
    if (!res.ok || !data.token) {
      const msg = data.message || ("Login failed (" + res.status + ")");
      if ($("error")) $("error").textContent = msg;
      $("login").className = "login-wrap";
      $("app").className = "hide";
      alert(msg);
      return;
    }
    localStorage.setItem("adminToken", data.token);
    $("login").className = "hide";
    $("app").className = "";
    if ($("error")) $("error").textContent = "";
    loadAll();
  } catch (err) {
    if ($("error")) $("error").textContent = "Could not reach the server. Wait and try again.";
    $("login").className = "login-wrap";
    $("app").className = "hide";
  }
}
async function forgot() {
  const email = $("email").value.trim();
  if (!email) {
    $("error").textContent = "Enter the admin email first.";
    return;
  }
  $("error").textContent = "Resetting...";
  try {
    const rec = await fetch(api + "/admin/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    }).then(function(r) { return r.json(); });
    if (rec && rec.reset) {
      $("error").textContent = "Password was reset to ADMIN_PASSWORD from the server. Sign in with that password.";
      return;
    }
    await fetch(api + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    $("error").textContent = "No server admin match. A reset email is sent only if mail is configured.";
  } catch (err) {
    $("error").textContent = "Could not reach the server.";
  }
}
function logout() {
  localStorage.removeItem("adminToken");
  $("app").className = "hide";
  $("login").className = "login-wrap";
  if ($("error")) $("error").textContent = "Please sign in again.";
}
async function loadAll() {
  try {
    const probe = await fetch(api + "/admin/stats", { headers: headers() });
    if (probe.status === 401 || probe.status === 403) {
      localStorage.removeItem("adminToken");
      $("app").className = "hide";
      $("login").className = "login-wrap";
      if ($("error")) $("error").textContent = "Signed in, but the admin session was rejected. Check JWT_SECRET and try again.";
      return;
    }
    await Promise.all([loadStats(), loadTickets(), loadUsers(), loadExchanges(), loadReviews()]);
  } catch (err) {
    $("stats").innerHTML = "<p class=error>Could not load the panel. Refresh the page.</p>";
  }
}
function filters() {
  return { city: $("fCity").value.trim(), skill: $("fSkill").value.trim(), status: $("fStatus").value, role: $("fRole").value };
}
function esc(value) { return String(value == null ? "" : value).replace(/&/g,"&").replace(/</g,"<"); }
function shortDate(value) {
  const text = String(value || "");
  const parts = text.split("-");
  return parts.length === 3 ? parts[2] + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(parts[1]) - 1] : text;
}
function barChart(title, note, rows, labelKey, valueKey) {
  const list = rows || [];
  if (!list.length) return "<div class=chart-box><h3>" + esc(title) + "</h3><p>No data yet</p></div>";
  const max = Math.max.apply(null, list.map(function(r) { return Number(r[valueKey] || 0); }).concat([1]));
  return "<div class=chart-box><h3>" + esc(title) + "</h3><p class=chart-note>" + esc(note) + "</p>" +
    list.map(function(r) {
      const n = Number(r[valueKey] || 0);
      const label = labelKey === "day" ? shortDate(r[labelKey]) : (r[labelKey] || "Unknown");
      return "<div class=bar-row><span>" + esc(label) + "</span><div class=bar-track><div class=bar-fill style=width:" +
        Math.max(2, Math.round(n * 100 / max)) + "%></div></div><b>" + n + "</b></div>";
    }).join("") + "</div>";
}
function lineChart(title, rows) { return barChart(title, "Each row is one day. The number is the count.", rows, "day", "count"); }
async function loadReport() {
  const q = new URLSearchParams(filters());
  const res = await fetch("/admin/report?" + q.toString(), { headers: headers() });
  const data = await res.json();
  const charts = data.charts || {};
  $("charts").innerHTML = barChart("New members, 30 days", "Date on the left, number of new accounts on the right.", charts.signups || [], "day", "count") + barChart("Offers", "Date or status on the left, count on the right.", (charts.offers || []).map(function(r){ return { label: r.day || r.status || r.type, count: r.count }; }), "label", "count");
  $("skillReport").innerHTML = barChart("Skills", "Skill name and how many times it appears in offers.", data.topSkills || [], "skill", "count");
  $("cityReport").innerHTML = barChart("Cities", "City name and members active in the last 30 days.", data.activeCities || [], "city", "active_30d");
  if ((data.users || []).length) $("users").innerHTML = userTable(data.users);
  if ((data.exchanges || []).length) $("exchanges").innerHTML = offerTable(data.exchanges);
}
function downloadCsv(kind) {
  const q = new URLSearchParams(filters());
  q.set("kind", kind);
  fetch("/admin/export?" + q.toString(), { headers: headers() }).then(function(res) { return res.blob(); }).then(function(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skill4handel-" + kind + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  });
}
async function loadStats() {
  const s = await fetch(api + "/admin/stats", { headers: headers() }).then(function(r) { return r.json(); });
  $("stats").innerHTML =
    stat("Users", s.users && s.users.total) +
    stat("Verified", s.users && s.users.verified) +
    stat("Suspended", s.users && s.users.suspended) +
    stat("Open tickets", s.tickets && s.tickets.open) +
    stat("Pending offers", s.offers && s.offers.pending) +
    stat("Completed offers", s.offers && s.offers.completed);
  const charts = s.charts || {};
  $("charts").innerHTML = barChart("New members, 30 days", "Date on the left, number of new accounts on the right.", charts.signups || [], "day", "count") + barChart("Offers", "Date or status on the left, count on the right.", (charts.offers || []).map(function(r){ return { label: r.day || r.status || r.type, count: r.count }; }), "label", "count");
  loadReport();
}
function chartBox(title, rows, labelKey, valueKey) {
  if (!rows.length) return "<div class=chart-box><h3>" + title + "</h3><p>No data yet</p></div>";
  const max = Math.max.apply(null, rows.map(function(r) { return Number(r[valueKey] || 0); })) || 1;
  return "<div class=chart-box><h3>" + title + "</h3><div class=vchart>" + rows.map(function(r) {
    const n = Number(r[valueKey] || 0);
    const h = Math.max(6, Math.round(n * 90 / max));
    const label = String(r[labelKey] || "").replace(/^20/, "");
    return "<div class=vcol><span class=val>" + n + "</span><div class=vbar style=height:" + h +
      "px></div><span class=label>" + label + "</span></div>";
  }).join("") + "</div></div>";
}
function stat(label, value) {
  return "<div class=stat><b>" + (value == null ? "-" : value) + "</b><span>" + label + "</span></div>";
}
async function loadTickets() {
  const status = $("ticketFilter").value;
  const rows = await fetch(api + "/admin/tickets?status=" + status, { headers: headers() }).then(function(r) { return r.json(); });
  $("tickets").innerHTML = ticketTable(rows);
}
async function loadUsers() {
  const q = $("userQuery").value || "";
  const rows = await fetch(api + "/admin/users?q=" + encodeURIComponent(q), { headers: headers() }).then(function(r) { return r.json(); });
  $("users").innerHTML = userTable(rows);
}
async function loadExchanges() {
  const status = $("offerFilter").value;
  const rows = await fetch(api + "/admin/exchanges?status=" + status, { headers: headers() }).then(function(r) { return r.json(); });
  $("exchanges").innerHTML = offerTable(rows);
}
async function loadReviews() {
  const rows = await fetch(api + "/admin/reviews", { headers: headers() }).then(function(r) { return r.json(); });
  $("reviews").innerHTML = reviewTable(rows);
}
function reviewTable(rows) {
  if (!Array.isArray(rows)) return "<p class=error>Could not load</p>";
  if (!rows.length) return "<p>No rows</p>";
  return "<table><tr><th>id</th><th>from</th><th>to</th><th>rating</th><th>skill</th><th>text</th><th>created</th></tr>" +
    rows.map(function(row) {
      return "<tr><td>" + row.id + "</td><td>" + (row.from_name || row.from_id || "") + "</td><td>" +
        (row.to_name || row.to_id || "") + "</td><td>" + (row.rating || "") + "</td><td>" +
        (row.skill || "") + "</td><td>" + String(row.text || "").replace(/</g, "&lt;") +
        "</td><td>" + formatTime(row.created_at) + "</td></tr>";
    }).join("") + "</table>";
}
function ticketTable(rows) {
  if (!Array.isArray(rows)) return "<p class=error>Could not load</p>";
  if (!rows.length) return "<p>No rows</p>";
  return "<table><tr><th>id</th><th>member</th><th>type</th><th>subject</th><th>status</th><th></th></tr>" +
    rows.map(function(row) {
      const preview = String(row.text || row.subject || "Open ticket").replace(/</g, "&lt;").slice(0, 70);
      return "<tr><td>" + row.id + "</td><td>" + (row.name || "") + "</td><td>" + (row.type || "") +
        "</td><td><button type=button data-open-ticket=" + row.id + ">" + preview + "</button></td><td>" +
        (row.status || "open") + "</td><td>" +
        (row.status !== "closed" ? "<button type=button data-close-ticket=" + row.id + ">Close</button> " : "") +
        "<button type=button data-delete-ticket=" + row.id + ">Delete</button>" +
        "</td></tr>";
    }).join("") + "</table>";
}
function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}
function userTable(rows) {
  if (!Array.isArray(rows)) return "<p class=error>Could not load</p>";
  if (!rows.length) return "<p>No rows</p>";
  return "<table><tr><th>id</th><th>name</th><th>email</th><th>city</th><th>balance</th><th>created</th><th>last login</th><th>status</th><th></th></tr>" +
    rows.map(function(row) {
      const roleBtn = row.role === "admin"
        ? "<button type=button data-role-user=" + row.id + ">Make user</button>"
        : "<button type=button data-role-admin=" + row.id + ">Make admin</button>";
      const susBtn = row.role === "admin" ? "" : (row.is_suspended
        ? "<button type=button data-unsuspend=" + row.id + ">Unsuspend</button>"
        : "<button type=button data-suspend=" + row.id + ">Suspend</button>");
      const delBtn = row.role === "admin" ? "" : "<button type=button data-delete-user=" + row.id + ">Delete</button>";
      const verifyBtn = row.email_verified ? "" : "<button type=button data-verify=" + row.id + ">Verify email</button>";
      return "<tr><td>" + row.id + "</td><td><button type=button data-open-user=" + row.id + ">" + (row.name || "") +
        "</button></td><td>" + (row.email || "") + "</td><td>" + (row.city || "") + "</td><td>" +
        (row.balance == null ? "" : row.balance) + "</td><td>" + formatTime(row.created_at) +
        "</td><td>" + formatTime(row.last_login || row.updated_at) + "</td><td>" +
        (row.is_suspended ? "suspended" : (row.email_verified ? (row.role || "user") : "unverified")) +
        "</td><td>" + verifyBtn +
        " <button type=button data-password=" + row.id + ">Password</button>" +
        " <button type=button data-wallet=" + row.id + ">Wallet</button> " +
        roleBtn + " " + susBtn + " " + delBtn + "</td></tr>";
    }).join("") + "</table>";
}
function offerTable(rows) {
  if (!Array.isArray(rows)) return "<p class=error>Could not load</p>";
  if (!rows.length) return "<p>No rows</p>";
  return "<table><tr><th>id</th><th>from</th><th>to</th><th>requested</th><th>status</th><th>tokens</th><th></th></tr>" +
    rows.map(function(row) {
      const canCancel = row.status === "PROPOSED" || row.status === "COUNTERED" || row.status === "ACCEPTED";
      return "<tr><td>" + row.id + "</td><td>" + (row.name_a || "") + "</td><td>" + (row.name_b || "") +
        "</td><td>" + (row.skill_requested || "") + "</td><td>" + (row.status || "") + "</td><td>" +
        (row.extra_tokens == null ? "" : row.extra_tokens) + "</td><td>" +
        (canCancel ? "<button type=button data-cancel-offer=" + row.id + ">Cancel</button>" : "") +
        "</td></tr>";
    }).join("") + "</table>";
}
function table(rows, keys) {
  if (!Array.isArray(rows) || !rows.length) return "<p>No rows</p>";
  return "<table><tr>" + keys.map(function(k) { return "<th>" + k + "</th>"; }).join("") + "</tr>" +
    rows.map(function(row) {
      return "<tr>" + keys.map(function(k) { return "<td>" + String(row[k] == null ? "" : row[k]) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</table>";
}
async function openTicket(id) {
  currentTicket = id;
  const row = await fetch(api + "/admin/tickets/" + id, { headers: headers() }).then(function(r) { return r.json(); });
  $("ticketTitle").textContent = "Ticket #" + row.id + " · " + (row.type || "") + " · " + (row.name || "");
  $("ticketBody").textContent = ["Member: " + (row.name || ""), "Other: " + (row.other_name || "-"), "Status: " + (row.status || ""), "Created: " + (row.created_at || ""), "", row.text || "", row.admin_reply || ""].join(String.fromCharCode(10));
  $("ticketReply").value = "";
  $("ticketBox").showModal();
}
async function replyTicket() {
  const text = $("ticketReply").value;
  if (!text.trim() || !currentTicket) return;
  await fetch(api + "/admin/tickets/" + currentTicket + "/reply", {
    method: "POST", headers: headers(), body: JSON.stringify({ text: text })
  });
  $("ticketBox").close();
  loadTickets();
}
async function openUser(id) {
  const data = await fetch(api + "/admin/users/" + id, { headers: headers() }).then(function(r) { return r.json(); });
  const u = data.user || {};
  const a = data.activity || {};
  $("userDetail").innerHTML =
    "<h3>" + (u.name || "") + "</h3>" +
    "<p>Email: " + (u.email || "") + "<br>City: " + (u.city || "") + "<br>Role: " + (u.role || "") +
    "<br>Balance: " + (u.balance == null ? "" : u.balance) + "<br>Rating: " + (u.rating == null ? "" : u.rating) + "</p>" +
    "<p>Account created: " + formatTime(u.created_at) + "<br>Last login: " + formatTime(u.last_login || u.updated_at) + "</p>" +
    "<p>Skills offered: " + (u.offers || "-") + "</p>" +
    "<h3>Registration fields</h3>" +
    "<label>Name</label><input id=editName />" +
    "<label>Email</label><input id=editEmail />" +
    "<label>City</label><input id=editCity />" +
    "<label>Language</label><select id=editLang><option value=en>English</option><option value=nl>Nederlands</option></select>" +
    "<label>Age</label><input id=editAge type=number />" +
    "<label>Date of birth</label><input id=editBirth type=date />" +
    "<label>New password optional</label><input id=editPass type=password />" +
    "<p><button type=button id=saveUserBtn>Save registration fields</button></p>" +
    "<h3>Recent chats</h3>" + table(a.chats || [], ["id","name_a","name_b","last_message","updated_at"]) +
    "<h3>Offers</h3>" + table(a.offers || [], ["id","status","skill_requested","skill_offered","extra_tokens","updated_at"]) +
    "<h3>Tickets</h3>" + table(a.tickets || [], ["id","type","status","created_at"]) +
    "<h3>Reviews</h3>" + table(a.reviews || [], ["id","rating","text","created_at"]) +
    "<h3>Wallet</h3>" + table(a.wallet || [], ["id","type","amount","title","created_at"]);
  if ($("editName")) $("editName").value = u.name || "";
  if ($("editEmail")) $("editEmail").value = u.email || "";
  if ($("editCity")) $("editCity").value = u.city || "";
  if ($("editLang")) $("editLang").value = u.language === "nl" ? "nl" : "en";
  if ($("editAge")) $("editAge").value = u.age == null ? "" : u.age;
  if ($("editBirth")) $("editBirth").value = String(u.birth_date || "").slice(0,10);
  if ($("saveUserBtn")) $("saveUserBtn").setAttribute("data-save-user", String(u.id));
}
async function act(url, method, body) {
  const res = await fetch(api + url, {
    method: method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    alert(data.message || "Request failed");
    return false;
  }
  return data;
}
document.addEventListener("submit", function(event) {
  if (event.target && event.target.id === "loginForm") {
    event.preventDefault();
    login();
  }
});
document.addEventListener("click", async function(event) {
  const raw = event.target;
  if (!raw) return;
  const t = raw.closest ? raw.closest("button, [data-tab], [data-open-user], [data-open-ticket], [data-close-ticket], [data-delete-ticket], [data-save-user], [data-verify], [data-suspend], [data-unsuspend], [data-role-user], [data-role-admin], [data-password], [data-wallet], [data-delete-user], [data-cancel-offer]") : raw;
  if (!t || !t.getAttribute) return;
  if (t.id === "loginBtn") return login();
  if (t.id === "forgotBtn") return forgot();
  if (t.id === "logoutBtn") return logout();
  if (t.id === "refreshBtn") return loadAll();
  if (t.id === "searchBtn") return loadUsers();
  if (t.id === "replyBtn") return replyTicket();
  if (t.id === "closeBoxBtn") return $("ticketBox").close();
  if (t.getAttribute("data-tab")) return showTab(t.getAttribute("data-tab"));
  if (t.getAttribute("data-open-ticket")) return openTicket(t.getAttribute("data-open-ticket"));
  if (t.getAttribute("data-close-ticket")) { await act("/admin/tickets/" + t.getAttribute("data-close-ticket") + "/close", "POST"); return loadTickets(); }
  if (t.getAttribute("data-delete-ticket")) {
    if (!confirm("Delete this ticket permanently?")) return;
    await act("/admin/tickets/" + t.getAttribute("data-delete-ticket"), "DELETE");
    return loadTickets();
  }
  if (t.getAttribute("data-save-user") || t.id === "saveUserBtn") {
    const id = t.getAttribute("data-save-user") || (document.querySelector("[data-save-user]") || {}).getAttribute("data-save-user");
    if (!id) return;
    await act("/admin/users/" + id, "POST", {
      name: $("editName").value,
      email: $("editEmail").value,
      city: $("editCity").value,
      language: $("editLang").value,
      age: $("editAge").value,
      birthDate: $("editBirth").value,
      password: $("editPass").value
    });
    alert("Saved");
    await loadUsers();
    return openUser(id);
  }

  if (t.getAttribute("data-open-user")) return openUser(t.getAttribute("data-open-user"));
  if (t.getAttribute("data-verify")) { await act("/admin/users/" + t.getAttribute("data-verify") + "/verify", "POST"); return loadUsers(); }
  if (t.getAttribute("data-suspend")) { await act("/admin/users/" + t.getAttribute("data-suspend") + "/suspend", "POST"); return loadUsers(); }
  if (t.getAttribute("data-unsuspend")) { await act("/admin/users/" + t.getAttribute("data-unsuspend") + "/unsuspend", "POST"); return loadUsers(); }
  if (t.getAttribute("data-role-user")) { await act("/admin/users/" + t.getAttribute("data-role-user") + "/role", "POST", { role: "user" }); return loadUsers(); }
  if (t.getAttribute("data-role-admin")) { await act("/admin/users/" + t.getAttribute("data-role-admin") + "/role", "POST", { role: "admin" }); return loadUsers(); }
  if (t.getAttribute("data-password")) {
    const password = prompt("New password");
    if (!password) return;
    await act("/admin/users/" + t.getAttribute("data-password") + "/password", "POST", { password: password });
    alert("Password updated");
    return;
  }
  if (t.getAttribute("data-wallet")) {
    const amount = prompt("Amount. Use +10 to add or -5 to remove.");
    if (!amount) return;
    const title = prompt("Note") || "Admin adjustment";
    const data = await act("/admin/users/" + t.getAttribute("data-wallet") + "/wallet", "POST", { amount: Number(amount), title: title });
    if (data) alert("New balance: " + data.balance);
    return loadUsers();
  }
  if (t.getAttribute("data-delete-user")) {
    if (!confirm("Delete this member and all related chats, offers and tickets?")) return;
    await act("/admin/users/" + t.getAttribute("data-delete-user"), "DELETE");
    $("userDetail").innerHTML = "";
    return loadUsers();
  }
  if (t.getAttribute("data-cancel-offer")) {
    if (!confirm("Cancel this offer as support?")) return;
    await act("/admin/exchanges/" + t.getAttribute("data-cancel-offer") + "/cancel", "POST");
    return loadExchanges();
  }
});
$("ticketFilter").addEventListener("change", loadTickets);
$("offerFilter").addEventListener("change", loadExchanges);
$("loginForm").addEventListener("submit", function(event) {
  event.preventDefault();
  login();
});
document.addEventListener("keydown", function(event) {
  if (event.key === "Enter" && $("login") && $("login").className.indexOf("hide") < 0) {
    event.preventDefault();
    login();
  }
});
if (token()) {
  $("login").className = "hide";
  $("app").className = "";
  loadAll();
}
</script>
</body>
</html>`;
  }

  @Post('login')
  login(@Req() req: any, @Body() body: { email: string; password: string }) {
    enforceThrottle(req, 'admin-login', 30, 10 * 60 * 1000);
    return this.adminService.login(body.email, body.password);
  }

  @Post('recover')
  recover(@Req() req: any, @Body() body: { email?: string }) {
    enforceThrottle(req, 'admin-recover', 6, 15 * 60 * 1000);
    return this.adminService.recoverFromEnv(String(body?.email || ''));
  }

  @Get('report')
  report(@Req() req: any, @Query() query: Record<string, string>) {
    requireAdmin(req);
    return this.adminService.report(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Req() req: any, @Query() query: Record<string, string>) {
    requireAdmin(req);
    return this.adminService.exportCsv(query.kind || 'users', query);
  }

  @Get('stats')
  async stats(@Req() req: any) {
    await requireAdmin(req);
    return this.adminService.stats();
  }

  @Get('users')
  async users(@Req() req: any, @Query('q') q?: string) {
    await requireAdmin(req);
    return this.adminService.listUsers(q || '');
  }

  @Get('users/:id')
  async user(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.getUser(Number(id));
  }

  @Post('users/:id')
  async updateUser(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await requireAdmin(req);
    return this.adminService.updateUser(Number(id), body || {});
  }

  @Delete('users/:id')
  async removeUser(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.deleteUser(Number(id));
  }

  @Post('users/:id/suspend')
  async suspend(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.setSuspended(Number(id), true);
  }

  @Post('users/:id/unsuspend')
  async unsuspend(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.setSuspended(Number(id), false);
  }

  @Post('users/:id/role')
  async setRole(@Req() req: any, @Param('id') id: string, @Body() body: { role: string }) {
    await requireAdmin(req);
    return this.adminService.setRole(Number(id), body.role);
  }

  @Post('users/:id/password')
  async setPassword(@Req() req: any, @Param('id') id: string, @Body() body: { password: string }) {
    await requireAdmin(req);
    return this.adminService.setPassword(Number(id), body.password);
  }

  @Post('users/:id/verify')
  async verify(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.verifyUser(Number(id));
  }

  @Post('users/:id/wallet')
  async wallet(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; title?: string }) {
    await requireAdmin(req);
    return this.adminService.adjustWallet(Number(id), Number(body.amount), body.title);
  }

  @Get('tickets')
  async tickets(@Req() req: any, @Query('status') status?: string) {
    await requireAdmin(req);
    return this.adminService.listTickets(status || '');
  }

  @Get('tickets/:id')
  async ticket(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.getTicket(Number(id));
  }

  @Post('tickets/:id/close')
  async close(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.closeTicket(Number(id));
  }

  @Delete('tickets/:id')
  async removeTicket(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.deleteTicket(Number(id));
  }

  @Post('tickets/:id/reply')
  async reply(@Req() req: any, @Param('id') id: string, @Body() body: { text: string }) {
    await requireAdmin(req);
    return this.adminService.replyTicket(Number(id), body.text);
  }

  @Get('reviews')
  async reviews(@Req() req: any) {
    await requireAdmin(req);
    return this.adminService.listReviews();
  }

  @Get('exchanges')
  async exchanges(@Req() req: any, @Query('status') status?: string) {
    await requireAdmin(req);
    return this.adminService.listExchanges(status || '');
  }

  @Post('exchanges/:id/cancel')
  async cancelOffer(@Req() req: any, @Param('id') id: string) {
    await requireAdmin(req);
    return this.adminService.cancelExchange(Number(id));
  }
}
