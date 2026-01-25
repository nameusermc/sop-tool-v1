/**
 * AI Interaction Placeholders Module - SOP Tool v1
 * 
 * This module provides placeholder functions for AI-powered features.
 * All functions are designed to be easily replaced with actual AI API calls
 * (OpenAI, Anthropic Claude, Google Gemini, etc.) when ready.
 * 
 * IMPORTANT DESIGN PRINCIPLES:
 * 1. NO AUTOMATIC DATA CHANGES - All functions return suggestions only
 * 2. User must explicitly accept/apply any AI suggestions
 * 3. All functions are async-ready for real API integration
 * 4. Comprehensive documentation for easy implementation
 * 5. Configurable for different AI providers
 * 
 * INTEGRATION GUIDE:
 * 1. Import this module into SOP Create/Edit or Checklist modules
 * 2. Replace placeholder implementations with actual API calls
 * 3. Handle the returned suggestions in your UI
 * 4. Let users review and accept/reject suggestions
 * 
 * @module AIPlaceholders
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * AI Provider Configuration
 * 
 * Configure your AI provider settings here. When implementing real AI,
 * update these values with your actual API credentials and endpoints.
 * 
 * SECURITY NOTE: Never commit actual API keys to source control.
 * Use environment variables or a secure configuration system.
 */
const AI_CONFIG = {
    // Provider selection: 'openai', 'anthropic', 'google', 'azure', 'custom'
    provider: 'placeholder',
    
    // API endpoint (update when implementing real AI)
    endpoint: null,
    
    // API key placeholder (use environment variables in production)
    apiKey: null,
    
    // Model selection
    model: 'gpt-4',  // or 'claude-3-opus', 'gemini-pro', etc.
    
    // Default parameters
    defaults: {
        temperature: 0.7,      // Creativity level (0-1)
        maxTokens: 1000,       // Maximum response length
        topP: 1,               // Nucleus sampling
    },
    
    // Feature flags
    features: {
        suggestSteps: true,
        improveLanguage: true,
        formatChecklist: true,
        analyzeSOP: true,
        suggestTags: true
    },
    
    // Simulate API delay for realistic UX testing (ms)
    simulatedDelay: 1500
};

/**
 * Response status codes for AI operations
 */
const AI_STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    CANCELLED: 'cancelled',
    RATE_LIMITED: 'rate_limited',
    INVALID_INPUT: 'invalid_input'
};

// ============================================================================
// CORE AI PLACEHOLDER CLASS
// ============================================================================

/**
 * AIPlaceholders Class
 * 
 * Central class for all AI interaction placeholder functions.
 * Designed for easy extension and real AI implementation.
 */
class AIPlaceholders {
    /**
     * Initialize AIPlaceholders with optional configuration
     * @param {Object} config - Configuration overrides
     */
    constructor(config = {}) {
        this.config = { ...AI_CONFIG, ...config };
        this.requestQueue = [];
        this.isProcessing = false;
        
        // Callbacks for UI integration
        this.callbacks = {
            onStart: null,      // Called when AI request starts
            onComplete: null,   // Called when AI request completes
            onError: null,      // Called on error
            onProgress: null    // Called for progress updates (if supported)
        };
    }
    
    // ========================================================================
    // MAIN AI FUNCTIONS
    // ========================================================================
    
