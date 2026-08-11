import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export const EXCEL_PRO_JWT = process.env.JWT_SECRET;
