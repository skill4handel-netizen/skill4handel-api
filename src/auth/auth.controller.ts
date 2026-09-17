import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  me(@Query('userId') userId: string) {
    return this.authService.me(Number(userId));
  }

  @Post('signup')
  signup(@Body() body: any) {
    return this.authService.signup(body.name, body.email, body.password, body.age, body.acceptedTerms);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verify')
  resend(@Body() body: any) {
    return this.authService.resendVerify(body.email);
  }

  @Post('device-token')
  deviceToken(@Body() body: any) {
    return this.authService.saveDeviceToken(Number(body.userId), body.token, body.platform);
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