    /**
     * =========================================================================
     * SUGGEST STEPS
     * =========================================================================
     * 
     * Generates AI-suggested steps for an SOP based on title and description.
     * 
     * USE CASE:
     * - User creates new SOP with title "Employee Onboarding Process"
     * - User clicks "AI: Draft Steps"
     * - This function generates relevant steps
     * - User reviews and selects which steps to add
     * 
     * IMPLEMENTATION NOTES:
     * When implementing with real AI:
     * 1. Construct prompt using title, description, and context
     * 2. Send to AI API
     * 3. Parse response into structured step objects
     * 4. Return for user review (don't auto-add)
     * 
     * @param {Object} params - Input parameters
     * @param {string} params.title - SOP title
     * @param {string} params.description - SOP description (optional)
     * @param {string} params.category - SOP category/folder (optional)
     * @param {Array} params.existingSteps - Already defined steps (optional)
     * @param {number} params.targetStepCount - Desired number of steps (optional)
     * @param {string} params.tone - Desired tone: 'formal', 'casual', 'technical' (optional)
     * 
     * @returns {Promise<Object>} AI response object
     * @returns {string} return.status - Status code (success/error)
     * @returns {Array} return.suggestions - Array of suggested step objects
     * @returns {string} return.message - Human-readable message
     * @returns {Object} return.metadata - Additional response metadata
     * 
     * @example
     * const result = await ai.suggestSteps({
     *     title: 'New Employee Onboarding',
     *     description: 'Process for onboarding new team members',
     *     targetStepCount: 8
     * });
     * 
     * if (result.status === 'success') {
     *     result.suggestions.forEach(step => {
     *         console.log(`${step.order}. ${step.text}`);
     *     });
     * }
     */
    async suggestSteps(params = {}) {
        // Validate input
        if (!params.title?.trim()) {
            return this._createResponse(AI_STATUS.INVALID_INPUT, {
                message: 'SOP title is required to generate step suggestions',
                suggestions: []
            });
        }
        
        // Notify start
        this._notifyStart('suggestSteps', params);
        
        try {
            // ================================================================
            // PLACEHOLDER IMPLEMENTATION
            // Replace this section with actual AI API call
            // ================================================================
            
            /**
             * EXAMPLE PROMPT TEMPLATE:
             * 
             * System: You are an expert in creating Standard Operating Procedures.
             * Generate clear, actionable steps for the following SOP.
             * 
             * User: Create steps for an SOP titled "${params.title}".
             * Description: ${params.description || 'Not provided'}
             * Category: ${params.category || 'General'}
             * Target number of steps: ${params.targetStepCount || '5-10'}
             * 
             * Requirements:
             * - Each step should start with an action verb
             * - Steps should be clear and unambiguous
             * - Include any necessary warnings or notes
             * - Order steps logically
             * 
             * Return as JSON array with format:
             * [{ "order": 1, "text": "Step text", "note": "Optional note" }]
             */
            
            // Simulate API delay
            await this._simulateDelay();
            
            // Generate placeholder suggestions based on title keywords
            const suggestions = this._generatePlaceholderSteps(params);
            
            // ================================================================
            // END PLACEHOLDER IMPLEMENTATION
            // ================================================================
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: `Generated ${suggestions.length} step suggestions`,
                suggestions: suggestions,
                metadata: {
                    model: this.config.model,
                    inputTokens: null,  // Populate with real values
                    outputTokens: null,
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('suggestSteps', response);
            return response;
            
        } catch (error) {
            return this._handleError('suggestSteps', error);
        }
    }
    
    /**
     * =========================================================================
     * IMPROVE STEP LANGUAGE
     * =========================================================================
     * 
     * Improves the clarity, grammar, and action-orientation of a step.
     * 
     * USE CASE:
     * - User has step: "make sure to check the forms"
     * - User clicks "AI: Improve" on that step
     * - AI suggests: "Verify all required forms are complete and signed"
     * - User can accept, modify, or reject the suggestion
     * 
     * IMPLEMENTATION NOTES:
     * When implementing with real AI:
     * 1. Send the step text with context (SOP title, surrounding steps)
     * 2. Request improvements for clarity and action language
     * 3. Return original + improved version for comparison
     * 4. Let user choose which to keep
     * 
     * @param {Object} params - Input parameters
     * @param {string} params.stepId - Step identifier
     * @param {string} params.stepText - Current step text
     * @param {string} params.stepNote - Current step note (optional)
     * @param {Object} params.context - Additional context
     * @param {string} params.context.sopTitle - Parent SOP title
     * @param {Array} params.context.allSteps - All steps for context
     * @param {number} params.context.stepIndex - Position in step list
     * @param {string} params.improvementFocus - Focus area: 'clarity', 'brevity', 'action', 'all'
     * 
     * @returns {Promise<Object>} AI response object
     * @returns {string} return.status - Status code
     * @returns {Object} return.original - Original step data
     * @returns {Object} return.improved - Improved step suggestion
     * @returns {Array} return.alternatives - Alternative phrasings (optional)
     * @returns {string} return.explanation - Why changes were made
     * 
     * @example
     * const result = await ai.improveStepLanguage({
     *     stepId: 'step_123',
     *     stepText: 'check if the document is ok',
     *     context: {
     *         sopTitle: 'Document Review Process'
     *     },
     *     improvementFocus: 'clarity'
     * });
     * 
     * if (result.status === 'success') {
     *     console.log('Original:', result.original.text);
     *     console.log('Improved:', result.improved.text);
     *     console.log('Why:', result.explanation);
     * }
     */
    async improveStepLanguage(params = {}) {
        // Validate input
        if (!params.stepText?.trim()) {
            return this._createResponse(AI_STATUS.INVALID_INPUT, {
                message: 'Step text is required for improvement',
                original: null,
                improved: null
            });
        }
        
        this._notifyStart('improveStepLanguage', params);
        
        try {
            // ================================================================
            // PLACEHOLDER IMPLEMENTATION
            // Replace this section with actual AI API call
            // ================================================================
            
            /**
             * EXAMPLE PROMPT TEMPLATE:
             * 
             * System: You are an expert technical writer specializing in
             * Standard Operating Procedures. Improve the following step
             * for clarity, action-orientation, and professional language.
             * 
             * User: Improve this SOP step:
             * Original: "${params.stepText}"
             * 
             * Context:
             * - SOP Title: ${params.context?.sopTitle || 'Not provided'}
             * - Step position: ${params.context?.stepIndex || 'Unknown'}
             * - Focus: ${params.improvementFocus || 'all aspects'}
             * 
             * Requirements:
             * - Start with a strong action verb
             * - Be specific and unambiguous
             * - Keep it concise but complete
             * - Maintain the original intent
             * 
             * Return JSON:
             * {
             *   "improved": "Improved step text",
             *   "alternatives": ["Alt 1", "Alt 2"],
             *   "explanation": "Why these changes improve the step"
             * }
             */
            
            await this._simulateDelay();
            
            // Generate placeholder improvement
            const improvement = this._generatePlaceholderImprovement(params);
            
            // ================================================================
            // END PLACEHOLDER IMPLEMENTATION
            // ================================================================
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: 'Step improvement generated',
                original: {
                    stepId: params.stepId,
                    text: params.stepText,
                    note: params.stepNote || ''
                },
                improved: improvement.improved,
                alternatives: improvement.alternatives,
                explanation: improvement.explanation,
                metadata: {
                    model: this.config.model,
                    focus: params.improvementFocus || 'all',
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('improveStepLanguage', response);
            return response;
            
        } catch (error) {
            return this._handleError('improveStepLanguage', error);
        }
    }
    
    /**
     * =========================================================================
     * FORMAT CHECKLIST
     * =========================================================================
     * 
     * Formats an SOP as a print-ready or shareable checklist.
     * 
     * USE CASE:
     * - User wants to print a checklist for field use
     * - User clicks "AI: Format for Print"
     * - AI generates optimized layout with clear formatting
     * - User can print or export the formatted version
     * 
     * IMPLEMENTATION NOTES:
     * When implementing with real AI:
     * 1. Send SOP data with formatting preferences
     * 2. AI can add section headers, numbering styles, etc.
     * 3. Can generate multiple format options (compact, detailed, etc.)
     * 4. Returns formatted content (HTML, Markdown, or plain text)
     * 
     * @param {Object} params - Input parameters
     * @param {Object} params.sop - Full SOP object
     * @param {string} params.sop.title - SOP title
     * @param {string} params.sop.description - SOP description
     * @param {Array} params.sop.steps - SOP steps
     * @param {string} params.format - Output format: 'html', 'markdown', 'text'
     * @param {string} params.style - Style preset: 'compact', 'detailed', 'minimal'
     * @param {Object} params.options - Additional options
     * @param {boolean} params.options.includeNotes - Include step notes
     * @param {boolean} params.options.includeSignature - Add signature line
     * @param {boolean} params.options.includeDate - Add date field
     * @param {string} params.options.paperSize - 'letter', 'a4', 'legal'
     * 
     * @returns {Promise<Object>} AI response object
     * @returns {string} return.status - Status code
     * @returns {string} return.formatted - Formatted checklist content
     * @returns {string} return.format - Output format used
     * @returns {Object} return.printStyles - CSS for printing (if HTML)
     * 
     * @example
     * const result = await ai.formatChecklist({
     *     sop: currentSOP,
     *     format: 'html',
     *     style: 'detailed',
     *     options: {
     *         includeNotes: true,
     *         includeSignature: true
     *     }
     * });
     * 
     * if (result.status === 'success') {
     *     document.getElementById('preview').innerHTML = result.formatted;
     * }
     */
    async formatChecklist(params = {}) {
        // Validate input
        if (!params.sop?.steps?.length) {
            return this._createResponse(AI_STATUS.INVALID_INPUT, {
                message: 'SOP with steps is required for formatting',
                formatted: null
            });
        }
        
        this._notifyStart('formatChecklist', params);
        
        try {
            // ================================================================
            // PLACEHOLDER IMPLEMENTATION
            // Replace this section with actual AI API call
            // ================================================================
            
            /**
             * EXAMPLE PROMPT TEMPLATE:
             * 
             * System: You are an expert in document formatting and design.
             * Format the following SOP as a professional, print-ready checklist.
             * 
             * User: Format this SOP for printing:
             * Title: ${params.sop.title}
             * Description: ${params.sop.description}
             * Steps: ${JSON.stringify(params.sop.steps)}
             * 
             * Format: ${params.format || 'html'}
             * Style: ${params.style || 'detailed'}
             * Options: ${JSON.stringify(params.options || {})}
             * 
             * Requirements:
             * - Clear visual hierarchy
             * - Easy-to-check boxes
             * - Professional appearance
             * - Optimized for ${params.options?.paperSize || 'letter'} paper
             */
            
            await this._simulateDelay();
            
            // Generate placeholder formatted content
            const formatted = this._generatePlaceholderChecklist(params);
            
            // ================================================================
            // END PLACEHOLDER IMPLEMENTATION
            // ================================================================
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: 'Checklist formatted successfully',
                formatted: formatted.content,
                format: params.format || 'html',
                style: params.style || 'detailed',
                printStyles: formatted.printStyles,
                metadata: {
                    model: this.config.model,
                    stepCount: params.sop.steps.length,
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('formatChecklist', response);
            return response;
            
        } catch (error) {
            return this._handleError('formatChecklist', error);
        }
    }
    
    // ========================================================================
    // ADDITIONAL AI FUNCTIONS
    // ========================================================================
    
    /**
     * =========================================================================
     * SUGGEST TAGS
     * =========================================================================
     * 
     * Suggests relevant tags for an SOP based on its content.
     * 
     * @param {Object} params - Input parameters
     * @param {string} params.title - SOP title
     * @param {string} params.description - SOP description
     * @param {Array} params.steps - SOP steps
     * @param {Array} params.existingTags - Already assigned tags
     * 
     * @returns {Promise<Object>} AI response with tag suggestions
     */
    async suggestTags(params = {}) {
        if (!params.title?.trim()) {
            return this._createResponse(AI_STATUS.INVALID_INPUT, {
                message: 'SOP title is required for tag suggestions',
                suggestions: []
            });
        }
        
        this._notifyStart('suggestTags', params);
        
        try {
            await this._simulateDelay();
            
            // Placeholder tag generation
            const tags = this._generatePlaceholderTags(params);
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: `Suggested ${tags.length} tags`,
                suggestions: tags,
                metadata: {
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('suggestTags', response);
            return response;
            
        } catch (error) {
            return this._handleError('suggestTags', error);
        }
    }
    
    /**
     * =========================================================================
     * ANALYZE SOP
     * =========================================================================
     * 
     * Analyzes an SOP for completeness, clarity, and potential improvements.
     * 
     * @param {Object} params - Input parameters
     * @param {Object} params.sop - Full SOP object to analyze
     * @param {Array} params.analysisTypes - Types: 'completeness', 'clarity', 'consistency'
     * 
     * @returns {Promise<Object>} AI response with analysis results
     */
    async analyzeSOP(params = {}) {
        if (!params.sop) {
            return this._createResponse(AI_STATUS.INVALID_INPUT, {
                message: 'SOP object is required for analysis',
                analysis: null
            });
        }
        
        this._notifyStart('analyzeSOP', params);
        
        try {
            await this._simulateDelay();
            
            // Placeholder analysis
            const analysis = this._generatePlaceholderAnalysis(params);
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: 'SOP analysis complete',
                analysis: analysis,
                metadata: {
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('analyzeSOP', response);
            return response;
            
        } catch (error) {
            return this._handleError('analyzeSOP', error);
        }
    }
    
    /**
     * =========================================================================
     * SUGGEST TITLE
     * =========================================================================
     * 
     * Suggests improved titles based on SOP content.
     * 
     * @param {Object} params - Input parameters
     * @param {string} params.currentTitle - Current title
     * @param {string} params.description - SOP description
     * @param {Array} params.steps - SOP steps
     * 
     * @returns {Promise<Object>} AI response with title suggestions
     */
    async suggestTitle(params = {}) {
        this._notifyStart('suggestTitle', params);
        
        try {
            await this._simulateDelay();
            
            const suggestions = this._generatePlaceholderTitles(params);
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: `Generated ${suggestions.length} title suggestions`,
                currentTitle: params.currentTitle || '',
                suggestions: suggestions,
                metadata: {
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('suggestTitle', response);
            return response;
            
        } catch (error) {
            return this._handleError('suggestTitle', error);
        }
    }
    
    /**
     * =========================================================================
     * IMPROVE DESCRIPTION
     * =========================================================================
     * 
     * Improves SOP description for clarity and completeness.
     * 
     * @param {Object} params - Input parameters
     * @param {string} params.title - SOP title
     * @param {string} params.description - Current description
     * @param {Array} params.steps - SOP steps for context
     * 
     * @returns {Promise<Object>} AI response with improved description
     */
    async improveDescription(params = {}) {
        this._notifyStart('improveDescription', params);
        
        try {
            await this._simulateDelay();
            
            const improved = this._generatePlaceholderDescription(params);
            
            const response = this._createResponse(AI_STATUS.SUCCESS, {
                message: 'Description improved',
                original: params.description || '',
                improved: improved,
                metadata: {
                    generatedAt: new Date().toISOString()
                }
            });
            
            this._notifyComplete('improveDescription', response);
            return response;
            
        } catch (error) {
            return this._handleError('improveDescription', error);
        }
    }
    
    // ========================================================================
    // PLACEHOLDER GENERATORS
    // ========================================================================
    
    /**
     * Generate placeholder steps based on title keywords
     * @private
     */
    _generatePlaceholderSteps(params) {
        const title = params.title.toLowerCase();
        const targetCount = params.targetStepCount || 6;
        
        // Generic step templates based on common SOP patterns
        let steps = [];
        
        if (title.includes('onboard') || title.includes('new employee') || title.includes('hire')) {
            steps = [
                { text: 'Send welcome email with first-day instructions', note: 'Include parking info and dress code' },
                { text: 'Prepare workstation with necessary equipment', note: '' },
                { text: 'Set up user accounts and system access', note: 'IT ticket required' },
                { text: 'Schedule orientation meeting with HR', note: '' },
                { text: 'Assign onboarding buddy from the team', note: '' },
                { text: 'Review company policies and obtain signatures', note: '' },
                { text: 'Complete required training modules', note: '' },
                { text: 'Schedule 30-day check-in meeting', note: '' }
            ];
        } else if (title.includes('safety') || title.includes('inspection')) {
            steps = [
                { text: 'Review previous inspection reports', note: '' },
                { text: 'Gather required inspection tools and PPE', note: '' },
                { text: 'Check all emergency exits and signage', note: 'Document any obstructions' },
                { text: 'Inspect fire extinguishers and safety equipment', note: '' },
                { text: 'Verify first aid supplies are stocked', note: '' },
                { text: 'Test emergency lighting systems', note: '' },
                { text: 'Document findings in inspection log', note: '' },
                { text: 'Report any issues to facility management', note: '' }
            ];
        } else if (title.includes('maintenance') || title.includes('equipment')) {
            steps = [
                { text: 'Power down equipment and apply lockout/tagout', note: 'Safety first' },
                { text: 'Inspect equipment for visible damage or wear', note: '' },
                { text: 'Clean all components per manufacturer specs', note: '' },
                { text: 'Replace filters and consumable parts', note: '' },
                { text: 'Lubricate moving parts as required', note: '' },
                { text: 'Run diagnostic tests', note: '' },
                { text: 'Update maintenance log with work performed', note: '' },
                { text: 'Return equipment to service', note: '' }
            ];
        } else {
            // Generic process steps
            steps = [
                { text: 'Review requirements and gather necessary materials', note: '' },
                { text: 'Verify prerequisites are complete', note: '' },
                { text: 'Execute primary task steps', note: 'Follow established guidelines' },
                { text: 'Perform quality verification', note: '' },
                { text: 'Document completion and results', note: '' },
                { text: 'Notify relevant stakeholders', note: '' },
                { text: 'Archive records per retention policy', note: '' },
                { text: 'Schedule follow-up if required', note: '' }
            ];
        }
        
        // Trim to target count and add order numbers
        return steps.slice(0, targetCount).map((step, index) => ({
            id: `suggested_${Date.now()}_${index}`,
            text: step.text,
            note: step.note,
            order: index + 1,
            isAISuggestion: true
        }));
    }
    
    /**
     * Generate placeholder step improvement
     * @private
     */
    _generatePlaceholderImprovement(params) {
        const original = params.stepText;
        
        // Simple improvement rules for demonstration
        let improved = original;
        
        // Capitalize first letter
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);
        
        // Remove filler phrases
        improved = improved.replace(/make sure to /gi, '');
        improved = improved.replace(/be sure to /gi, '');
        improved = improved.replace(/don't forget to /gi, '');
        improved = improved.replace(/remember to /gi, '');
        
        // Add action verb if missing
        const actionVerbs = ['Verify', 'Complete', 'Review', 'Submit', 'Confirm', 'Ensure'];
        const startsWithVerb = /^(verify|check|complete|review|submit|confirm|ensure|create|update|send|prepare|document)/i.test(improved);
        
        if (!startsWithVerb) {
            improved = 'Verify ' + improved.charAt(0).toLowerCase() + improved.slice(1);
        }
        
        // Ensure ends with period
        if (!improved.endsWith('.') && !improved.endsWith('?') && !improved.endsWith('!')) {
            improved += '.';
        }
        
        return {
            improved: {
                stepId: params.stepId,
                text: improved,
                note: params.stepNote || ''
            },
            alternatives: [
                `Confirm ${original.toLowerCase()}.`,
                `Ensure ${original.toLowerCase()} is complete.`
            ],
            explanation: 'Improved by: capitalizing, starting with action verb, removing filler phrases, and adding punctuation.'
        };
    }
    
    /**
     * Generate placeholder formatted checklist
     * @private
     */
    _generatePlaceholderChecklist(params) {
        const sop = params.sop;
        const includeNotes = params.options?.includeNotes !== false;
        const includeSignature = params.options?.includeSignature !== false;
        const includeDate = params.options?.includeDate !== false;
        
        const content = `
<!DOCTYPE html>
<html>
<head>
    <title>${this._escapeHtml(sop.title)} - Checklist</title>
    <style>
        body { 
            font-family: Georgia, serif; 
            max-width: 700px; 
            margin: 0 auto; 
            padding: 2rem;
            line-height: 1.6;
        }
        h1 { 
            font-size: 1.5rem; 
            border-bottom: 2px solid #000; 
            padding-bottom: 0.5rem; 
        }
        .meta { 
            color: #666; 
            margin-bottom: 1.5rem; 
            font-size: 0.9rem;
        }
        .description {
            font-style: italic;
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #f5f5f5;
            border-radius: 4px;
        }
        ol { 
            padding-left: 0;
            list-style: none;
        }
        li { 
            margin-bottom: 1rem;
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }
        .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid #333;
            border-radius: 3px;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .step-content {
            flex: 1;
        }
        .step-text {
            font-weight: 500;
        }
        .step-note {
            font-size: 0.85rem;
            color: #666;
            margin-top: 0.25rem;
        }
        .signature-section {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #ccc;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
        }
        .signature-line {
            border-bottom: 1px solid #000;
            margin-top: 2rem;
            margin-bottom: 0.5rem;
        }
        .signature-label {
            font-size: 0.8rem;
            color: #666;
        }
        @media print {
            body { padding: 1rem; }
            .checkbox { -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <h1>${this._escapeHtml(sop.title)}</h1>
    
    <div class="meta">
        ${includeDate ? `<p><strong>Date:</strong> _______________</p>` : ''}
        <p><strong>Completed by:</strong> _______________</p>
    </div>
    
    ${sop.description ? `<div class="description">${this._escapeHtml(sop.description)}</div>` : ''}
    
    <ol>
        ${sop.steps.map((step, index) => `
            <li>
                <div class="checkbox"></div>
                <div class="step-content">
                    <div class="step-text">${index + 1}. ${this._escapeHtml(step.text)}</div>
                    ${includeNotes && step.note ? `<div class="step-note">💡 ${this._escapeHtml(step.note)}</div>` : ''}
                </div>
            </li>
        `).join('')}
    </ol>
    
    ${includeSignature ? `
    <div class="signature-section">
        <div>
            <div class="signature-line"></div>
            <div class="signature-label">Signature</div>
        </div>
        <div>
            <div class="signature-line"></div>
            <div class="signature-label">Date Completed</div>
        </div>
    </div>
    ` : ''}
</body>
</html>`;
        
        return {
            content: content.trim(),
            printStyles: '@media print { .checkbox { -webkit-print-color-adjust: exact; } }'
        };
    }
    
    /**
     * Generate placeholder tags
     * @private
     */
    _generatePlaceholderTags(params) {
        const title = (params.title || '').toLowerCase();
        const description = (params.description || '').toLowerCase();
        const combined = `${title} ${description}`;
        
        const tagMap = {
            'onboard': ['onboarding', 'new-hire', 'training'],
            'safety': ['safety', 'compliance', 'inspection'],
            'maintenance': ['maintenance', 'equipment', 'repair'],
            'hr': ['hr', 'human-resources', 'policy'],
            'review': ['review', 'audit', 'quality'],
            'customer': ['customer-service', 'support', 'client'],
            'training': ['training', 'learning', 'development'],
            'report': ['reporting', 'documentation', 'records']
        };
        
        const suggestedTags = [];
        
        for (const [keyword, tags] of Object.entries(tagMap)) {
            if (combined.includes(keyword)) {
                suggestedTags.push(...tags);
            }
        }
        
        // Add generic tags if none matched
        if (suggestedTags.length === 0) {
            suggestedTags.push('process', 'procedure', 'general');
        }
        
        // Remove duplicates and existing tags
        const existingTags = new Set(params.existingTags || []);
        return [...new Set(suggestedTags)].filter(tag => !existingTags.has(tag));
    }
    
    /**
     * Generate placeholder analysis
     * @private
     */
    _generatePlaceholderAnalysis(params) {
        const sop = params.sop;
        const stepCount = sop.steps?.length || 0;
        
        return {
            overallScore: 75,
            completeness: {
                score: stepCount > 5 ? 85 : 60,
                feedback: stepCount > 5 
                    ? 'Good number of steps for thorough coverage.'
                    : 'Consider adding more detailed steps for completeness.'
            },
            clarity: {
                score: 70,
                feedback: 'Some steps could be more specific with action verbs.',
                flaggedSteps: []
            },
            consistency: {
                score: 80,
                feedback: 'Step formatting is mostly consistent.'
            },
            suggestions: [
                'Consider adding estimated time for each step',
                'Add safety warnings where applicable',
                'Include references to related documents'
            ]
        };
    }
    
    /**
     * Generate placeholder title suggestions
     * @private
     */
    _generatePlaceholderTitles(params) {
        const current = params.currentTitle || 'Untitled SOP';
        
        return [
            `${current} - Standard Procedure`,
            `${current} Guidelines`,
            `${current} Protocol`,
            `How to: ${current}`
        ];
    }
    
    /**
     * Generate placeholder description improvement
     * @private
     */
    _generatePlaceholderDescription(params) {
        const title = params.title || 'this procedure';
        const original = params.description || '';
        
        if (!original) {
            return `This Standard Operating Procedure outlines the steps required to complete ${title}. Follow these steps in order to ensure consistency and compliance with established guidelines.`;
        }
        
        // Simple improvement: ensure proper punctuation and formatting
        let improved = original.trim();
        if (!improved.endsWith('.')) {
            improved += '.';
        }
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);
        
        return improved + ' Ensure all steps are completed in sequence for best results.';
    }
    
    // ========================================================================
    // UTILITY METHODS
    // ========================================================================
    
    /**
     * Create standardized response object
     * @private
     */
    _createResponse(status, data = {}) {
        return {
            status,
            timestamp: new Date().toISOString(),
            provider: this.config.provider,
            ...data
        };
    }
    
    /**
     * Handle errors consistently
     * @private
     */
    _handleError(operation, error) {
        console.error(`AI ${operation} error:`, error);
        
        const response = this._createResponse(AI_STATUS.ERROR, {
            message: error.message || 'An unexpected error occurred',
            error: {
                name: error.name,
                message: error.message
            }
        });
        
        this._notifyError(operation, response);
        return response;
    }
    
    /**
     * Simulate API delay for realistic UX testing
     * @private
     */
    async _simulateDelay() {
        if (this.config.simulatedDelay > 0) {
            await new Promise(resolve => 
                setTimeout(resolve, this.config.simulatedDelay)
            );
        }
    }
    
    /**
     * Notify listeners of operation start
     * @private
     */
    _notifyStart(operation, params) {
        if (this.callbacks.onStart) {
            this.callbacks.onStart(operation, params);
        }
    }
    
    /**
     * Notify listeners of operation completion
     * @private
     */
    _notifyComplete(operation, response) {
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete(operation, response);
        }
    }
    
    /**
     * Notify listeners of error
     * @private
     */
    _notifyError(operation, response) {
        if (this.callbacks.onError) {
            this.callbacks.onError(operation, response);
        }
    }
    
    /**
     * Escape HTML for safe output
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    // ========================================================================
    // PUBLIC CONFIGURATION METHODS
    // ========================================================================
    
    /**
     * Update configuration
     * @public
     * @param {Object} config - Configuration updates
     */
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * Register callback functions
     * @public
     * @param {string} event - Event name: 'onStart', 'onComplete', 'onError', 'onProgress'
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        } else {
            console.warn(`Unknown event: ${event}`);
        }
    }
    
    /**
     * Check if a feature is enabled
     * @public
     * @param {string} feature - Feature name
     * @returns {boolean} Whether feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.config.features[feature] === true;
    }
    
    /**
     * Get current configuration
     * @public
     * @returns {Object} Current configuration (with sensitive data masked)
     */
    getConfig() {
        return {
            ...this.config,
            apiKey: this.config.apiKey ? '***masked***' : null
        };
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a singleton instance for simple usage
 */
let defaultInstance = null;

/**
 * Get or create the default AI instance
 * @param {Object} config - Optional configuration
 * @returns {AIPlaceholders} AI instance
 */
function getAI(config = null) {
    if (!defaultInstance || config) {
        defaultInstance = new AIPlaceholders(config || {});
    }
    return defaultInstance;
}

/**
 * Shorthand function for suggesting steps
 * @param {Object} params - See AIPlaceholders.suggestSteps
 * @returns {Promise<Object>} AI response
 */
async function suggestSteps(params) {
    return getAI().suggestSteps(params);
}

/**
 * Shorthand function for improving step language
 * @param {Object} params - See AIPlaceholders.improveStepLanguage
 * @returns {Promise<Object>} AI response
 */
async function improveStepLanguage(params) {
    return getAI().improveStepLanguage(params);
}

/**
 * Shorthand function for formatting checklist
 * @param {Object} params - See AIPlaceholders.formatChecklist
 * @returns {Promise<Object>} AI response
 */
async function formatChecklist(params) {
    return getAI().formatChecklist(params);
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Factory function to create AIPlaceholders instance
 * @param {Object} config - Configuration options
 * @returns {AIPlaceholders} AIPlaceholders instance
 */
function createAIHelper(config = {}) {
    return new AIPlaceholders(config);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AIPlaceholders,
        createAIHelper,
        getAI,
        suggestSteps,
        improveStepLanguage,
        formatChecklist,
        AI_CONFIG,
        AI_STATUS
    };
} else if (typeof window !== 'undefined') {
    window.AIPlaceholders = AIPlaceholders;
    window.createAIHelper = createAIHelper;
    window.getAI = getAI;
    window.suggestSteps = suggestSteps;
    window.improveStepLanguage = improveStepLanguage;
    window.formatChecklist = formatChecklist;
    window.AI_CONFIG = AI_CONFIG;
    window.AI_STATUS = AI_STATUS;
}

// ES6 module export
export {
    AIPlaceholders,
    createAIHelper,
    getAI,
    suggestSteps,
    improveStepLanguage,
    formatChecklist,
    AI_CONFIG,
    AI_STATUS
};
