/**
 * Builds a structured prompt for the LLM to perform a full CareerSense analysis.
 * The prompt instructs the model to return a single JSON object conforming to
 * the AnalysisResult schema, covering all 10 analysis subsystems.
 */
export function buildPrompt(
  resume: string,
  targetRole: string,
  targetCompanies: string[] | null,
  schema: object
): string {
  const companiesSection =
    targetCompanies && targetCompanies.length > 0
      ? `Target Companies: ${targetCompanies.join(', ')}\n`
      : '';

  const faangNote =
    targetCompanies && targetCompanies.length > 0 && isFaang(targetCompanies)
      ? `\nBar: top-tier tech. Be stricter on measurable impact, system design depth, and leadership.`
      : '';

  // Minify schema to reduce prompt tokens while preserving constraints.
  const schemaJson = JSON.stringify(schema);

  return `You are CareerSense. Task: analyze the resume for the target role and return ONLY a single JSON object (no markdown).

Input:
- Target Role: ${targetRole}
${companiesSection ? `- ${companiesSection.trimEnd()}` : ''}${faangNote}
- Resume:
${resume}

Output must match the schema exactly and satisfy these constraints (keep answers specific to the resume + role):
- Keys required: resumeScore, heatmap, strengths, weaknesses, top1Comparison, gapAnalysis, bulletImprovements, roadmap, profileOptimization, finalVerdict.
- resumeScore: overall 0-100; breakdown has keywordMatch/formatting/readability/structure (0-100); rationale has >=3 distinct strings; highRiskFlag is true iff overall<50.
- heatmap.sections: include >=1 "high" and >=1 "low"; each section has explanation (>=2 sentences); missingSections is an array.
- strengths and weaknesses: each >=2 items (area, description).
- top1Comparison: each array has >=1 item.
- gapAnalysis: readinessPercentage 0-100; methodology non-empty; if readiness<90 then gaps must be non-empty; if readiness<60 then notCompetitiveNote must be non-empty else null.
- bulletImprovements: rewritten != original and rewritten strings are distinct.
- roadmap: exactly 3 phases in order: "30 Days", "3 Months", "6 Months"; each has >=3 distinct action items.
- profileOptimization: linkedin/github/portfolio each has >=2 distinct suggestions across all platforms.
- finalVerdict.readinessPercentage must equal gapAnalysis.readinessPercentage and readinessLabel must be one of: Not Competitive, Developing, Competitive, Top-Tier; include >=2 rejectionReasons and >=3 stepsToTopTier.

Schema (minified):
${schemaJson}`;
}

const FAANG_COMPANIES = new Set([
  'facebook', 'meta', 'amazon', 'apple', 'netflix', 'google', 'alphabet',
  'microsoft', 'faang', 'manga', 'maang',
]);

function isFaang(companies: string[]): boolean {
  return companies.some((c) => FAANG_COMPANIES.has(c.toLowerCase().trim()));
}
