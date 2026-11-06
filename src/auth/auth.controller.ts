import { Body, Controller, Delete, Get, Header, Post, Query, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NotifyService } from '../notify/notify.service';
import { userIdFromRequest } from './http-user';
import { enforceThrottle } from './throttle';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly notify: NotifyService,
  ) {}

  @Get('alerts')
  alerts(@Req() req: any) {
    const userId = userIdFromRequest(req);
    return this.authService.alerts(userId);
  }

  @Post('alerts/read')
  readAlert(@Req() req: any, @Body() body: any) {
    const userId = userIdFromRequest(req);
    return this.authService.readAlert(userId, Number(body.id));
  }

  @Post('alerts/clear')
  clearAlerts(@Req() req: any) {
    return this.authService.clearAlerts(userIdFromRequest(req));
  }

  @Post('alerts/delete')
  deleteAlert(@Req() req: any, @Body() body: any) {
    return this.authService.deleteAlert(userIdFromRequest(req), Number(body.id));
  }

  @Get('me')
  me(@Req() req: any) {
    return this.authService.me(userIdFromRequest(req));
  }

  @Post('signup')
  signup(@Req() req: any, @Body() body: any) {
    enforceThrottle(req, 'signup', 5, 15 * 60 * 1000);
    return this.authService.signup(
      body.name,
      body.email,
      body.password,
      body.age,
      body.acceptedTerms,
      body.city,
      body.phone,
      body.accessibility,
      body.birthDate,
      body.language,
      body.willingVolunteer,
    );
  }

  @Post('login')
  login(@Req() req: any, @Body() body: any) {
    enforceThrottle(req, 'login', 8, 15 * 60 * 1000);
    return this.authService.login(body.email, body.password);
  }

  @Post('google')
  google(@Req() req: any, @Body() body: any) {
    enforceThrottle(req, 'google', 8, 15 * 60 * 1000);
    return this.authService.googleLogin(body.idToken);
  }

  @Get('verify')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async verifyLink(@Query('token') token: string) {
    const app = `skill4handel://verify?token=${encodeURIComponent(token || '')}`;
    try {
      await this.authService.verifyEmail(token);
      return `<!doctype html><html><body style="font-family:sans-serif;padding:32px;text-align:center">
        <h2>Skill4Handel</h2>
        <p>Your email address has been confirmed.</p>
        <p>Open the app and continue to log in.</p>
        <p><a href="${app}">Open the app</a></p>
        <p><a href="https://www.skill4handel.com">www.skill4handel.com</a></p>
        <script>setTimeout(function(){ location.href="${app}"; }, 800);</script>
      </body></html>`;
    } catch {
      return `<!doctype html><html><body style="font-family:sans-serif;padding:32px;text-align:center">
        <h2>Skill4Handel</h2>
        <p>This link was already used. If your account is confirmed, open the app and log in.</p>
        <p><a href="${app}">Open the app</a></p>
      </body></html>`;
    }
  }

  @Post('verify')
  verifyPost(@Body() body: any) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verify')
  resend(@Body() body: any) {
    return this.authService.resendVerify(body.email);
  }

  @Post('verification-status')
  verificationStatus(@Body() body: any) {
    return this.authService.verificationStatus(body.email);
  }

  @Post('device-token')
  deviceToken(@Req() req: any, @Body() body: any) {
    return this.authService.saveDeviceToken(userIdFromRequest(req), body.token, body.platform);
  }

  @Post('test-push')
  testPush(@Req() req: any) {
    return this.notify.sendToUser(
      userIdFromRequest(req),
      'Skill4Handel',
      'Test notification. If you see this, push is working.',
      { type: 'test' },
    );
  }

  @Post('forgot-password')
  forgot(@Req() req: any, @Body() body: any) {
    enforceThrottle(req, 'forgot', 5, 15 * 60 * 1000);
    return this.authService.forgotPassword(body.email);
  }

  @Get('reset')
  @Header('Content-Type', 'text/html; charset=utf-8')
  resetForm(@Query('token') token: string) {
    const safe = encodeURIComponent(token || '');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: sans-serif; background: #f4f7fb; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { width: 100%; max-width: 420px; background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 8px 24px rgba(16,24,40,.08); }
      .logo { width: 56px; height: 56px; border-radius: 16px; background: #2f6fed; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; }
      h2 { font-size: 26px; margin: 16px 0 8px; }
      .muted { color: #667085; font-size: 15px; margin: 0 0 16px; }
      .rule { background: #eef4ff; border-radius: 12px; padding: 12px; color: #1d4ed8; margin: 0 0 16px; }
      input, button { width: 100%; padding: 16px; font-size: 16px; border-radius: 12px; }
      input { border: 1px solid #d0d5dd; margin-bottom: 12px; }
      button { border: 0; background: #2f6fed; color: #fff; font-weight: 700; }
      #msg { min-height: 22px; margin-top: 12px; font-size: 15px; }
      .bad { color: #b42318; }
      .ok { color: #067647; }
    </style></head><body>
      <div class="card">
        <div class="logo">S</div>
        <h2>Choose a new password</h2>
        <p class="muted">This link expires in two hours and can be used once.</p>
        <p class="rule">Use at least 8 characters, including one letter and one number.</p>
        <input id="password" type="password" placeholder="New password">
        <button id="go">Update password</button>
        <p id="msg"></p>
      </div>
      <script>
        document.getElementById('go').onclick = async function() {
          const password = document.getElementById('password').value;
          const msg = document.getElementById('msg');
          const res = await fetch('/auth/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: decodeURIComponent('${safe}'), password })
          });
          let text = '';
          try { text = await res.text(); } catch (e) {}
          let message = 'Password updated. Open the app and log in.';
          if (!res.ok) {
            try {
              const data = JSON.parse(text);
              message = data.message || 'Use at least 8 characters, including one letter and one number.';
              if (Array.isArray(message)) message = message[0];
            } catch (e) {
              message = text || 'Use at least 8 characters, including one letter and one number.';
            }
          }
          msg.className = res.ok ? 'ok' : 'bad';
          msg.textContent = message;
        };
      </script>
    </body></html>`;
  }

  @Post('reset')
  async reset(@Body() body: any) {
    await this.authService.resetPassword(body.token, body.password);
    return `<!doctype html><html><body style="font-family:sans-serif;padding:32px;text-align:center">
      <h2>Skill4Handel</h2>
      <p>Your password has been updated. Open the app and log in.</p>
    </body></html>`;
  }

  @Post('set-password')
  setPassword(@Req() req: any, @Body() body: any) {
    return this.authService.setPassword(userIdFromRequest(req), body.newPassword || '');
  }

  @Post('change-password')
  changePassword(@Req() req: any, @Body() body: any) {
    return this.authService.changePassword(userIdFromRequest(req), body.currentPassword, body.newPassword);
  }

  @Post('profile')
  profile(@Req() req: any, @Body() body: any) {
    return this.authService.updateProfile({ ...body, id: userIdFromRequest(req) });
  }

  @Post('photo')
  photo(@Req() req: any, @Body() body: any) {
    return this.authService.setPhoto(userIdFromRequest(req), body.photoUrl);
  }

  @Post('review/report')
  reportReview(@Req() req: any, @Body() body: any) {
    return this.authService.reportReview(
      userIdFromRequest(req),
      Number(body.reviewId),
      body.reason || body.text || '',
    );
  }

  @Post('review')
  review(@Req() req: any, @Body() body: any) {
    return this.authService.addReview({ ...body, fromId: userIdFromRequest(req) });
  }

  @Post('transfer')
  transfer(@Req() req: any, @Body() body: any) {
    return this.authService.transfer({ ...body, fromId: userIdFromRequest(req), userId: userIdFromRequest(req) });
  }

  @Delete('transaction')
  deleteTransaction(@Req() req: any, @Query('id') id: string) {
    return this.authService.deleteTransaction(userIdFromRequest(req), Number(id));
  }

  @Get('tickets')
  tickets(@Req() req: any) {
    return this.authService.listTickets(userIdFromRequest(req));
  }

  @Post('ticket')
  ticket(@Req() req: any, @Body() body: any) {
    return this.authService.addTicket({ ...body, userId: userIdFromRequest(req) });
  }

  @Get('blocks')
  blocks(@Req() req: any) {
    return this.authService.listBlocks(userIdFromRequest(req));
  }

  @Post('block')
  block(@Req() req: any, @Body() body: any) {
    return this.authService.block(userIdFromRequest(req), Number(body.otherId));
  }

  @Delete('account')
  deleteAccount(@Req() req: any, @Body() body: { password?: string }) {
    return this.authService.deleteAccount(userIdFromRequest(req), String(body?.password || ''));
  }

  @Post('unblock')
  unblock(@Req() req: any, @Body() body: any) {
    return this.authService.unblock(userIdFromRequest(req), Number(body.otherId));
  }
}
