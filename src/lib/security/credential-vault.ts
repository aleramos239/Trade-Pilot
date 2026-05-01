import { randomBytes, randomUUID, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BrokerCredentialVaultEntry,
  BrokerPlatform,
  EncryptedPayload,
} from "@/lib/trading/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_KEY_FILE = path.join(DATA_DIR, "vault.key");
const ALGORITHM = "aes-256-gcm";

export type BrokerCredentialInput = {
  authMethod?: "direct" | "oauth" | "bridge";
  username?: string;
  password?: string;
  apiKey?: string;
  apiSecret?: string;
  bridgeUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  clientId?: string;
  clientSecret?: string;
  appId?: string;
  appVersion?: string;
  cid?: string;
  deviceId?: string;
  environment?: "demo" | "live";
};

async function getLocalVaultKey() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    return Buffer.from((await readFile(LOCAL_KEY_FILE, "utf8")).trim(), "base64");
  } catch {
    const key = randomBytes(32);
    await writeFile(LOCAL_KEY_FILE, key.toString("base64"), { encoding: "utf8", flag: "wx" });
    return key;
  }
}

async function getVaultKey() {
  const configuredKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (configuredKey) {
    const decoded = Buffer.from(configuredKey, "base64");

    if (decoded.length === 32) {
      return decoded;
    }

    return createHash("sha256").update(configuredKey).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is required in production before broker credentials can be encrypted or decrypted.",
    );
  }

  return getLocalVaultKey();
}

export async function encryptCredentialPayload(credentials: BrokerCredentialInput): Promise<EncryptedPayload> {
  const key = await getVaultKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export async function decryptCredentialPayload(payload: EncryptedPayload) {
  const key = await getVaultKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as BrokerCredentialInput;
}

export async function createVaultEntry({
  ownerId,
  brokerConnectionId,
  platform,
  label,
  credentials,
}: {
  ownerId: string;
  brokerConnectionId: string;
  platform: BrokerPlatform;
  label: string;
  credentials: BrokerCredentialInput;
}): Promise<BrokerCredentialVaultEntry> {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    ownerId,
    brokerConnectionId,
    platform,
    label,
    encryptedPayload: await encryptCredentialPayload(credentials),
    createdAt: now,
    rotatedAt: now,
  };
}
