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

  @Post('forgot-password')
  forgot(@Body() body: any) {
    return this.authService.forgotPassword(body.email, body.password);
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
}