/**
 * JSON output schemas for community summarization and global synthesis.
 */

export const COMMUNITY_SCHEMA = `Output EXACTLY ONE JSON object with this structure:

{
  "title": "Short name for this community (2-5 words)",
  "summary": "Executive summary of the community's structure, key entities, and dynamics",
  "findings": ["Established: finding", "Current: finding", "Tension: finding", "Uncertain: finding"],
  "subcommunities": [
    {
      "entity_ids": ["exact_node_id_1", "exact_node_id_2"],
      "title": "Focused current cluster",
      "summary": "Grounded current-state summary",
      "findings": ["Established: grounded fact"],
      "rationale": "Why this is a distinct connected narrative"
    }
  ]
}

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "title": short specific name (2-5 words). "summary": current-state paragraph. "findings": 1-5 prefixed strings.
3. "subcommunities" is [] unless the supplied cluster contains 2-4 distinct connected narratives. Use exact node IDs, cover every node exactly once, and never invent an ID or relationship.
4. Do NOT wrap in markdown code blocks.
5. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.`;

export const GLOBAL_SYNTHESIS_SCHEMA = `Output EXACTLY ONE JSON object with this structure:

{
  "global_summary": "A 300-token overarching summary of the current story state"
}

FORMAT RULES:
1. Top level MUST be a JSON object { }, NEVER a bare array [ ].
2. "global_summary" must be a single comprehensive string.
3. Do NOT wrap in markdown code blocks.
4. NEVER use string concatenation ("+") inside JSON values. Write all text as a single, unbroken line within the quotes.`;
