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
    h1,h2,h3 { margin: 0 0 12px; }
    .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .stat { background: #f7f9fc; border-radius: 10px; padding: 12px; }
    .stat b { display: block; font-size: 22px; }
    input, button, select { padding: 8px 10px; margin: 4px 4px 4px 0; }
    button { cursor: pointer; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
    .bad { color: #b42318; }
    .ok { color: #067647; }
    a { color: #1b4f8a; }
    .tabs button { border: 0; background: #d9e2ef; border-radius: 8px; }
    .tabs button.on { background: #12345a; color: #fff; }
    dialog { border: 0; border-radius: 12px; padding: 20px; width: min(720px, 92vw); }
    dialog::backdrop { background: rgba(0,0,0,.35); }
    pre { white-space: pre-wrap; background: #f6f7fb; padding: 12px; border-radius: 8px; }
    .hide { display: none; }
  </style>
</head>
<body>
  <div id="login" class="card" style="max-width:420px;margin:80px auto">
    <h2>Skill4Handel Admin</h2>
    <input id="email" placeholder="admin email" style="width:90%" />
    <input id="password" type="password" placeholder="password" style="width:90%" />
    <div><button onclick="login()">Enter</button></div>
    <p id="error" class="bad"></p>
  </div>
  <div id="app" class="hide">
    <header>
      <h1>Skill4Handel Admin</h1>
      <div>
        <button onclick="loadAll()">Refresh</button>
        <button onclick="logout()">Logout</button>
      </div>
    </header>
    <main>
      <div class="card grid" id="stats"></div>
      <div class="card tabs">
        <button class="on" onclick="showTab('tickets', this)">Tickets</button>
        <button onclick="showTab('users', this)">Users</button>
        <button onclick="showTab('exchanges', this)">Exchanges</button>
      </div>
      <div id="tab-tickets" class="card">
        <h2>Tickets</h2>
        <select id="ticketFilter" onchange="loadTickets()">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <div id="tickets"></div>
      </div>
      <div id="tab-users" class="card hide">
        <h2>Users</h2>
        <input id="userQuery" placeholder="Search name, email or city" />
        <button onclick="loadUsers()">Search</button>
        <div id="users"></div>
        <div id="userDetail"></div>
      </div>
      <div id="tab-exchanges" class="card hide">
        <h2>Exchanges</h2>
        <select id="offerFilter" onchange="loadExchanges()">
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
      <button onclick="replyTicket()">Save reply and close</button>
      <button onclick="document.getElementById('ticketBox').close()">Close</button>
    </div>
  </dialog>
<script>
const api = '';
let currentTicket = 0;
function token() { return localStorage.getItem('adminToken') || ''; }
function headers() { return { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }; }
function showTab(name, btn) {
  ['tickets','users','exchanges'].forEach(id => {
    document.getElementById('tab-' + id).className = 'card' + (id === name ? '' : ' hide');
  });
  document.querySelectorAll('.tabs button').forEach(el => el.classList.remove('on'));
  if (btn) btn.classList.add('on');
}
async function login() {
  document.getElementById('error').textContent = '';
  const res = await fetch(api + '/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    })
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('error').textContent = data.message || 'Login failed';
    return;
  }
  localStorage.setItem('adminToken', data.token);
  document.getElementById('login').className = 'hide';
  document.getElementById('app').className = '';
  loadAll();
}
function logout() {
  localStorage.removeItem('adminToken');
  location.reload();
}
async function loadAll() {
  await Promise.all([loadStats(), loadTickets(), loadUsers(), loadExchanges()]);
}
async function loadStats() {
  const s = await fetch(api + '/admin/stats', { headers: headers() }).then(r => r.json());
  document.getElementById('stats').innerHTML =
    stat('Users', s.users && s.users.total) +
    stat('Verified', s.users && s.users.verified) +
    stat('Suspended', s.users && s.users.suspended) +
    stat('Open tickets', s.tickets && s.tickets.open) +
    stat('Pending offers', s.offers && s.offers.pending) +
    stat('Completed offers', s.offers && s.offers.completed);
}
function stat(label, value) {
  return '<div class="stat"><b>'+ (value ?? '-') +'</b>'+ label +'</div>';
}
async function loadTickets() {
  const status = document.getElementById('ticketFilter').value;
  const rows = await fetch(api + '/admin/tickets?status=' + status, { headers: headers() }).then(r => r.json());
  document.getElementById('tickets').innerHTML = ticketTable(rows);
}
async function loadUsers() {
  const q = document.getElementById('userQuery').value || '';
  const rows = await fetch(api + '/admin/users?q=' + encodeURIComponent(q), { headers: headers() }).then(r => r.json());
  document.getElementById('users').innerHTML = userTable(rows);
}
async function loadExchanges() {
  const status = document.getElementById('offerFilter').value;
  const rows = await fetch(api + '/admin/exchanges?status=' + status, { headers: headers() }).then(r => r.json());
  document.getElementById('exchanges').innerHTML = offerTable(rows);
}
function ticketTable(rows) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr><th>id</th><th>member</th><th>type</th><th>subject</th><th>status</th><th></th></tr>' +
    rows.map(row => '<tr>' +
      '<td>'+row.id+'</td>' +
      '<td>'+(row.name||'')+'</td>' +
      '<td>'+(row.type||'')+'</td>' +
      '<td><a href="#" onclick="openTicket('+row.id+');return false;">Open ticket</a></td>' +
      '<td>'+(row.status||'open')+'</td>' +
      '<td>'+(row.status !== 'closed' ? '<button onclick="closeTicket('+row.id+')">Close</button>' : '')+'</td>' +
    '</tr>').join('') + '</table>';
}
function userTable(rows) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr><th>id</th><th>name</th><th>email</th><th>city</th><th>balance</th><th>status</th><th></th></tr>' +
    rows.map(row => {
      const roleBtn = row.role === 'admin'
        ? '<button onclick="setRole('+row.id+', \\'user\\')">Make user</button>'
        : '<button onclick="setRole('+row.id+', \\'admin\\')">Make admin</button>';
      const susBtn = row.role === 'admin' ? '' : (row.is_suspended
        ? '<button onclick="setUser('+row.id+', false)">Unsuspend</button>'
        : '<button onclick="setUser('+row.id+', true)">Suspend</button>');
      const delBtn = row.role === 'admin' ? '' : '<button onclick="deleteUser('+row.id+', \\''+String(row.name||'').replace(/'/g,'')+'\\')">Delete</button>';
      const verifyBtn = row.email_verified ? '' : '<button onclick="verifyUser('+row.id+')">Verify email</button>';
      return '<tr>' +
        '<td>'+row.id+'</td>' +
        '<td><a href="#" onclick="openUser('+row.id+');return false;">'+(row.name||'')+'</a></td>' +
        '<td>'+(row.email||'')+'</td>' +
        '<td>'+(row.city||'')+'</td>' +
        '<td>'+(row.balance??'')+'</td>' +
        '<td>'+(row.is_suspended ? 'suspended' : (row.email_verified ? (row.role||'user') : 'unverified'))+'</td>' +
        '<td>'+verifyBtn+' <button onclick="setPassword('+row.id+')">Password</button> <button onclick="adjustWallet('+row.id+')">Wallet</button> '+roleBtn+' '+susBtn+' '+delBtn+'</td>' +
      '</tr>';
    }).join('') + '</table>';
}
function offerTable(rows) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr><th>id</th><th>from</th><th>to</th><th>requested</th><th>status</th><th>tokens</th><th></th></tr>' +
    rows.map(row => '<tr>' +
      '<td>'+row.id+'</td>' +
      '<td>'+(row.name_a||'')+'</td>' +
      '<td>'+(row.name_b||'')+'</td>' +
      '<td>'+(row.skill_requested||'')+'</td>' +
      '<td>'+(row.status||'')+'</td>' +
      '<td>'+(row.extra_tokens??'')+'</td>' +
      '<td>'+(['PROPOSED','COUNTERED','ACCEPTED'].includes(row.status) ? '<button onclick="cancelOffer('+row.id+')">Cancel</button>' : '')+'</td>' +
    '</tr>').join('') + '</table>';
}
function table(rows, keys) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr>' + keys.map(k => '<th>'+k+'</th>').join('') + '</tr>' +
    rows.map(row => '<tr>' + keys.map(k => '<td>'+String(row[k] ?? '')+'</td>').join('') + '</tr>').join('') + '</table>';
}
async function openTicket(id) {
  currentTicket = id;
  const row = await fetch(api + '/admin/tickets/' + id, { headers: headers() }).then(r => r.json());
  document.getElementById('ticketTitle').textContent = 'Ticket #' + row.id + ' · ' + (row.type||'') + ' · ' + (row.name||'');
  document.getElementById('ticketBody').textContent =
    'Member: ' + (row.name||'') + '\nOther: ' + (row.other_name||'-') + '\nStatus: ' + (row.status||'') +
    '\nCreated: ' + (row.created_at||'') + '\n\n' + (row.text||'') + '\n' + (row.admin_reply||'');
  document.getElementById('ticketReply').value = '';
  document.getElementById('ticketBox').showModal();
}
async function replyTicket() {
  const text = document.getElementById('ticketReply').value;
  if (!text.trim() || !currentTicket) return;
  await fetch(api + '/admin/tickets/' + currentTicket + '/reply', {
    method: 'POST', headers: headers(), body: JSON.stringify({ text })
  });
  document.getElementById('ticketBox').close();
  loadTickets();
}
async function openUser(id) {
  const data = await fetch(api + '/admin/users/' + id, { headers: headers() }).then(r => r.json());
  const u = data.user || {};
  const a = data.activity || {};
  const box = document.getElementById('userDetail');
  box.innerHTML =
    '<h3>'+(u.name||'')+'</h3>' +
    '<p>Email: '+(u.email||'')+'<br>City: '+(u.city||'')+'<br>Role: '+(u.role||'')+'<br>Balance: '+(u.balance??'')+'<br>Rating: '+(u.rating??'')+'</p>' +
    '<p>Account created: '+(u.created_at||'-')+'<br>Last login: '+(u.last_login||u.updated_at||'-')+'</p>' +
    '<p>Skills offered: '+(u.offers||'-')+'</p>' +
    '<h3>Recent chats</h3>' + table(a.chats||[], ['id','name_a','name_b','last_message','updated_at']) +
    '<h3>Offers</h3>' + table(a.offers||[], ['id','status','skill_requested','skill_offered','extra_tokens','updated_at']) +
    '<h3>Tickets</h3>' + table(a.tickets||[], ['id','type','status','created_at']) +
    '<h3>Reviews</h3>' + table(a.reviews||[], ['id','rating','text','created_at']) +
    '<h3>Wallet</h3>' + table(a.wallet||[], ['id','type','amount','title','created_at']);
  box.scrollIntoView({ behavior: 'smooth' });
}
async function closeTicket(id) {
  await fetch(api + '/admin/tickets/' + id + '/close', { method: 'POST', headers: headers() });
  loadTickets();
}
async function setUser(id, suspended) {
  await fetch(api + '/admin/users/' + id + '/' + (suspended ? 'suspend' : 'unsuspend'), { method: 'POST', headers: headers() });
  loadUsers();
}
async function setRole(id, role) {
  await fetch(api + '/admin/users/' + id + '/role', { method: 'POST', headers: headers(), body: JSON.stringify({ role }) });
  loadUsers();
}
async function setPassword(id) {
  const password = prompt('New password');
  if (!password) return;
  await fetch(api + '/admin/users/' + id + '/password', { method: 'POST', headers: headers(), body: JSON.stringify({ password }) });
  alert('Password updated');
}
async function verifyUser(id) {
  await fetch(api + '/admin/users/' + id + '/verify', { method: 'POST', headers: headers() });
  loadUsers();
}
async function adjustWallet(id) {
  const amount = prompt('Amount. Use +10 to add or -5 to remove.');
  if (!amount) return;
  const title = prompt('Note') || 'Admin adjustment';
  const res = await fetch(api + '/admin/users/' + id + '/wallet', {
    method: 'POST', headers: headers(), body: JSON.stringify({ amount: Number(amount), title })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.message || 'Could not update wallet');
    return;
  }
  alert('New balance: ' + data.balance);
  loadUsers();
}
async function cancelOffer(id) {
  if (!confirm('Cancel this offer as support?')) return;
  const res = await fetch(api + '/admin/exchanges/' + id + '/cancel', { method: 'POST', headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || 'Could not cancel');
    return;
  }
  loadExchanges();
}
async function deleteUser(id, name) {
  if (!confirm('Delete ' + name + ' and all related chats, offers and tickets?')) return;
  const res = await fetch(api + '/admin/users/' + id, { method: 'DELETE', headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || 'Could not delete');
    return;
  }
  document.getElementById('userDetail').innerHTML = '';
  loadUsers();
}
if (token()) {
  document.getElementById('login').className = 'hide';
  document.getElementById('app').className = '';
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
