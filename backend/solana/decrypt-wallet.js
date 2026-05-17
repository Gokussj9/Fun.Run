import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const encryptedText = "d67067b8b75a2698147ba211ff73f033:f4b2556a96ad995814acaec9fbdb429681e8758510e3775635eeb9f63c30b477631ab0f05452bf23e1e218de43c056a1ac081f7eb5a13fcd739d4d999f2f2c184b2df9063f6451799b57d68c6cd06b68ef28a68be1e0f5ef0560f492107f7770";

function decrypt(text) {
  const parts = text.split(":");

  const iv = Buffer.from(parts[0], "hex");

  const encryptedText = Buffer.from(
    parts[1],
    "hex"
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  let decrypted = decipher.update(
    encryptedText
  );

  decrypted = Buffer.concat([
    decrypted,
    decipher.final()
  ]);

  return decrypted.toString();
}

console.log(
  decrypt(encryptedText)
);