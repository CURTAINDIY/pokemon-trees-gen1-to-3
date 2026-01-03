// src/lib/diagnostics/errorHandler.ts
// Enhanced error handling and diagnostic system inspired by PKHeX.Everywhere
// Provides detailed error reporting, recovery suggestions, and diagnostic tools

export interface DiagnosticReport {
  timestamp: number;
  context: DiagnosticContext;
  errors: DetailedError[];
  warnings: DetailedWarning[];
  performance: PerformanceMetrics;
  systemInfo: SystemInfo;
  recoveryActions: RecoveryAction[];
}

export interface DiagnosticContext {
  operation: string;
  filename?: string;
  saveType?: 'gen1' | 'gen2' | 'gen3';
  fileSize?: number;
  userAgent?: string;
}

export interface DetailedError {
  id: string;
  type: ErrorType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: ErrorCategory;
  message: string;
  technicalDetails: string;
  userFriendlyMessage: string;
  stackTrace?: string;
  relatedData?: any;
  timestamp: number;
  recoverable: boolean;
  autoRetryable: boolean;
}

export interface DetailedWarning {
  id: string;
  type: WarningType;
  message: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  dismissible: boolean;
}

export interface PerformanceMetrics {
  operationDuration: number;
  memoryUsage?: number;
  fileProcessingTime?: number;
  compressionTime?: number;
  validationTime?: number;
}

export interface SystemInfo {
  browserName: string;
  browserVersion: string;
  platform: string;
  memoryLimit?: number;
  indexedDbSupport: boolean;
  webCryptoSupport: boolean;
}

export interface RecoveryAction {
  id: string;
  description: string;
  type: 'automatic' | 'user' | 'manual';
  priority: number;
  action: () => Promise<void> | void;
  condition?: () => boolean;
}

export type ErrorType = 
  | 'SAVE_FILE_CORRUPT' 
  | 'INVALID_FORMAT' 
  | 'CHECKSUM_FAILURE'
  | 'MEMORY_OVERFLOW'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'CONVERSION_ERROR'
  | 'VALIDATION_ERROR'
  | 'BROWSER_COMPATIBILITY'
  | 'USER_INPUT_ERROR';

export type ErrorCategory = 
  | 'FILE_PROCESSING' 
  | 'DATA_VALIDATION' 
  | 'STORAGE' 
  | 'CONVERSION' 
  | 'SYSTEM' 
  | 'USER_ERROR';

export type WarningType = 
  | 'DATA_LOSS_POSSIBLE'
  | 'COMPATIBILITY_ISSUE' 
  | 'PERFORMANCE_CONCERN'
  | 'DEPRECATED_FEATURE'
  | 'UNUSUAL_DATA'
  | 'EMULATOR_ARTIFACT';

/**
 * Enhanced error handling system with comprehensive diagnostics
 */
export class DiagnosticSystem {
  private static instance: DiagnosticSystem;
  private diagnosticHistory: DiagnosticReport[] = [];
  private errorCounts: Map<string, number> = new Map();

  static getInstance(): DiagnosticSystem {
    if (!this.instance) {
      this.instance = new DiagnosticSystem();
    }
    return this.instance;
  }

