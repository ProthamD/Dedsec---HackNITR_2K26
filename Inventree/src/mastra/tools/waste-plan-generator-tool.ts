import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const wastePlanInputSchema = z.object({
  productSku: z.string().describe('SKU of the product with excess stock'),
  productName: z.string().describe('Name of the product'),
  excessStock: z.number().describe('Number of excess units'),
  unitCost: z.number().describe('Cost per unit'),
  userId: z.string().default('user123').describe('User ID'),
});

const planSchema = z.object({
  type: z.enum(['bundle', 'discount', 'promotion', 'donation', 'liquidation']),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  estimatedUnitsReduced: z.number(),
  revenueImpact: z.string(),
  implementationTime: z.string(),
  effort: z.enum(['low', 'medium', 'high']),
});

const wastePlanOutputSchema = z.object({
  productSku: z.string(),
  productName: z.string(),
  totalExcessValue: z.number(),
  plans: z.array(planSchema),
  recommendedApproach: z.string(),
});

export const wastePlanGeneratorTool = createTool({
  id: 'generate-waste-reduction-plans',
  description: 'Generate creative AI-powered strategies to reduce waste from overstocked products. Returns actionable plans including bundles, discounts, promotions, donations, and liquidation strategies.',
  inputSchema: wastePlanInputSchema,
  outputSchema: wastePlanOutputSchema,
  execute: async ({ context }) => {
    try {
      const totalValue = context.excessStock * context.unitCost;
      
      // Generate intelligent plans based on product characteristics
      const plans = [
        {
          type: 'bundle' as const,
          title: 'Buy One Get One 50% Off Bundle',
          description: `Create attractive bundle offers with ${context.productName}. Pair with complementary products at discounted rates to increase perceived value while moving excess inventory.`,
          impact: `Reduce ${Math.floor(context.excessStock * 0.4)} units`,
          estimatedUnitsReduced: Math.floor(context.excessStock * 0.4),
          revenueImpact: `$${(Math.floor(context.excessStock * 0.4) * context.unitCost * 0.75).toFixed(2)} revenue`,
          implementationTime: '1-2 weeks',
          effort: 'medium' as const,
        },
        {
          type: 'discount' as const,
          title: 'Flash Sale - Limited Time Offer',
          description: `Launch a 72-hour flash sale with 25-35% discount on ${context.productName}. Create urgency through countdown timers and limited quantity messaging.`,
          impact: `Reduce ${Math.floor(context.excessStock * 0.5)} units`,
          estimatedUnitsReduced: Math.floor(context.excessStock * 0.5),
          revenueImpact: `$${(Math.floor(context.excessStock * 0.5) * context.unitCost * 0.7).toFixed(2)} revenue`,
          implementationTime: '3-5 days',
          effort: 'low' as const,
        },
        {
          type: 'promotion' as const,
          title: 'Loyalty Program Exclusive Bonus',
          description: `Offer ${context.productName} as exclusive bonus rewards to loyalty program members. Strengthen customer relationships while clearing inventory.`,
          impact: `Reduce ${Math.floor(context.excessStock * 0.25)} units`,
          estimatedUnitsReduced: Math.floor(context.excessStock * 0.25),
          revenueImpact: `$${(Math.floor(context.excessStock * 0.25) * context.unitCost * 0.6).toFixed(2)} + increased loyalty`,
          implementationTime: '1 week',
          effort: 'medium' as const,
        },
        {
          type: 'donation' as const,
          title: 'Corporate Social Responsibility Initiative',
          description: `Partner with local charities or non-profits to donate excess ${context.productName}. Gain tax benefits (typically 30-50% of cost), positive PR, and brand goodwill.`,
          impact: `Tax deduction + brand value`,
          estimatedUnitsReduced: Math.floor(context.excessStock * 0.3),
          revenueImpact: `$${(Math.floor(context.excessStock * 0.3) * context.unitCost * 0.4).toFixed(2)} tax benefit`,
          implementationTime: '2-3 weeks',
          effort: 'high' as const,
        },
        {
          type: 'liquidation' as const,
          title: 'Bulk Liquidation Partnership',
          description: `Sell remaining units to liquidation partners or discount retailers. Accept lower margins (40-60% of cost) to quickly free up warehouse space and recover capital.`,
          impact: `Clear ${Math.floor(context.excessStock * 0.7)} units`,
          estimatedUnitsReduced: Math.floor(context.excessStock * 0.7),
          revenueImpact: `$${(Math.floor(context.excessStock * 0.7) * context.unitCost * 0.5).toFixed(2)} recovered`,
          implementationTime: '1-2 weeks',
          effort: 'medium' as const,
        },
      ];
      
      // Determine recommended approach based on context
      let recommendedApproach = '';
      if (context.excessStock < 50) {
        recommendedApproach = 'Focus on Flash Sale and Bundle strategies for quick clearance with minimal effort.';
      } else if (totalValue > 10000) {
        recommendedApproach = 'Consider multi-channel approach: Start with Flash Sale (fast), follow with Bundles (medium-term), and use Liquidation for remaining units.';
      } else {
        recommendedApproach = 'Combine Loyalty Promotion and Donation for balanced financial and brand value outcomes.';
      }
      
      return {
        productSku: context.productSku,
        productName: context.productName,
        totalExcessValue: totalValue,
        plans,
        recommendedApproach,
      };
    } catch (error) {
      throw new Error(`Failed to generate waste reduction plans: ${error}`);
    }
  },
});
