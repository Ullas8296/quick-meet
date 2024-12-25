import { LoginResponse, type IConferenceRoom } from '@quickmeet/shared';
import { ApiResponse } from '@quickmeet/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Auth, User } from './entities';
import appConfig from '../config/env/app.config';
import { ConfigType } from '@nestjs/config';
import { IJwtPayload } from './dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import to from 'await-to-js';
import { createResponse } from '../helpers/payload.util';
import { GoogleApiService } from 'src/google-api/google-api.service';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Auth)
    private authRepository: Repository<Auth>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(appConfig.KEY) private config: ConfigType<typeof appConfig>,
    @Inject('GoogleApiService') private readonly googleApiService: GoogleApiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private jwtService: JwtService,
    private logger: Logger,
  ) {}

  async login(code: string, redirectUrl: string): Promise<ApiResponse<LoginResponse>> {
    const oauth2Client = this.googleApiService.getOAuthClient(redirectUrl);
    const { tokens } = await this.googleApiService.getToken(oauth2Client, code);
    const userInfo = await this.googleApiService.getUserInfo(oauth2Client);

    const authPayload: Auth = {
      accessToken: tokens.access_token,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date,
      tokenType: tokens.token_type,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
    };

    const domain = userInfo.email.split('@')[1];
    const resources = await this.getDirectoryResources(domain);
    if (!resources) {
      await this.createCalenderResources(oauth2Client, domain);
    }

    const existingUser = await this.getUser(userInfo.id);
    if (existingUser) {
      const jwt = await this.createJwt(existingUser.id, existingUser.name, authPayload.expiryDate);
      await this.authRepository.update({ id: existingUser.authId }, authPayload);

      const res: LoginResponse = { accessToken: jwt };
      return createResponse(res);
    }

    const auth = await this.authRepository.save(authPayload);
    const user = await this.usersRepository.save({
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      authId: auth.id,
      domain,
    });

    const jwt = await this.createJwt(user.id, user.name, authPayload.expiryDate);
    const res: LoginResponse = { accessToken: jwt };
    return createResponse(res);
  }

  async purgeAccess(oauth2Client: OAuth2Client) {
    const [err, _] = await to(oauth2Client.revokeCredentials());

    if (err) {
      this.logger.error(err);
      return false;
    }

    return true;
  }

  async createJwt(id: string, name: string, oAuthExpiry: number) {
    const payload: IJwtPayload = { sub: id, name: name, expiresIn: oAuthExpiry };
    const jwt = await this.jwtService.signAsync(payload, { secret: this.config.jwtSecret, expiresIn: oAuthExpiry * 2 });
    return jwt;
  }

  async getUser(id: string): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: {
        id,
      },
      relations: {
        auth: true,
      },
    });

    return existingUser;
  }

  async validateSession() {
    return createResponse(true);
  }

  async logout(): Promise<ApiResponse<boolean>> {
    try {
      // todo: remove the refresh token from the cookie
      // todo: the access_token is removed from the client side
      return createResponse(true);
    } catch (error) {
      return createResponse(false);
    }
  }

  async getFloors(domain: string): Promise<string[]> {
    const conferenceRooms = (await this.getDirectoryResources(domain)) || [];
    const floors = Array.from(new Set(conferenceRooms.filter((room) => room.domain === domain).map((room) => room.floor)));

    // assuming floor is a string in the format F1, F2 etc
    floors.sort((a, b) => {
      const numA = parseInt(a.slice(1), 10);
      const numB = parseInt(b.slice(1), 10);
      return numA - numB;
    });

    return floors;
  }

  /**
   * gets the calender resources from google and save it in the cache
   */
  async createCalenderResources(oauth2Client: OAuth2Client, domain: string): Promise<void> {
    const { items } = await this.googleApiService.getCalendarResources(oauth2Client);

    const rooms: IConferenceRoom[] = [];
    for (const resource of items) {
      rooms.push({
        id: resource.resourceId,
        email: resource.resourceEmail,
        description: resource.userVisibleDescription,
        domain: domain,
        floor: resource.floorName, // in the format of F3 or F1, whatever the organization assigns
        name: resource.resourceName,
        seats: resource.capacity,
      });
    }

    await this.saveDirectoryResouces(rooms);
    this.logger.log(`Conference rooms created successfully, Count: ${rooms.length}`);
  }

  /**
   * obtains the directory resources from the in-memory cache
   */
  async getDirectoryResources(domain: string): Promise<IConferenceRoom[] | null> {
    const rooms: IConferenceRoom[] = await this.cacheManager.get('conference_rooms');
    if (!rooms) return null;

    const resources = rooms.filter((room: IConferenceRoom) => room.domain === domain).sort((a: IConferenceRoom, b: IConferenceRoom) => a.seats - b.seats);
    return resources;
  }

  /**
   * saves the conference rooms in the cache
   */
  async saveDirectoryResouces(resources: IConferenceRoom[]): Promise<void> {
    await this.cacheManager.set('conference_rooms', resources, 15 * 24 * 60 * 60 * 1000); // set TTL to 15 days
  }
}