  /**
   * Create a comprehensive diagnostic report for an error scenario
   */
  async createDiagnosticReport(
    context: DiagnosticContext, 
    error?: Error, 
    additionalData?: any
  ): Promise<DiagnosticReport> {
    const startTime = performance.now();
    
    const report: DiagnosticReport = {
      timestamp: Date.now(),
      context,
      errors: [],
      warnings: [],
      performance: {
        operationDuration: 0
      },
      systemInfo: await this.gatherSystemInfo(),
      recoveryActions: []
    };

    // Process the main error if provided
    if (error) {
      const detailedError = await this.analyzeError(error, context, additionalData);
      report.errors.push(detailedError);
      
      // Generate recovery actions based on error type
      report.recoveryActions = this.generateRecoveryActions(detailedError, context);
    }

    // Analyze context for potential issues
    const contextAnalysis = await this.analyzeContext(context);
    report.warnings.push(...contextAnalysis.warnings);
    
    // Performance analysis
    const endTime = performance.now();
    report.performance.operationDuration = endTime - startTime;
    
    // Memory usage if available
    if ('memory' in performance) {
      report.performance.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    // Store in history for pattern analysis
    this.diagnosticHistory.push(report);
    this.maintainHistoryLimit();

    return report;
  }

  /**
   * Analyze an error and create detailed error information
   */
  private async analyzeError(
    error: Error, 
    context: DiagnosticContext, 
    additionalData?: any
  ): Promise<DetailedError> {
    const errorId = this.generateErrorId(error, context);
    const errorType = this.classifyError(error, context);
    const category = this.categorizeError(errorType);
    
    // Track error frequency
    const count = this.errorCounts.get(errorId) || 0;
    this.errorCounts.set(errorId, count + 1);

    const detailedError: DetailedError = {
      id: errorId,
      type: errorType,
      severity: this.determineSeverity(errorType, count),
      category,
      message: error.message,
      technicalDetails: this.extractTechnicalDetails(error, additionalData),
      userFriendlyMessage: this.generateUserFriendlyMessage(errorType, context),
      stackTrace: error.stack,
      relatedData: additionalData,
      timestamp: Date.now(),
      recoverable: this.isRecoverable(errorType),
      autoRetryable: this.isAutoRetryable(errorType, count)
    };

    return detailedError;
  }

  /**
   * Classify error into specific types
   */
  private classifyError(error: Error, context: DiagnosticContext): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Save file related errors
    if (message.includes('checksum') || message.includes('invalid signature')) {
      return 'CHECKSUM_FAILURE';
    }
    
    if (message.includes('not detected as valid') || message.includes('unsupported format')) {
      return 'INVALID_FORMAT';
    }
    
    if (message.includes('corrupt') || message.includes('malformed')) {
      return 'SAVE_FILE_CORRUPT';
    }

    // Memory and storage errors
    if (name.includes('rangeerror') || message.includes('out of memory')) {
      return 'MEMORY_OVERFLOW';
    }
    
    if (message.includes('indexeddb') || message.includes('storage')) {
      return 'STORAGE_ERROR';
    }

    // Network errors
    if (name.includes('networkerror') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }

    // Conversion errors
    if (context.operation.includes('convert') || message.includes('conversion')) {
      return 'CONVERSION_ERROR';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }

    // Browser compatibility
    if (message.includes('not supported') || message.includes('unavailable')) {
      return 'BROWSER_COMPATIBILITY';
    }

    // Default to user input error
    return 'USER_INPUT_ERROR';
  }

  /**
   * Categorize errors for reporting
   */
  private categorizeError(errorType: ErrorType): ErrorCategory {
    const categoryMap: Record<ErrorType, ErrorCategory> = {
      'SAVE_FILE_CORRUPT': 'FILE_PROCESSING',
      'INVALID_FORMAT': 'FILE_PROCESSING', 
      'CHECKSUM_FAILURE': 'DATA_VALIDATION',
      'MEMORY_OVERFLOW': 'SYSTEM',
      'NETWORK_ERROR': 'SYSTEM',
      'STORAGE_ERROR': 'STORAGE',
      'CONVERSION_ERROR': 'CONVERSION',
      'VALIDATION_ERROR': 'DATA_VALIDATION',
      'BROWSER_COMPATIBILITY': 'SYSTEM',
      'USER_INPUT_ERROR': 'USER_ERROR'
    };

    return categoryMap[errorType];
  }

