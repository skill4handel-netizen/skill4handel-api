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
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Skill4Handel Admin</title>
<style>
  :root { --navy:#102a43; --ink:#172033; --muted:#66788a; --line:#e6edf5; --bg:#f4f7fb; --blue:#1f4e79; --green:#1f8a4c; --red:#b42318; --gold:#b58100; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Segoe UI, Arial, sans-serif; color:var(--ink); background:var(--bg); font-size:14px; }
  button, input, select, textarea { font:inherit; }
  .login { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(160deg,#102a43,#1f4e79); }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px; box-shadow:0 8px 24px rgba(16,42,67,.04); }
  .login .card { width:min(420px,92vw); }
  h1 { margin:0 0 4px; font-size:22px; }
  .muted { color:var(--muted); }
  label { display:block; margin:12px 0 4px; color:var(--muted); font-size:12px; }
  input, select, textarea { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:#fff; }
  button { border:0; border-radius:10px; padding:9px 12px; cursor:pointer; background:#eef3f8; color:var(--navy); }
  .primary { background:var(--navy); color:#fff; }
  .danger { background:#fdecea; color:var(--red); }
  .ok { background:#e8f7ee; color:var(--green); }
  .shell { display:grid; grid-template-columns:240px 1fr; min-height:100vh; }
  aside { background:var(--navy); color:#fff; padding:18px 14px; }
  aside strong { display:block; font-size:16px; margin-bottom:18px; }
  nav button { display:flex; width:100%; text-align:left; background:transparent; color:#d7e3ef; margin:2px 0; }
  nav button.on { background:#fff; color:var(--navy); font-weight:700; }
  main { padding:22px; }
  header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
  .kpi b { display:block; font-size:26px; margin-top:6px; }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:10px 0; }
  .row input, .row select, .row button { width:auto; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-size:12px; }
  .badge { display:inline-block; border-radius:999px; padding:2px 8px; background:#eef3f8; font-size:12px; }
  .badge.red { background:#fdecea; color:var(--red); }
  .badge.green { background:#e8f7ee; color:var(--green); }
  .hide { display:none; }
  dialog { border:0; border-radius:16px; width:min(860px,96vw); padding:0; }
  dialog form, .pad { padding:16px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .error { color:var(--red); min-height:18px; }
  svg.chart { width:100%; height:240px; background:#fff; }
  @media (max-width:900px) { .shell { grid-template-columns:1fr; } .kpis, .grid2 { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div id="login" class="login">
  <div class="card">
    <h1>Skill4Handel</h1>
    <p class="muted">Administration</p>
    <label>Email</label><input id="email" type="email" />
    <label>Password</label><input id="password" type="password" />
    <div class="row"><button id="loginBtn" class="primary" type="button">Sign in</button><button id="forgotBtn" type="button">Reset password</button></div>
    <div id="error" class="error"></div>
  </div>
</div>
<div id="app" class="shell hide">
  <aside>
    <strong>Skill4Handel Admin</strong>
    <nav>
      <button data-tab="overview" class="on" type="button">Overview</button>
      <button data-tab="members" type="button">Members</button>
      <button data-tab="exchanges" type="button">Exchanges</button>
      <button data-tab="tickets" type="button">Tickets</button>
      <button data-tab="reviews" type="button">Reviews</button>
      <button data-tab="activity" type="button">Activity log</button>
      <button data-tab="charts" type="button">Charts</button>
    </nav>
  </aside>
  <main>
    <header><div><h1 id="title">Overview</h1><div class="muted">All member, exchange, ticket and wallet actions stay available.</div></div><button id="logoutBtn" type="button">Sign out</button></header>
    <section id="tab-overview">
      <div class="kpis" id="kpis"></div>
      <div class="card" id="overviewCharts"></div>
    </section>
    <section id="tab-members" class="hide">
      <div class="card">
        <div class="row"><input id="userQuery" placeholder="Search name, email or city" /><button id="searchBtn" class="primary" type="button">Search</button><button id="exportUsers" type="button">Export Excel</button></div>
        <div id="users"></div>
      </div>
    </section>
    <section id="tab-exchanges" class="hide"><div class="card"><div class="row"><select id="offerFilter"><option value="">All statuses</option><option>PROPOSED</option><option>COUNTERED</option><option>ACCEPTED</option><option>CANCELLED</option><option>SETTLED</option><option>REVIEWED</option></select><button id="exportExchanges" type="button">Export Excel</button></div><div id="exchanges"></div></div></section>
    <section id="tab-tickets" class="hide"><div class="card"><div class="row"><select id="ticketFilter"><option value="">All</option><option value="open">Open</option><option value="closed">Closed</option></select></div><div id="tickets"></div></div></section>
    <section id="tab-reviews" class="hide"><div class="card" id="reviews"></div></section>
    <section id="tab-activity" class="hide"><div class="card"><div class="row"><input id="actFrom" type="date" /><input id="actTo" type="date" /><select id="actKind"><option value="">All events</option><option value="signup">Signups</option><option value="offer">Offers</option><option value="message">Messages</option><option value="review">Reviews</option><option value="ticket">Tickets</option><option value="wallet">Wallet</option><option value="admin">Admin changes</option></select><button id="actBtn" class="primary" type="button">Show</button><button id="actExport" type="button">Export Excel</button></div><div id="activity"></div></div></section>
    <section id="tab-charts" class="hide"><div class="card"><div class="row"><select id="chartKind"><option value="members">Members</option><option value="offers">Offers</option><option value="skills">Skills</option><option value="cities">Cities</option><option value="tickets">Tickets</option><option value="reviews">Reviews</option></select><input id="chartFrom" type="date" /><input id="chartTo" type="date" /><input id="chartCity" placeholder="City" /><input id="chartSkill" placeholder="Skill" /><select id="chartStatus"><option value="">Any status</option><option>PROPOSED</option><option>COUNTERED</option><option>ACCEPTED</option><option>CANCELLED</option><option>SETTLED</option><option>REVIEWED</option></select><button id="chartBtn" class="primary" type="button">Show chart</button><button id="chartExport" type="button">Export Excel</button></div><div id="chartBox"></div></div></section>
  </main>
</div>
<dialog id="userBox"><form method="dialog" class="pad"><h2 id="userTitle">Member</h2><div id="userMeta" class="muted"></div><div class="grid2" id="userFields"></div><div class="row"><button id="saveUser" class="primary" type="button">Save all fields</button><button id="closeUser" type="button">Close</button></div><h3>Activity</h3><pre id="userActivity"></pre></form></dialog>
<dialog id="ticketBox"><form method="dialog" class="pad"><h2 id="ticketTitle">Ticket</h2><pre id="ticketBody"></pre><textarea id="ticketReply" rows="4" placeholder="Reply"></textarea><div class="row"><button id="replyBtn" class="primary" type="button">Save reply</button><button id="closeTicketBtn" type="button">Close</button></div></form></dialog>
<script>
const titles = {overview:"Overview", members:"Members", exchanges:"Exchanges", tickets:"Tickets", reviews:"Reviews", activity:"Activity log", charts:"Charts"};
let currentUser = 0, currentTicket = 0;
function token(){ return localStorage.getItem("adminToken") || ""; }
function headers(){ return { Authorization:"Bearer " + token(), "Content-Type":"application/json" }; }
function $(id){ return document.getElementById(id); }
function esc(v){ return String(v == null ? "" : v).replace(/&/g,"&").replace(/</g,"<"); }
function when(v){ if(!v) return "-"; const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleString(); }
function show(name){
  Object.keys(titles).forEach(function(id){ $("tab-"+id).className = id===name ? "" : "hide"; });
  document.querySelectorAll("nav button").forEach(function(el){ el.className = el.getAttribute("data-tab")===name ? "on" : ""; });
  $("title").textContent = titles[name];
  if(name==="overview") loadOverview();
  if(name==="members") loadUsers();
  if(name==="exchanges") loadExchanges();
  if(name==="tickets") loadTickets();
  if(name==="reviews") loadReviews();
  if(name==="activity") loadActivity();
  if(name==="charts") loadChart();
}
async function api(url, method, body){
  const res = await fetch(url, { method:method||"GET", headers:headers(), body:body?JSON.stringify(body):undefined });
  const data = await res.json().catch(function(){ return {}; });
  if(!res.ok){ alert(data.message || "Request failed"); return null; }
  return data;
}
function download(kind, extra){
  const q = new URLSearchParams(Object.assign({kind:kind}, extra||{}));
  fetch("/admin/export?"+q.toString(), {headers:headers()}).then(r=>r.text()).then(function(text){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], {type:"text/csv"}));
    a.download = kind + ".csv";
    a.click();
  });
}
async function login(){
  $("error").textContent = "Signing in...";
  try {
    localStorage.removeItem("adminToken");
    const res = await fetch("/admin/login", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:$("email").value.trim(), password:$("password").value})});
    const data = await res.json().catch(function(){ return {}; });
    if(!res.ok || !data.token){ $("error").textContent = data.message || "Login failed"; return; }
    localStorage.setItem("adminToken", data.token);
    $("login").className = "hide"; $("app").className = "shell"; show("overview");
  } catch(e){ $("error").textContent = "Could not reach the server."; }
}
function bars(rows){
  rows = rows || [];
  if(!rows.length) return "<p>No data for this filter.</p>";
  const max = Math.max.apply(null, rows.map(r=>Number(r.count)||0).concat([1]));
  const w = 760, h = 230, pad = 28, step = (w-pad*2)/rows.length;
  const marks = rows.map(function(r,i){
    const n = Number(r.count)||0, bh = Math.round(n/max*(h-58)), x = pad+i*step+2, y = h-26-bh;
    const label = String(r.label||"");
    const showLabel = rows.length<=16 || i%Math.ceil(rows.length/12)===0;
    return "<rect x="+x+" y="+y+" width="+Math.max(4,step-6)+" height="+Math.max(1,bh)+" fill='#1f4e79'></rect><text font-size='10' fill='#66788a' x="+(x+2)+" y="+(y-4)+">"+n+"</text>"+(showLabel?"<text font-size='10' fill='#66788a' x="+x+" y="+(h-8)+">"+esc(label).slice(0,12)+"</text>":"");
  }).join("");
  return "<svg class='chart' viewBox='0 0 "+w+" "+h+"'>"+marks+"</svg><table><tr><th>Label</th><th>Count</th></tr>"+rows.map(r=>"<tr><td>"+esc(r.label)+"</td><td>"+r.count+"</td></tr>").join("")+"</table>";
}
async function loadOverview(){
  const s = await api("/admin/stats"); if(!s) return;
  const u = s.users||{}, t = s.tickets||{}, o = s.offers||{};
  $("kpis").innerHTML = [["Members",u.total],["Verified",u.verified],["Suspended",u.suspended],["Open tickets",t.open],["Pending offers",o.pending],["Accepted",o.accepted],["Completed",o.completed],["Admins",u.admins]].map(function(item){return "<div class='card'><span class='muted'>"+item[0]+"</span><b>"+(item[1]||0)+"</b></div>";}).join("");
  const c = s.charts||{};
  $("overviewCharts").innerHTML = "<h3>New members</h3>"+bars((c.signups||[]).map(r=>({label:r.day,count:r.count})))+"<h3>Offers by status</h3>"+bars((c.offers||[]).map(r=>({label:r.status,count:r.count})));
}
async function loadUsers(){
  const rows = await api("/admin/users?q="+encodeURIComponent($("userQuery").value||"")); if(!rows) return;
  $("users").innerHTML = !rows.length ? "<p>No members.</p>" : "<table><tr><th>Name</th><th>Email</th><th>City</th><th>Balance</th><th>Status</th><th>Actions</th></tr>"+rows.map(function(row){
    const role = row.role==="admin" ? "<button data-role-user='"+row.id+"'>Make member</button>" : "<button data-role-admin='"+row.id+"'>Make admin</button>";
    const sus = row.is_suspended ? "<button data-unsuspend='"+row.id+"'>Unsuspend</button>" : "<button data-suspend='"+row.id+"'>Suspend</button>";
    return "<tr><td><button data-open-user='"+row.id+"'>"+esc(row.name)+"</button></td><td>"+esc(row.email)+"</td><td>"+esc(row.city)+"</td><td>"+esc(row.balance)+"</td><td><span class='badge "+(row.is_suspended?"red":"green")+"'>"+esc(row.role)+(row.is_suspended?" suspended":"")+(row.email_verified?"":" unverified")+"</span></td><td>"+role+" "+sus+" <button data-verify='"+row.id+"'>Verify</button> <button data-password='"+row.id+"'>Password</button> <button data-wallet='"+row.id+"'>Wallet</button> "+(row.role==="admin"?"":"<button class='danger' data-delete-user='"+row.id+"'>Delete</button>")+"</td></tr>";
  }).join("")+"</table>";
}
function field(id,label,value){ return "<label>"+label+"<input id='"+id+"' value='"+esc(value)+"'></label>"; }
async function openUser(id){
  currentUser = id;
  const data = await api("/admin/users/"+id); if(!data) return;
  const u = data.user||{};
  $("userTitle").textContent = u.name || "Member";
  $("userMeta").textContent = "Created "+when(u.created_at)+" · last login "+when(u.last_login)+" · balance "+(u.balance||0)+" · rating "+(u.rating||0);
  $("userFields").innerHTML = field("editName","Name",u.name)+field("editEmail","Email",u.email)+field("editCity","City",u.city)+field("editPhone","Phone",u.phone)+field("editLang","Language",u.language||"en")+field("editBirth","Birth date",String(u.birth_date||"").slice(0,10))+field("editAge","Age",u.age)+field("editGender","Gender",u.gender)+field("editPhoto","Photo URL",u.photo_url)+field("editOffers","Skills offered",u.offers)+field("editNeeds","Skills needed",u.needs)+field("editBio","Bio",u.bio);
  $("userActivity").textContent = JSON.stringify(data.activity||{}, null, 2);
  $("userBox").showModal();
}
async function loadExchanges(){
  const rows = await api("/admin/exchanges?status="+$("offerFilter").value); if(!rows) return;
  $("exchanges").innerHTML = !rows.length ? "<p>No exchanges.</p>" : "<table><tr><th>Members</th><th>Requested</th><th>Offered</th><th>Tokens</th><th>Status</th><th>When</th><th></th></tr>"+rows.map(r=>"<tr><td>"+esc(r.name_a)+" / "+esc(r.name_b)+"</td><td>"+esc(r.skill_requested)+"</td><td>"+esc(r.skill_offered)+"</td><td>"+esc(r.extra_tokens)+"</td><td><span class='badge'>"+esc(r.status)+"</span></td><td>"+when(r.created_at)+"</td><td><button class='danger' data-cancel-offer='"+r.id+"'>Cancel</button></td></tr>").join("")+"</table>";
}
async function loadTickets(){
  const rows = await api("/admin/tickets?status="+$("ticketFilter").value); if(!rows) return;
  $("tickets").innerHTML = !rows.length ? "<p>No tickets.</p>" : "<table><tr><th>Member</th><th>Type</th><th>Subject</th><th>Status</th><th></th></tr>"+rows.map(r=>"<tr><td>"+esc(r.name)+"</td><td>"+esc(r.type)+"</td><td><button data-open-ticket='"+r.id+"'>"+esc(String(r.text||r.subject||"Open").slice(0,80))+"</button></td><td><span class='badge'>"+esc(r.status||"open")+"</span></td><td><button data-close-ticket='"+r.id+"'>Close</button> <button class='danger' data-delete-ticket='"+r.id+"'>Delete</button></td></tr>").join("")+"</table>";
}
async function loadReviews(){
  const rows = await api("/admin/reviews"); if(!rows) return;
  $("reviews").innerHTML = !rows.length ? "<p>No reviews.</p>" : "<table><tr><th>From</th><th>To</th><th>Stars</th><th>Text</th><th>When</th></tr>"+rows.map(r=>"<tr><td>"+esc(r.from_name||r.from_id)+"</td><td>"+esc(r.to_name||r.to_id)+"</td><td>"+esc(r.rating)+"</td><td>"+esc(r.text)+"</td><td>"+when(r.created_at)+"</td></tr>").join("")+"</table>";
}
async function loadActivity(){
  const q = new URLSearchParams({kind:$("actKind").value, from:$("actFrom").value, to:$("actTo").value});
  const rows = await api("/admin/events?"+q.toString()); if(!rows) return;
  $("activity").innerHTML = !rows.length ? "<p>No events in this filter.</p>" : "<table><tr><th>When</th><th>Type</th><th>Who</th><th>Detail</th></tr>"+rows.map(r=>"<tr><td>"+when(r.when)+"</td><td><span class='badge'>"+esc(r.type)+"</span></td><td>"+esc(r.who)+"</td><td>"+esc(r.detail)+"</td></tr>").join("")+"</table>";
}
async function loadChart(){
  const q = new URLSearchParams({kind:$("chartKind").value, from:$("chartFrom").value, to:$("chartTo").value, city:$("chartCity").value, skill:$("chartSkill").value, status:$("chartStatus").value});
  const data = await api("/admin/chart?"+q.toString()); if(!data) return;
  $("chartBox").innerHTML = "<h3>"+esc(data.title)+" · "+esc(data.from)+" to "+esc(data.to)+"</h3>"+bars(data.rows);
}
async function openTicket(id){ currentTicket=id; const row=await api("/admin/tickets/"+id); if(!row) return; $("ticketTitle").textContent="Ticket "+id; $("ticketBody").textContent=row.text||""; $("ticketBox").showModal(); }
document.addEventListener("click", async function(event){
  const t = event.target.closest ? event.target.closest("button") : event.target; if(!t) return;
  if(t.id==="loginBtn") return login();
  if(t.id==="forgotBtn") return fetch("/admin/recover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("email").value.trim()})}).then(()=>{$("error").textContent="Reset requested.";});
  if(t.id==="logoutBtn"){ localStorage.removeItem("adminToken"); location.reload(); }
  if(t.getAttribute("data-tab")) return show(t.getAttribute("data-tab"));
  if(t.id==="searchBtn") return loadUsers();
  if(t.id==="exportUsers") return download("users");
  if(t.id==="exportExchanges") return download("exchanges");
  if(t.id==="actBtn") return loadActivity();
  if(t.id==="actExport") return download("events", {from:$("actFrom").value,to:$("actTo").value});
  if(t.id==="chartBtn") return loadChart();
  if(t.id==="chartExport") return download($("chartKind").value, {from:$("chartFrom").value,to:$("chartTo").value,city:$("chartCity").value,skill:$("chartSkill").value,status:$("chartStatus").value});
  if(t.id==="closeUser") return $("userBox").close();
  if(t.id==="closeTicketBtn") return $("ticketBox").close();
  if(t.id==="saveUser"){ await api("/admin/users/"+currentUser,"POST",{name:$("editName").value,email:$("editEmail").value,city:$("editCity").value,phone:$("editPhone").value,language:$("editLang").value,birthDate:$("editBirth").value,age:$("editAge").value,gender:$("editGender").value,photoUrl:$("editPhoto").value,offers:$("editOffers").value,needs:$("editNeeds").value,bio:$("editBio").value}); return openUser(currentUser); }
  if(t.id==="replyBtn"){ await api("/admin/tickets/"+currentTicket+"/reply","POST",{text:$("ticketReply").value}); $("ticketBox").close(); return loadTickets(); }
  if(t.getAttribute("data-open-user")) return openUser(t.getAttribute("data-open-user"));
  if(t.getAttribute("data-role-user")){ await api("/admin/users/"+t.getAttribute("data-role-user")+"/role","POST",{role:"user"}); return loadUsers(); }
  if(t.getAttribute("data-role-admin")){ await api("/admin/users/"+t.getAttribute("data-role-admin")+"/role","POST",{role:"admin"}); return loadUsers(); }
  if(t.getAttribute("data-suspend")){ await api("/admin/users/"+t.getAttribute("data-suspend")+"/suspend","POST"); return loadUsers(); }
  if(t.getAttribute("data-unsuspend")){ await api("/admin/users/"+t.getAttribute("data-unsuspend")+"/unsuspend","POST"); return loadUsers(); }
  if(t.getAttribute("data-verify")){ await api("/admin/users/"+t.getAttribute("data-verify")+"/verify","POST"); return loadUsers(); }
  if(t.getAttribute("data-password")){ const password=prompt("New password"); if(password) await api("/admin/users/"+t.getAttribute("data-password")+"/password","POST",{password:password}); }
  if(t.getAttribute("data-wallet")){ const amount=prompt("Amount, for example 10 or -5"); if(amount){ const data=await api("/admin/users/"+t.getAttribute("data-wallet")+"/wallet","POST",{amount:Number(amount),title:"Admin adjustment"}); if(data) alert("Balance "+data.balance);} }
  if(t.getAttribute("data-delete-user")){ if(confirm("Delete this member?")){ await api("/admin/users/"+t.getAttribute("data-delete-user"),"DELETE"); loadUsers(); } }
  if(t.getAttribute("data-open-ticket")) return openTicket(t.getAttribute("data-open-ticket"));
  if(t.getAttribute("data-close-ticket")){ await api("/admin/tickets/"+t.getAttribute("data-close-ticket")+"/close","POST"); return loadTickets(); }
  if(t.getAttribute("data-delete-ticket")){ if(confirm("Delete this ticket?")){ await api("/admin/tickets/"+t.getAttribute("data-delete-ticket"),"DELETE"); loadTickets(); } }
  if(t.getAttribute("data-cancel-offer")){ if(confirm("Cancel this offer?")){ await api("/admin/exchanges/"+t.getAttribute("data-cancel-offer")+"/cancel","POST"); loadExchanges(); } }
});
$("ticketFilter").addEventListener("change", loadTickets);
$("offerFilter").addEventListener("change", loadExchanges);
if(token()){ $("login").className="hide"; $("app").className="shell"; show("overview"); }
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

  @Get('chart')
  chart(@Req() req: any, @Query() query: Record<string, string>) {
    requireAdmin(req);
    return this.adminService.chart(query.kind || 'members', query);
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

  @Get('events')
  events(@Req() req: any, @Query() query: Record<string, string>) {
    requireAdmin(req);
    return this.adminService.events(query);
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
