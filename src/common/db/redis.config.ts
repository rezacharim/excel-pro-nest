import { registerAs } from '@nestjs/config';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
export default registerAs('redis', () => ({
  url: process.env.REDIS_URI,
}));
