import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export const pool = {
  type: process.env.DB_TYPE as 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: process.env.NODE_ENV === 'development' ? true : false,
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  // SSL is required for Supabase; set DB_SSL=false for a local database.
  ssl:
    process.env.DB_SSL === 'false'
      ? false
      : {
          rejectUnauthorized: false,
        },
  connectTimeoutMS: 30000,
  extra: {
    connectionTimeoutMillis: 30000,
  },
};
