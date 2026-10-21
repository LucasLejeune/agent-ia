import { config } from '../config/index.js';
import { chat, type ChatMessage } from '../llm/ollama.js';
import { checkNumbers } from './numbers.js';

export interface Judge {
  verdict: 'supported' | 'partial' | 'unsupported' | 'unknown';
  issues: string[];
}

export interface Verification {
  status: 'verified' | 'warning' | 'not_checked';
  unsupportedNumbers: number[];
  judge?: Judge;
}

const JUDGE_PROMPT = `Tu es un vérificateur factuel strict. On te donne une QUESTION, des PREUVES (résultats d'outils et extraits de documents) et une RÉPONSE.
Vérifie que chaque affirmation factuelle de la RÉPONSE est justifiée par les PREUVES. Ignore le style.
Réponds UNIQUEMENT en JSON : {"verdict":"supported"|"partial"|"unsupported","issues":["affirmation non justifiée", ...]}`;

async function judgeAnswer(question: string, answer: string, evidence: string[]): Promise<Judge> {
  const messages: ChatMessage[] = [
    { role: 'system', content: JUDGE_PROMPT },
    {
      role: 'user',
      content: `QUESTION:\n${question}\n\nPREUVES:\n${evidence.join('\n---\n').slice(0, 12000)}\n\nRÉPONSE:\n${answer}`,
    },
  ];
  try {
    const reply = await chat(messages, [], { json: true });
    const parsed = JSON.parse(reply.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()) as Partial<Judge>;
    const verdicts = ['supported', 'partial', 'unsupported'];
    return {
      verdict: verdicts.includes(parsed.verdict as string) ? (parsed.verdict as Judge['verdict']) : 'unknown',
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 5) : [],
    };
  } catch {
    return { verdict: 'unknown', issues: [] };
  }
}

/**
 * Vérification en 2 temps :
 * 1. contrôle déterministe des nombres (chaque chiffre doit venir d'une preuve) ;
 * 2. second appel LLM "juge" qui confronte la réponse aux preuves.
 */
export async function verifyAnswer(question: string, answer: string, evidence: string[]): Promise<Verification> {
  if (!config.VERIFY_ANSWERS || evidence.length === 0 || !answer) {
    return { status: 'not_checked', unsupportedNumbers: [] };
  }
  const numbers = checkNumbers(answer, [question, ...evidence]);
  const judge = await judgeAnswer(question, answer, evidence);
  const ok = numbers.unsupported.length === 0 && judge.verdict !== 'partial' && judge.verdict !== 'unsupported';
  return { status: ok ? 'verified' : 'warning', unsupportedNumbers: numbers.unsupported, judge };
}
