import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowMustChangePassword } from '../../common/decorators/allow-must-change-password.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import type { RequestUser } from '../../common/types/request-user.interface';
import { AuthService } from './auth.service';
import { ActivateDto } from './dto/activate.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { RefreshTokenPayload } from './types/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Log in with email + password (CompanyUser or StaffUser)',
  })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({
    summary: 'Rotate a refresh token for a new access/refresh token pair',
  })
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(
    @Body() _dto: RefreshTokenDto,
    @CurrentUser() payload: RefreshTokenPayload,
  ) {
    return this.authService.refresh(payload);
  }

  @ApiOperation({
    summary: 'Revoke a single refresh token (log out of one session)',
  })
  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiOperation({
    summary:
      'Revoke all refresh tokens for the current user (log out everywhere)',
  })
  @ApiBearerAuth()
  @Post('logout-all')
  logoutAll(@CurrentUser() user: RequestUser) {
    return this.authService.logoutAll(user);
  }

  @ApiOperation({ summary: 'Change the current user password' })
  @ApiBearerAuth()
  @AllowMustChangePassword()
  @Post('change-password')
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }

  @ApiOperation({
    summary: 'Activate a CompanyUser account with the token sent by an admin',
  })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('activate')
  activate(@Body() dto: ActivateDto) {
    return this.authService.activate(dto);
  }

  @ApiOperation({ summary: 'Email a 6-digit password reset code' })
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({
    summary: 'Reset the password with the 6-digit code sent by email',
  })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
