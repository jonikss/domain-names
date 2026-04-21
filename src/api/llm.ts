import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const CandidateSchema = z.object({
  name: z
    .string()
    .describe(
      'Base domain name in lowercase ASCII: letters, digits, and internal hyphens only. 3-20 chars. No TLD, no dot.',
    ),
  rationale: z.string().describe('Одно короткое предложение на русском языке, объясняющее идею названия.'),
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
    'Ты — креативный генератор доменных имён.',
    '',
    `По описанию проекта предложи ${count} различных базовых имён для домена (без зоны, без точки).`,
    '',
    'Правила для поля "name" (только это поле — на английском):',
    '- Только строчные ASCII-буквы и цифры; дефис допустим только между символами, не в начале и не в конце.',
    '- Длина 3–20 символов.',
    '- Запоминающееся, брендовое, связанное с описанием.',
    '- Смешивай стили: придуманные слова, составные слова, короткие метафоры, латинские/греческие корни, транслит русских слов.',
    '- Без бессмысленных цифр и суффиксов ради длины.',
    '- Не использовать известные торговые марки.',
    '',
    'Правила для поля "rationale" (КРИТИЧНО):',
    '- ТОЛЬКО на русском языке. Никогда на английском.',
    '- Одно короткое предложение, до 15 слов.',
    '- Объясняет смысл или идею имени.',
    '- Пример: {"name": "divanex", "rationale": "Соединение \\"диван\\" и \\"ex\\" — намёк на эксклюзивность мебели."}',
    '- Пример: {"name": "cozyalia", "rationale": "Слово \\"cozy\\" с мелодичным окончанием — ощущение уюта."}',
    '',
    'Описание проекта:',
    `"""${description}"""`,
    '',
    `Верни ровно ${count} вариантов. Напоминаю: поле "rationale" — строго на русском.`,
  ].join('\n');

  const result = await structured.invoke(prompt);
  return normalize(result.candidates, count);
}

function normalize(candidates: Candidate[], max: number): Candidate[] {
  const seenNames = new Set<string>();
  const normalized: Candidate[] = [];
  for (const candidate of candidates) {
    const name = candidate.name.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])?$/.test(name)) continue;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    normalized.push({ name, rationale: candidate.rationale });
    if (normalized.length >= max) break;
  }
  return normalized;
}
