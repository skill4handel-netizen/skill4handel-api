import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  list(@Query('userId') userId?: string) {
    return this.authService.listUsers(Number(userId || 0));
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.authService.me(Number(id));
  }
}