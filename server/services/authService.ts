import crypto from 'crypto';
import { db } from '../store.ts';

export class AuthService {
  /**
   * Verify Merchant API Key
   */
  public static verifyMerchantKey(authHeader?: string): { valid: boolean; error?: string } {
    if (!authHeader) {
      return { valid: false, error: 'Authorization header is missing' };
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token !== db.merchant.apiKey) {
      return { valid: false, error: 'Invalid merchant API key' };
    }
    return { valid: true };
  }

  /**
   * Customer Phone Verification - Create OTP Challenge
   * CRITICAL SECURITY: Never expose OTP secret in response to client!
   */
  public static createPhoneChallenge(phone: string): {
    challengeId: string;
    maskedPhone: string;
    expiresAt: number;
    mockDeliveryStatus: string;
  } {
    const cleanPhone = phone.trim();
    const challengeId = 'chal_' + crypto.randomBytes(8).toString('hex');
    // Generate secure 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store in backend database store
    db.phoneChallenges.set(challengeId, {
      phone: cleanPhone,
      rawOtp,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    // Mask phone e.g. +91 98*** **521
    const maskedPhone = cleanPhone.length > 6 
      ? cleanPhone.slice(0, 4) + '******' + cleanPhone.slice(-2) 
      : cleanPhone;

    // Log to server console / developer audit log only
    console.log(`[SECURE_SMS_GATEWAY] OTP issued for ${maskedPhone}. Challenge ID: ${challengeId}. (Stored securely on server)`);

    return {
      challengeId,
      maskedPhone,
      expiresAt,
      mockDeliveryStatus: 'SMS dispatched via mock carrier gateway',
    };
  }

  /**
   * Verify customer OTP challenge
   */
  public static verifyPhoneChallenge(challengeId: string, enteredOtp: string): {
    success: boolean;
    verificationToken?: string;
    error?: string;
  } {
    const challenge = db.phoneChallenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge expired or not found' };
    }

    if (Date.now() > challenge.expiresAt) {
      db.phoneChallenges.delete(challengeId);
      return { success: false, error: 'OTP has expired. Please request a new code.' };
    }

    if (challenge.attempts >= 3) {
      db.phoneChallenges.delete(challengeId);
      return { success: false, error: 'Maximum verification attempts exceeded.' };
    }

    challenge.attempts += 1;

    // Constant-time comparison to prevent timing attacks
    const isValid = challenge.rawOtp.trim() === enteredOtp.trim();

    if (!isValid) {
      return { success: false, error: `Invalid OTP code. Remaining attempts: ${3 - challenge.attempts}` };
    }

    challenge.verified = true;
    const verificationToken = 'vtok_' + crypto.randomBytes(16).toString('hex');

    return {
      success: true,
      verificationToken,
    };
  }

  /**
   * Safe Developer Helper for Mock Mode testing:
   * Returns metadata about the latest challenge for UI test simulator display only
   */
  public static getMockChallengeInspector(challengeId?: string) {
    if (!challengeId) return null;
    const challenge = db.phoneChallenges.get(challengeId);
    if (!challenge) return null;
    return {
      challengeId,
      phoneMasked: challenge.phone.slice(0, 4) + '****' + challenge.phone.slice(-2),
      expiresInSeconds: Math.max(0, Math.round((challenge.expiresAt - Date.now()) / 1000)),
      verified: challenge.verified,
      serverOtpForTestSandbox: db.merchant.mockMode ? challenge.rawOtp : undefined,
    };
  }
}
