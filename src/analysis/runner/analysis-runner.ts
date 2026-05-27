import * as fs from 'fs';
import * as path from 'path';
import { Analyzer, Finding, AnalysisResult, AnalyzerConfig } from '../../../libs/engine/core/analyzer-interface';

export interface RunnerOptions {
  /** Maximum heap memory usage (in bytes) allowed before forcing garbage collection. Default: 150MB */
  memoryThreshold?: number;
  /** Number of files to process before performing a garbage collection check. Default: 10 */
  batchSize?: number;
  /** Enable explicit garbage collection calls (calls global.gc()). Default: true */
  enableGC?: boolean;
}

export class StreamAnalysisRunner {
  constructor(
    private readonly analyzer: Analyzer,
    private readonly options: RunnerOptions = {}
  ) {}

  /**
   * Streams the analysis of files one-by-one or in small batches.
   * Yields findings as they are detected to minimize memory footprint.
   * Runs explicit garbage collection when memory thresholds or batch sizes are exceeded.
   */
  async *analyzeStream(
    filePaths: string[] | AsyncIterable<string> | Iterable<string>,
    config?: AnalyzerConfig
  ): AsyncGenerator<Finding, Omit<AnalysisResult, 'findings'> & { totalFindings: number }, unknown> {
    const startTime = Date.now();
    let filesAnalyzed = 0;
    let totalFindings = 0;
    
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    
    let totalEstimatedGasSavings = 0;
    const errors: Array<{ file: string; message: string; error?: Error }> = [];

    const memoryThreshold = this.options.memoryThreshold ?? 150 * 1024 * 1024; // 150 MB
    const batchSize = this.options.batchSize ?? 10;
    const enableGC = this.options.enableGC ?? true;

    // Helper to run garbage collection if requested and available
    const runGarbageCollection = () => {
      if (enableGC && typeof global.gc === 'function') {
        try {
          global.gc();
        } catch (e) {
          // gc is not exposed or fails
        }
      }
    };

    let count = 0;
    for await (const filePath of filePaths) {
      if (!filePath) continue;

      let code: string | null = null;
      let result: AnalysisResult | null = null;

      try {
        // Stream processing: read file asynchronously
        code = await fs.promises.readFile(filePath, 'utf8');
        
        // Execute analysis on file contents
        result = await this.analyzer.analyze(code, filePath, config);
        
        filesAnalyzed++;

        if (result.findings && result.findings.length > 0) {
          for (const finding of result.findings) {
            totalFindings++;
            summary[finding.severity]++;
            if (finding.estimatedGasSavings) {
              totalEstimatedGasSavings += finding.estimatedGasSavings;
            }
            yield finding;
          }
        }

        if (result.errors) {
          errors.push(...result.errors);
        }
      } catch (error) {
        errors.push({
          file: filePath,
          message: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error : undefined,
        });
      } finally {
        // Garbage collection optimization: Dereference heavy objects immediately
        code = null;
        result = null;
      }

      count++;

      // Trigger garbage collection if we hit the batch size or exceed memory threshold
      if (count % batchSize === 0 || process.memoryUsage().heapUsed > memoryThreshold) {
        runGarbageCollection();
      }
    }

    // Perform final clean up
    runGarbageCollection();

    const analysisTime = Date.now() - startTime;

    return {
      filesAnalyzed,
      totalFindings,
      analysisTime,
      analyzerVersion: this.analyzer.getVersion(),
      summary,
      totalEstimatedGasSavings: totalEstimatedGasSavings > 0 ? totalEstimatedGasSavings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * Async generator that recursively streams file paths from a directory,
 * yielding paths one by one to avoid loading all file paths into memory.
 */
export async function* streamFiles(
  dirPath: string,
  allowedExtensions: string[] = ['.sol', '.vy', '.rs'],
  excludePaths: string[] = ['node_modules', '.git', 'dist', 'build', 'target']
): AsyncGenerator<string, void, unknown> {
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    console.warn(`[Stream Files] Cannot read directory ${dirPath}: ${err}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    // Check if the current entry name or path matches any exclude patterns
    if (excludePaths.some(exclude => entry.name === exclude || fullPath.includes(exclude))) {
      continue;
    }

    if (entry.isDirectory()) {
      yield* streamFiles(fullPath, allowedExtensions, excludePaths);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (allowedExtensions.includes(ext)) {
        yield fullPath;
      }
    }
  }
}
