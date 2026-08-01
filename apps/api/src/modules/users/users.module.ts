import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Accounts, roles, skills and usernames (08-Backend-Design.md section 1.2).
 *
 * Depends on no other feature module, which is what lets `AuthModule` and
 * `ClientsModule` both depend on it without closing a cycle.
 *
 * `UsersRepository` is exported alongside the service because `AuthModule`
 * needs the one operation that has no business-rule wrapper by design:
 * loading a login candidate with the password hash, before any scope exists.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
