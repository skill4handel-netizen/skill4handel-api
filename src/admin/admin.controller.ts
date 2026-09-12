import { Body, Controller, Delete, Get, Header, Param, Post } from '@nestjs/common';
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
    body { font-family: Arial, sans-serif; margin: 24px; background: #f4f6fb; color: #111; }
    h1,h2 { margin: 0 0 12px; }
    .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    input, button { padding: 8px 10px; margin: 4px 4px 4px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
    .bad { color: #b42318; }
    a { color: #1b4f8a; }
    dialog { border: 0; border-radius: 12px; padding: 20px; width: min(720px, 92vw); }
    dialog::backdrop { background: rgba(0,0,0,.35); }
    pre { white-space: pre-wrap; background: #f6f7fb; padding: 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Skill4Handel Admin</h1>
  <div id="login" class="card">
    <h2>Login</h2>
    <input id="email" placeholder="admin email" />
    <input id="password" type="password" placeholder="password" />
    <button onclick="login()">Enter</button>
    <p id="error" class="bad"></p>
  </div>
  <div id="panel" style="display:none">
    <div class="card">
      <button onclick="loadAll()">Refresh</button>
      <button onclick="logout()">Logout</button>
    </div>
    <div class="card">
      <h2>Tickets</h2>
      <div id="tickets"></div>
    </div>
    <div class="card">
      <h2>Users</h2>
      <div id="users"></div>
    </div>
    <div id="userDetail" class="card" style="display:none"></div>
    <div class="card">
      <h2>Exchanges</h2>
      <div id="exchanges"></div>
    </div>
  </div>
  <dialog id="ticketBox">
    <h2 id="ticketTitle">Ticket</h2>
    <pre id="ticketBody"></pre>
    <button onclick="document.getElementById('ticketBox').close()">Close</button>
  </dialog>
<script>
const api = '';
function token() { return localStorage.getItem('adminToken') || ''; }
function headers() { return { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }; }
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
  document.getElementById('login').style.display = 'none';
  document.getElementById('panel').style.display = 'block';
  loadAll();
}
function logout() {
  localStorage.removeItem('adminToken');
  location.reload();
}
async function loadAll() {
  const [tickets, users, exchanges] = await Promise.all([
    fetch(api + '/admin/tickets', { headers: headers() }).then(r => r.json()),
    fetch(api + '/admin/users', { headers: headers() }).then(r => r.json()),
    fetch(api + '/admin/exchanges', { headers: headers() }).then(r => r.json())
  ]);
  document.getElementById('tickets').innerHTML = ticketTable(tickets);
  document.getElementById('users').innerHTML = userTable(users);
  document.getElementById('exchanges').innerHTML = table(exchanges, [
    'id','name_a','name_b','skill_requested','status','pay_with_tokens','extra_tokens','settled'
  ]);
}
function ticketTable(rows) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr><th>id</th><th>member</th><th>type</th><th>subject</th><th>status</th><th>created</th><th></th></tr>' +
    rows.map(row => '<tr>' +
      '<td>'+row.id+'</td>' +
      '<td>'+(row.name||'')+'</td>' +
      '<td>'+(row.type||'')+'</td>' +
      '<td><a href="#" onclick="openTicket('+row.id+');return false;">Open ticket</a></td>' +
      '<td>'+(row.status||'')+'</td>' +
      '<td>'+(row.created_at||'')+'</td>' +
      '<td>'+(row.status !== 'closed' ? '<button onclick="closeTicket('+row.id+')">Close</button>' : '')+'</td>' +
    '</tr>').join('') + '</table>';
}
function userTable(rows) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr><th>id</th><th>name</th><th>email</th><th>city</th><th>balance</th><th>rating</th><th>status</th><th></th></tr>' +
    rows.map(row => {
      const roleBtn = row.role === 'admin'
        ? '<button onclick="setRole('+row.id+', \\'user\\')">Make user</button>'
        : '<button onclick="setRole('+row.id+', \\'admin\\')">Make admin</button>';
      const passBtn = '<button onclick="setPassword('+row.id+')">Password</button>';
      const susBtn = row.role === 'admin' ? '' : (row.is_suspended
        ? '<button onclick="setUser('+row.id+', false)">Unsuspend</button>'
        : '<button onclick="setUser('+row.id+', true)">Suspend</button>');
      const delBtn = row.role === 'admin' ? '' : '<button onclick="deleteUser('+row.id+', \\''+String(row.name||'').replace(/'/g,'')+'\\')">Delete</button>';
      return '<tr>' +
        '<td>'+row.id+'</td>' +
        '<td><a href="#" onclick="openUser('+row.id+');return false;">'+(row.name||'')+'</a></td>' +
        '<td>'+(row.email||'')+'</td>' +
        '<td>'+(row.city||'')+'</td>' +
        '<td>'+(row.balance??'')+'</td>' +
        '<td>'+(row.rating??'')+'</td>' +
        '<td>'+(row.is_suspended ? 'suspended' : (row.role||'user'))+'</td>' +
        '<td>'+roleBtn+' '+passBtn+' '+susBtn+' '+delBtn+'</td>' +
      '</tr>';
    }).join('') + '</table>';
}
function table(rows, keys) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr>' + keys.map(k => '<th>'+k+'</th>').join('') + '</tr>' +
    rows.map(row => '<tr>' + keys.map(k => '<td>'+String(row[k] ?? '')+'</td>').join('') + '</tr>').join('') + '</table>';
}
async function openTicket(id) {
  const row = await fetch(api + '/admin/tickets/' + id, { headers: headers() }).then(r => r.json());
  document.getElementById('ticketTitle').textContent = 'Ticket #' + row.id + ' · ' + (row.type||'') + ' · ' + (row.name||'');
  document.getElementById('ticketBody').textContent =
    'Member: ' + (row.name||'') + '\\nOther: ' + (row.other_name||'-') + '\\nStatus: ' + (row.status||'') +
    '\\nCreated: ' + (row.created_at||'') + '\\n\\n' + (row.text||'');
  document.getElementById('ticketBox').showModal();
}
async function openUser(id) {
  const data = await fetch(api + '/admin/users/' + id, { headers: headers() }).then(r => r.json());
  const u = data.user || {};
  const a = data.activity || {};
  const box = document.getElementById('userDetail');
  box.style.display = 'block';
  box.innerHTML =
    '<h2>'+(u.name||'')+'</h2>' +
    '<p>Email: '+(u.email||'')+'<br>City: '+(u.city||'')+'<br>Role: '+(u.role||'')+'<br>Balance: '+(u.balance??'')+'<br>Rating: '+(u.rating??'')+'</p>' +
    '<p>Account created: '+(u.created_at||'-')+'<br>Last login: '+(u.last_login||u.updated_at||'-')+'</p>' +
    '<p>Skills offered: '+(u.offers||'-')+'<br>Skills needed: '+(u.needs||'-')+'</p>' +
    '<h3>Recent chats</h3>' + table(a.chats||[], ['id','name_a','name_b','last_message','updated_at']) +
    '<h3>Offers</h3>' + table(a.offers||[], ['id','status','skill_requested','skill_offered','extra_tokens','updated_at']) +
    '<h3>Tickets</h3>' + table(a.tickets||[], ['id','type','status','created_at']) +
    '<h3>Reviews</h3>' + table(a.reviews||[], ['id','rating','text','created_at']) +
    '<h3>Wallet</h3>' + table(a.wallet||[], ['id','type','amount','title','created_at']);
  box.scrollIntoView({ behavior: 'smooth' });
}
async function closeTicket(id) {
  await fetch(api + '/admin/tickets/' + id + '/close', { method: 'POST', headers: headers() });
  loadAll();
}
async function setUser(id, suspended) {
  await fetch(api + '/admin/users/' + id + '/' + (suspended ? 'suspend' : 'unsuspend'), { method: 'POST', headers: headers() });
  loadAll();
}
async function setRole(id, role) {
  await fetch(api + '/admin/users/' + id + '/role', { method: 'POST', headers: headers(), body: JSON.stringify({ role }) });
  loadAll();
}
async function setPassword(id) {
  const password = prompt('New password');
  if (!password) return;
  await fetch(api + '/admin/users/' + id + '/password', { method: 'POST', headers: headers(), body: JSON.stringify({ password }) });
  alert('Password updated');
}
async function deleteUser(id, name) {
  if (!confirm('Delete ' + name + ' and all related chats, offers and tickets?')) return;
  const res = await fetch(api + '/admin/users/' + id, { method: 'DELETE', headers: headers() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || 'Could not delete');
    return;
  }
  document.getElementById('userDetail').style.display = 'none';
  loadAll();
}
if (token()) {
  document.getElementById('login').style.display = 'none';
  document.getElementById('panel').style.display = 'block';
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

  @Get('users')
  users() {
    return this.adminService.listUsers();
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

  @Get('tickets')
  tickets() {
    return this.adminService.listTickets();
  }

  @Get('tickets/:id')
  ticket(@Param('id') id: string) {
    return this.adminService.getTicket(Number(id));
  }

  @Post('tickets/:id/close')
  close(@Param('id') id: string) {
    return this.adminService.closeTicket(Number(id));
  }

  @Get('exchanges')
  exchanges() {
    return this.adminService.listExchanges();
  }
}