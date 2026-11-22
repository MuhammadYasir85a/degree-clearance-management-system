const DOMAIN = /\b(clearance|degrees?|uet|mardan|university|transcripts?|dmc|cnic|challan|receipts?|certificates?|hostel|provost|tuition|controller|internship|fyp|clo|admissions?|graduation|graduating)\b/i;
const RELATED = /\b(documents?|fees?|accounts?|library|books?|transport|dues|fines?|examinations?|applications?)\b/i;
const ACTION = /\b(my|our|student|submit|upload|verify|verification|pay|return|pending|approved|rejected|correction|status|apply|collect|need|required)\b/i;
const JAILBREAK = /\b(ignore|disregard|forget|override)\b.{0,60}\b(instructions?|rules?|system|prompt|previous)\b|\b(reveal|print|show|repeat)\b.{0,40}\b(system prompt|api key|password|access token)\b|\b(act as|pretend to be)\b.{0,60}\b(unrestricted|general|another|different)\b/i;
const OFF_TOPIC = /\b(recipes?|jokes?|horoscopes?|weather|football|cricket|movies?|politics|president|prime minister)\b|\b(write|generate|debug|build|implement|create)\b.{0,60}\b(code|python|javascript|sql|program|app|poem|story|song)\b|\b(capital of|medical advice|diagnose|stock price|buy bitcoin)\b/i;
const FOLLOW_UP = /^(and\s+)?(what next|what about .{1,60}|how (long|much|do i|can i).{0,60}|why.{0,60}|when.{0,60}|where.{0,60}|which (one|ones|office).{0,30}|can (i|you).{0,60}|explain (that|more)|tell me more|what should i do)[?.!\s]*$/i;

export function isDomainRelevant(text) {
  return typeof text === 'string' && (DOMAIN.test(text) || (RELATED.test(text) && ACTION.test(text)));
}

export function classifyQuestion(text, history = []) {
  const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  if (JAILBREAK.test(normalized)) return { decision: 'reject', reason: 'instruction_override' };
  if (OFF_TOPIC.test(normalized)) return { decision: 'reject', reason: 'out_of_domain' };
  if (isDomainRelevant(normalized)) return { decision: 'allow', retrievalQuery: normalized };
  const recentUser = (Array.isArray(history) ? history : []).filter((item) => item.role === 'user' && typeof item.content === 'string').at(-1);
  if (FOLLOW_UP.test(normalized) && recentUser && isDomainRelevant(recentUser.content)
    && !JAILBREAK.test(recentUser.content) && !OFF_TOPIC.test(recentUser.content)) {
    return { decision: 'allow', retrievalQuery: `${recentUser.content.slice(0, 1000)}\nFollow-up: ${normalized}` };
  }
  if (/^(hi|hello|hey|thanks|thank you|bye)[!.\s]*$/i.test(normalized)) return { decision: 'reject', reason: 'out_of_domain' };
  return { decision: 'semantic', retrievalQuery: normalized };
}

export function domainRefusal(reason) {
  return {
    answer: 'I am the GradFlow Academic Assistant. I can help with university clearance, degree applications, required documents, fees, and your application status. Please ask a question about these services.',
    sources: [],
    guardrail: { blocked: true, reason },
  };
}
