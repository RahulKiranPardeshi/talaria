import type { AIProviderInfo } from './types.ts';

/** The AI accounts Talaria can use, in the order setup offers them. */
export const AI_PROVIDERS: AIProviderInfo[] = [
  { id: 'openai-codex', label: 'ChatGPT', auth: 'chatgpt', webSearch: 'native' },
  { id: 'copilot', label: 'GitHub Copilot', auth: 'copilot', webSearch: 'talaria' },
  {
    id: 'gemini',
    label: 'Google Gemini',
    auth: 'key',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'Free: sign in to Google AI Studio and press Create API key.',
    webSearch: 'talaria',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    auth: 'key',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyHint: 'One key for hundreds of models, paid per use (a few free ones too).',
    webSearch: 'talaria',
  },
  {
    id: 'anthropic',
    label: 'Claude (API key)',
    auth: 'key',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'A key from the Claude Console, paid per use. A Claude Pro or Max plan is separate and can’t be used here.',
    webSearch: 'talaria',
  },
  {
    id: 'openai',
    label: 'OpenAI (API key)',
    auth: 'key',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'A key from the OpenAI Platform, paid per use. For a ChatGPT plan, pick ChatGPT instead.',
    webSearch: 'talaria',
  },
  {
    id: 'groq',
    label: 'Groq',
    auth: 'key',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'Very fast open models, with a free tier.',
    webSearch: 'talaria',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    auth: 'key',
    keyUrl: 'https://console.x.ai',
    keyHint: 'A key from the xAI Console, paid per use.',
    webSearch: 'talaria',
  },
];

export const aiProviderLabel = (id?: string) => AI_PROVIDERS.find(p => p.id === id)?.label || id || 'The AI provider';
