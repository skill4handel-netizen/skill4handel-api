import { Body, Controller, Delete, Get, Header, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NotifyService } from '../notify/notify.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly notify: NotifyService,
  ) {}

  @Get('me')
  me(@Query('userId') userId: string) {
    return this.authService.me(Number(userId));
  }

  @Post('signup')
  signup(@Body() body: any) {
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
  login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
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
  deviceToken(@Body() body: any) {
    return this.authService.saveDeviceToken(Number(body.userId), body.token, body.platform);
  }

  @Post('test-push')
  testPush(@Body() body: any) {
    return this.notify.sendToUser(
      Number(body.userId),
      'Skill4Handel',
      'Test notification. If you see this, push is working.',
      { type: 'test' },
    );
  }

  @Post('forgot-password')
  forgot(@Body() body: any) {
    return this.authService.forgotPassword(body.email, body.password);
  }

  @Post('change-password')
  changePassword(@Body() body: any) {
    return this.authService.changePassword(Number(body.userId), body.currentPassword, body.newPassword);
  }

  @Post('profile')
  profile(@Body() body: any) {
    return this.authService.updateProfile(body);
  }

  @Post('photo')
  photo(@Body() body: any) {
    return this.authService.setPhoto(body.id, body.photoUrl);
  }

  @Post('review')
  review(@Body() body: any) {
    return this.authService.addReview(body);
  }

  @Post('transfer')
  transfer(@Body() body: any) {
    return this.authService.transfer(body);
  }

  @Delete('transaction')
  deleteTransaction(@Query('userId') userId: string, @Query('id') id: string) {
    return this.authService.deleteTransaction(Number(userId), Number(id));
  }

  @Post('ticket')
  ticket(@Body() body: any) {
    return this.authService.addTicket(body);
  }

  @Get('blocks')
  blocks(@Query('userId') userId: string) {
    return this.authService.listBlocks(Number(userId));
  }

  @Post('block')
  block(@Body() body: any) {
    return this.authService.block(Number(body.userId), Number(body.otherId));
  }

  @Post('unblock')
  unblock(@Body() body: any) {
    return this.authService.unblock(Number(body.userId), Number(body.otherId));
  }
}
