import crypto from 'crypto';
import { db } from '../store.ts';
import { AndroidDevice, CompanionObservation } from '../../src/types/index.ts';

export class CompanionService {
  /**
   * Enroll a new Android Companion Device
   */
  public static enrollDevice(params: {
    deviceName: string;
    model: string;
    firmwareVersion?: string;
  }): { device: AndroidDevice; enrollmentSecret: string; pairingQr: string } {
    const deviceId = 'AND-NODE-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const enrollmentSecret = crypto.randomBytes(32).toString('hex');
    const publicKey = crypto.createHash('sha256').update(enrollmentSecret).digest('hex');

    const device: AndroidDevice = {
      deviceId,
      deviceName: params.deviceName,
      model: params.model,
      enrollmentDate: new Date().toISOString(),
      status: 'ONLINE',
      batteryPercent: 95,
      isCharging: true,
      batteryTempC: 31.0,
      networkType: 'WIFI',
      lastHeartbeat: Date.now(),
      publicKey,
      firmwareVersion: params.firmwareVersion || 'v2.5.0-companion',
      permissionsGranted: [
        'BIND_NOTIFICATION_LISTENER_SERVICE',
        'RECEIVE_BOOT_COMPLETED',
        'ACCESS_NETWORK_STATE',
        'FOREGROUND_SERVICE_DATA_SYNC',
      ],
    };

    db.androidDevices.set(deviceId, device);

    const pairingData = JSON.stringify({
      deviceId,
      secret: enrollmentSecret,
      endpoint: `${db.merchant.customDomain}/api/v1/companion`,
    });

    return {
      device,
      enrollmentSecret,
      pairingQr: pairingData,
    };
  }

  /**
   * Record Device Health Heartbeat
   */
  public static recordHeartbeat(
    deviceId: string,
    telemetry: {
      batteryPercent: number;
      isCharging: boolean;
      batteryTempC: number;
      networkType: 'WIFI' | 'CELLULAR_5G' | 'CELLULAR_4G';
    }
  ): AndroidDevice | null {
    const device = db.androidDevices.get(deviceId);
    if (!device) return null;

    device.batteryPercent = Math.min(100, Math.max(0, telemetry.batteryPercent));
    device.isCharging = telemetry.isCharging;
    device.batteryTempC = telemetry.batteryTempC;
    device.networkType = telemetry.networkType;
    device.lastHeartbeat = Date.now();
    device.status = 'ONLINE';

    db.androidDevices.set(deviceId, device);
    return device;
  }

  /**
   * Process Signed Observation Event from Android Device
   *
   * CRITICAL SECURITY PRINCIPLE:
   * Observations NEVER independently confirm bank settlement!
   * They signal arrival of incoming push notification for auditing, but cannot move
   * a payment session to 'PAID' on their own without bank webhook reconciliation.
   */
  public static ingestObservation(params: {
    deviceId: string;
    rawSender: string;
    detectedAmount: number;
    referenceId: string;
    signature: string;
    matchedSessionId?: string;
  }): {
    observation: CompanionObservation;
    settlementDisallowedReason: string;
  } {
    const device = db.androidDevices.get(params.deviceId);
    const signatureValid = !!device; // In real engine, verify HMAC using device.publicKey

    const observation: CompanionObservation = {
      id: 'obs_' + crypto.randomBytes(6).toString('hex'),
      deviceId: params.deviceId,
      timestamp: Date.now(),
      rawSender: params.rawSender,
      detectedAmount: params.detectedAmount,
      referenceId: params.referenceId,
      signature: params.signature,
      signatureValid,
      settlementStatus: 'OBSERVED_UNVERIFIED',
      disclaimer:
        'SECURITY ENFORCED: Android notification observations are telemetry events and NEVER independently confirm bank settlement.',
    };

    db.companionObservations.unshift(observation);

    // If matched to an active session, annotate session for merchant review without auto-settling
    if (params.matchedSessionId) {
      const session = db.getSession(params.matchedSessionId);
      if (session) {
        db.updateSession(session.id, {
          observedByCompanion: true,
          companionObservationNote: `Push observed by ${params.deviceId} for ₹${params.detectedAmount} (Ref: ${params.referenceId}). Awaiting bank settlement.`,
        });
      }
    }

    return {
      observation,
      settlementDisallowedReason:
        'Strict Settlement Separation Rule: Android notification captures are vulnerable to device spoofing. Final bank ledger confirmation is required.',
    };
  }

  /**
   * Kotlin Companion Architecture Code Blueprint
   * Returns clean reference architecture for merchant's Android developer team
   */
  public static getKotlinArchitectureBlueprint(): {
    manifestSnippet: string;
    serviceKotlinCode: string;
    securityRules: string[];
  } {
    return {
      manifestSnippet: `
<service
    android:name=".service.OpenUpiNotificationListenerService"
    android:label="OpenUPI Gateway Companion"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>`,
      serviceKotlinCode: `
package org.openupi.companion.service

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.Signature
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class OpenUpiNotificationListenerService : NotificationListenerService() {
    private val allowedBankSenders = setOf("AXISBK-UPI", "HDFCBK-UPI", "SBIPAY", "ICICIB-UPI")

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val packageName = sbn?.packageName ?: return
        val extras = sbn.notification?.extras ?: return
        val sender = extras.getString("android.title") ?: ""
        val message = extras.getString("android.text") ?: ""

        // Privacy Filter: strictly restrict to approved financial sender patterns
        if (!allowedBankSenders.contains(sender)) return

        val parsed = NotificationParser.extractUpiTransaction(message) ?: return

        // Cryptographically sign observation using Android KeyStore-backed key
        val payload = "\${parsed.amount}|\${parsed.refId}|\${System.currentTimeMillis()}"
        val signature = CryptoManager.signObservation(payload)

        // Dispatch observation strictly marked as UNVERIFIED telemetry
        CompanionApiClient.postObservation(
            rawSender = sender,
            detectedAmount = parsed.amount,
            referenceId = parsed.refId,
            signature = signature
        )
    }
}`,
      securityRules: [
        'Android Keystore Hardware-backed key generation (TEE / StrongBox)',
        'Zero personal SMS/notification storage in SQLite or SharedPreferences',
        'Notification listener scoped strictly to whitelisted bank sender handles',
        'TLS 1.3 pinning with Certificate Transparency validation',
        'Clear server-side assertion: Companion telemetry never flips ledger to settled',
      ],
    };
  }
}
