import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const disasterAnalysisInputSchema = z.object({
  userId: z.string().default('user123').describe('User ID'),
  newsContext: z.string().optional().describe('Current logistics news context'),
});

const necessaryProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  priority: z.enum(['critical', 'high', 'medium']),
  reason: z.string(),
  warehouses: z.array(z.string()),
  currentStock: z.number().optional(),
});

const disasterSchema = z.object({
  type: z.enum(['flood', 'fuel_shortage', 'supply_disruption', 'weather_delay', 'infrastructure_failure']),
  severity: z.enum(['high', 'medium', 'low']),
  affectedRegions: z.array(z.string()),
  necessaryProducts: z.array(necessaryProductSchema),
  recommendations: z.string(),
});

const disasterAnalysisOutputSchema = z.object({
  disasters: z.array(disasterSchema),
  analysisTimestamp: z.string(),
  totalProductsAffected: z.number(),
});

export const disasterAnalysisTool = createTool({
  id: 'analyze-disaster-scenarios',
  description: 'Analyze current inventory and logistics news to detect potential disaster scenarios and identify necessary products for emergency response. Returns disaster alerts with product recommendations by warehouse.',
  inputSchema: disasterAnalysisInputSchema,
  outputSchema: disasterAnalysisOutputSchema,
  execute: async ({ context }) => {
    try {
      // Fetch inventory data
      const response = await fetch(`http://localhost:3000/api/inventory?userId=${context.userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }
      const inventory = await response.json();

      // Default news context if not provided
      const newsContext = context.newsContext || `
        - Heavy monsoon rains causing delays on Mumbai-Pune highway
        - National Highway 44 Delhi-Bangalore corridor upgraded
        - Fuel price surge affecting logistics costs
      `;

      // Analyze for disasters based on news patterns
      const disasters: any[] = [];

      // Check for weather-related disasters
      if (newsContext.toLowerCase().includes('monsoon') || newsContext.toLowerCase().includes('rain') || newsContext.toLowerCase().includes('flood')) {
        const essentialProducts = inventory
          .filter((item: any) => {
            // Prioritize low-stock items that might be needed
            const daysOfCover = item.onHand / (item.unitsSold / 7 || 1);
            return daysOfCover < 10 || item.category === 'essential';
          })
          .slice(0, 5)
          .map((item: any) => ({
            sku: item.sku,
            name: item.productName,
            priority: item.onHand < 20 ? 'critical' : item.onHand < 50 ? 'high' : 'medium',
            reason: `Essential supply needed for monsoon delays. Current stock: ${item.onHand} units (${Math.round(item.onHand / (item.unitsSold / 7 || 1))} days of cover)`,
            warehouses: ['wh-boston', 'wh-atlanta', 'wh-chicago'],
            currentStock: item.onHand,
          }));

        disasters.push({
          type: 'weather_delay',
          severity: 'high',
          affectedRegions: ['Mumbai-Pune corridor', 'Western India'],
          necessaryProducts: essentialProducts,
          recommendations: 'Increase buffer stock in unaffected regions. Activate alternate supply routes via Delhi-Bangalore corridor. Pre-position emergency inventory near affected areas.',
        });
      }

      // Check for fuel-related disasters
      if (newsContext.toLowerCase().includes('fuel') || newsContext.toLowerCase().includes('price surge')) {
        const highDemandProducts = inventory
          .filter((item: any) => item.unitsSold > 50)
          .slice(0, 4)
          .map((item: any) => ({
            sku: item.sku,
            name: item.productName,
            priority: 'high',
            reason: `High-demand product (${item.unitsSold} units sold). Fuel costs increasing delivery expenses. Optimize distribution to reduce trips.`,
            warehouses: ['wh-dallas', 'wh-la'],
            currentStock: item.onHand,
          }));

        disasters.push({
          type: 'fuel_shortage',
          severity: 'medium',
          affectedRegions: ['All routes', 'National distribution'],
          necessaryProducts: highDemandProducts,
          recommendations: 'Consolidate shipments to reduce fuel costs. Prioritize high-margin products. Consider rail/sea freight alternatives. Implement zone-based distribution.',
        });
      }

      // Check for supply chain disruptions
      const lowStockProducts = inventory.filter((item: any) => {
        const daysOfCover = item.onHand / (item.unitsSold / 7 || 1);
        return daysOfCover < 5;
      });

      if (lowStockProducts.length > 3) {
        disasters.push({
          type: 'supply_disruption',
          severity: lowStockProducts.length > 5 ? 'high' : 'medium',
          affectedRegions: ['Multiple warehouses'],
          necessaryProducts: lowStockProducts.slice(0, 5).map((item: any) => ({
            sku: item.sku,
            name: item.productName,
            priority: 'critical',
            reason: `Critical low stock: only ${Math.round(item.onHand / (item.unitsSold / 7 || 1))} days of inventory remaining. Risk of stockout.`,
            warehouses: ['wh-boston', 'wh-chicago', 'wh-atlanta'],
            currentStock: item.onHand,
          })),
          recommendations: 'Urgent restocking required. Expedite supplier orders. Consider emergency air freight for critical items. Activate safety stock protocols.',
        });
      }

      // If no disasters detected, create a positive status
      if (disasters.length === 0) {
        disasters.push({
          type: 'supply_disruption',
          severity: 'low',
          affectedRegions: ['No critical areas'],
          necessaryProducts: inventory.slice(0, 3).map((item: any) => ({
            sku: item.sku,
            name: item.productName,
            priority: 'medium',
            reason: 'Monitor for potential issues. Maintain current stock levels.',
            warehouses: ['wh-boston', 'wh-atlanta'],
            currentStock: item.onHand,
          })),
          recommendations: 'All systems operating normally. Continue standard monitoring. Review stock levels weekly.',
        });
      }

      const totalProductsAffected = disasters.reduce((sum, d) => sum + d.necessaryProducts.length, 0);

      return {
        disasters,
        analysisTimestamp: new Date().toISOString(),
        totalProductsAffected,
      };
    } catch (error: any) {
      console.error('Disaster analysis tool error:', error);
      
      // Return safe fallback data
      return {
        disasters: [{
          type: 'supply_disruption',
          severity: 'low',
          affectedRegions: ['System monitoring'],
          necessaryProducts: [],
          recommendations: 'Analysis temporarily unavailable. Manual review recommended.',
        }],
        analysisTimestamp: new Date().toISOString(),
        totalProductsAffected: 0,
      };
    }
  },
});
