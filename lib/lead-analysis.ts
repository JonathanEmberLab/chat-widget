import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, LeadAnalysis } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const analysisTool: Anthropic.Tool = {
  name: 'classify_lead',
  description: 'Devuelve la clasificación y análisis del cliente con base en la conversación.',
  input_schema: {
    type: 'object',
    properties: {
      score: { type: 'integer', description: 'Calidad del lead de 0 a 100 (100 = listo para comprar).' },
      temperatura: { type: 'string', enum: ['caliente', 'tibio', 'frio'], description: 'caliente = alta intención de compra; frio = curioseando.' },
      resumen: { type: 'string', description: 'Resumen corto (1-2 frases) de quién es el cliente y qué quiere.' },
      intencion: { type: 'string', description: 'Qué busca el cliente (ej. comprar, cotizar, soporte, curiosear).' },
      interes: { type: 'array', items: { type: 'string' }, description: 'Productos/temas concretos que le interesaron.' },
      accion_recomendada: { type: 'string', description: 'La siguiente acción recomendada para el equipo de ventas.' },
      sentimiento: { type: 'string', enum: ['positivo', 'neutral', 'negativo'] },
      objeciones: { type: 'array', items: { type: 'string' }, description: 'Dudas u objeciones detectadas (vacío si ninguna).' },
    },
    required: ['score', 'temperatura', 'resumen', 'intencion', 'interes', 'accion_recomendada', 'sentimiento', 'objeciones'],
  },
};

/**
 * Analyze a chat conversation and return a structured lead classification.
 * Throws if the model doesn't return the tool call (caller decides how to handle).
 */
export async function analyzeConversation(messages: ChatMessage[], businessName?: string): Promise<LeadAnalysis> {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [analysisTool],
    tool_choice: { type: 'tool', name: 'classify_lead' },
    system: `Eres un analista de ventas. Analiza la conversación entre un cliente y el asistente${businessName ? ` de ${businessName}` : ''} y clasifica al cliente como lead. Sé objetivo: si el cliente mostró poca intención, el score debe ser bajo. Responde SIEMPRE en español.`,
    messages: [{ role: 'user', content: `Conversación:\n\n${transcript}` }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('El modelo no devolvió la clasificación');
  }

  const raw = toolUse.input as Partial<LeadAnalysis>;
  // Normalize/clamp so storage and UI always get sane values.
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw.score ?? 0)))),
    temperatura: raw.temperatura ?? 'frio',
    resumen: raw.resumen ?? '',
    intencion: raw.intencion ?? '',
    interes: Array.isArray(raw.interes) ? raw.interes : [],
    accion_recomendada: raw.accion_recomendada ?? '',
    sentimiento: raw.sentimiento ?? 'neutral',
    objeciones: Array.isArray(raw.objeciones) ? raw.objeciones : [],
  };
}
