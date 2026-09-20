import { Body, Controller, Delete, Get, Header, Param, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

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
<title>Skill4Handel Admin</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; background: #eef2f7; color: #122; }
header { background: #12345a; color: #fff; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
main { padding: 20px; }
.card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.stat { background: #f7f9fc; border-radius: 10px; padding: 12px; }
.stat b { display: block; font-size: 22px; }
input, button, select, textarea { padding: 8px 10px; margin: 4px 4px 4px 0; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
.bad { color: #b42318; }
.hide { display: none; }
.tabs button { border: 0; background: #d9e2ef; border-radius: 8px; padding: 8px 12px; }
.tabs button.on { background: #12345a; color: #fff; }
dialog { border: 0; border-radius: 12px; padding: 20px; width: min(720px, 92vw); }
pre { white-space: pre-wrap; background: #f6f7fb; padding: 12px; border-radius: 8px; }
</style>
</head>
<body>
<div id="login" class="card" style="max-width:420px;margin:80px auto">
  <h2>Skill4Handel Admin</h2>
  <input id="email" placeholder="admin email" style="width:90%" />
  <input id="password" type="password" placeholder="password" style="width:90%" />
  <div>
    <button id="loginBtn" type="button">Enter</button>
    <button id="forgotBtn" type="button">Forgot password</button>
  </div>
  <p id="error" class="bad"></p>
</div>
<div id="app" class="hide">
  <header>
    <h1>Skill4Handel Admin</h1>
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
    const res = await fetch(api + "/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    await res.json().catch(function() { return {}; });
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
    await Promise.all([loadStats(), loadTickets(), loadUsers(), loadExchanges()]);
  } catch (err) {
    $("stats").innerHTML = "<p class=bad>Could not load the panel. Refresh the page.</p>";
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
function ticketTable(rows) {
  if (!Array.isArray(rows)) return "<p class=bad>Could not load</p>";
  if (!rows.length) return "<p>No rows</p>";
  return "<table><tr><th>id</th><th>member</th><th>type</th><th>subject</th><th>status</th><th></th></tr>" +
    rows.map(function(row) {
      return "<tr><td>" + row.id + "</td><td>" + (row.name || "") + "</td><td>" + (row.type || "") +
        "</td><td><button type=button data-open-ticket=" + row.id + ">Open ticket</button></td><td>" +
        (row.status || "open") + "</td><td>" +
        (row.status !== "closed" ? "<button type=button data-close-ticket=" + row.id + ">Close</button>" : "") +
        "</td></tr>";
    }).join("") + "</table>";
}
function userTable(rows) {
  if (!Array.isArray(rows)) return "<p class=bad>Could not load</p>";
  if (!rows.length) return "<p>No rows</p>";
  return "<table><tr><th>id</th><th>name</th><th>email</th><th>city</th><th>balance</th><th>status</th><th></th></tr>" +
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
        (row.balance == null ? "" : row.balance) + "</td><td>" +
        (row.is_suspended ? "suspended" : (row.email_verified ? (row.role || "user") : "unverified")) +
        "</td><td>" + verifyBtn +
        " <button type=button data-password=" + row.id + ">Password</button>" +
        " <button type=button data-wallet=" + row.id + ">Wallet</button> " +
        roleBtn + " " + susBtn + " " + delBtn + "</td></tr>";
    }).join("") + "</table>";
}
function offerTable(rows) {
  if (!Array.isArray(rows)) return "<p class=bad>Could not load</p>";
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
  $("ticketBody").textContent = "Member: " + (row.name || "") + "\nOther: " + (row.other_name || "-") +
    "\nStatus: " + (row.status || "") + "\nCreated: " + (row.created_at || "") + "\n\n" +
    (row.text || "") + "\n" + (row.admin_reply || "");
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
    "<p>Account created: " + (u.created_at || "-") + "<br>Last login: " + (u.last_login || u.updated_at || "-") + "</p>" +
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
  login(@Body() body: { email: string; password: string }) {
    return this.adminService.login(body.email, body.password);
  }

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Get('users')
  users(@Query('q') q?: string) {
    return this.adminService.listUsers(q || '');
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.adminService.getUser(Number(id));
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string) {
    return this.adminService.deleteUser(Number(id));
  }

  @Post('users/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.adminService.setSuspended(Number(id), true);
  }

  @Post('users/:id/unsuspend')
  unsuspend(@Param('id') id: string) {
    return this.adminService.setSuspended(Number(id), false);
  }

  @Post('users/:id/role')
  setRole(@Param('id') id: string, @Body() body: { role: string }) {
    return this.adminService.setRole(Number(id), body.role);
  }

  @Post('users/:id/password')
  setPassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.adminService.setPassword(Number(id), body.password);
  }

  @Post('users/:id/verify')
  verify(@Param('id') id: string) {
    return this.adminService.verifyUser(Number(id));
  }

  @Post('users/:id/wallet')
  wallet(@Param('id') id: string, @Body() body: { amount: number; title?: string }) {
    return this.adminService.adjustWallet(Number(id), Number(body.amount), body.title);
  }

  @Get('tickets')
  tickets(@Query('status') status?: string) {
    return this.adminService.listTickets(status || '');
  }

  @Get('tickets/:id')
  ticket(@Param('id') id: string) {
    return this.adminService.getTicket(Number(id));
  }

  @Post('tickets/:id/close')
  close(@Param('id') id: string) {
    return this.adminService.closeTicket(Number(id));
  }

  @Post('tickets/:id/reply')
  reply(@Param('id') id: string, @Body() body: { text: string }) {
    return this.adminService.replyTicket(Number(id), body.text);
  }

  @Get('exchanges')
  exchanges(@Query('status') status?: string) {
    return this.adminService.listExchanges(status || '');
  }

  @Post('exchanges/:id/cancel')
  cancelOffer(@Param('id') id: string) {
    return this.adminService.cancelExchange(Number(id));
  }
}
