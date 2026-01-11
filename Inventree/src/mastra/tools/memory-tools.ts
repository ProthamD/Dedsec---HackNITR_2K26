import { Agent } from '@mastra/core/agent';
import { Tool } from '@mastra/core/tools';

// Tool to query past agent decisions and their outcomes
export const queryMemoryTool = new Tool({
  id: 'query-agent-memory',
  description: 'Query past agent decisions and their outcomes to learn from previous experiences. Use this before making important decisions.',
  inputSchema: {
    type: 'object',
    properties: {
      agentType: {
        type: 'string',
        description: 'Type of agent (inventory, waste-reduction, distribution, disaster-analysis)',
        enum: ['inventory', 'waste-reduction', 'distribution', 'disaster-analysis']
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to filter memories (e.g., overstock, stockout, distribution, urgent)'
      },
      outcome: {
        type: 'string',
        description: 'Filter by outcome type',
        enum: ['success', 'failure', 'partial', 'all']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of memories to retrieve (default: 5)',
        default: 5
      }
    },
    required: ['agentType']
  },
  execute: async ({ context, mastra }) => {
    try {
      const { agentType, tags = [], outcome = 'all', limit = 5 } = context;
      
      // Fetch from backend API
      const queryParams = new URLSearchParams({
        agentType,
        outcome: outcome !== 'all' ? outcome : '',
        tags: tags.join(','),
        limit: limit.toString()
      });
      
      const response = await fetch(`http://localhost:3000/api/agent-memory/query?${queryParams}`);
      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to query memories'
        };
      }
      
      // Format memories for agent consumption
      const formattedMemories = data.memories.map(mem => ({
        timestamp: mem.createdAt,
        decision: mem.decision,
        context: mem.context,
        action: mem.action,
        outcome: mem.outcome,
        learnings: mem.learnings,
        metrics: mem.metrics
      }));
      
      return {
        success: true,
        memories: formattedMemories,
        summary: `Found ${formattedMemories.length} relevant past experiences. ${
          formattedMemories.filter(m => m.outcome === 'failure').length
        } were failures to learn from.`
      };
    } catch (error) {
      console.error('Error querying agent memory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Tool to store agent decisions and outcomes
export const storeMemoryTool = new Tool({
  id: 'store-agent-memory',
  description: 'Store a decision, action, and its outcome for future learning. Use this after completing important tasks.',
  inputSchema: {
    type: 'object',
    properties: {
      agentType: {
        type: 'string',
        description: 'Type of agent making the decision',
        enum: ['inventory', 'waste-reduction', 'distribution', 'disaster-analysis']
      },
      decision: {
        type: 'string',
        description: 'The decision that was made'
      },
      context: {
        type: 'object',
        description: 'Context in which the decision was made (relevant data, constraints, etc.)'
      },
      action: {
        type: 'string',
        description: 'The action that was taken based on the decision'
      },
      outcome: {
        type: 'string',
        description: 'The result of the action',
        enum: ['success', 'failure', 'partial', 'pending']
      },
      metrics: {
        type: 'object',
        description: 'Quantitative metrics about the outcome',
        properties: {
          cost: { type: 'number' },
          timeElapsed: { type: 'number' },
          accuracy: { type: 'number' },
          userSatisfaction: { type: 'number' },
          inventoryImpact: { type: 'number' }
        }
      },
      learnings: {
        type: 'string',
        description: 'What was learned from this experience (especially important for failures)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to categorize this memory (e.g., overstock, urgent, cost-sensitive)'
      }
    },
    required: ['agentType', 'decision', 'context', 'action', 'outcome']
  },
  execute: async ({ context, mastra }) => {
    try {
      const memoryData = {
        userId: context.userId || 'user123',
        ...context
      };
      
      const response = await fetch('http://localhost:3000/api/agent-memory/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to store memory'
        };
      }
      
      return {
        success: true,
        message: 'Memory stored successfully. Future decisions will benefit from this experience.',
        memoryId: data.memory._id
      };
    } catch (error) {
      console.error('Error storing agent memory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

// Tool to get analysis of past patterns (successes vs failures)
export const analyzeMemoryPatternsTool = new Tool({
  id: 'analyze-memory-patterns',
  description: 'Analyze patterns in past decisions to identify what works and what doesn\'t',
  inputSchema: {
    type: 'object',
    properties: {
      agentType: {
        type: 'string',
        description: 'Type of agent to analyze',
        enum: ['inventory', 'waste-reduction', 'distribution', 'disaster-analysis']
      },
      timeRange: {
        type: 'string',
        description: 'Time range to analyze',
        enum: ['7days', '30days', '90days', 'all'],
        default: '30days'
      }
    },
    required: ['agentType']
  },
  execute: async ({ context, mastra }) => {
    try {
      const { agentType, timeRange = '30days' } = context;
      
      const response = await fetch(`http://localhost:3000/api/agent-memory/analyze?agentType=${agentType}&timeRange=${timeRange}`);
      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to analyze patterns'
        };
      }
      
      return {
        success: true,
        analysis: data.analysis
      };
    } catch (error) {
      console.error('Error analyzing memory patterns:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});
