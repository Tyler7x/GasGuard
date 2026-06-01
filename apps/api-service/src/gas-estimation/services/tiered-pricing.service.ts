import { Injectable } from "@nestjs/common";
import {
  UsageTier,
  TierConfig,
  UserUsage,
} from "../interfaces/tiered-pricing.interface";

@Injectable()
export class TieredPricingService {
  private readonly tiers: Map<UsageTier, TierConfig> = new Map([
    [
      UsageTier.STARTER,
      {
        tier: UsageTier.STARTER,
        name: "Starter",
        description: "For small projects and individual developers",
        requestLimit: 1000,
        basePricePerRequest: 0.0001,
        discountPercentage: 0,
        features: ["Basic gas estimation", "API access (1000 requests/month)"],
        rateLimitPerMinute: 10,
        prioritySupport: false,
        customPricing: false,
      },
    ],
    [
      UsageTier.DEVELOPER,
      {
        tier: UsageTier.DEVELOPER,
        name: "Developer",
        description: "For growing projects and small teams",
        requestLimit: 10000,
        basePricePerRequest: 0.00008,
        discountPercentage: 20,
        features: [
          "Advanced gas estimation",
          "API access (10000 requests/month)",
          "Historical data access",
          "Email support",
        ],
        rateLimitPerMinute: 60,
        prioritySupport: false,
        customPricing: false,
      },
    ],
    [
      UsageTier.PROFESSIONAL,
      {
        tier: UsageTier.PROFESSIONAL,
        name: "Professional",
        description: "For production applications and larger teams",
        requestLimit: 100000,
        basePricePerRequest: 0.00005,
        discountPercentage: 50,
        features: [
          "Professional gas estimation",
          "API access (100000 requests/month)",
          "Full historical data",
          "Priority support",
          "Custom analytics",
        ],
        rateLimitPerMinute: 300,
        prioritySupport: true,
        customPricing: false,
      },
    ],
    [
      UsageTier.ENTERPRISE,
      {
        tier: UsageTier.ENTERPRISE,
        name: "Enterprise",
        description: "Custom solutions for large-scale operations",
        requestLimit: -1,
        basePricePerRequest: 0.00003,
        discountPercentage: 70,
        features: [
          "Enterprise-grade gas estimation",
          "Unlimited API access",
          "Dedicated support team",
          "Custom analytics and reporting",
          "White-label solutions",
          "Custom integrations",
          "99.9% SLA guarantee",
        ],
        rateLimitPerMinute: 1000,
        prioritySupport: true,
        customPricing: true,
      },
    ],
  ]);

  getTierConfig(tier: UsageTier): TierConfig | undefined {
    return this.tiers.get(tier);
  }

  getAllTiers(): TierConfig[] {
    return Array.from(this.tiers.values());
  }

  getRecommendedTier(monthlyRequests: number): UsageTier {
    if (monthlyRequests <= 1000) return UsageTier.STARTER;
    if (monthlyRequests <= 10000) return UsageTier.DEVELOPER;
    if (monthlyRequests <= 100000) return UsageTier.PROFESSIONAL;
    return UsageTier.ENTERPRISE;
  }

  calculateUpgradeSavings(
    currentTier: UsageTier,
    targetTier: UsageTier,
    baseCost: number,
  ): number {
    const currentConfig = this.getTierConfig(currentTier);
    const targetConfig = this.getTierConfig(targetTier);
    if (!currentConfig || !targetConfig) return 0;
    const currentPrice =
      baseCost * (1 - currentConfig.discountPercentage / 100);
    const targetPrice = baseCost * (1 - targetConfig.discountPercentage / 100);
    return currentPrice - targetPrice;
  }

  getTierComparison(): Array<TierConfig & { valueScore: number }> {
    return Array.from(this.tiers.values())
      .map((config) => {
        const estimatedMonthly =
          config.requestLimit === -1 ? 50000 : config.requestLimit * 0.5;
        const monthlyCost = estimatedMonthly * config.basePricePerRequest;
        const featureScore = config.features.length;
        const priceScore = monthlyCost > 0 ? 1000 / monthlyCost : 1000;
        return { ...config, valueScore: featureScore * priceScore };
      })
      .sort((a, b) => b.valueScore - a.valueScore);
  }

  shouldAutoUpgrade(userUsage: UserUsage): boolean {
    const currentConfig = this.getTierConfig(userUsage.currentTier);
    if (!currentConfig || currentConfig.requestLimit === -1) return false;

    const recentMonths = userUsage.monthlyUsage.slice(-3);
    if (recentMonths.length < 3) return false;

    const highUsageMonths = recentMonths.filter(
      (month) => month.requests / currentConfig.requestLimit > 0.9,
    );
    return highUsageMonths.length >= 3;
  }

  async simulateUpgrade(
    userUsage: UserUsage,
    targetTier: UsageTier,
  ): Promise<{
    currentTier: UsageTier;
    targetTier: UsageTier;
    estimatedMonthlySavings: number;
    newFeatures: string[];
    newRateLimit: number;
    recommendedAction: string;
  }> {
    const currentConfig = this.getTierConfig(userUsage.currentTier);
    const targetConfig = this.getTierConfig(targetTier);

    if (!currentConfig || !targetConfig) {
      throw new Error("Invalid tier configuration");
    }

    const baseMonthlyCost =
      userUsage.averageRequestsPerMonth * currentConfig.basePricePerRequest;
    const estimatedMonthlySavings = this.calculateUpgradeSavings(
      userUsage.currentTier,
      targetTier,
      baseMonthlyCost,
    );
    const newFeatures = targetConfig.features.filter(
      (f) => !currentConfig.features.includes(f),
    );

    return {
      currentTier: userUsage.currentTier,
      targetTier,
      estimatedMonthlySavings,
      newFeatures,
      newRateLimit: targetConfig.rateLimitPerMinute,
      recommendedAction:
        estimatedMonthlySavings > 0
          ? `Upgrading to ${targetConfig.name} will save you approximately ${estimatedMonthlySavings.toFixed(4)} XLM per month.`
          : `Consider your usage patterns before upgrading to ${targetConfig.name}.`,
    };
  }
}
