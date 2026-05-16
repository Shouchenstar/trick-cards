// 论文导入：arXiv URL/ID、DOI、关键词 → arXiv / Semantic Scholar 元数据 → 可选 LLM 总结。

import { chatJSON, isLLMAvailable, type LLMOverride } from "./llm";
import {
  detectIEEEXploreUrl,
  fetchArxivById,
  fetchCrossrefByDOI,
  fetchIEEEXploreByUrl,
  fetchOpenAlexByDOI,
  searchArxiv,
  searchIEEEXplore,
  searchOpenAlex,
  searchSemanticScholar
} from "./search";
import { safeFetch } from "../safeFetch";
import type {
  AIChatMessage,
  AIPaperImport,
  AISearchResultPaper,
  AITrickCandidate
} from "./types";

const ARXIV_URL_RE = /arxiv\.org\/(?:abs|pdf)\/([\w.\-/]+?)(?:v\d+)?(?:\.pdf)?(?:[?#].*)?$/i;
const ARXIV_ID_RE = /^(?:arxiv:)?(\d{4}\.\d{4,6}|[a-z\-]+\/\d{7})(?:v\d+)?$/i;
const DOI_URL_RE = /(?:doi\.org|dx\.doi\.org)\/(10\.[\w.]+\/[^\s]+)/i;
const DOI_RE = /^10\.\d{4,9}\/[^\s]+$/i;
const URL_RE = /^https?:\/\//i;

// 已知学术网站 URL → 可通过 Semantic Scholar URL lookup
const KNOWN_PAPER_SITES = [
  // --- 大型出版商 ---
  "ieeexplore.ieee.org",       // IEEE
  "dl.acm.org",                // ACM Digital Library
  "link.springer.com",         // Springer
  "sciencedirect.com",         // Elsevier / ScienceDirect
  "nature.com",                // Nature
  "science.org",               // Science (AAAS)
  "wiley.com",                 // Wiley
  "onlinelibrary.wiley.com",   // Wiley Online Library
  "tandfonline.com",           // Taylor & Francis
  "sagepub.com",               // SAGE
  "journals.sagepub.com",      // SAGE Journals
  "cambridge.org",             // Cambridge University Press
  "academic.oup.com",          // Oxford University Press
  "oup.com",                   // OUP
  "mdpi.com",                  // MDPI
  "frontiersin.org",           // Frontiers
  "cell.com",                  // Cell Press
  "thelancet.com",             // The Lancet
  "bmj.com",                   // BMJ
  "nejm.org",                  // NEJM
  "pnas.org",                  // PNAS
  "acs.org",                   // ACS (American Chemical Society)
  "pubs.acs.org",              // ACS Publications
  "rsc.org",                   // Royal Society of Chemistry
  "pubs.rsc.org",              // RSC Publications
  "aps.org",                   // APS (American Physical Society)
  "journals.aps.org",          // APS Journals
  "aip.org",                   // AIP
  "pubs.aip.org",              // AIP Publishing
  "iopscience.iop.org",        // IOP Science
  "royalsocietypublishing.org",// Royal Society
  "annualreviews.org",         // Annual Reviews
  "degruyter.com",             // De Gruyter
  "karger.com",                // Karger
  "hindawi.com",               // Hindawi
  "biorxiv.org",               // bioRxiv
  "medrxiv.org",               // medRxiv
  "ssrn.com",                  // SSRN
  "researchgate.net",          // ResearchGate
  "jstor.org",                 // JSTOR
  "pubmed.ncbi.nlm.nih.gov",  // PubMed
  "ncbi.nlm.nih.gov",         // NCBI / PMC
  "europepmc.org",             // Europe PMC
  // --- AI / CS 会议 & 预印本 ---
  "openreview.net",            // OpenReview (ICLR, NeurIPS etc.)
  "aclanthology.org",          // ACL Anthology
  "proceedings.mlr.press",     // PMLR (ICML, AISTATS etc.)
  "papers.nips.cc",            // NeurIPS legacy
  "neurips.cc",                // NeurIPS
  "proceedings.neurips.cc",    // NeurIPS proceedings
  "cvpr.org",                  // CVPR
  "openaccess.thecvf.com",    // CVF Open Access (CVPR, ICCV, ECCV)
  "thecvf.com",               // CVF
  "aaai.org",                  // AAAI
  "ijcai.org",                 // IJCAI
  "usenix.org",               // USENIX
  "vldb.org",                  // VLDB
  "semanticscholar.org",       // Semantic Scholar
  // --- 中国学术平台 ---
  "cnki.net",                  // 中国知网
  "wanfangdata.com.cn",       // 万方
  "cqvip.com",                // 维普
  "csdn.net",                 // CSDN (技术博客, 部分论文)
  "scholar.google.com",        // Google Scholar
  "scholar.google.com.hk"     // Google Scholar (HK)
];

function isPaperUrl(input: string): boolean {
  if (!URL_RE.test(input)) return false;
  try {
    const host = new URL(input).hostname.toLowerCase();
    return KNOWN_PAPER_SITES.some((site) => host.includes(site));
  } catch {
    return false;
  }
}

export function detectArxivId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(ARXIV_URL_RE);
  if (urlMatch) return urlMatch[1].replace(/v\d+$/i, "");
  const idMatch = trimmed.match(ARXIV_ID_RE);
  if (idMatch) return idMatch[1].replace(/v\d+$/i, "");
  return null;
}

export function detectDOI(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(DOI_URL_RE);
  if (urlMatch) return urlMatch[1];
  if (DOI_RE.test(trimmed)) return trimmed;
  return null;
}

const S2_PAPER_ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper";

type S2PaperResponse = {
  paperId: string;
  title?: string;
  abstract?: string | null;
  authors?: Array<{ name: string }>;
  venue?: string;
  year?: number;
  url?: string;
  externalIds?: Record<string, string | undefined>;
  openAccessPdf?: { url: string } | null;
  publicationDate?: string;
};

const S2_FIELDS = "paperId,title,abstract,authors,venue,year,externalIds,url,openAccessPdf,publicationDate";

function s2ResponseToPaper(
  item: S2PaperResponse,
  fallbackUrl?: string
): AISearchResultPaper | null {
  if (!item.title) return null;
  return {
    source: "semantic_scholar" as const,
    id: item.paperId,
    title: item.title,
    authors: (item.authors ?? []).map((a) => a.name),
    abstract: item.abstract ?? "",
    url: item.url ?? fallbackUrl ?? "",
    pdfUrl: item.openAccessPdf?.url,
    published: item.publicationDate ?? undefined,
    venue: item.venue || undefined,
    year: item.year ?? undefined,
    primaryCategory: undefined
  };
}

async function fetchSemanticScholarByDOI(
  doi: string
): Promise<AISearchResultPaper | null> {
  try {
    const response = await safeFetch(
      // Semantic Scholar 路径风格 /paper/DOI:10.x/yy —— 斜杠保留原样
      `${S2_PAPER_ENDPOINT}/DOI:${doi}?fields=${S2_FIELDS}`,
      {
        headers: { "user-agent": "trick-cards/0.1 (+research-aid)" },
        cache: "no-store"
      }
    );
    if (!response.ok) return null;
    const item = (await response.json()) as S2PaperResponse;
    return s2ResponseToPaper(item, `https://doi.org/${doi}`);
  } catch {
    return null;
  }
}

async function fetchSemanticScholarByUrl(
  paperUrl: string
): Promise<AISearchResultPaper | null> {
  try {
    const response = await safeFetch(
      `${S2_PAPER_ENDPOINT}/URL:${encodeURIComponent(paperUrl)}?fields=${S2_FIELDS}`,
      {
        headers: { "user-agent": "trick-cards/0.1 (+research-aid)" },
        cache: "no-store"
      }
    );
    if (!response.ok) return null;
    const item = (await response.json()) as S2PaperResponse;
    return s2ResponseToPaper(item, paperUrl);
  } catch {
    return null;
  }
}

export async function importPaper(
  input: string,
  options: { llmOverride?: LLMOverride } = {}
): Promise<AIPaperImport> {
  let paper: AISearchResultPaper | null = null;

  // 1. arXiv ID / URL → arXiv 直连
  const arxivId = detectArxivId(input);
  if (arxivId) {
    paper = await fetchArxivById(arxivId).catch(() => null);
  }

  // 2. DOI → 同时打 OpenAlex + Semantic Scholar + Crossref，谁先返回用谁
  if (!paper) {
    const doi = detectDOI(input);
    if (doi) {
      paper = await firstResolved([
        fetchOpenAlexByDOI(doi),
        fetchSemanticScholarByDOI(doi),
        fetchCrossrefByDOI(doi)
      ]);
      if (!paper) {
        throw new Error(
          `DOI "${doi}" 在公开数据库（OpenAlex / Semantic Scholar / Crossref）中均查不到。可能 DOI 拼写有误，或这是 IEEE 等付费源未公开收录的论文。建议：粘贴论文标题，或直接复制 IEEE Xplore / Springer 的页面 URL。`
        );
      }
    }
  }

  // 2.5 IEEE Xplore URL → 抓页面元数据（IEEE 没有公开 API，但页面里有 DOI / 标题 / 摘要）
  if (!paper) {
    const ieeeUrl = detectIEEEXploreUrl(input);
    if (ieeeUrl) {
      paper = await fetchIEEEXploreByUrl(ieeeUrl);
      // 如果拿到 DOI，再用 OpenAlex/Crossref 补充更完整的摘要/作者信息
      if (paper && paper.id?.startsWith("10.")) {
        const enriched = await firstResolved([
          fetchOpenAlexByDOI(paper.id),
          fetchCrossrefByDOI(paper.id)
        ]);
        if (enriched && enriched.abstract && enriched.abstract.length > paper.abstract.length) {
          paper = enriched;
        }
      }
    }
  }

  // 3. 已知学术站点 URL → Semantic Scholar URL 查询
  if (!paper && isPaperUrl(input)) {
    paper = await fetchSemanticScholarByUrl(input).catch(() => null);
  }

  // 4. 关键词搜索 → arXiv + OpenAlex + Semantic Scholar + IEEE Xplore 四路并发，取首个非空
  if (!paper) {
    const query = URL_RE.test(input)
      ? input.replace(/^https?:\/\/[^/]+\//, "").replace(/[/\-_]+/g, " ").trim()
      : input;

    paper = await firstResolved([
      searchArxiv(query, { maxResults: 1 })
        .then((list) => list[0] ?? null)
        .catch(() => null),
      searchOpenAlex(query, { maxResults: 1 })
        .then((list) => list[0] ?? null)
        .catch(() => null),
      searchSemanticScholar(query, { maxResults: 1 })
        .then((list) => list[0] ?? null)
        .catch(() => null),
      searchIEEEXplore(query, { maxResults: 1 })
        .then((list) => list[0] ?? null)
        .catch(() => null)
    ]);
  }

  if (!paper) {
    throw new Error("未能找到匹配的论文，试试换个链接、DOI 或关键词。");
  }

  const result: AIPaperImport = {
    source: paper.source ?? "arxiv",
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    url: paper.url,
    pdfUrl: paper.pdfUrl,
    published: paper.published,
    venue: paper.venue,
    year: paper.year,
    tags: paper.primaryCategory ? [paper.primaryCategory] : []
  };

  if (isLLMAvailable(options.llmOverride) && paper.abstract) {
    try {
      const llm = await summarizeWithLLM(paper, options.llmOverride);
      result.summary = llm.summary;
      result.highlights = llm.highlights;
      result.tags = mergeTags(result.tags, llm.tags);
      result.trickCandidates = llm.trickCandidates;
    } catch {
      // LLM 失败不影响导入，仅缺少摘要
    }
  }

  return result;
}

type LLMResult = {
  summary: string;
  highlights: string[];
  tags: string[];
  trickCandidates: AITrickCandidate[];
};

async function summarizeWithLLM(
  paper: AISearchResultPaper,
  override?: LLMOverride
): Promise<LLMResult> {
  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "你是帮助技术研究者管理论文的助手。基于论文标题与英文摘要，用中文输出严格 JSON。每一项必须具体、可操作；不要重复输入。"
    },
    {
      role: "user",
      content: [
        `标题：${paper.title}`,
        `作者：${paper.authors.join(", ")}`,
        paper.year ? `年份：${paper.year}` : "",
        paper.venue ? `出处：${paper.venue}` : "",
        `摘要：${paper.abstract}`,
        "",
        "请严格按以下 JSON 结构输出：",
        '{',
        '  "summary": "2-3 句中文一句话总结，可以稍长，但不超过 120 字",',
        '  "highlights": ["3-5 个中文要点，每条不超过 25 字"],',
        '  "tags": ["3-6 个英文或中文标签，如 RAG / Diffusion / Multimodal"],',
        '  "trickCandidates": [',
        '    {',
        '      "title": "中文标题，命名一个具体的技术 trick",',
        '      "problem": "1-2 句中文：这个 trick 解决了什么问题",',
        '      "solution": "2-4 句中文：核心做法",',
        '      "benefits": ["收益要点 1", "收益要点 2"],',
        '      "costs": ["成本/代价要点"],',
        '      "applicableScenarios": ["适用场景 1", "适用场景 2"]',
        '    }',
        '  ]',
        '}'
      ]
        .filter(Boolean)
        .join("\n")
    }
  ];

  const data = await chatJSON<LLMResult>(messages, {
    temperature: 0.3,
    maxTokens: 1400,
    override
  });

  return {
    summary: data.summary ?? "",
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    trickCandidates: Array.isArray(data.trickCandidates)
      ? data.trickCandidates
      : []
  };
}

/**
 * 并发跑多个 Promise，返回第一个非空（非 null/undefined）结果。
 * 全部失败/为空则返回 null。
 */
async function firstResolved<T>(
  promises: Promise<T | null | undefined>[]
): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = promises.length;
    if (pending === 0) {
      resolve(null);
      return;
    }
    let resolved = false;
    promises.forEach((p) => {
      p.then((value) => {
        if (resolved) return;
        if (value !== null && value !== undefined) {
          resolved = true;
          resolve(value);
        } else if (--pending === 0) {
          resolve(null);
        }
      }).catch(() => {
        if (resolved) return;
        if (--pending === 0) resolve(null);
      });
    });
  });
}

function mergeTags(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...base, ...extra]) {
    const key = tag.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out.slice(0, 8);
}
