import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';

/**
 * INVENTORY DECISION SCORERS
 * 
 * These scorers evaluate the AI agent's inventory management decisions:
 * 1. Decision Appropriateness - Is the restock/delay/reallocate decision correct?
 * 2. Explanation Quality - Are the reasons clear and comprehensive?
 * 3. Cost Optimization - Does it minimize overstocking/understocking costs?
 * 4. Demand Forecast Accuracy - How accurate is the demand prediction?
 * 5. Constraint Compliance - Does it respect budget/storage/capacity limits?
 */

// ============================================
// 1. DECISION APPROPRIATENESS SCORER
// ============================================
export const decisionAppropriatenessScorer = createScorer({
  name: 'Decision Appropriateness',
  description: 'Evaluates if the inventory decision (restock/delay/reallocate) is appropriate given the data',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions: 'You are evaluating an AI inventory manager\'s decision appropriateness. Analyze the context and decision, then return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const input = run.input as any;
    return {
      productName: input?.productName || '',
      currentStock: input?.currentStock || 0,
      historicalSales: input?.historicalSales || '',
      seasonalPattern: input?.seasonalPattern || '',
      demandForecast: input?.demandForecast || '',
      budgetAvailable: input?.budgetAvailable || 0,
      storageCapacity: input?.storageCapacity || 0,
      decision: input?.decision || '',
      reasoning: input?.reasoning || '',
    };
  })
  .analyze({
    description: 'Evaluate if the inventory decision is appropriate',
    outputSchema: z.object({
      score: z.number().min(0).max(100).describe('Score from 0-100'),
      reasoning: z.string().describe('Explanation of the score'),
      wouldPreventOverstocking: z.boolean(),
      wouldPreventUnderstocking: z.boolean(),
      alignsWithPatterns: z.boolean(),
    }),
    createPrompt: ({ results }) => {
      const data = results.preprocessStepResult as any;
      return `You are evaluating an AI inventory manager's decision.

Context:
- Product: ${data.productName}
- Current Stock: ${data.currentStock}
- Historical Sales: ${data.historicalSales}
- Seasonal Pattern: ${data.seasonalPattern}
- Demand Forecast: ${data.demandForecast}
- Budget Available: ${data.budgetAvailable}
- Storage Capacity: ${data.storageCapacity}

Agent's Decision: ${data.decision}
Agent's Reasoning: ${data.reasoning}

Evaluate if this decision is appropriate:
- Would it prevent overstocking (capital lock-in, storage costs)?
- Would it prevent understocking (lost sales, poor customer experience)?
- Does it align with historical patterns and forecast?
- Is it timely (right season, right timing)?

Score from 0-100:
- 90-100: Optimal decision, perfectly balanced
- 70-89: Good decision with minor issues
- 50-69: Acceptable but suboptimal
- 30-49: Poor decision, likely to cause problems
- 0-29: Wrong decision, will cause significant losses

Return JSON with:
{
  "score": number (0-100),
  "reasoning": "explanation",
  "wouldPreventOverstocking": boolean,
  "wouldPreventUnderstocking": boolean,
  "alignsWithPatterns": boolean
}`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (r.score || 0) / 100; // Convert to 0-1 scale
  })
  .generateReason(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return r.reasoning || 'No reasoning provided';
  });

