import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const listInventoryInputSchema = z.object({
  userId: z.string().default('user123').describe('User ID for fetching inventory'),
  filterBy: z.enum(['all', 'low-stock', 'high-demand', 'overstocked', 'stagnant']).default('all').describe('Filter inventory by criteria'),
});

const inventoryItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  location: z.string(),
  onHand: z.number(),
  inboundUnits: z.number(),
  leadTimeDays: z.number(),
  moq: z.number(),
  unitCost: z.number(),
  budgetCap: z.number(),
  demandHistory: z.array(z.object({
    date: z.string(),
    unitsSold: z.number(),
  })),
});

const listInventoryOutputSchema = z.object({
  totalItems: z.number(),
  items: z.array(inventoryItemSchema),
  summary: z.object({
    lowStock: z.number().describe('Items with less than 5 days of cover'),
    highDemand: z.number().describe('Items with velocity > 20 units/day'),
    overstocked: z.number().describe('Items with more than 30 days of cover'),
    stagnant: z.number().describe('Items with zero sales in last 7 days'),
  }),
});

export const listInventoryTool = createTool({
  id: 'list-all-inventory',
  description: 'Get complete inventory list from database with analytics summary. Use this to analyze all products without specifying individual SKUs.',
  inputSchema: listInventoryInputSchema,
  outputSchema: listInventoryOutputSchema,
  execute: async ({ context }) => {
    try {
      // Fetch all inventory from backend API
      const response = await fetch(`http://localhost:3000/api/inventory?userId=${context.userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch inventory: ${response.statusText}`);
      }
      
      const inventoryData = await response.json();
      
      // Calculate analytics
      let lowStock = 0;
      let highDemand = 0;
      let overstocked = 0;
      let stagnant = 0;
      
      const processedItems = inventoryData.map((item: any) => {
        // Calculate daily velocity
        const last7Days = item.demandHistory.slice(-7);
        const totalSales = last7Days.reduce((sum: number, d: any) => sum + d.unitsSold, 0);
        const velocity = last7Days.length > 0 ? totalSales / last7Days.length : 0;
        
        // Calculate days of cover
        const daysOfCover = velocity > 0 ? item.onHand / velocity : 999;
        
        // Categorize
        if (daysOfCover < 5) lowStock++;
        if (velocity > 20) highDemand++;
        if (daysOfCover > 30) overstocked++;
        if (velocity === 0 && item.onHand > 0) stagnant++;
        
        return {
          sku: item.sku,
          name: item.name,
          location: item.location,
          onHand: item.onHand,
          inboundUnits: item.inboundUnits,
          leadTimeDays: item.leadTimeDays,
          moq: item.moq,
          unitCost: item.unitCost,
          budgetCap: item.budgetCap,
          demandHistory: item.demandHistory.slice(-7), // Last 7 days only
        };
      });
      
      // Apply filter
      let filteredItems = processedItems;
      if (context.filterBy !== 'all') {
        filteredItems = processedItems.filter((item: any) => {
          const last7Days = item.demandHistory;
          const totalSales = last7Days.reduce((sum: number, d: any) => sum + d.unitsSold, 0);
          const velocity = last7Days.length > 0 ? totalSales / last7Days.length : 0;
          const daysOfCover = velocity > 0 ? item.onHand / velocity : 999;
          
          switch (context.filterBy) {
            case 'low-stock': return daysOfCover < 5;
            case 'high-demand': return velocity > 20;
            case 'overstocked': return daysOfCover > 30;
            case 'stagnant': return velocity === 0 && item.onHand > 0;
            default: return true;
          }
        });
      }
      
      return {
        totalItems: filteredItems.length,
        items: filteredItems,
        summary: {
          lowStock,
          highDemand,
          overstocked,
          stagnant,
        },
      };
    } catch (error) {
      throw new Error(`Error fetching inventory list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});
