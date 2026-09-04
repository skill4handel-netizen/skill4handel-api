import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { MatchModule } from './match/match.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AuthModule, ChatModule, MatchModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}