// ============================================
// 2. EXPLANATION QUALITY SCORER
// ============================================
export const explanationQualityScorer = createScorer({
  name: 'Explanation Quality',
  description: 'Evaluates if the agent explains decisions like a human operations manager',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions: 'You are evaluating explanation quality of an AI inventory manager. Return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const input = run.input as any;
    return {
      decision: input?.decision || '',
      explanation: input?.explanation || '',
    };
  })
  .analyze({
    description: 'Evaluate explanation quality',
    outputSchema: z.object({
      score: z.number().min(0).max(100).describe('Score from 0-100'),
      reasoning: z.string().describe('What makes this explanation good or bad'),
      missingElements: z.array(z.string()).optional().describe('What critical elements are missing'),
      isClear: z.boolean(),
      referencesData: z.boolean(),
      explainsAlternatives: z.boolean(),
    }),
    createPrompt: ({ results }) => {
      const data = results.preprocessStepResult as any;
      return `You are evaluating how well an AI inventory manager explains its decisions.

Agent's Decision: ${data.decision}
Agent's Explanation: ${data.explanation}

A good explanation should:
1. Be clear and easy to understand (no jargon)
2. Reference specific data points (historical sales, forecasts, constraints)
3. Explain WHY this action was chosen
4. Explain WHY other actions were NOT chosen
5. Mention risks and trade-offs
6. Sound like a human operations manager, not a robot

Evaluate the explanation quality:
- 90-100: Excellent - Clear, data-driven, explains all alternatives, mentions trade-offs
- 70-89: Good - Covers main points but missing some details
- 50-69: Adequate - Basic explanation but lacks depth
- 30-49: Poor - Vague or incomplete
- 0-29: Very poor - Confusing or missing critical information

Return JSON with:
{
  "score": number (0-100),
  "reasoning": "assessment",
  "missingElements": ["element1", "element2"],
  "isClear": boolean,
  "referencesData": boolean,
  "explainsAlternatives": boolean
}`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (r.score || 0) / 100;
  })
  .generateReason(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return r.reasoning || 'No reasoning provided';
  });

// ============================================
// 3. COST OPTIMIZATION SCORER
// ============================================
export const costOptimizationScorer = createScorer({
  name: 'Cost Optimization',
  description: 'Evaluates if the decision minimizes total costs (storage + opportunity costs)',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions: 'You are evaluating cost optimization in inventory decisions. Return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const input = run.input as any;
    return {
      unitCost: input?.unitCost || 0,
      storageCost: input?.storageCost || 0,
      lostSalePenalty: input?.lostSalePenalty || 0,
      currentStockValue: input?.currentStockValue || 0,
      budgetAvailable: input?.budgetAvailable || 0,
      decision: input?.decision || '',
      quantity: input?.quantity || 0,
    };
  })
  .analyze({
    description: 'Evaluate cost optimization',
    outputSchema: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string(),
      estimatedCostImpact: z.string().optional(),
      riskFactors: z.array(z.string()).optional(),
      optimizesCapital: z.boolean(),
      minimizesStorage: z.boolean(),
      avoidsLostSales: z.boolean(),
    }),
    createPrompt: ({ results }) => {
      const data = results.preprocessStepResult as any;
      return `You are evaluating cost optimization in an inventory decision.

Financial Context:
- Product Unit Cost: ${data.unitCost}
- Storage Cost per Unit: ${data.storageCost}
- Lost Sale Penalty (opportunity cost): ${data.lostSalePenalty}
- Current Stock Value: ${data.currentStockValue}
- Budget Available: ${data.budgetAvailable}

Decision Made: ${data.decision}
Quantity Involved: ${data.quantity}

Evaluate the cost impact:
- 90-100: Optimal - Minimizes total costs, great balance
- 70-89: Good - Reasonable cost management
- 50-69: Acceptable - Some cost inefficiency
- 30-49: Poor - Significant cost implications
- 0-29: Very poor - Major financial losses expected

Consider:
1. Capital efficiency (not locking too much money)
2. Storage costs
3. Opportunity costs of lost sales
4. Risk of obsolescence or seasonality

Return JSON with score, reasoning, cost impact, risk factors, and boolean flags.`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (r.score || 0) / 100;
  })
  .generateReason(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return r.reasoning || 'No reasoning provided';
  });