  /**
   * Determine error severity based on type and frequency
   */
  private determineSeverity(errorType: ErrorType, count: number): 'critical' | 'high' | 'medium' | 'low' {
    // Critical errors that completely block functionality
    if (['SAVE_FILE_CORRUPT', 'MEMORY_OVERFLOW', 'BROWSER_COMPATIBILITY'].includes(errorType)) {
      return 'critical';
    }

    // High severity for data integrity issues
    if (['CHECKSUM_FAILURE', 'STORAGE_ERROR'].includes(errorType)) {
      return 'high';
    }

    // Medium severity for functionality issues
    if (['INVALID_FORMAT', 'CONVERSION_ERROR', 'VALIDATION_ERROR'].includes(errorType)) {
      return 'medium';
    }

    // Escalate severity for repeated errors
    if (count > 3) {
      return 'high';
    } else if (count > 1) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate user-friendly error messages
   */
  private generateUserFriendlyMessage(errorType: ErrorType, context: DiagnosticContext): string {
    const messageMap: Record<ErrorType, string> = {
      'SAVE_FILE_CORRUPT': `The save file "${context.filename}" appears to be corrupted or damaged. This could be due to incomplete download or emulator issues.`,
      'INVALID_FORMAT': `The file "${context.filename}" is not a recognized Pokémon save file format. Please ensure it's a valid .sav file from a Game Boy or GBA emulator.`,
      'CHECKSUM_FAILURE': `The save file has checksum errors, which may indicate data corruption. The file might still be usable but some data could be inconsistent.`,
      'MEMORY_OVERFLOW': 'Your browser has run out of memory while processing this large file. Try closing other tabs or using a different browser.',
      'NETWORK_ERROR': 'Network connection issues prevented the operation from completing. Please check your internet connection and try again.',
      'STORAGE_ERROR': 'Unable to save data to your browser storage. Your storage might be full or disabled. Try clearing some browser data.',
      'CONVERSION_ERROR': 'Failed to convert Pokémon data between generations. The source data may be invalid or contain unsupported features.',
      'VALIDATION_ERROR': 'Data validation failed during processing. This usually indicates corrupted or non-standard save data.',
      'BROWSER_COMPATIBILITY': 'Your browser does not support required features for this application. Please update your browser or try a different one.',
      'USER_INPUT_ERROR': 'There was an issue with the provided input. Please check your file and try again.'
    };

    return messageMap[errorType] || 'An unexpected error occurred. Please try again or contact support.';
  }

  /**
   * Extract technical details for debugging
   */
  private extractTechnicalDetails(error: Error, additionalData?: any): string {
    const details: string[] = [];
    
    details.push(`Error: ${error.name}: ${error.message}`);
    
    if (additionalData) {
      if (additionalData.fileSize) {
        details.push(`File size: ${additionalData.fileSize} bytes`);
      }
      if (additionalData.operation) {
        details.push(`Operation: ${additionalData.operation}`);
      }
      if (additionalData.validationResult) {
        details.push(`Validation: ${JSON.stringify(additionalData.validationResult, null, 2)}`);
      }
    }
    
    return details.join('\n');
  }

  /**
   * Determine if an error type is recoverable
   */
  private isRecoverable(errorType: ErrorType): boolean {
    const recoverableTypes: ErrorType[] = [
      'NETWORK_ERROR',
      'STORAGE_ERROR', 
      'USER_INPUT_ERROR',
      'VALIDATION_ERROR'
    ];
    
    return recoverableTypes.includes(errorType);
  }

  /**
   * Determine if an error can be automatically retried
   */
  private isAutoRetryable(errorType: ErrorType, count: number): boolean {
    // Don't auto-retry if we've failed too many times
    if (count > 2) return false;
    
    const retryableTypes: ErrorType[] = [
      'NETWORK_ERROR',
      'STORAGE_ERROR'
    ];
    
    return retryableTypes.includes(errorType);
  }

  /**
   * Generate recovery actions based on error analysis
   */
  private generateRecoveryActions(error: DetailedError, _context: DiagnosticContext): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (error.type) {
      case 'SAVE_FILE_CORRUPT':
        actions.push({
          id: 'try_different_emulator_format',
          description: 'Try exporting the save in a different format from your emulator',
          type: 'manual',
          priority: 1,
          action: async () => {
            console.info('User should try different emulator export format');
          }
        });
        break;

      case 'INVALID_FORMAT':
        actions.push({
          id: 'validate_file_format',
          description: 'Verify that this is a valid Pokémon save file',
          type: 'user',
          priority: 1,
          action: async () => {
            // Could open a format validation dialog
          }
        });
        break;

      case 'MEMORY_OVERFLOW':
        actions.push({
          id: 'clear_memory',
          description: 'Clear browser memory and try again',
          type: 'automatic',
          priority: 1,
          action: async () => {
            // Clear caches, temporary data
            if ('gc' in window) {
              (window as any).gc();
            }
          }
        });
        break;

      case 'STORAGE_ERROR':
        actions.push({
          id: 'clear_old_data',
          description: 'Clear old save data to free up storage space',
          type: 'user',
          priority: 2,
          action: async () => {
            // Implement storage cleanup
          }
        });
        break;

      case 'NETWORK_ERROR':
        if (error.autoRetryable) {
          actions.push({
            id: 'auto_retry',
            description: 'Automatically retry the operation',
            type: 'automatic',
            priority: 1,
            action: async () => {
              // Implement auto-retry logic
              console.info('Retrying network operation...');
            }
          });
        }
        break;
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Analyze context for potential warnings
   */
  private async analyzeContext(context: DiagnosticContext): Promise<{ warnings: DetailedWarning[] }> {
    const warnings: DetailedWarning[] = [];

    // File size analysis
    if (context.fileSize) {
      if (context.fileSize > 200000) {
        warnings.push({
          id: 'large_file_warning',
          type: 'PERFORMANCE_CONCERN',
          message: 'File is larger than expected for a Pokémon save',
          suggestion: 'Consider checking if this file contains extra emulator data',
          impact: 'medium',
          dismissible: true
        });
      }
      
      if (context.fileSize < 10000) {
        warnings.push({
          id: 'small_file_warning', 
          type: 'UNUSUAL_DATA',
          message: 'File is smaller than expected for a Pokémon save',
          suggestion: 'Verify this is a complete save file',
          impact: 'high',
          dismissible: false
        });
      }
    }

    // Browser compatibility warnings
    const systemInfo = await this.gatherSystemInfo();
    if (!systemInfo.indexedDbSupport) {
      warnings.push({
        id: 'indexeddb_unsupported',
        type: 'COMPATIBILITY_ISSUE',
        message: 'IndexedDB not supported in this browser',
        suggestion: 'Use a modern browser for full functionality',
        impact: 'high',
        dismissible: false
      });
    }

    return { warnings };
  }

  /**
   * Gather system information for diagnostics
   */
  private async gatherSystemInfo(): Promise<SystemInfo> {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Parse browser information
    const browserInfo = this.parseBrowserInfo(userAgent);

    return {
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
      platform,
      indexedDbSupport: 'indexedDB' in window,
      webCryptoSupport: 'crypto' in window && 'subtle' in window.crypto,
      memoryLimit: 'memory' in performance ? (performance as any).memory.jsHeapSizeLimit : undefined
    };
  }

  /**
   * Parse browser information from user agent
   */
  private parseBrowserInfo(userAgent: string): { name: string; version: string } {
    // Simplified browser detection
    if (userAgent.includes('Chrome')) {
      const match = userAgent.match(/Chrome\/([0-9.]+)/);
      return { name: 'Chrome', version: match ? match[1] : 'Unknown' };
    } else if (userAgent.includes('Firefox')) {
      const match = userAgent.match(/Firefox\/([0-9.]+)/);
      return { name: 'Firefox', version: match ? match[1] : 'Unknown' };
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      const match = userAgent.match(/Version\/([0-9.]+)/);
      return { name: 'Safari', version: match ? match[1] : 'Unknown' };
    } else if (userAgent.includes('Edge')) {
      const match = userAgent.match(/Edge\/([0-9.]+)/);
      return { name: 'Edge', version: match ? match[1] : 'Unknown' };
    }
    
    return { name: 'Unknown', version: 'Unknown' };
  }

  /**
   * Generate a unique error ID for tracking
   */
  private generateErrorId(error: Error, context: DiagnosticContext): string {
    const components = [
      context.operation,
      error.name,
      error.message.substring(0, 50) // First 50 chars of message
    ];
    
    return btoa(components.join('|')).substring(0, 16);
  }

  /**
   * Maintain diagnostic history within reasonable limits
   */
  private maintainHistoryLimit(): void {
    const maxHistorySize = 100;
    if (this.diagnosticHistory.length > maxHistorySize) {
      this.diagnosticHistory = this.diagnosticHistory.slice(-maxHistorySize);
    }
  }

  /**
   * Get diagnostic history for analysis
   */
  getDiagnosticHistory(): DiagnosticReport[] {
    return [...this.diagnosticHistory];
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): Map<string, number> {
    return new Map(this.errorCounts);
  }

  /**
   * Export diagnostic report for support
   */
  exportDiagnosticReport(report: DiagnosticReport): string {
    const exportData = {
      ...report,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    return JSON.stringify(exportData, null, 2);
  }
}

/**
 * Enhanced error wrapper that automatically generates diagnostic reports
 */
export class DiagnosticError extends Error {
  public diagnosticReport?: DiagnosticReport;

  constructor(
    message: string,
    public context: DiagnosticContext,
    public originalError?: Error,
    public additionalData?: any
  ) {
    super(message);
    this.name = 'DiagnosticError';
    
    // Generate diagnostic report asynchronously
    this.generateDiagnosticReport();
  }

  private async generateDiagnosticReport(): Promise<void> {
    const diagnostics = DiagnosticSystem.getInstance();
    this.diagnosticReport = await diagnostics.createDiagnosticReport(
      this.context,
      this.originalError || this,
      this.additionalData
    );
  }

  getDiagnosticReport(): DiagnosticReport | undefined {
    return this.diagnosticReport;
  }
}

/**
 * Utility function to wrap operations with enhanced error handling
 */
export async function withDiagnostics<T>(
  operation: () => Promise<T> | T,
  context: DiagnosticContext
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    
    // Log successful operation for performance tracking
    const endTime = performance.now();
    console.info(`✅ ${context.operation} completed in ${(endTime - startTime).toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    const diagnostics = DiagnosticSystem.getInstance();
    const report = await diagnostics.createDiagnosticReport(
      context,
      error as Error,
      { operation: context.operation, duration: performance.now() - startTime }
    );

    console.error(`❌ ${context.operation} failed:`, report);
    
    // Throw enhanced error with diagnostic information
    throw new DiagnosticError(
      `${context.operation} failed: ${(error as Error).message}`,
      context,
      error as Error,
      { diagnosticReport: report }
    );
  }
}