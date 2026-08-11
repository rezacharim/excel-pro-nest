import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { Program } from './entities/program.entity';

@ApiTags('Programs')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new program' })
  @ApiResponse({
    status: 201,
    description: 'Program successfully created.',
    type: Program,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async create(@Body() createProgramDto: CreateProgramDto): Promise<Program> {
    return this.programsService.create(createProgramDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all programs' })
  @ApiResponse({
    status: 200,
    description: 'List of programs',
    type: [Program],
  })
  async findAll(): Promise<Program[]> {
    return this.programsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a program by ID' })
  @ApiResponse({ status: 200, description: 'Program found', type: Program })
  @ApiResponse({ status: 404, description: 'Program not found.' })
  async findOne(@Param('id') id: string): Promise<Program> {
    return this.programsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a program by ID' })
  @ApiResponse({
    status: 200,
    description: 'Program updated successfully',
    type: Program,
  })
  @ApiResponse({ status: 404, description: 'Program not found.' })
  async update(
    @Param('id') id: string,
    @Body() updateProgramDto: UpdateProgramDto,
  ): Promise<Program> {
    return this.programsService.update(+id, updateProgramDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a program by ID' })
  @ApiResponse({ status: 200, description: 'Program deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Program not found.' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.programsService.remove(+id);
  }
}
