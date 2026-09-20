import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CustomersService } from '../customers/customers.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { generateRawToken, hashToken } from '../../common/utils/token.util';
import { RoleName } from '../../common/constants/roles.constant';
import { AccessTokenPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly customers: CustomersService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailTokens: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.users.create(dto, RoleName.CUSTOMER);
    await this.customers.createForUser(user, dto.phone);
    await this.issueEmailVerification(user);
    return { message: 'Registration successful. Check your email to verify your account.' };
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await this.users.comparePassword(user, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Verify your email before signing in');
    }
    await this.users.touchLastLogin(user);
    return this.issueSession(user, meta);
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash, revokedAt: IsNull() },
      relations: { user: { role: { permissions: true } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueSession(stored.user, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findOne({ where: { tokenHash: hashToken(refreshToken) } });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.emailTokens.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Verification token is invalid or expired');
    }
    record.usedAt = new Date();
    await this.emailTokens.save(record);
    await this.users.markEmailVerified(record.user);
    return { message: 'Email verified. You can now sign in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(email);
    if (user && !user.isEmailVerified) {
      await this.issueEmailVerification(user);
    }
    return { message: 'If that account exists and is unverified, a new email has been sent.' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(email);
    if (user) {
      await this.resetTokens.update(
        { userId: user.id, usedAt: IsNull() },
        { usedAt: new Date() },
      );
      const raw = generateRawToken();
      await this.resetTokens.save(
        this.resetTokens.create({
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      );
      await this.mail.sendPasswordReset(user.email, user.firstName, raw);
    }
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const record = await this.resetTokens.findOne({
      where: { tokenHash: hashToken(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!record || record.usedAt) {
      throw new BadRequestException('Reset token is invalid or expired');
    }
    record.usedAt = new Date();
    await this.resetTokens.save(record);
    await this.users.setPassword(record.user, password);
    await this.refreshTokens.update({ userId: record.user.id }, { revokedAt: new Date() });
    return { message: 'Password updated. Sign in with your new password.' };
  }

  private async issueEmailVerification(user: User): Promise<void> {
    const raw = generateRawToken();
    await this.emailTokens.save(
      this.emailTokens.create({
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );
    await this.mail.sendVerifyEmail(user.email, user.firstName, raw);
  }

  private async issueSession(user: User, meta: { ip?: string; userAgent?: string }) {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn') as `${number}m`,
    });
    const rawRefresh = generateRawToken(48);
    const refreshDays = this.parseDurationToMs(this.config.get<string>('jwt.refreshExpiresIn') ?? '7d');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + refreshDays),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      }),
    );
    return {
      accessToken,
      refreshToken: rawRefresh,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name,
      },
    };
  }

  private parseDurationToMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * multipliers[unit];
  }
}
