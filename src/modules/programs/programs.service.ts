import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program } from './entities/program.entity';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program)
    private readonly programRpository: Repository<Program>,
  ) {}

  async create(createProgramDto: CreateProgramDto): Promise<Program> {
    const { index_image_url, program_name, price, description } =
      createProgramDto;

    const newProgram = this.programRpository.create({
      index_image_url,
      program_name,
      price,
      description,
    });

    await this.programRpository.save(newProgram);
    return newProgram;
  }

  async findAll(): Promise<Program[]> {
    return await this.programRpository.find();
  }

  async findOne(id: number): Promise<Program> {
    const program = await this.programRpository.findOne({ where: { id } });

    if (!program) {
      throw new NotFoundException(`Program with ID "${id}" not found`);
    }

    return program;
  }

  async update(
    id: number,
    updateProgramDto: UpdateProgramDto,
  ): Promise<Program> {
    await this.programRpository.update(id, updateProgramDto);
    const updatedPost = await this.programRpository.findOne({
      where: { id },
    });
    if (!updatedPost) {
      throw new NotFoundException(`Program with ID "${id}" not found`);
    }
    return updatedPost;
  }

  async remove(id: number): Promise<void> {
    const post = await this.programRpository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Program with ID "${id}" not found`);
    }
    await this.programRpository.delete(id);
  }
}
