// AI / 检索相关的共享类型。注意：这个文件可被前端 import（仅类型，无 server-only 副作用）。

export type AIChatRole = "system" | "user" | "assistant";

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
};

export type AISearchResultPaper = {
  source: "arxiv" | "semantic_scholar" | "openalex" | "crossref";
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  pdfUrl?: string;
  published?: string;
  updated?: string;
  venue?: string;
  year?: number;
  primaryCategory?: string;
};

export type AISearchResultWeb = {
  source: "tavily" | "github" | "bilibili" | "youtube" | "free_search";
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
};

export type AITrickCandidate = {
  title: string;
  problem: string;
  solution: string;
  benefits: string[];
  costs: string[];
  applicableScenarios: string[];
};

export type AIPaperImport = {
  source: "arxiv" | "semantic_scholar" | "openalex" | "crossref" | "doi" | "manual";
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  pdfUrl?: string;
  published?: string;
  venue?: string;
  year?: number;
  tags: string[];
  summary?: string;
  highlights?: string[];
  trickCandidates?: AITrickCandidate[];
};

export type AICardCompletion = {
  problem: string;
  solution: string;
  benefits: string[];
  costs: string[];
  tradeoffs: string[];
  applicableScenarios: string[];
  unsuitableScenarios: string[];
  tags: string[];
};

export type AgentRunResult = {
  topic: string;
  papers: AISearchResultPaper[];
  webResults: AISearchResultWeb[];
  trickCandidates: AITrickCandidate[];
  outline: { id: string; title: string; description: string }[];
  llmAvailable: boolean;
  tavilyAvailable: boolean;
};

export type DailyDigestItem = {
  paper: AISearchResultPaper;
  summary?: string;
  whyRead?: string;
  /** 1 句中文，论文最核心的洞见（前端「关键 insight」） */
  insight?: string;
  /** 1 句中文，可整理为 trick card 的可操作建议 */
  trickHint?: string;
  /** 该 trick 的具体收益，2-4 条短语 */
  benefits?: string[];
  /** 该 trick 的代价/局限，1-3 条短语 */
  costs?: string[];
};

export type DailyDigest = {
  topic: string;
  generatedAt: string;
  items: DailyDigestItem[];
  llmAvailable: boolean;
};
