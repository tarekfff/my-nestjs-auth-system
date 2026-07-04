import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user.interface';
import { UserEntity } from './entities/user.entity';
import { UserService } from './user.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: "Get the current authenticated user's profile" })
  @Get('me')
  async me(@CurrentUser() currentUser: RequestUser): Promise<UserEntity> {
    const user = await this.userService.findById(currentUser.id);
    if (!user) throw new NotFoundException('User not found');
    return new UserEntity(user);
  }

  @ApiOperation({ summary: 'List all users (admin only)' })
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAll(): Promise<UserEntity[]> {
    const users = await this.userService.findAll();
    return users.map((user) => new UserEntity(user));
  }
}
