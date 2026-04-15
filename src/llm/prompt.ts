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
      ? `Target Companies: ${targetCompanies.join(', ')}
${isFaang(targetCompanies) ? 'NOTE: One or more target companies are top-tier technology companies (FAANG/MANGA). Apply elevated evaluation criteria reflecting their known high hiring bars, including system design depth, algorithmic proficiency, measurable impact, and leadership principles.' : ''}
`
      : '';

  return `You are CareerSense, an expert AI career intelligence system. Analyze the resume below against the target role${targetCompanies && targetCompanies.length > 0 ? ' and target companies' : ''} and produce a comprehensive career intelligence report.

## Input

Target Role: ${targetRole}
${companiesSection}
### Resume
${resume}

---

## Instructions

Analyze the resume across ALL 10 subsystems described below. Return your entire response as a single valid JSON object that conforms exactly to the JSON schema provided at the end of these instructions. Do NOT include any markdown code blocks, backticks, or explanatory text — output ONLY the raw JSON object.

### Subsystem 1: ATS Compatibility Analysis (resumeScore)
- Evaluate the resume for keyword match against the target role, formatting compliance, readability, and structural completeness.
- Produce an overall score (0–100) and a breakdown with four sub-scores: keywordMatch, formatting, readability, structure (each 0–100).
- Provide a rationale array with AT LEAST 3 specific observations explaining the score.
- Set highRiskFlag to true if and only if the overall score is below 50.

### Subsystem 2: Recruiter Eye View / Heatmap (heatmap)
- Classify each resume section as high, medium, or low attention.
- Include at minimum: summary/objective, work experience, skills, education, projects, certifications (when present).
- Provide an explanation of AT LEAST 2 sentences per section explaining the attention classification.
- Ensure AT LEAST one section is classified as high attention and AT LEAST one as low attention.
- List any sections that are missing but typically expected for the target role in missingSections.

### Subsystem 3: Strengths and Weaknesses (strengths, weaknesses)
- Identify AT LEAST 2 strengths covering skills, projects, or experience.
- Identify AT LEAST 2 weaknesses or missed opportunities covering skills, projects, or experience.
- Each weakness must include a specific explanation relative to the target role — not a generic statement.
- Ensure no strength and weakness finding overlap or contradict each other.

### Subsystem 4: Company-Specific and Role-Specific Optimization (roleOptimization)
- Identify AT LEAST 3 role-specific skills or qualifications expected for the target role.
- For each skill, indicate whether it is present, partially present, or absent in the resume.
- Produce AT LEAST 3 specific, actionable modification suggestions addressing gaps between the resume and the target role${targetCompanies && targetCompanies.length > 0 ? '/company' : ''} expectations.
- Ensure no two modification suggestions are semantically equivalent or redundant.${targetCompanies && targetCompanies.length > 0 ? '\n- Incorporate known hiring criteria for the specified target companies.' : ''}

### Subsystem 5: Top 1% Candidate Comparison (top1Comparison)
- Compare the resume against a Top 1% profile for the target role.
- Identify AT LEAST 1 item in each of the four categories:
  - missingSkills: skills present in top 1% profiles but absent from this resume
  - experienceGaps: differences in years, seniority, or domain breadth
  - projectQualityDifferences: differences in scale, measurable impact, and technical complexity
  - presentationDifferences: differences in use of metrics, action verbs, and achievement framing

### Subsystem 6: Gap Analysis and Readiness Percentage (gapAnalysis)
- Compute a readinessPercentage (0–100) based on combined findings from ATS analysis, role evaluation, and Top 1% comparison.
- List each gap as a discrete item with a label (e.g., "Missing: System Design experience") and a severity of critical, moderate, or minor.
- Include AT LEAST 1 gap item when readinessPercentage is below 90.
- Include a methodology field: a single sentence explaining how the readiness percentage was computed.
- If readinessPercentage is below 60, set notCompetitiveNote to a non-empty string indicating the candidate is not yet competitive for the target role at top-tier companies. Otherwise set it to null.

### Subsystem 7: Bullet-Level Resume Improvements (bulletImprovements)
- Identify resume bullet points that lack measurable impact, use passive voice, or are vague.
- Rewrite AT LEAST 3 weak bullets using the format: [Action Verb] + [Task/Project] + [Measurable Result].
- Each rewritten bullet must be distinct — no two rewritten bullets may be paraphrases of each other.
- Each rewritten field must differ from its corresponding original field.

### Subsystem 8: Personalized Improvement Roadmap (roadmap)
- Produce exactly 3 phases: "30 Days", "3 Months", "6 Months" (in that order).
- Each phase must contain AT LEAST 3 action items.
- At least one action item per phase must reference the target role by name ("${targetRole}").${targetCompanies && targetCompanies.length > 0 ? `\n- Include at least one company-specific action item per phase referencing ${targetCompanies.join(' or ')}.` : ''}
- Base action items on the gaps identified in the gap analysis — each critical gap must map to at least one roadmap action item.
- Ensure no action item is a duplicate or near-duplicate of another action item within the same roadmap.

### Subsystem 9: Professional Profile Optimization (profileOptimization)
- Provide AT LEAST 2 specific, actionable suggestions for each platform: linkedin, github, portfolio.
- Each suggestion must reference a specific profile element (e.g., "LinkedIn headline", "GitHub README", "portfolio project descriptions").${targetCompanies && targetCompanies.length > 0 ? `\n- Tailor at least one suggestion per platform to align with ${targetCompanies.join('/')} recruiter expectations.` : ''}
- Ensure no two suggestions across all three platforms are semantically equivalent.

### Subsystem 10: Final Verdict (finalVerdict)
- Set readinessPercentage to the SAME value as gapAnalysis.readinessPercentage.
- Set readinessLabel based on the percentage:
  - 0–39: "Not Competitive"
  - 40–59: "Developing"
  - 60–79: "Competitive"
  - 80–100: "Top-Tier"
- List AT LEAST 2 key rejection reasons based on findings from ATS analysis, Top 1% comparison, and gap analysis.
- List AT LEAST 3 clear, prioritized steps the candidate must take to reach top-tier (top 1%) level.
- Ensure the final verdict is fully consistent with all other sections — no contradictions.

---

## JSON Schema

The output must conform exactly to this schema:

${JSON.stringify(schema, null, 2)}

---

Return ONLY the raw JSON object. No markdown, no code fences, no commentary.`;
}

const FAANG_COMPANIES = new Set([
  'facebook', 'meta', 'amazon', 'apple', 'netflix', 'google', 'alphabet',
  'microsoft', 'faang', 'manga', 'maang',
]);

function isFaang(companies: string[]): boolean {
  return companies.some((c) => FAANG_COMPANIES.has(c.toLowerCase().trim()));
}
