import { Finding, Severity, AnalysisResult } from '@engine/core';
import { SeverityScoringSystem, ScoringConfig } from './severity-scorer';

export interface ProjectRiskScore {
  /** Normalized overall risk score from 0 (safe) to 100 (critical) */
  overallScore: number;
  /** Letter grade summarizing project health */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Human-readable risk label */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Count of findings per severity level */
  severityBreakdown: Record<Severity, number>;
  /** Count of findings per impact category */
  impactBreakdown: Record<'security' | 'gas' | 'performance' | 'maintainability', number>;
  /** Total potential gas savings across all findings */
  totalGasSavings: number;
  /** Top 5 highest-risk findings */
  topFindings: Finding[];
  /** Actionable recommendations */
  recommendations: string[];
  /** Metadata */
  meta: {
    totalFindings: number;
    filesAnalyzed?: number;
    analysisTimeMs?: number;
    scoredAt: string;
  };
}

export interface ProjectRiskScorerOptions {
  scoringConfig?: Partial<ScoringConfig>;
  /** Max raw score expected; used to normalize overallScore to 0–100 */
  normalizationCeiling?: number;
}

/**
 * Aggregates findings from an analysis run into a single project-level risk score.
 * Builds on top of SeverityScoringSystem to provide overall project health insight.
 */
export class ProjectRiskScorer {
  private readonly scorer: SeverityScoringSystem;
  private readonly normalizationCeiling: number;

  constructor(options: ProjectRiskScorerOptions = {}) {
    this.scorer = new SeverityScoringSystem(options.scoringConfig);
    this.normalizationCeiling = options.normalizationCeiling ?? 500;
  }

  /**
   * Score a project from an AnalysisResult (the standard output of an Analyzer).
   */
  scoreFromAnalysisResult(result: AnalysisResult): ProjectRiskScore {
    return this.score(result.findings, {
      filesAnalyzed: result.filesAnalyzed,
      analysisTimeMs: result.analysisTime,
    });
  }

  /**
   * Score a project from a raw list of findings.
   */
  score(
    findings: Finding[],
    meta: { filesAnalyzed?: number; analysisTimeMs?: number } = {},
  ): ProjectRiskScore {
    if (findings.length === 0) {
      return this.emptyScore(meta);
    }

    // Score all findings individually
    const scoredFindings = findings.map((f) => ({
      finding: f,
      score: this.scorer.scoreFinding(f),
    }));

    // Raw aggregate score
    const rawTotal = scoredFindings.reduce((sum, sf) => sum + sf.score.score, 0);

    // Normalize to 0–100
    const overallScore = Math.min(100, Math.round((rawTotal / this.normalizationCeiling) * 100));

    // Severity breakdown
    const severityBreakdown: Record<Severity, number> = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.LOW]: 0,
      [Severity.INFO]: 0,
    };
    const impactBreakdown: Record<string, number> = {
      security: 0,
      gas: 0,
      performance: 0,
      maintainability: 0,
    };

    let totalGasSavings = 0;

    for (const { finding, score } of scoredFindings) {
      severityBreakdown[finding.severity]++;
      impactBreakdown[score.impact]++;
      totalGasSavings += finding.estimatedGasSavings ?? 0;
    }

    // Top 5 findings sorted by score descending
    const topFindings = scoredFindings
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, 5)
      .map((sf) => sf.finding);

    const grade = this.calculateGrade(overallScore);
    const riskLevel = this.calculateRiskLevel(overallScore);
    const recommendations = this.generateRecommendations(
      severityBreakdown,
      impactBreakdown as Record<'security' | 'gas' | 'performance' | 'maintainability', number>,
      totalGasSavings,
    );

    return {
      overallScore,
      grade,
      riskLevel,
      severityBreakdown,
      impactBreakdown: impactBreakdown as Record<
        'security' | 'gas' | 'performance' | 'maintainability',
        number
      >,
      totalGasSavings,
      topFindings,
      recommendations,
      meta: {
        totalFindings: findings.length,
        filesAnalyzed: meta.filesAnalyzed,
        analysisTimeMs: meta.analysisTimeMs,
        scoredAt: new Date().toISOString(),
      },
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private emptyScore(
    meta: { filesAnalyzed?: number; analysisTimeMs?: number },
  ): ProjectRiskScore {
    return {
      overallScore: 0,
      grade: 'A',
      riskLevel: 'low',
      severityBreakdown: {
        [Severity.CRITICAL]: 0,
        [Severity.HIGH]: 0,
        [Severity.MEDIUM]: 0,
        [Severity.LOW]: 0,
        [Severity.INFO]: 0,
      },
      impactBreakdown: { security: 0, gas: 0, performance: 0, maintainability: 0 },
      totalGasSavings: 0,
      topFindings: [],
      recommendations: ['No issues found. Project looks clean!'],
      meta: {
        totalFindings: 0,
        filesAnalyzed: meta.filesAnalyzed,
        analysisTimeMs: meta.analysisTimeMs,
        scoredAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Maps normalized score (0–100) to a letter grade.
   * A = excellent (0–19), B = good (20–39), C = moderate (40–59), D = poor (60–79), F = failing (80+)
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score < 20) return 'A';
    if (score < 40) return 'B';
    if (score < 60) return 'C';
    if (score < 80) return 'D';
    return 'F';
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 20) return 'low';
    if (score < 50) return 'medium';
    if (score < 80) return 'high';
    return 'critical';
  }

  private generateRecommendations(
    severityBreakdown: Record<Severity, number>,
    impactBreakdown: Record<'security' | 'gas' | 'performance' | 'maintainability', number>,
    totalGasSavings: number,
  ): string[] {
    const recs: string[] = [];

    if (severityBreakdown[Severity.CRITICAL] > 0) {
      recs.push(
        `🚨 Fix ${severityBreakdown[Severity.CRITICAL]} critical issue(s) immediately — these pose severe security or financial risk.`,
      );
    }
    if (severityBreakdown[Severity.HIGH] > 0) {
      recs.push(
        `⚠️ Address ${severityBreakdown[Severity.HIGH]} high-severity issue(s) before the next deployment.`,
      );
    }
    if (impactBreakdown.security > 0) {
      recs.push(
        `🔒 ${impactBreakdown.security} security finding(s) detected — conduct a thorough security review.`,
      );
    }
    if (totalGasSavings > 1000) {
      recs.push(
        `⛽ Optimizing flagged patterns could save ~${totalGasSavings.toLocaleString()} gas units.`,
      );
    }
    if (impactBreakdown.maintainability > 3) {
      recs.push(
        `🛠 ${impactBreakdown.maintainability} maintainability issues found — consider a refactoring pass.`,
      );
    }
    if (recs.length === 0) {
      recs.push('✅ Project is in good shape. Continue maintaining code quality standards.');
    }

    return recs;
  }
}
