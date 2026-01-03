import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const wasteDistributionInputSchema = z.object({
  productSku: z.string().describe('SKU of the product to distribute'),
  userId: z.string().default('user123').describe('User ID'),
  analysisOnly: z.boolean().default(true).describe('If true, only analyze without executing distribution'),
});

const distributionRecommendationSchema = z.object({
  warehouseId: z.string(),
  warehouseName: z.string(),
  location: z.string(),
  currentStock: z.number(),
  demand: z.number(),
  suggestedQuantity: z.number(),
  transferCost: z.number(),
  priority: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
});

const wasteDistributionOutputSchema = z.object({
  productSku: z.string(),
  productName: z.string(),
  currentStock: z.number(),
  excessStock: z.number(),
  recommendations: z.array(distributionRecommendationSchema),
  totalRecommendedDistribution: z.number(),
  estimatedCost: z.number(),
  executionReady: z.boolean(),
});

export const wasteDistributionTool = createTool({
  id: 'analyze-waste-distribution',
  description: 'Analyze overstocked products and recommend distribution to other warehouses. Returns detailed distribution plan with costs and priorities.',
  inputSchema: wasteDistributionInputSchema,
  outputSchema: wasteDistributionOutputSchema,
  execute: async ({ context }) => {
    try {
      // Fetch product details
      const response = await fetch(`http://localhost:3000/api/inventory?userId=${context.userId}`);
      const inventoryData = await response.json();
      
      const product = inventoryData.find((item: any) => item.sku === context.productSku);
      
      if (!product) {
        throw new Error(`Product ${context.productSku} not found`);
      }
      
      // Calculate average demand
      const demands = product.demandHistory?.map((d: any) => d.unitsSold) || [];
      const avgDemand = demands.length > 0 
        ? demands.reduce((a: number, b: number) => a + b, 0) / demands.length 
        : 0;
      
      // Calculate excess stock (anything above 60 days of supply)
      const excessStock = Math.max(0, product.onHand - Math.ceil(avgDemand * 60));
      
      // Mock warehouse recommendations (in production, this would query real warehouse data)
      const recommendations = [
        {
          warehouseId: 'WH-001',
          warehouseName: 'Northeast Hub',
          location: 'Boston, MA',
          currentStock: 15,
          demand: avgDemand * 1.2,
          suggestedQuantity: Math.min(excessStock, Math.ceil(avgDemand * 30)),
          transferCost: 45.50,
          priority: 'high' as const,
          reasoning: 'High demand area with low current stock. Transfer cost is lowest.'
        },
        {
          warehouseId: 'WH-002',
          warehouseName: 'Southeast Center',
          location: 'Atlanta, GA',
          currentStock: 8,
          demand: avgDemand * 0.9,
          suggestedQuantity: Math.min(excessStock, Math.ceil(avgDemand * 20)),
          transferCost: 52.75,
          priority: 'high' as const,
          reasoning: 'Very low stock with moderate demand. Second best transfer cost.'
        },
        {
          warehouseId: 'WH-003',
          warehouseName: 'Midwest Warehouse',
          location: 'Chicago, IL',
          currentStock: 5,
          demand: avgDemand * 1.5,
          suggestedQuantity: Math.min(excessStock, Math.ceil(avgDemand * 40)),
          transferCost: 58.20,
          priority: 'high' as const,
          reasoning: 'Critical low stock with very high demand. Urgent transfer needed.'
        },
        {
          warehouseId: 'WH-004',
          warehouseName: 'Southwest Depot',
          location: 'Dallas, TX',
          currentStock: 12,
          demand: avgDemand * 0.8,
          suggestedQuantity: Math.min(excessStock, Math.ceil(avgDemand * 15)),
          transferCost: 65.90,
          priority: 'medium' as const,
          reasoning: 'Moderate stock with steady demand. Consider if excess remains.'
        },
        {
          warehouseId: 'WH-005',
          warehouseName: 'West Coast Hub',
          location: 'Los Angeles, CA',
          currentStock: 3,
          demand: avgDemand * 1.8,
          suggestedQuantity: Math.min(excessStock, Math.ceil(avgDemand * 50)),
          transferCost: 78.40,
          priority: 'medium' as const,
          reasoning: 'Highest demand but higher transfer cost. Good for large quantities.'
        }
      ];
      
      const totalRecommended = recommendations.reduce((sum, r) => sum + r.suggestedQuantity, 0);
      const estimatedCost = recommendations.reduce((sum, r) => sum + (r.transferCost * r.suggestedQuantity / 100), 0);
      
      return {
        productSku: product.sku,
        productName: product.name,
        currentStock: product.onHand,
        excessStock,
        recommendations,
        totalRecommendedDistribution: totalRecommended,
        estimatedCost,
        executionReady: excessStock > 0,
      };
    } catch (error) {
      throw new Error(`Failed to analyze distribution: ${error}`);
    }
  },
});
