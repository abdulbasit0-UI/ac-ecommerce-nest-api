import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { configuration } from '../config/configuration';

config();

const appConfig = configuration();

export default new DataSource({
  type: 'postgres',
  host: appConfig.database.host,
  port: appConfig.database.port,
  username: appConfig.database.username,
  password: appConfig.database.password,
  database: appConfig.database.name,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