// ============================================
// 4. DEMAND FORECAST ACCURACY SCORER
// ============================================
export const demandForecastAccuracyScorer = createScorer({
  name: 'Demand Forecast Accuracy',
  description: 'Evaluates the quality and accuracy of demand predictions',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions: 'You are evaluating demand forecasting quality. Return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const input = run.input as any;
    return {
      lastYearSales: input?.lastYearSales || '',
      lastMonthSales: input?.lastMonthSales || '',
      seasonalPattern: input?.seasonalPattern || '',
      growthTrend: input?.growthTrend || '',
      forecastedDemand: input?.forecastedDemand || '',
      confidenceLevel: input?.confidenceLevel || '',
      forecastMethod: input?.forecastMethod || '',
    };
  })
  .analyze({
    description: 'Evaluate forecast quality',
    outputSchema: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string(),
      strengths: z.array(z.string()).optional(),
      weaknesses: z.array(z.string()).optional(),
      accountsForSeasonality: z.boolean(),
      usesHistoricalData: z.boolean(),
      acknowledgesUncertainty: z.boolean(),
    }),
    createPrompt: ({ results }) => {
      const data = results.preprocessStepResult as any;
      return `You are evaluating the demand forecasting approach used in an inventory decision.

Historical Data:
- Last Year Same Period: ${data.lastYearSales}
- Last Month Sales: ${data.lastMonthSales}
- Seasonal Pattern: ${data.seasonalPattern}
- Growth Trend: ${data.growthTrend}

Forecast Made:
- Predicted Demand (next 21 days): ${data.forecastedDemand}
- Confidence Level: ${data.confidenceLevel}
- Method Used: ${data.forecastMethod}

Evaluate the forecast quality:
- 90-100: Excellent - Uses multiple data points, considers seasonality, realistic
- 70-89: Good - Reasonable forecast with solid basis
- 50-69: Adequate - Basic forecast but could be more sophisticated
- 30-49: Poor - Weak methodology or ignores key factors
- 0-29: Very poor - Unrealistic or not data-driven

Consider:
1. Does it account for seasonality?
2. Does it consider year-over-year trends?
3. Is it based on actual data or guesswork?
4. Is the confidence level realistic?
5. Does it acknowledge uncertainty?

Return JSON with score, reasoning, strengths, weaknesses, and boolean flags.`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (r.score || 0) / 100;
  })
  .generateReason(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return r.reasoning || 'No reasoning provided';
  });

// ============================================
// 5. CONSTRAINT COMPLIANCE SCORER
// ============================================
export const constraintComplianceScorer = createScorer({
  name: 'Constraint Compliance',
  description: 'Evaluates if the decision respects budget, storage, and operational constraints',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions: 'You are evaluating constraint compliance in inventory decisions. Return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const input = run.input as any;
    return {
      budgetAvailable: input?.budgetAvailable || 0,
      storageCapacity: input?.storageCapacity || 0,
      currentOccupiedSpace: input?.currentOccupiedSpace || 0,
      minOrderQuantity: input?.minOrderQuantity || 0,
      leadTime: input?.leadTime || 0,
      maxOrderFrequency: input?.maxOrderFrequency || '',
      decision: input?.decision || '',
      quantity: input?.quantity || 0,
      estimatedCost: input?.estimatedCost || 0,
    };
  })
  .analyze({
    description: 'Evaluate constraint compliance',
    outputSchema: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string(),
      violations: z.array(z.string()).optional(),
      recommendations: z.array(z.string()).optional(),
      budgetCompliant: z.boolean(),
      storageCompliant: z.boolean(),
      operationallyFeasible: z.boolean(),
    }),
    createPrompt: ({ results }) => {
      const data = results.preprocessStepResult as any;
      return `You are evaluating constraint compliance in an inventory decision.

Constraints:
- Budget Available: ${data.budgetAvailable}
- Storage Capacity: ${data.storageCapacity} units
- Current Occupied Space: ${data.currentOccupiedSpace} units
- Minimum Order Quantity: ${data.minOrderQuantity}
- Supplier Lead Time: ${data.leadTime} days
- Maximum Order Frequency: ${data.maxOrderFrequency}

Decision Made: ${data.decision}
Quantity: ${data.quantity}
Estimated Cost: ${data.estimatedCost}

Evaluate constraint compliance:
- 100: Perfect - Respects all constraints optimally
- 90-99: Excellent - Minor constraint considerations
- 70-89: Good - Mostly compliant with minor issues
- 50-69: Acceptable - Some constraint violations but manageable
- 30-49: Poor - Significant constraint violations
- 0-29: Failed - Major violations that make decision infeasible

Check:
1. Budget compliance (can we afford it?)
2. Storage capacity (do we have space?)
3. MOQ compliance (meets supplier requirements?)
4. Lead time consideration (ordered in time?)
5. Operational feasibility (realistic to execute?)

Return JSON with score, reasoning, violations, recommendations, and boolean flags.`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (r.score || 0) / 100;
  })
  .generateReason(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return r.reasoning || 'No reasoning provided';
  });

