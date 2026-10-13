import { randomUUID } from "node:crypto";
import { transaction } from "../db.js";
import { email, studentEmail, password } from "../lib/validation.js";
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  otpHash,
  safeEqual,
  randomSecret,
  anonymousReviewKey,
} from "../lib/security.js";
import { HttpError, requireValue } from "../lib/errors.js";

const INVALID_CODE =
  "This code is invalid, expired, or exhausted. Request a new code.";
export async function createAuthService(pool, config, sendOtp) {
  // Unknown users still run a real password comparison, reducing timing leakage.
  const dummyHash = await hashPassword(randomSecret());
  async function issue(user) {
    const otp = generateOtp(),
      hash = otpHash(config.otpSecret, user.id, otp),
      now = Date.now();
    await transaction(pool, async (connection) => {
      await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [
        user.id,
      ]);
      const [rows] = await connection.execute(
        "SELECT sent_at FROM password_resets WHERE user_id = ?",
        [user.id],
      );
      if (rows.length && now - Number(rows[0].sent_at) < 60000)
        throw new HttpError(
          429,
          "Wait one minute before requesting another code.",
          "RESEND_COOLDOWN",
        );
      await connection.execute(
        "INSERT INTO password_resets (user_id, code_hash, expires_at, sent_at, attempts) VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), sent_at = VALUES(sent_at), attempts = 0",
        [user.id, hash, now + 600000, now],
      );
    });
    try {
      await sendOtp({ to: user.email, otp });
    } catch (error) {
      await pool.execute(
        "DELETE FROM password_resets WHERE user_id = ? AND code_hash = ?",
        [user.id, hash],
      );
      throw error;
    }
  }
  async function register(body) {
    const address = studentEmail(body.email, config.domains);
    requireValue(
      body.agreed === true,
      "Agree to the community guidelines before registering.",
    );
    const hash = await hashPassword(password(body.password));
    const user = { id: randomUUID(), email: address };
    // The database UNIQUE constraint closes the race between concurrent signups.
    try {
      await pool.execute(
        "INSERT INTO users (id, email, password_hash, anonymous_seed) VALUES (?, ?, ?, ?)",
        [user.id, address, hash, randomSecret()],
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY")
        throw new HttpError(
          409,
          "An account with this email already exists. Please sign in.",
          "ACCOUNT_EXISTS",
        );
      throw error;
    }
    return {
      email: address,
      message:
        "Account created. You can now sign in with your email and password.",
    };
  }

  async function consume(value, otp, newPasswordHash) {
    const address = email(value);
    requireValue(
      typeof otp === "string" && /^\d{6}$/.test(otp),
      "Enter the six-digit code.",
    );
    const success = await transaction(pool, async (connection) => {
      const [users] = await connection.execute(
        "SELECT id FROM users WHERE email = ? FOR UPDATE",
        [address],
      );
      if (!users[0]) return false;
      const userId = users[0].id;
      const [challenges] = await connection.execute(
        "SELECT * FROM password_resets WHERE user_id = ? FOR UPDATE",
        [userId],
      );
      const challenge = challenges[0];
      if (
        !challenge ||
        challenge.attempts >= 5 ||
        Number(challenge.expires_at) <= Date.now()
      )
        return false;
      if (
        !safeEqual(challenge.code_hash, otpHash(config.otpSecret, userId, otp))
      ) {
        // Return instead of throwing here, so the failed-attempt update commits.
        await connection.execute(
          "UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?",
          [userId],
        );
        return false;
      }
      await connection.execute(
        "UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?",
        [newPasswordHash, userId],
      );
      await connection.execute(
        "DELETE FROM password_resets WHERE user_id = ?",
        [userId],
      );
      return true;
    });
    if (!success) throw new HttpError(400, INVALID_CODE, "INVALID_CODE");
  }
  async function login(body) {
    const address = email(body.email);
    requireValue(
      typeof body.password === "string" && body.password.length <= 128,
      "Enter your password.",
    );
    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [
      address,
    ]);
    const user = rows[0];
    const valid = await verifyPassword(
      body.password,
      user?.password_hash || dummyHash,
    );
    if (!user || !valid)
      throw new HttpError(
        401,
        "Email or password is incorrect.",
        "INVALID_CREDENTIALS",
      );
    return user;
  }
  async function forgotPassword(value) {
    const address = email(value);
    const [rows] = await pool.execute(
      "SELECT id, email FROM users WHERE email = ?",
      [address],
    );
    if (rows[0]) await issue(rows[0]);
    return {
      message: "If this account exists, a password reset code has been sent.",
    };
  }
  async function resetPassword(body) {
    const hash = await hashPassword(password(body.password));
    await consume(body.email, body.code, hash);
    return {
      message:
        "Password changed. Existing login sessions have been invalidated. Please log in again.",
    };
  }
  async function reviewIdentity(userId, professorId, courseId) {
    const [rows] = await pool.execute(
      "SELECT anonymous_seed FROM users WHERE id = ?",
      [userId],
    );
    requireValue(rows[0], "Account access required.", 403);
    const [links] = await pool.execute(
      "SELECT 1 FROM professor_courses WHERE professor_id = ? AND course_id = ?",
      [professorId, courseId],
    );
    requireValue(
      links.length > 0,
      "This professor does not teach the selected course.",
    );
    return anonymousReviewKey(
      config.anonymousSecret,
      rows[0].anonymous_seed,
      professorId,
      courseId,
    );
  }
  return {
    register,
    login,
    forgotPassword,
    resetPassword,
    reviewIdentity,
  };
}
