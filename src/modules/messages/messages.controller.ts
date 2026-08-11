import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from './entities/message.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Get all messages',
    description: 'Retrieves a list of all messages',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages successfully retrieved',
    type: [Message],
  })
  findAll(): Promise<Message[]> {
    return this.messagesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Get a message by ID',
    description: 'Retrieves a specific message by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Message unique identifier',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Message successfully retrieved',
    type: Message,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Message> {
    return this.messagesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new message',
    description: 'Creates a new message with the provided data',
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message successfully created',
    type: Message,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createMessageDto: CreateMessageDto): Promise<Message> {
    return this.messagesService.create(createMessageDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a message',
    description: 'Deletes a message by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Message unique identifier',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({ status: 204, description: 'Message successfully deleted' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.messagesService.remove(id);
  }
}
