import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const CandidateSchema = z.object({
  name: z
    .string()
    .describe(
      'Base domain name in lowercase ASCII: letters, digits, and internal hyphens only. 3-20 chars. No TLD, no dot.',
    ),
  rationale: z.string().describe('One short sentence explaining the name idea.'),
});

const CandidateListSchema = z.object({
  candidates: z.array(CandidateSchema).describe('Array of distinct domain base name candidates.'),
});

export type Candidate = z.infer<typeof CandidateSchema>;

export async function generateCandidates(description: string, count = 20): Promise<Candidate[]> {
  const apiKey = process.env['OPENAI_API_KEY'];
  const baseURL = process.env['OPENAI_BASE_URL'];
  const modelName = process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const llm = new ChatOpenAI({
    model: modelName,
    apiKey,
    temperature: 0.9,
    configuration: baseURL ? { baseURL } : undefined,
  });

  const structured = llm.withStructuredOutput(CandidateListSchema, {
    name: 'domain_candidates',
    method: 'jsonSchema',
  });

  const prompt = [
    'You are a creative domain name generator.',
    '',
    `Given a project description, propose ${count} distinct domain base names (no TLD, no dot).`,
    '',
    'Rules:',
    '- ASCII lowercase letters and digits only; hyphens allowed only between other characters.',
    '- 3 to 20 characters.',
    '- Memorable, brandable, relevant to the description.',
    '- Mix styles: made-up words, compounds, short metaphors, Latin/Greek roots, transliterated Russian where it fits.',
    '- Do not pad with meaningless numbers or suffixes.',
    '- Avoid well-known trademarks.',
    '',
    'Project description:',
    `"""${description}"""`,
    '',
    `Return exactly ${count} candidates.`,
  ].join('\n');

  const result = await structured.invoke(prompt);
  return normalize(result.candidates, count);
}

function normalize(candidates: Candidate[], max: number): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of candidates) {
    const name = c.name.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])?$/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, rationale: c.rationale });
    if (out.length >= max) break;
  }
  return out;
}
