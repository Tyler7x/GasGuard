import { Analyzer, AnalysisResult, AnalyzerConfig, Severity, Finding } from '../libs/engine/core/analyzer-interface';
import { StreamAnalysisRunner, streamFiles } from '../src/analysis/runner';
import * as fs from 'fs';
import * as path from 'path';

class MockAnalyzer implements Analyzer {
  getName() { return 'MockAnalyzer'; }
  getVersion() { return '1.0.0'; }
  supportsLanguage() { return true; }
  getSupportedLanguages() { return []; }
  getRules() { return []; }
  getRule() { return undefined; }
  validateConfig() { return []; }
  async initialize() {}
  async dispose() {}

  async analyze(code: string, filePath: string, config?: AnalyzerConfig): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    if (code.includes('optimize-me')) {
      findings.push({
        ruleId: 'mock-001',
        message: 'Mock finding',
        severity: Severity.HIGH,
        location: { file: filePath, startLine: 1, endLine: 1 },
        estimatedGasSavings: 100
      });
    }
    return {
      findings,
      filesAnalyzed: 1,
      analysisTime: 5,
      analyzerVersion: '1.0.0',
      summary: {
        critical: 0,
        high: findings.length,
        medium: 0,
        low: 0,
        info: 0
      }
    };
  }

  async analyzeMultiple(files: Map<string, string>, config?: AnalyzerConfig): Promise<AnalysisResult> {
    return {
      findings: [],
      filesAnalyzed: 0,
      analysisTime: 0,
      analyzerVersion: '1.0.0',
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    };
  }
}

describe('StreamAnalysisRunner', () => {
  const testDir = path.join(__dirname, 'temp_runner_test_dir');
  const file1 = path.join(testDir, 'contract1.sol');
  const file2 = path.join(testDir, 'contract2.rs');
  const file3 = path.join(testDir, 'ignored.txt');

  beforeAll(async () => {
    // Set up test directory and fixtures
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    fs.writeFileSync(file1, '// optimize-me\ncontract Test1 {}');
    fs.writeFileSync(file2, '// clean code\nfn main() {}');
    fs.writeFileSync(file3, '// optimize-me but wrong extension');
  });

  afterAll(async () => {
    // Clean up fixtures
    if (fs.existsSync(file1)) fs.unlinkSync(file1);
    if (fs.existsSync(file2)) fs.unlinkSync(file2);
    if (fs.existsSync(file3)) fs.unlinkSync(file3);
    if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
  });

  it('streams file scanning and yields findings one-by-one', async () => {
    const analyzer = new MockAnalyzer();
    const runner = new StreamAnalysisRunner(analyzer, { enableGC: false });
    
    const filePaths = [file1, file2];
    const generator = runner.analyzeStream(filePaths);
    
    const findings: Finding[] = [];
    let next = await generator.next();
    
    while (!next.done) {
      findings.push(next.value);
      next = await generator.next();
    }
    
    const finalResult = next.value;
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('mock-001');
    expect(findings[0].location.file).toBe(file1);
    
    expect(finalResult.filesAnalyzed).toBe(2);
    expect(finalResult.totalFindings).toBe(1);
    expect(finalResult.summary.high).toBe(1);
    expect(finalResult.totalEstimatedGasSavings).toBe(100);
  });

  it('triggers garbage collection when heap limit or batch size is exceeded', async () => {
    const mockGC = jest.fn();
    const originalGC = global.gc;
    global.gc = mockGC;

    try {
      const analyzer = new MockAnalyzer();
      // Configure batchSize to 1 to force GC after each file
      const runner = new StreamAnalysisRunner(analyzer, {
        enableGC: true,
        batchSize: 1
      });

      const filePaths = [file1, file2];
      const generator = runner.analyzeStream(filePaths);
      
      let next = await generator.next();
      while (!next.done) {
        next = await generator.next();
      }

      // GC should have been called during execution and at the end
      expect(mockGC).toHaveBeenCalled();
    } finally {
      global.gc = originalGC;
    }
  });

  describe('streamFiles directory walker', () => {
    it('yields scannable files from directory recursively while filtering exclusions', async () => {
      const foundFiles: string[] = [];
      for await (const filePath of streamFiles(testDir)) {
        foundFiles.push(filePath);
      }

      expect(foundFiles).toContain(file1);
      expect(foundFiles).toContain(file2);
      expect(foundFiles).not.toContain(file3); // txt not allowed extension
    });
  });
});
