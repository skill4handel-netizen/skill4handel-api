import { Controller, Get, Query } from '@nestjs/common';
import { MatchService } from './match.service';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get()
  list(@Query('userId') userId: string) {
    return this.matchService.forUser(Number(userId));
  }
}