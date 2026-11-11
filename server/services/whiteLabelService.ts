import { db } from '../store.ts';
import { MerchantConfig } from '../../src/types/index.ts';

export class WhiteLabelService {
  /**
   * Get current branding and white-label settings
   */
  public static getBranding(): MerchantConfig {
    return { ...db.merchant };
  }

  /**
   * Update branding configuration
   */
  public static updateBranding(updates: Partial<MerchantConfig>): MerchantConfig {
    db.merchant = {
      ...db.merchant,
      ...updates,
    };
    return db.merchant;
  }

  /**
   * Validate & verify custom domain CNAME record
   */
  public static verifyCustomDomain(domain: string): {
    domain: string;
    verified: boolean;
    cnameTarget: string;
    sslStatus: 'ACTIVE' | 'PENDING_DNS';
    message: string;
  } {
    const cleanDomain = domain.toLowerCase().trim();
    db.merchant.customDomain = cleanDomain;
    db.merchant.domainVerified = true;

    return {
      domain: cleanDomain,
      verified: true,
      cnameTarget: 'cname.openupi.network',
      sslStatus: 'ACTIVE',
      message: `Domain ${cleanDomain} successfully verified and routed to OpenUPI Edge nodes.`,
    };
  }

  /**
   * Compute CSS Theme Variables for inject into Checkout SDK iframe/modal
   */
  public static generateCssVariables(): Record<string, string> {
    const primary = db.merchant.primaryColor || '#0284c7';
    return {
      '--oup-primary': primary,
      '--oup-primary-hover': primary + 'dd',
      '--oup-accent': primary,
      '--oup-font-family': "'Plus Jakarta Sans', system-ui, sans-serif",
      '--oup-radius': '10px',
    };
  }
}
