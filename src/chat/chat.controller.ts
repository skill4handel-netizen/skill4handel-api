import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  list(@Query('userId') userId: string) {
    return this.chatService.list(Number(userId));
  }

  @Get('history')
  history(@Query('userId') userId: string) {
    return this.chatService.history(Number(userId));
  }

  @Get(':id')
  get(@Param('id') id: string, @Query('userId') userId: string) {
    return this.chatService.get(Number(id), userId ? Number(userId) : undefined);
  }

  @Post('open')
  open(
    @Body()
    body: { myId: number; myName: string; otherId: number; otherName: string },
  ) {
    return this.chatService.open(body.myId, body.myName, body.otherId, body.otherName);
  }

  @Post(':id/messages')
  send(@Param('id') id: string, @Body() body: { fromId: number; text: string }) {
    return this.chatService.send(Number(id), body.fromId, body.text);
  }

  @Post(':id/swap')
  propose(@Param('id') id: string, @Body() body: any) {
    return this.chatService.proposeSwap(Number(id), Number(body.userId), body);
  }

  @Post(':id/swap/respond')
  respond(@Param('id') id: string, @Body() body: any) {
    return this.chatService.respondSwap(Number(id), Number(body.userId), body.action, body);
  }

  @Post(':id/swap/cancel')
  cancel(@Param('id') id: string, @Body() body: { userId: number }) {
    return this.chatService.cancelSwap(Number(id), Number(body.userId));
  }

  @Post(':id/swap/done')
  done(@Param('id') id: string, @Body() body: { userId: number }) {
    return this.chatService.markDone(Number(id), Number(body.userId));
  }

  @Post(':id/reviewed')
  reviewed(@Param('id') id: string, @Body() body: { userId: number }) {
    return this.chatService.markReviewed(Number(id), Number(body.userId));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    return this.chatService.remove(Number(id), Number(userId));
  }
}
