import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { userIdFromRequest } from '../auth/http-user';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  list(@Req() req: any) {
    return this.chatService.list(userIdFromRequest(req));
  }

  @Get('history')
  history(@Req() req: any) {
    return this.chatService.history(userIdFromRequest(req));
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.chatService.get(Number(id), userIdFromRequest(req));
  }

  @Post('open')
  open(@Req() req: any, @Body() body: { myName?: string; otherId: number; otherName: string }) {
    const myId = userIdFromRequest(req);
    return this.chatService.open(myId, body.myName || '', Number(body.otherId), body.otherName);
  }

  @Post(':id/messages')
  send(@Param('id') id: string, @Req() req: any, @Body() body: { text: string }) {
    return this.chatService.send(Number(id), userIdFromRequest(req), body.text);
  }

  @Post(':id/swap')
  propose(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.chatService.proposeSwap(Number(id), userIdFromRequest(req), body);
  }

  @Post(':id/swap/respond')
  respond(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.chatService.respondSwap(Number(id), userIdFromRequest(req), body.action, body);
  }

  @Post(':id/swap/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.chatService.cancelSwap(Number(id), userIdFromRequest(req));
  }

  @Post(':id/swap/done')
  done(@Param('id') id: string, @Req() req: any) {
    return this.chatService.markDone(Number(id), userIdFromRequest(req));
  }

  @Post(':id/reviewed')
  reviewed(@Param('id') id: string, @Req() req: any) {
    return this.chatService.markReviewed(Number(id), userIdFromRequest(req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.chatService.remove(Number(id), userIdFromRequest(req));
  }
}
