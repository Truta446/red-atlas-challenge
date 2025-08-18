import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { hashPassword, verifyPassword } from '../../../common/security/password.util';
import { User } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: 'user' | 'admin';
  tenantId: string;
}

@Injectable()
export class AuthService {
  @InjectRepository(User) private readonly users: Repository<User>;
  @Inject(JwtService) private readonly jwt: JwtService;

  private signAccess(payload: JwtPayload): Promise<string> {
    const secret = process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret';
    const expiresIn = process.env.ACCESS_TOKEN_TTL || '15m';
    return this.jwt.signAsync(payload, { secret, expiresIn });
  }
  private signRefresh(payload: Pick<JwtPayload, 'sub' | 'email' | 'tenantId'>): Promise<string> {
    const secret = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret';
    const expiresIn = process.env.REFRESH_TOKEN_TTL || '30d';
    return this.jwt.signAsync(payload, { secret, expiresIn });
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public async register(
    email: string,
    password: string,
    tenantId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const exists = await this.users.findOne({ where: { email } });
    if (exists) throw new UnauthorizedException('Email already registered');
    const user = this.users.create({
      email,
      passwordHash: await hashPassword(password),
      role: 'user',
      tenantId: tenantId || process.env.DEFAULT_TENANT || 'public',
    });
    await this.users.save(user);
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    const accessToken = await this.signAccess(payload);
    const refreshToken = await this.signRefresh({ sub: user.id, email: user.email, tenantId: user.tenantId });
    user.refreshTokenHash = this.hashToken(refreshToken);
    await this.users.save(user);
    return { accessToken, refreshToken };
  }

  public async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    const accessToken = await this.signAccess(payload);
    const refreshToken = await this.signRefresh({ sub: user.id, email: user.email, tenantId: user.tenantId });
    user.refreshTokenHash = this.hashToken(refreshToken);
    await this.users.save(user);
    return { accessToken, refreshToken };
  }

  public async rotateRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret';
    let decoded: any;
    try {
      decoded = await this.jwt.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findOne({ where: { id: decoded.sub } });
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('Refresh not allowed');
    // rotation: must match stored hash, then replace it
    if (this.hashToken(refreshToken) !== user.refreshTokenHash) throw new UnauthorizedException('Token rotated');

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    const newAccess = await this.signAccess(payload);
    const newRefresh = await this.signRefresh({ sub: user.id, email: user.email, tenantId: user.tenantId });
    user.refreshTokenHash = this.hashToken(newRefresh);
    await this.users.save(user);
    return { accessToken: newAccess, refreshToken: newRefresh };
  }
}