// ============================================
// 6. OVERALL DECISION INTELLIGENCE SCORER
// ============================================
export const overallDecisionIntelligenceScorer = createScorer({
  name: 'Overall Decision Intelligence',
  description: 'Holistic evaluation of the AI agent as an autonomous inventory manager',
  type: 'agent',
  judge: {
    model: 'google/gemini-2.5-flash',
    instructions: 'You are evaluating an AI inventory manager\'s overall performance. Return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const input = run.input as any;
    return {
      productName: input?.productName || '',
      decision: input?.decision || '',
      reasoning: input?.reasoning || '',
      dataConsidered: input?.dataConsidered || '',
      alternativesRejected: input?.alternativesRejected || '',
      riskAssessment: input?.riskAssessment || '',
    };
  })
  .analyze({
    description: 'Evaluate overall decision intelligence',
    outputSchema: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string(),
      trustLevel: z.enum(['high', 'medium', 'low']),
      keyStrengths: z.array(z.string()).optional(),
      keyWeaknesses: z.array(z.string()).optional(),
      readyForAutonomy: z.boolean(),
    }),
    createPrompt: ({ results }) => {
      const data = results.preprocessStepResult as any;
      return `You are evaluating an AI inventory manager's overall performance.

Complete Decision Package:
- Product: ${data.productName}
- Decision: ${data.decision}
- Reasoning: ${data.reasoning}
- Data Considered: ${data.dataConsidered}
- Alternatives Rejected: ${data.alternativesRejected}
- Risk Assessment: ${data.riskAssessment}

Evaluate as if this AI is replacing a human operations manager:
1. Decision Quality: Is it the right call?
2. Autonomy: Can it operate without human intervention?
3. Explainability: Would a business owner understand and trust this?
4. Risk Awareness: Does it acknowledge what could go wrong?
5. Business Impact: Will this improve profitability?

Overall Assessment:
- 90-100: Exceptional - Ready to operate autonomously, trustworthy
- 70-89: Strong - Good decision-making with minor supervision needed
- 50-69: Competent - Needs regular oversight
- 30-49: Weak - Significant supervision required
- 0-29: Poor - Not ready for autonomous operation

Would you trust this AI to manage your inventory? Why or why not?

Return JSON with:
{
  "score": number (0-100),
  "reasoning": "holistic assessment",
  "trustLevel": "high" | "medium" | "low",
  "keyStrengths": ["strength1", "strength2"],
  "keyWeaknesses": ["weakness1", "weakness2"],
  "readyForAutonomy": boolean
}`;
    },
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (r.score || 0) / 100;
  })
  .generateReason(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return r.reasoning || 'No reasoning provided';
  });

// ============================================
// EXPORT ALL SCORERS
// ============================================
export const scorers = {
  decisionAppropriatenessScorer,
  explanationQualityScorer,
  costOptimizationScorer,
  demandForecastAccuracyScorer,
  constraintComplianceScorer,
  overallDecisionIntelligenceScorer,
};

/**
 * USAGE NOTES FOR YOUR TEAM:
 * 
 * These scorers are designed to be flexible and work with your tools once they're built.
 * 
 * When you create your inventory tools, make sure they output data that includes:
 * - Product information (name, cost, current stock)
 * - Historical sales data
 * - Seasonal patterns
 * - Demand forecasts
 * - Budget and storage constraints
 * - The decision made (restock/delay/reallocate)
 * - The reasoning/explanation
 * 
 * The scorers will use this data to evaluate decision quality.
 * 
 * You can add these scorers to your agent configuration like:
 * 
 * scorers: {
 *   decisionAppropriateness: {
 *     scorer: scorers.decisionAppropriatenessScorer,
 *     sampling: { type: 'ratio', rate: 1 },
 *   },
 *   explanationQuality: {
 *     scorer: scorers.explanationQualityScorer,
 *     sampling: { type: 'ratio', rate: 1 },
 *   },
 *   // ... other scorers
 * }
 * 
 * Start with decisionAppropriatenessScorer and explanationQualityScorer,
 * then add others as your system matures.
 */
