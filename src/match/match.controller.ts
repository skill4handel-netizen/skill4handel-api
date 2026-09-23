import { Controller, Get, Req } from '@nestjs/common';
import { MatchService } from './match.service';
import { userIdFromRequest } from '../auth/http-user';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get()
  list(@Req() req: any) {
    return this.matchService.forUser(userIdFromRequest(req));
  }
}
