import { Controller, Get } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  list() {
    return this.authService.listUsers();
  }
}