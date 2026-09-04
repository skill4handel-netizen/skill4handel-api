import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { readToken } from './token';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  me(@Query('userId') userId: string) {
    return this.authService.me(Number(userId));
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('signup')
  signup(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.signup(body.name, body.email, body.password);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('forgot-password')
  forgot(@Body() body: { email: string; password: string }) {
    return this.authService.forgotPassword(body.email, body.password);
  }

  @Post('profile')
  profile(@Body() body: { id: number; name: string; city: string; offers: string; needs: string }) {
    return this.authService.updateProfile(body);
  }

  @Post('photo')
  photo(@Body() body: { id: number; photoUrl: string }) {
    return this.authService.setPhoto(body.id, body.photoUrl);
  }

  @Post('complete-swap')
  completeSwap(@Body() body: any) {
    return this.authService.completeSwap(body);
  }

  @Post('review')
  review(@Body() body: any) {
    return this.authService.addReview(body);
  }

  @Post('transfer')
  transfer(@Body() body: { fromId: number; toId: number; amount: number; title: string }) {
    return this.authService.transfer(body);
  }

  @Post('ticket')
  ticket(@Body() body: any) {
    return this.authService.addTicket(body);
  }
}