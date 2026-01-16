/**
 * AI Tools Configuration & Utilities
 * Enhanced tool management with better organization
 */

export type ToolSection = 'GENERATIVE' | 'ANALYTIC';

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  section: ToolSection;
  icon: string;
  enabled: boolean;
  beta?: boolean;
}

/**
 * Tool registry with metadata
 */
export const TOOL_REGISTRY: Record<string, ToolConfig> = {
  generativeStudio: {
    id: 'generativeStudio',
    name: 'Generative Studio',
    description: 'Create high-quality images using advanced AI models',
    section: 'GENERATIVE',
    icon: 'ImagePlus',
    enabled: true,
    beta: false
  },
  neuralVision: {
    id: 'neuralVision',
    name: 'Neural Vision',
    description: 'Analyze and inspect visual content with AI',
    section: 'ANALYTIC',
    icon: 'Aperture',
    enabled: true,
    beta: false
  },
  codeIntel: {
    id: 'codeIntel',
    name: 'Code Intel',
    description: 'Intelligent code analysis and generation',
    section: 'GENERATIVE',
    icon: 'Code',
    enabled: true,
    beta: true
  },
  dataProcessor: {
    id: 'dataProcessor',
    name: 'Data Processor',
    description: 'Extract, transform and analyze structured data',
    section: 'ANALYTIC',
    icon: 'Database',
    enabled: true,
    beta: true
  }
};

/**
 * Get tools by section
 */
export const getToolsBySection = (section: ToolSection) => {
  return Object.values(TOOL_REGISTRY).filter(
    tool => tool.section === section && tool.enabled
  );
};

/**
 * Get all enabled tools
 */
export const getEnabledTools = () => {
  return Object.values(TOOL_REGISTRY).filter(tool => tool.enabled);
};

/**
 * Check if tool is available
 */
export const isToolAvailable = (toolId: string): boolean => {
  const tool = TOOL_REGISTRY[toolId];
  return tool?.enabled === true;
};
