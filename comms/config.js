function envFlag(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return String(raw).toLowerCase() === 'true' || String(raw) === '1';
}

function publicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
}

function absoluteUrl(pathname) {
  const base = publicBaseUrl();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (base) return `${base}${path}`;
  return path;
}

const TTS = {
  en: { voice: 'Polly.Joanna', language: 'en-US' },
  es: { voice: 'Polly.Lupe', language: 'es-US' },
};

const COMPANY_NAME = 'MG Building Services';

const LANGUAGE_PROMPT_EN =
  'Thank you for calling MG Building Services. For English, press 1.';
const LANGUAGE_PROMPT_ES = 'Para español, oprima el número 2.';

const MENU_PROMPT = {
  en:
    'If you are an existing customer, press 1. If you are calling about a new service or would like to request a quote, press 2. For all other inquiries, press 3.',
  es:
    'Gracias por llamar a MG Building Services. Si ya es cliente, oprima el número 1. Si llama para solicitar un nuevo servicio o una cotización, oprima el número 2. Para cualquier otra consulta, oprima el número 3.',
};

const VOICEMAIL_PROMPT = {
  en:
    'Please leave your name, company name if applicable, and a brief description of how we can assist you. A member of our team will return your call as soon as possible. Please leave your message after the tone. When you are finished, press the pound key.',
  es:
    'Por favor, deje su nombre, el nombre de su compañía si corresponde, y una breve descripción de cómo podemos ayudarle. Un miembro de nuestro equipo le devolverá la llamada lo antes posible. Deje su mensaje después del tono. Cuando termine, oprima la tecla de numeral.',
};

const NO_MESSAGE_PROMPT = {
  en: 'We did not receive a message. Goodbye.',
  es: 'No recibimos un mensaje. Adiós.',
};

const GOODBYE_PROMPT = {
  en: 'Thank you. Goodbye.',
  es: 'Gracias. Adiós.',
};

const SORRY_PROMPT = {
  en: 'We are sorry. Please try again later.',
  es: 'Lo sentimos. Por favor, intente más tarde.',
};

const DIGIT_LANGUAGE = {
  1: 'en',
  2: 'es',
};

const DIGIT_CATEGORY = {
  1: 'existing_customer',
  2: 'quote',
  3: 'other',
};

function normalizeLang(value) {
  return String(value || '').toLowerCase() === 'es' ? 'es' : 'en';
}

module.exports = {
  envFlag,
  publicBaseUrl,
  absoluteUrl,
  TTS,
  COMPANY_NAME,
  LANGUAGE_PROMPT_EN,
  LANGUAGE_PROMPT_ES,
  MENU_PROMPT,
  VOICEMAIL_PROMPT,
  NO_MESSAGE_PROMPT,
  GOODBYE_PROMPT,
  SORRY_PROMPT,
  DIGIT_LANGUAGE,
  DIGIT_CATEGORY,
  normalizeLang,
  RECORD_MAX_SECONDS: 120,
  CATEGORIES: ['existing_customer', 'quote', 'other', 'unknown'],
  LANGUAGES: ['en', 'es'],
  CALLBACK_STATUSES: ['new', 'called_back', 'completed', 'no_answer'],
  CALL_STATUSES: ['in_progress', 'completed', 'no_message', 'failed'],
};
