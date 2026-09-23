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
    return `<!doctype html><html><body style="font-family:sans-serif;padding:32px;max-width:420px;margin:auto">
      <h2>Skill4Handel</h2>
      <p>Choose a new password. This link expires in two hours and can be used once.</p>
      <p><input id="password" type="password" placeholder="New password" minlength="6" style="width:100%;padding:10px"></p>
      <p><button id="go" style="padding:10px 16px">Update password</button></p>
      <p id="msg"></p>
      <script>
        document.getElementById('go').onclick = async function() {
          const password = document.getElementById('password').value;
          const res = await fetch('/auth/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: decodeURIComponent('${safe}'), password })
          });
          document.getElementById('msg').textContent = res.ok
            ? 'Password updated. Open the app and log in.'
            : 'This link is invalid or has expired.';
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

  @Post('unblock')
  unblock(@Req() req: any, @Body() body: any) {
    return this.authService.unblock(userIdFromRequest(req), Number(body.otherId));
  }
}
