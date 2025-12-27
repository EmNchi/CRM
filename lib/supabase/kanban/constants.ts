/**
 * Kanban Constants
 * 
 * Centralized configuration for pipeline-specific behavior.
 * This allows changing business rules without modifying code logic.
 */

// Pipeline names that have special behavior
export const DEPARTMENT_PIPELINES = ['Saloane', 'Horeca', 'Frizerii', 'Reparatii'] as const
export type DepartmentPipelineName = typeof DEPARTMENT_PIPELINES[number]

// Special pipeline names
export const RECEPTIE_PIPELINE_NAME = 'receptie'
export const CURIER_PIPELINE_NAME = 'curier'
export const REPARATII_PIPELINE_NAME = 'Reparatii'

// Stage name patterns for matching
export const STAGE_PATTERNS = {
  IN_LUCRU: ['in lucru', 'in work', 'in progress'],
  IN_ASTEPTARE: ['in asteptare', 'asteptare'],
  FINALIZARE: ['finalizare', 'finalized', 'done'],
  DE_FACTURAT: ['facturat', 'to invoice'],
  NOUA: ['noua', 'new'],
  ASTEPT_PIESE: ['astept piese', 'asteptare piese', 'waiting parts'],
} as const

// Cache configuration
export const CACHE_TTL = 60000 // 1 minute

// Pricing configuration
export const URGENT_MARKUP_PCT = 30 // +30% for urgent items

/**
 * Check if a pipeline name matches a pattern
 */
export function isPipelineType(pipelineName: string, type: 'receptie' | 'curier' | 'department'): boolean {
  const nameLower = pipelineName.toLowerCase()
  
  switch (type) {
    case 'receptie':
      return nameLower.includes(RECEPTIE_PIPELINE_NAME)
    case 'curier':
      return nameLower.includes(CURIER_PIPELINE_NAME)
    case 'department':
      return DEPARTMENT_PIPELINES.some(dept => 
        nameLower === dept.toLowerCase() || nameLower.includes(dept.toLowerCase())
      )
    default:
      return false
  }
}

/**
 * Check if a stage name matches a pattern
 */
export function matchesStagePattern(
  stageName: string, 
  pattern: keyof typeof STAGE_PATTERNS
): boolean {
  const nameLower = stageName.toLowerCase()
  return STAGE_PATTERNS[pattern].some(p => nameLower.includes(p))
}

/**
 * Find a stage matching a pattern in a list of stages
 */
export function findStageByPattern(
  stages: Array<{ id: string; name: string }>,
  pattern: keyof typeof STAGE_PATTERNS
): { id: string; name: string } | undefined {
  return stages.find(s => matchesStagePattern(s.name, pattern))
}

