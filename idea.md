Build an Advanced AI Career Intelligence System designed to simulate real-world hiring evaluation and help candidates optimize their profiles for specific roles and companies.

Input:

* Resume (in structured JSON or markdown format)
* Target role (e.g., Software Engineer, Product Manager)
* Target companies (optional, e.g., FAANG, startups)

Tasks:

1. Resume Evaluation (ATS + Recruiter Perspective)

* Analyze ATS compatibility: keyword match, formatting, readability, structure.
* Provide a resume quality score (0–100) with clear reasoning.
* Evaluate the resume from a recruiter’s perspective, highlighting which sections attract attention and which are ignored.

2. Recruiter Eye View (Heatmap Simulation)

* Simulate how a recruiter scans the resume.
* Highlight:

  * High-impact sections (strong attention areas)
  * Weak or ignored sections
* Represent this as a structured “attention heatmap” explanation (text-based).

3. Company-Specific + Role-Specific Optimization

* Tailor evaluation based on target role and company expectations.
* Identify what top companies (e.g., FAANG) specifically look for in this role.
* Suggest precise modifications to align the resume with those expectations.

4. Resume vs Top 1% Candidates Comparison

* Compare the candidate’s profile with top 1% candidates for the target role.
* Identify:

  * Missing skills
  * Experience gaps
  * Project quality differences
  * Presentation differences
* Clearly explain what separates the candidate from top-tier profiles.

5. Strengths and Weaknesses Analysis

* Identify strong areas in skills, projects, and experience.
* Identify weak areas and missed opportunities.

6. Bullet-Level Resume Improvements

* Rewrite weak bullet points into high-impact, achievement-oriented statements.
* Ensure suggestions include measurable impact (metrics, outcomes).

7. Gap Analysis

* Compare the candidate’s profile with real-world expectations for the target role.
* Provide a “readiness percentage” (e.g., 65% ready).
* List exact gaps preventing the candidate from reaching top-tier level.

8. Personalized Roadmap (Core Feature)

* Generate a structured improvement plan:

  * Short-term (30 days)
  * Mid-term (3 months)
  * Long-term (6 months)
* Make it:

  * Role-specific
  * Company-specific
  * Based on current skill level

9. Professional Profile Optimization

* Suggest improvements for:

  * LinkedIn
  * GitHub
  * Portfolio
* Focus on credibility, visibility, and recruiter appeal.

10. Final Verdict

* Provide:

  * Overall readiness level
  * Key reasons for potential rejection
  * Clear steps to reach top-tier (top 1%) candidate level

Constraints:

* Be specific, actionable, and non-generic.
* Avoid vague or repetitive advice.
* Focus on real hiring practices and recruiter behavior.
* Keep responses structured and concise.

Output Format:

* Resume Score (0–100)
* Recruiter Eye View (Heatmap Insights)
* Key Strengths
* Key Weaknesses
* Top 1% Comparison
* Gap Analysis (with readiness %)
* Resume Improvements (bullet-level)
* Personalized Roadmap (30d / 3m / 6m)
* Profile Optimization Suggestions
* Final Verdict


**not total deployment project, just build a basic frontend, backend with some basic sql storage.
no heavyweight application - demo purposed fully functional prototype only 