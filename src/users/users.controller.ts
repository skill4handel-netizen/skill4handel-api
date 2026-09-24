import { Controller, Get, Param, Req } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { userIdFromRequest } from '../auth/http-user';

@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  list(@Req() req: any) {
    return this.authService.listUsers(userIdFromRequest(req));
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.authService.publicProfile(Number(id));
  }
}
