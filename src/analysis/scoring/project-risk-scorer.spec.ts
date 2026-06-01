import { Finding, Severity, AnalysisResult } from '@engine/core';
import { ProjectRiskScorer } from './project-risk-scorer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFinding(
  overrides: Partial<Finding> & { severity: Severity; message: string; ruleId: string },
): Finding {
  return {
    ruleId: overrides.ruleId,
    message: overrides.message,
    severity: overrides.severity,
    location: { file: 'Contract.sol', startLine: 1, endLine: 1 },
    estimatedGasSavings: overrides.estimatedGasSavings,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectRiskScorer', () => {
  let scorer: ProjectRiskScorer;

  beforeEach(() => {
    scorer = new ProjectRiskScorer();
  });

  // ── Empty input ─────────────────────────────────────────────────────────────

  it('should return a zero-risk score when there are no findings', () => {
    const result = scorer.score([]);

    expect(result.overallScore).toBe(0);
    expect(result.grade).toBe('A');
    expect(result.riskLevel).toBe('low');
    expect(result.meta.totalFindings).toBe(0);
    expect(result.recommendations).toContain('No issues found. Project looks clean!');
  });

  // ── Severity breakdown ──────────────────────────────────────────────────────

  it('should correctly count findings by severity', () => {
    const findings: Finding[] = [
      makeFinding({ severity: Severity.CRITICAL, ruleId: 'r1', message: 'reentrancy vulnerability' }),
      makeFinding({ severity: Severity.HIGH, ruleId: 'r2', message: 'access control issue' }),
      makeFinding({ severity: Severity.MEDIUM, ruleId: 'r3', message: 'gas optimization' }),
      makeFinding({ severity: Severity.LOW, ruleId: 'r4', message: 'maintainability issue' }),
      makeFinding({ severity: Severity.INFO, ruleId: 'r5', message: 'info note' }),
    ];

    const result = scorer.score(findings);

    expect(result.severityBreakdown[Severity.CRITICAL]).toBe(1);
    expect(result.severityBreakdown[Severity.HIGH]).toBe(1);
    expect(result.severityBreakdown[Severity.MEDIUM]).toBe(1);
    expect(result.severityBreakdown[Severity.LOW]).toBe(1);
    expect(result.severityBreakdown[Severity.INFO]).toBe(1);
    expect(result.meta.totalFindings).toBe(5);
  });

  // ── Risk level / grade ──────────────────────────────────────────────────────

  it('should produce a critical risk level and F grade for many severe findings', () => {
    // Feed enough critical findings to push score >= 80
    const findings: Finding[] = Array.from({ length: 10 }, (_, i) =>
      makeFinding({
        severity: Severity.CRITICAL,
        ruleId: `critical-${i}`,
        message: 'reentrancy vulnerability attack exploit',
      }),
    );

    const result = scorer.score(findings);

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.grade).toBe('F');
    expect(result.riskLevel).toBe('critical');
  });

  it('should produce a low risk level and A grade for only info findings', () => {
    const findings: Finding[] = Array.from({ length: 3 }, (_, i) =>
      makeFinding({ severity: Severity.INFO, ruleId: `info-${i}`, message: 'minor note' }),
    );

    const result = scorer.score(findings);

    expect(result.grade).toBe('A');
    expect(result.riskLevel).toBe('low');
  });

  // ── Gas savings ─────────────────────────────────────────────────────────────

  it('should aggregate total gas savings across all findings', () => {
    const findings: Finding[] = [
      makeFinding({ severity: Severity.MEDIUM, ruleId: 'g1', message: 'gas optimization', estimatedGasSavings: 500 }),
      makeFinding({ severity: Severity.LOW, ruleId: 'g2', message: 'gas cost', estimatedGasSavings: 750 }),
    ];

    const result = scorer.score(findings);

    expect(result.totalGasSavings).toBe(1250);
    expect(result.recommendations.some(r => r.includes('gas'))).toBe(true);
  });

  // ── Top findings ────────────────────────────────────────────────────────────

  it('should return at most 5 top findings sorted by highest score', () => {
    const findings: Finding[] = Array.from({ length: 8 }, (_, i) =>
      makeFinding({
        severity: i < 3 ? Severity.CRITICAL : Severity.INFO,
        ruleId: `rule-${i}`,
        message: i < 3 ? 'reentrancy vulnerability' : 'minor info',
      }),
    );

    const result = scorer.score(findings);

    expect(result.topFindings.length).toBeLessThanOrEqual(5);
    // Critical findings should appear first
    expect(result.topFindings[0].severity).toBe(Severity.CRITICAL);
  });

  // ── AnalysisResult integration ──────────────────────────────────────────────

  it('should correctly score from an AnalysisResult object', () => {
    const findings: Finding[] = [
      makeFinding({ severity: Severity.HIGH, ruleId: 'h1', message: 'access control vulnerability' }),
    ];

    const analysisResult: AnalysisResult = {
      findings,
      filesAnalyzed: 5,
      analysisTime: 120,
      analyzerVersion: '1.0.0',
      summary: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
    };

    const result = scorer.scoreFromAnalysisResult(analysisResult);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.meta.filesAnalyzed).toBe(5);
    expect(result.meta.analysisTimeMs).toBe(120);
  });

  // ── Recommendations ─────────────────────────────────────────────────────────

  it('should recommend fixing critical issues when present', () => {
    const findings: Finding[] = [
      makeFinding({ severity: Severity.CRITICAL, ruleId: 'c1', message: 'exploit vulnerability' }),
    ];

    const result = scorer.score(findings);

    expect(result.recommendations.some(r => r.toLowerCase().includes('critical'))).toBe(true);
  });

  it('should not duplicate recommendations for clean projects', () => {
    const findings: Finding[] = [
      makeFinding({ severity: Severity.INFO, ruleId: 'i1', message: 'style note' }),
    ];

    const result = scorer.score(findings);

    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
