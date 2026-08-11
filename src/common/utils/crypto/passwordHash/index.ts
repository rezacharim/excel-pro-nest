import * as bcrypt from 'bcryptjs';

/**
 * Hash proccess
 * @param password Entry Password
 * @returns Hashed Password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

/**
 * Checked Password
 * @param password Entry Password
 * @param hashedPassword Hashed Password
 * @returns result
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};
