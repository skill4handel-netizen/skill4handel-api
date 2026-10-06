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
  :root { --navy:#102a43; --blue:#1f4e79; --bg:#f6f8fb; --line:#e6edf5; --muted:#66788a; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Segoe UI, Arial, sans-serif; background:var(--bg); color:#172033; font-size:14px; }
  button, input, select, textarea { font:inherit; }
  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#102a43; }
  .login-card { width:min(400px,92vw); background:#fff; border-radius:18px; padding:24px; }
  label { display:block; margin:10px 0 4px; color:var(--muted); font-size:12px; }
  input, select, textarea { width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:10px; }
  button { border:0; border-radius:10px; padding:8px 12px; cursor:pointer; background:#eef3f8; color:var(--navy); }
  .primary { background:var(--navy); color:#fff; }
  .shell { display:grid; grid-template-columns:200px 1fr; min-height:100vh; }
  aside { background:var(--navy); color:#fff; padding:16px; }
  aside h1 { font-size:16px; margin:8px 0; }
  .tabs { display:flex; flex-direction:column; gap:6px; }
  .tabs button { text-align:left; background:transparent; color:#d7e3ef; }
  .tabs button.on { background:#fff; color:var(--navy); }
  main { padding:18px; }
  header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px; }
  .filters { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
  .filters input, .filters select, .filters button { width:auto; }
  .chart { width:100%; height:240px; }
  .axis { font-size:10px; fill:#66788a; }
  table { width:100%; border-collapse:collapse; }
  th, td { border-bottom:1px solid var(--line); padding:7px; text-align:left; font-size:13px; }
  .hide { display:none; }
  .error { color:#b42318; min-height:18px; }
  dialog { border:0; border-radius:14px; width:min(680px,94vw); }
  @media (max-width:800px) { .shell { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div id="login" class="login-wrap">
  <div class="login-card">
    <h1>Skill4Handel Admin</h1>
    <div id="loginForm">
      <label>Email</label><input id="email" type="email" />
      <label>Password</label><input id="password" type="password" />
      <div class="filters"><button id="loginBtn" class="primary" type="button">Sign in</button><button id="forgotBtn" type="button">Reset</button></div>
      <div id="error" class="error"></div>
    </div>
  </div>
</div>
<div id="app" class="shell hide">
  <aside>
    <h1>Admin</h1>
    <div class="tabs">
      <button data-tab="members" class="on" type="button">Members chart</button>
      <button data-tab="offers" type="button">Offers chart</button>
      <button data-tab="skills" type="button">Skills chart</button>
      <button data-tab="cities" type="button">Cities chart</button>
      <button data-tab="tickets" type="button">Tickets</button>
      <button data-tab="users" type="button">Members</button>
      <button data-tab="exchanges" type="button">Exchanges</button>
      <button data-tab="reviews" type="button">Reviews</button>
    </div>
  </aside>
  <main>
    <header><h2 id="pageTitle">Members chart</h2><button id="logoutBtn" type="button">Sign out</button></header>
    <section id="tab-members" class="card"></section>
    <section id="tab-offers" class="card hide"></section>
    <section id="tab-skills" class="card hide"></section>
    <section id="tab-cities" class="card hide"></section>
    <section id="tab-tickets" class="card hide"><select id="ticketFilter"><option value="">All</option><option value="open">Open</option><option value="closed">Closed</option></select><div id="tickets"></div></section>
    <section id="tab-users" class="card hide"><div class="filters"><input id="userQuery" placeholder="Search" /><button id="searchBtn" type="button">Search</button></div><div id="users"></div><div id="userDetail"></div></section>
    <section id="tab-exchanges" class="card hide"><select id="offerFilter"><option value="">All</option><option>PROPOSED</option><option>COUNTERED</option><option>ACCEPTED</option><option>CANCELLED</option><option>SETTLED</option><option>REVIEWED</option></select><div id="exchanges"></div></section>
    <section id="tab-reviews" class="card hide"><div id="reviews"></div></section>
  </main>
</div>
<dialog id="ticketBox"><h3 id="ticketTitle">Ticket</h3><pre id="ticketBody"></pre><textarea id="ticketReply" rows="4"></textarea><div class="filters"><button id="replyBtn" class="primary" type="button">Save reply</button><button id="closeBoxBtn" type="button">Close</button></div></dialog>
<script>
const api=""; let currentTicket=0;
function token(){return localStorage.getItem("adminToken")||"";}
function headers(){return {Authorization:"Bearer "+token(),"Content-Type":"application/json"};}
function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?"":v).replace(/&/g,"&").replace(/</g,"<");}
function showTab(name){
  ["members","offers","skills","cities","tickets","users","exchanges","reviews"].forEach(function(id){
    var el=$("tab-"+id); if(el) el.className="card"+(id===name?"":" hide");
  });
  document.querySelectorAll(".tabs button").forEach(function(el){el.className=el.getAttribute("data-tab")===name?"on":"";});
  $("pageTitle").textContent=name.charAt(0).toUpperCase()+name.slice(1);
  if(["members","offers","skills","cities"].indexOf(name)>=0) loadChart(name);
  if(name==="reviews") loadReviews();
}
function filters(kind){
  return {
    from: ($(kind+"From")||{}).value||"",
    to: ($(kind+"To")||{}).value||"",
    city: ($(kind+"City")||{}).value||"",
    skill: ($(kind+"Skill")||{}).value||"",
    status: ($(kind+"Status")||{}).value||""
  };
}
function chartPage(kind, fields){
  var today=new Date().toISOString().slice(0,10);
  var from=new Date(Date.now()-29*864e5).toISOString().slice(0,10);
  var html="<div class=filters><label>From <input id="+kind+"From type=date value="+from+"></label><label>To <input id="+kind+"To type=date value="+today+"></label>";
  if(fields.indexOf("city")>=0) html+="<input id="+kind+"City placeholder=City />";
  if(fields.indexOf("skill")>=0) html+="<input id="+kind+"Skill placeholder=Skill />";
  if(fields.indexOf("status")>=0) html+="<select id="+kind+"Status><option value=''>Any status</option><option>PROPOSED</option><option>COUNTERED</option><option>ACCEPTED</option><option>CANCELLED</option><option>SETTLED</option><option>REVIEWED</option></select>";
  html+="<button class=primary type=button data-chart="+kind+">Show chart</button><button type=button data-export="+kind+">Export Excel</button></div><div id="+kind+"Chart></div><div id="+kind+"Table></div>";
  $("tab-"+kind).innerHTML=html;
}
function drawChart(kind, data){
  var rows=data.rows||[];
  var max=Math.max.apply(null, rows.map(function(r){return Number(r.count)||0;}).concat([1]));
  var w=760,h=230,pad=28;
  var step=rows.length? (w-pad*2)/rows.length : 1;
  var bars=rows.map(function(r,i){
    var n=Number(r.count)||0;
    var bh=Math.round((n/max)*(h-56));
    var x=pad+i*step+2;
    var y=h-26-bh;
    var label=String(r.label||"");
    var show=rows.length<=16 || i%Math.ceil(rows.length/12)===0;
    return "<rect x="+x+" y="+y+" width="+Math.max(4,step-6)+" height="+Math.max(1,bh)+" fill='#1f4e79'></rect>"+
      "<text class=axis x="+(x+2)+" y="+(y-4)+">"+n+"</text>"+
      (show?"<text class=axis x="+x+" y="+(h-8)+" transform='rotate(35 "+x+" "+(h-8)+")'>"+esc(label)+"</text>":"");
  }).join("");
  $(kind+"Chart").innerHTML="<p>"+esc(data.title)+" from "+esc(data.from)+" to "+esc(data.to)+". Bar height is the count, number is printed above each bar.</p><svg class=chart viewBox='0 0 "+w+" "+h+"'>"+bars+"</svg>";
  $(kind+"Table").innerHTML="<table><tr><th>Label</th><th>Count</th></tr>"+rows.map(function(r){return "<tr><td>"+esc(r.label)+"</td><td>"+r.count+"</td></tr>";}).join("")+"</table>";
}
async function loadChart(kind){
  var q=new URLSearchParams(Object.assign({kind:kind}, filters(kind)));
  var data=await fetch("/admin/chart?"+q.toString(),{headers:headers()}).then(function(r){return r.json();});
  drawChart(kind, data);
}
function downloadCsv(kind){
  var q=new URLSearchParams(Object.assign({kind:kind}, filters(kind)));
  fetch("/admin/export?"+q.toString(),{headers:headers()}).then(function(r){return r.text();}).then(function(text){
    var blob=new Blob([text],{type:"text/csv"});
    var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=kind+".csv"; a.click();
  });
}
async function login(){
  $("error").textContent="Signing in...";
  try{
    localStorage.removeItem("adminToken");
    var res=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("email").value.trim(),password:$("password").value})});
    var data=await res.json().catch(function(){return {};});
    if(!res.ok||!data.token){$("error").textContent=data.message||"Login failed"; return;}
    localStorage.setItem("adminToken", data.token);
    $("login").className="hide"; $("app").className="shell"; loadAll();
  }catch(e){$("error").textContent="Could not reach the server.";}
}
function logout(){localStorage.removeItem("adminToken"); $("app").className="hide"; $("login").className="login-wrap";}
async function loadAll(){
  chartPage("members",["city"]); chartPage("offers",["city","skill","status"]); chartPage("skills",["skill"]); chartPage("cities",["city"]);
  await Promise.all([loadChart("members"), loadTickets(), loadUsers(), loadExchanges(), loadReviews()]);
}
async function loadTickets(){var rows=await fetch("/admin/tickets?status="+$("ticketFilter").value,{headers:headers()}).then(r=>r.json()); $("tickets").innerHTML=ticketTable(rows);}
async function loadUsers(){var rows=await fetch("/admin/users?q="+encodeURIComponent($("userQuery").value||""),{headers:headers()}).then(r=>r.json()); $("users").innerHTML=userTable(rows);}
async function loadExchanges(){var rows=await fetch("/admin/exchanges?status="+$("offerFilter").value,{headers:headers()}).then(r=>r.json()); $("exchanges").innerHTML=offerTable(rows);}
async function loadReviews(){var rows=await fetch("/admin/reviews",{headers:headers()}).then(r=>r.json()); $("reviews").innerHTML=reviewTable(rows);}
function formatTime(v){if(!v)return "-"; var d=new Date(v); return isNaN(d.getTime())?String(v):d.toLocaleString();}
function ticketTable(rows){if(!Array.isArray(rows)||!rows.length)return "<p>No tickets</p>"; return "<table><tr><th>Member</th><th>Type</th><th>Subject</th><th>Status</th><th></th></tr>"+rows.map(function(row){return "<tr><td>"+esc(row.name)+"</td><td>"+esc(row.type)+"</td><td><button data-open-ticket="+row.id+">"+esc(String(row.text||row.subject||"Open").slice(0,70))+"</button></td><td>"+esc(row.status||"open")+"</td><td><button data-close-ticket="+row.id+">Close</button> <button data-delete-ticket="+row.id+">Delete</button></td></tr>";}).join("")+"</table>";}
function userTable(rows){if(!Array.isArray(rows)||!rows.length)return "<p>No members</p>"; return "<table><tr><th>Name</th><th>Email</th><th>City</th><th>Balance</th><th>Status</th><th></th></tr>"+rows.map(function(row){return "<tr><td><button data-open-user="+row.id+">"+esc(row.name)+"</button></td><td>"+esc(row.email)+"</td><td>"+esc(row.city)+"</td><td>"+esc(row.balance)+"</td><td>"+esc(row.role)+(row.is_suspended?" suspended":"")+"</td><td><button data-password="+row.id+">Password</button> <button data-wallet="+row.id+">Wallet</button> "+(row.role==="admin"?"":"<button data-delete-user="+row.id+">Delete</button>")+"</td></tr>";}).join("")+"</table>";}
function offerTable(rows){if(!Array.isArray(rows)||!rows.length)return "<p>No exchanges</p>"; return "<table><tr><th>Members</th><th>Requested</th><th>Offered</th><th>Status</th><th>When</th><th></th></tr>"+rows.map(function(row){return "<tr><td>"+esc(row.name_a)+" / "+esc(row.name_b)+"</td><td>"+esc(row.skill_requested)+"</td><td>"+esc(row.skill_offered)+"</td><td>"+esc(row.status)+"</td><td>"+formatTime(row.created_at)+"</td><td><button data-cancel-offer="+row.id+">Cancel</button></td></tr>";}).join("")+"</table>";}
function reviewTable(rows){if(!Array.isArray(rows)||!rows.length)return "<p>No reviews</p>"; return "<table><tr><th>From</th><th>To</th><th>Stars</th><th>Text</th><th>When</th></tr>"+rows.map(function(row){return "<tr><td>"+esc(row.from_name||row.from_id)+"</td><td>"+esc(row.to_name||row.to_id)+"</td><td>"+esc(row.rating)+"</td><td>"+esc(row.text)+"</td><td>"+formatTime(row.created_at)+"</td></tr>";}).join("")+"</table>";}
async function openTicket(id){currentTicket=id; var row=await fetch("/admin/tickets/"+id,{headers:headers()}).then(r=>r.json()); $("ticketTitle").textContent="Ticket "+id; $("ticketBody").textContent=row.text||""; $("ticketBox").showModal();}
async function replyTicket(){await act("/admin/tickets/"+currentTicket+"/reply","POST",{text:$("ticketReply").value}); $("ticketBox").close(); loadTickets();}
async function openUser(id){var data=await fetch("/admin/users/"+id,{headers:headers()}).then(r=>r.json()); var u=data.user||{}; $("userDetail").innerHTML="<h3>"+esc(u.name)+"</h3><p>"+esc(u.email)+" · "+esc(u.city)+" · created "+formatTime(u.created_at)+" · last login "+formatTime(u.last_login)+"</p><div class=filters><input id=editName value='"+esc(u.name)+"' /><input id=editEmail value='"+esc(u.email)+"' /><input id=editCity value='"+esc(u.city)+"' /><button data-save-user="+u.id+">Save</button></div>";}
async function act(url, method, body){var res=await fetch(url,{method:method,headers:headers(),body:body?JSON.stringify(body):undefined}); var data=await res.json().catch(function(){return {};}); if(!res.ok){alert(data.message||"Request failed"); return false;} return data;}
document.addEventListener("click", async function(event){
  var t=event.target.closest?event.target.closest("button"):event.target; if(!t)return;
  if(t.id==="loginBtn")return login();
  if(t.id==="forgotBtn")return fetch("/admin/recover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("email").value.trim()})}).then(()=>{$("error").textContent="Reset requested.";});
  if(t.id==="logoutBtn")return logout();
  if(t.id==="searchBtn")return loadUsers();
  if(t.id==="replyBtn")return replyTicket();
  if(t.id==="closeBoxBtn")return $("ticketBox").close();
  if(t.getAttribute("data-tab"))return showTab(t.getAttribute("data-tab"));
  if(t.getAttribute("data-chart"))return loadChart(t.getAttribute("data-chart"));
  if(t.getAttribute("data-export"))return downloadCsv(t.getAttribute("data-export"));
  if(t.getAttribute("data-open-ticket"))return openTicket(t.getAttribute("data-open-ticket"));
  if(t.getAttribute("data-close-ticket")){await act("/admin/tickets/"+t.getAttribute("data-close-ticket")+"/close","POST"); return loadTickets();}
  if(t.getAttribute("data-delete-ticket")){if(confirm("Delete this ticket?")){await act("/admin/tickets/"+t.getAttribute("data-delete-ticket"),"DELETE"); loadTickets();}}
  if(t.getAttribute("data-open-user"))return openUser(t.getAttribute("data-open-user"));
  if(t.getAttribute("data-save-user")){await act("/admin/users/"+t.getAttribute("data-save-user"),"POST",{name:$("editName").value,email:$("editEmail").value,city:$("editCity").value}); return openUser(t.getAttribute("data-save-user"));}
  if(t.getAttribute("data-password")){var password=prompt("New password"); if(password) await act("/admin/users/"+t.getAttribute("data-password")+"/password","POST",{password:password});}
  if(t.getAttribute("data-wallet")){var amount=prompt("Amount, for example 10 or -5"); if(amount){var data=await act("/admin/users/"+t.getAttribute("data-wallet")+"/wallet","POST",{amount:Number(amount),title:"Admin adjustment"}); if(data) alert("Balance "+data.balance);}}
  if(t.getAttribute("data-delete-user")){if(confirm("Delete this member?")){await act("/admin/users/"+t.getAttribute("data-delete-user"),"DELETE"); loadUsers();}}
  if(t.getAttribute("data-cancel-offer")){if(confirm("Cancel this offer?")){await act("/admin/exchanges/"+t.getAttribute("data-cancel-offer")+"/cancel","POST"); loadExchanges();}}
});
$("ticketFilter").addEventListener("change", loadTickets);
$("offerFilter").addEventListener("change", loadExchanges);
if(token()){$("login").className="hide"; $("app").className="shell"; loadAll();}
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
