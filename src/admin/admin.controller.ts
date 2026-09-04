import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
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
    <div class="card">
      <h2>Exchanges</h2>
      <div id="exchanges"></div>
    </div>
  </div>
<script>
const api = '';
function token() { return localStorage.getItem('adminToken') || ''; }
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
  const headers = { Authorization: 'Bearer ' + token() };
  const [tickets, users, exchanges] = await Promise.all([
    fetch(api + '/admin/tickets', { headers }).then(r => r.json()),
    fetch(api + '/admin/users', { headers }).then(r => r.json()),
    fetch(api + '/admin/exchanges', { headers }).then(r => r.json())
  ]);
  document.getElementById('tickets').innerHTML = table(tickets, [
    'id','name','type','other_name','text','status','created_at'
  ], (row) => row.status !== 'closed' ? '<button onclick="closeTicket('+row.id+')">Close</button>' : '');
  document.getElementById('users').innerHTML = table(users, [
    'id','name','email','city','balance','rating','is_suspended','role'
  ], (row) => {
    const roleBtn = row.role === 'admin'
      ? '<button onclick="setRole('+row.id+', \\'user\\')">Make user</button>'
      : '<button onclick="setRole('+row.id+', \\'admin\\')">Make admin</button>';
    const passBtn = '<button onclick="setPassword('+row.id+')">Password</button>';
    const susBtn = row.role === 'admin' ? '' : (row.is_suspended
      ? '<button onclick="setUser('+row.id+', false)">Unsuspend</button>'
      : '<button onclick="setUser('+row.id+', true)">Suspend</button>');
    return roleBtn + ' ' + passBtn + ' ' + susBtn;
  });
  document.getElementById('exchanges').innerHTML = table(exchanges, [
    'id','name_a','name_b','skill_requested','status','pay_with_tokens','extra_tokens','settled'
  ]);
}
function table(rows, keys, extra) {
  if (!Array.isArray(rows)) return '<p class="bad">Could not load</p>';
  if (!rows.length) return '<p>No rows</p>';
  return '<table><tr>' + keys.map(k => '<th>'+k+'</th>').join('') + (extra ? '<th></th>' : '') + '</tr>' +
    rows.map(row => '<tr>' + keys.map(k => '<td>'+String(row[k] ?? '')+'</td>').join('') +
    (extra ? '<td>'+extra(row)+'</td>' : '') + '</tr>').join('') + '</table>';
}
async function closeTicket(id) {
  await fetch(api + '/admin/tickets/' + id + '/close', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }});
  loadAll();
}
async function setUser(id, suspended) {
  await fetch(api + '/admin/users/' + id + '/' + (suspended ? 'suspend' : 'unsuspend'), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token() }
  });
  loadAll();
}
async function setRole(id, role) {
  await fetch(api + '/admin/users/' + id + '/role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: JSON.stringify({ role })
  });
  loadAll();
}
async function setPassword(id) {
  const password = prompt('New password');
  if (!password) return;
  await fetch(api + '/admin/users/' + id + '/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: JSON.stringify({ password })
  });
  alert('Password updated');
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

  @Post('tickets/:id/close')
  close(@Param('id') id: string) {
    return this.adminService.closeTicket(Number(id));
  }

  @Get('exchanges')
  exchanges() {
    return this.adminService.listExchanges();
  }
}