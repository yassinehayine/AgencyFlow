import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';
import { Client, ClientSchema } from './schemas/client.schema';
import { ClientsController } from './clients.controller';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

/**
 * Client organisations and their contact accounts.
 *
 * Depends on `UsersModule` and not the reverse (08-Backend-Design 1.2). The
 * contact endpoints live here because the ORGANISATION owns the relationship:
 * a contact without an organisation is meaningless, while a user without a
 * client is the normal case.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Client.name, schema: ClientSchema }]), UsersModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsRepository],
  exports: [ClientsService, ClientsRepository],
})
export class ClientsModule {}
