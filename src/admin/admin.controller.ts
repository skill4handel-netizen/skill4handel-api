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
  :root { --navy:#102a43; --blue:#1f4e79; --gold:#c9a227; --bg:#e8eef5; --card:#fff; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Arial, sans-serif; background: var(--bg); color:#122; }
  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
    background: linear-gradient(160deg, #102a43 0%, #1f4e79 55%, #e8eef5 55%); }
  .login-card { width:min(420px,100%); background:#fff; border-radius:20px; padding:28px;
    box-shadow: 0 16px 40px rgba(16,42,67,.25); }
  .brand { text-align:center; margin-bottom:18px; }
  .mark { width:64px; height:64px; border-radius:16px; margin:0 auto 10px; display:flex; align-items:center;
    justify-content:center; background: var(--navy); color:#fff; font-weight:700; font-size:18px; }
  .brand h1 { margin:0; font-size:22px; color:var(--navy); }
  .brand p { margin:6px 0 0; color:#5b6b7c; font-size:13px; }
  label { display:block; font-size:12px; color:#5b6b7c; margin:10px 0 4px; }
  input, button, select, textarea { width:100%; padding:12px; border:1px solid #d5deea; border-radius:10px; font-size:14px; }
  .row-btns { display:flex; gap:8px; margin-top:14px; }
  button { cursor:pointer; border:0; }
  .primary { background:var(--navy); color:#fff; font-weight:700; }
  .ghost { background:#eef3f8; color:var(--navy); }
  .error { min-height:20px; color:#b42318; font-size:13px; margin-top:10px; }
  header { background:var(--navy); color:#fff; padding:16px 24px; display:flex; justify-content:space-between; align-items:center; }
  header button { width:auto; background:#fff; color:var(--navy); padding:8px 12px; }
  main { padding:20px; }
  .card { background:var(--card); border-radius:12px; padding:16px; margin-bottom:16px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
  .stat { background:#f7f9fc; border-radius:10px; padding:12px; }
  .stat b { display:block; font-size:22px; color:var(--navy); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { border-bottom:1px solid #eee; padding:8px; text-align:left; vertical-align:top; }
  .hide { display:none; }
  .tabs button { width:auto; background:#d9e2ef; color:var(--navy); }
  .tabs button.on { background:var(--navy); color:#fff; }
  dialog { border:0; border-radius:12px; padding:20px; width:min(720px,92vw); }
  pre { white-space:pre-wrap; background:#f6f7fb; padding:12px; border-radius:8px; }
  #app input, #app button, #app select, #app textarea { width:auto; }
</style>
</head>
<body>
<div id="login" class="login-wrap">
  <div class="login-card">
    <div class="brand">
      <div class="mark">S4H</div>
      <h1>Skill4Handel Admin</h1>
      <p>Support, members and exchanges</p>
    </div>
    <form id="loginForm">
      <label>Email</label>
      <input id="email" type="email" autocomplete="username" placeholder="admin@skill4handel.com" />
      <label>Password</label>
      <input id="password" type="password" autocomplete="current-password" placeholder="Password" />
      <div class="row-btns">
        <button id="loginBtn" class="primary" type="submit">Sign in</button>
        <button id="forgotBtn" class="ghost" type="button">Forgot password</button>
      </div>
      <p id="error" class="error"></p>
    </form>
  </div>
</div>
<div id="app" class="hide">
  <header>
    <h1 style="margin:0;font-size:20px">Skill4Handel Admin</h1>
    <div>
      <button id="refreshBtn" type="button">Refresh</button>
      <button id="logoutBtn" type="button">Logout</button>
    </div>
  </header>
  <main>
    <div class="card grid" id="stats"></div>
    <div class="card tabs">
      <button type="button" data-tab="tickets" class="on">Tickets</button>
      <button type="button" data-tab="users">Users</button>
      <button type="button" data-tab="exchanges">Exchanges</button>
      <button type="button" data-tab="reviews">Reviews</button>
    </div>
    <div id="tab-tickets" class="card">
      <h2>Tickets</h2>
      <select id="ticketFilter">
        <option value="">All</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>
      <div id="tickets"></div>
    </div>
    <div id="tab-users" class="card hide">
      <h2>Users</h2>
      <input id="userQuery" placeholder="Search name, email or city" />
      <button id="searchBtn" type="button">Search</button>
      <div id="users"></div>
      <div id="userDetail"></div>
    </div>
    <div id="tab-reviews" class="card hide">
      <h2>Reviews</h2>
      <div id="reviews"></div>
    </div>
    <div id="tab-exchanges" class="card hide">
      <h2>Exchanges</h2>
      <select id="offerFilter">
        <option value="">All</option>
        <option value="PROPOSED">Proposed</option>
        <option value="COUNTERED">Countered</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="CANCELLED">Cancelled</option>
        <option value="SETTLED">Settled</option>
      </select>
      <div id="exchanges"></div>
    </div>
  </main>
</div>
<dialog id="ticketBox">
  <h2 id="ticketTitle">Ticket</h2>
  <pre id="ticketBody"></pre>
  <textarea id="ticketReply" rows="4" style="width:100%" placeholder="Admin reply"></textarea>
  <div>
    <button id="replyBtn" type="button">Save reply and close</button>
    <button id="closeBoxBtn" type="button">Close</button>
  </div>
</dialog>
<script>
const api = "";
let currentTicket = 0;
function token() { return localStorage.getItem("adminToken") || ""; }
function headers() { return { Authorization: "Bearer " + token(), "Content-Type": "application/json" }; }
function $(id) { return document.getElementById(id); }
function showTab(name) {
  ["tickets","users","exchanges"].forEach(function(id) {
    $("tab-" + id).className = "card" + (id === name ? "" : " hide");
  });
  document.querySelectorAll(".tabs button").forEach(function(el) {
    el.className = el.getAttribute("data-tab") === name ? "on" : "";
  });
}
async function login() {
  $("error").textContent = "Signing in...";
  try {
    const res = await fetch(api + "/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value, password: $("password").value })
    });
    const data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      $("error").textContent = data.message || "Login failed";
      return;
    }
    localStorage.setItem("adminToken", data.token);
    $("login").className = "hide";
    $("app").className = "";
    loadAll();
  } catch (err) {
    $("error").textContent = "Could not reach the server. Wait and try again.";
  }
}
async function forgot() {
  const email = $("email").value.trim();
  if (!email) {
    $("error").textContent = "Enter the admin email first.";
    return;
  }
  $("error").textContent = "Sending reset email...";
  try {
    await fetch(api + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    $("error").textContent = "If this email exists, a reset message was sent.";
  } catch (err) {
    $("error").textContent = "Could not reach the server.";
  }
}
function logout() {
  localStorage.removeItem("adminToken");
  location.reload();
}
async function loadAll() {
  try {
    const probe = await fetch(api + "/admin/stats", { headers: headers() });
    if (probe.status === 401 || probe.status === 403) {
      logout();
      return;
    }
    await Promise.all([loadStats(), loadTickets(), loadUsers(), loadExchanges(), loadReviews()]);
  } catch (err) {
    $("stats").innerHTML = "<p class=error>Could not load the panel. Refresh the page.</p>";
  }
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
}
function stat(label, value) {
  return "<div class=stat><b>" + (value == null ? "-" : value) + "</b>" + label + "</div>";
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
        (row.status !== "closed" ? "<button type=button data-close-ticket=" + row.id + ">Close</button>" : "") +
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
    "<h3>Recent chats</h3>" + table(a.chats || [], ["id","name_a","name_b","last_message","updated_at"]) +
    "<h3>Offers</h3>" + table(a.offers || [], ["id","status","skill_requested","skill_offered","extra_tokens","updated_at"]) +
    "<h3>Tickets</h3>" + table(a.tickets || [], ["id","type","status","created_at"]) +
    "<h3>Reviews</h3>" + table(a.reviews || [], ["id","rating","text","created_at"]) +
    "<h3>Wallet</h3>" + table(a.wallet || [], ["id","type","amount","title","created_at"]);
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
document.addEventListener("click", async function(event) {
  const t = event.target;
  if (!t || !t.getAttribute) return;
  if (t.id === "forgotBtn") return forgot();
  if (t.id === "logoutBtn") return logout();
  if (t.id === "refreshBtn") return loadAll();
  if (t.id === "searchBtn") return loadUsers();
  if (t.id === "replyBtn") return replyTicket();
  if (t.id === "closeBoxBtn") return $("ticketBox").close();
  if (t.getAttribute("data-tab")) return showTab(t.getAttribute("data-tab"));
  if (t.getAttribute("data-open-ticket")) return openTicket(t.getAttribute("data-open-ticket"));
  if (t.getAttribute("data-close-ticket")) { await act("/admin/tickets/" + t.getAttribute("data-close-ticket") + "/close", "POST"); return loadTickets(); }
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
    enforceThrottle(req, 'admin-login', 8, 15 * 60 * 1000);
    return this.adminService.login(body.email, body.password);
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
