import { customAlphabet } from "nanoid";

const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export const generateShareId = customAlphabet(alphabet, 10);

const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{10}$/;

export const isValidShareId = (value: string): boolean =>
  SHARE_ID_REGEX.test(value);
