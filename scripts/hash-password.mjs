import { scryptSync, randomBytes } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm.cmd run auth:hash -- <password>");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`${salt}:${hash}`);
