// 检索源：arXiv（公开 API，免 key）+ Tavily（可选）。仅服务端使用。

import type { AISearchResultPaper, AISearchResultWeb } from "./types";
import { safeFetch } from "../safeFetch";

const ARXIV_ENDPOINT = "https://export.arxiv.org/api/query";

export async function searchArxiv(
  query: string,
  opts: {
    maxResults?: number;
    sortBy?: "relevance" | "submittedDate";
  } = {}
): Promise<AISearchResultPaper[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 8, 1), 30);
  const sortBy = opts.sortBy === "submittedDate" ? "submittedDate" : "relevance";
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(max),
    sortBy,
    sortOrder: "descending"
  });
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
    response = await safeFetch(`${ARXIV_ENDPOINT}?${params.toString()}`, {
      headers: { "user-agent": "trick-cards/0.1 (+research-aid)" },
      cache: "no-store"
    });
    if (response.status !== 429) break;
  }
  if (!response || !response.ok) {
    throw new Error(`arXiv 检索失败 (${response?.status ?? "no response"})`);
  }
  return parseArxivAtom(await response.text());
}

export async function fetchArxivById(
  id: string
): Promise<AISearchResultPaper | null> {
  const cleanId = id.trim().replace(/^arxiv:/i, "").replace(/v\d+$/i, "");
  if (!cleanId) return null;
  const params = new URLSearchParams({ id_list: cleanId });
  const response = await safeFetch(`${ARXIV_ENDPOINT}?${params.toString()}`, {
    headers: { "user-agent": "trick-cards/0.1 (+research-aid)" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`arXiv 抓取失败 (${response.status})`);
  }
  const list = parseArxivAtom(await response.text());
  return list[0] ?? null;
}

function parseArxivAtom(xml: string): AISearchResultPaper[] {
  const entries: AISearchResultPaper[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(xml)) !== null) {
    const block = match[1];
    const title = textOf(block, "title");
    const summary = textOf(block, "summary");
    const idRaw = textOf(block, "id");
    const published = textOf(block, "published");
    const updated = textOf(block, "updated");

    const authors: string[] = [];
    const authorRe = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
    let authorMatch: RegExpExecArray | null;
    while ((authorMatch = authorRe.exec(block)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    const pdfMatch = block.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const idMatch = idRaw.match(/abs\/([^\s]+)$/);
    const arxivId = (idMatch ? idMatch[1] : idRaw).replace(/v\d+$/i, "");
    const primaryCategoryMatch = block.match(
      /<arxiv:primary_category[^/]*term="([^"]+)"/
    );

    entries.push({
      source: "arxiv",
      id: arxivId,
      title: cleanWhitespace(title),
      authors,
      abstract: cleanWhitespace(summary),
      url: idRaw.trim(),
      pdfUrl: pdfMatch?.[1],
      published,
      updated,
      year: extractYear(published),
      venue: primaryCategoryMatch ? `arXiv ${primaryCategoryMatch[1]}` : "arXiv",
      primaryCategory: primaryCategoryMatch?.[1]
    });
  }
  return entries;
}

function textOf(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const result = block.match(re);
  return result ? result[1].trim() : "";
}

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractYear(date?: string): number | undefined {
  if (!date) return undefined;
  const match = date.match(/^(\d{4})/);
  return match ? Number(match[1]) : undefined;
}

// ---- Semantic Scholar（免费 API，覆盖 IEEE / ACM / Springer / CVPR 等） ----

const S2_ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/search";

/** 会议/期刊缩写 → Semantic Scholar venue 名称映射（覆盖 SCI Q1/Q2 及顶会） */
const VENUE_ALIASES: Record<string, string[]> = {
  // ===== 综合顶刊 =====
  nature: ["Nature"],
  science: ["Science"],
  pnas: ["PNAS", "Proceedings of the National Academy of Sciences"],
  "nature communications": ["Nature Communications"],
  "nature methods": ["Nature Methods"],
  "nature biotechnology": ["Nature Biotechnology"],
  "nature medicine": ["Nature Medicine"],
  "nature genetics": ["Nature Genetics"],
  "nature neuroscience": ["Nature Neuroscience"],
  "nature physics": ["Nature Physics"],
  "nature chemistry": ["Nature Chemistry"],
  "nature materials": ["Nature Materials"],
  "nature energy": ["Nature Energy"],
  "nature electronics": ["Nature Electronics"],
  "nature machine intelligence": ["Nature Machine Intelligence"],
  "nature computational science": ["Nature Computational Science"],
  "nature reviews": ["Nature Reviews"],
  "science advances": ["Science Advances"],
  "science robotics": ["Science Robotics"],
  cell: ["Cell"],
  lancet: ["The Lancet", "Lancet"],
  bmj: ["BMJ", "British Medical Journal"],
  jama: ["JAMA", "Journal of the American Medical Association"],
  nejm: ["NEJM", "New England Journal of Medicine"],

  // ===== AI / ML / DL 顶会 =====
  neurips: ["NeurIPS", "Neural Information Processing Systems"],
  nips: ["NeurIPS", "Neural Information Processing Systems"],
  icml: ["ICML", "International Conference on Machine Learning"],
  iclr: ["ICLR", "International Conference on Learning Representations"],
  aaai: ["AAAI", "AAAI Conference on Artificial Intelligence"],
  ijcai: ["IJCAI", "International Joint Conference on Artificial Intelligence"],
  uai: ["UAI", "Uncertainty in Artificial Intelligence"],
  aistats: ["AISTATS", "Artificial Intelligence and Statistics"],
  colt: ["COLT", "Conference on Learning Theory"],
  jmlr: ["JMLR", "Journal of Machine Learning Research"],

  // ===== 计算机视觉 =====
  cvpr: ["CVPR", "Computer Vision and Pattern Recognition"],
  iccv: ["ICCV", "International Conference on Computer Vision"],
  eccv: ["ECCV", "European Conference on Computer Vision"],
  tpami: ["TPAMI", "IEEE Transactions on Pattern Analysis and Machine Intelligence"],
  tip: ["TIP", "IEEE Transactions on Image Processing"],
  ijcv: ["IJCV", "International Journal of Computer Vision"],
  tmm: ["TMM", "IEEE Transactions on Multimedia"],
  tcsvt: ["TCSVT", "IEEE Transactions on Circuits and Systems for Video Technology"],
  wacv: ["WACV", "Winter Conference on Applications of Computer Vision"],
  bmvc: ["BMVC", "British Machine Vision Conference"],
  "3dv": ["3DV", "International Conference on 3D Vision"],
  fg: ["FG", "IEEE International Conference on Automatic Face and Gesture Recognition"],

  // ===== NLP / CL =====
  acl: ["ACL", "Annual Meeting of the Association for Computational Linguistics"],
  emnlp: ["EMNLP", "Empirical Methods in Natural Language Processing"],
  naacl: ["NAACL", "North American Chapter of the Association for Computational Linguistics"],
  coling: ["COLING", "International Conference on Computational Linguistics"],
  eacl: ["EACL", "European Chapter of the Association for Computational Linguistics"],
  tacl: ["TACL", "Transactions of the Association for Computational Linguistics"],
  cl: ["CL", "Computational Linguistics"],

  // ===== 信息检索 / 数据挖掘 / Web =====
  sigir: ["SIGIR", "ACM SIGIR"],
  kdd: ["KDD", "Knowledge Discovery and Data Mining"],
  www: ["WWW", "The Web Conference"],
  wsdm: ["WSDM", "Web Search and Data Mining"],
  cikm: ["CIKM", "Conference on Information and Knowledge Management"],
  recsys: ["RecSys", "ACM Conference on Recommender Systems"],
  icdm: ["ICDM", "IEEE International Conference on Data Mining"],
  sdm: ["SDM", "SIAM International Conference on Data Mining"],
  ecml: ["ECML", "European Conference on Machine Learning"],
  "ecml-pkdd": ["ECML-PKDD", "European Conference on Machine Learning and Principles and Practice of Knowledge Discovery in Databases"],
  tkde: ["TKDE", "IEEE Transactions on Knowledge and Data Engineering"],
  tkdd: ["TKDD", "ACM Transactions on Knowledge Discovery from Data"],
  tois: ["TOIS", "ACM Transactions on Information Systems"],

  // ===== 数据库 =====
  sigmod: ["SIGMOD", "ACM SIGMOD"],
  vldb: ["VLDB", "Very Large Data Bases", "Proceedings of the VLDB Endowment"],
  icde: ["ICDE", "IEEE International Conference on Data Engineering"],
  pods: ["PODS", "ACM Symposium on Principles of Database Systems"],
  tods: ["TODS", "ACM Transactions on Database Systems"],
  vldbj: ["VLDB Journal", "The VLDB Journal"],

  // ===== 系统 / 网络 / 安全 =====
  osdi: ["OSDI", "USENIX Symposium on Operating Systems Design and Implementation"],
  sosp: ["SOSP", "Symposium on Operating Systems Principles"],
  nsdi: ["NSDI", "USENIX Symposium on Networked Systems Design and Implementation"],
  sigcomm: ["SIGCOMM", "ACM SIGCOMM"],
  atc: ["ATC", "USENIX Annual Technical Conference"],
  eurosys: ["EuroSys", "European Conference on Computer Systems"],
  fast: ["FAST", "USENIX Conference on File and Storage Technologies"],
  mobicom: ["MobiCom", "ACM International Conference on Mobile Computing and Networking"],
  mobisys: ["MobiSys", "ACM International Conference on Mobile Systems"],
  sensys: ["SenSys", "ACM Conference on Embedded Networked Sensor Systems"],
  infocom: ["INFOCOM", "IEEE International Conference on Computer Communications"],
  imc: ["IMC", "ACM Internet Measurement Conference"],
  conext: ["CoNEXT", "ACM Conference on Emerging Networking Experiments and Technologies"],
  ton: ["TON", "IEEE/ACM Transactions on Networking"],
  tmc: ["TMC", "IEEE Transactions on Mobile Computing"],
  // 安全
  sp: ["S&P", "IEEE Symposium on Security and Privacy"],
  "s&p": ["S&P", "IEEE Symposium on Security and Privacy"],
  ccs: ["CCS", "ACM Conference on Computer and Communications Security"],
  usenixsec: ["USENIX Security", "USENIX Security Symposium"],
  "usenix security": ["USENIX Security", "USENIX Security Symposium"],
  ndss: ["NDSS", "Network and Distributed System Security Symposium"],
  tdsc: ["TDSC", "IEEE Transactions on Dependable and Secure Computing"],
  tifs: ["TIFS", "IEEE Transactions on Information Forensics and Security"],
  crypto: ["CRYPTO", "International Cryptology Conference"],
  eurocrypt: ["EUROCRYPT", "International Conference on the Theory and Applications of Cryptographic Techniques"],

  // ===== HCI / 图形学 =====
  chi: ["CHI", "Conference on Human Factors in Computing Systems"],
  uist: ["UIST", "ACM Symposium on User Interface Software and Technology"],
  cscw: ["CSCW", "Computer Supported Cooperative Work"],
  ubicomp: ["UbiComp", "ACM International Joint Conference on Pervasive and Ubiquittic Computing"],
  siggraph: ["SIGGRAPH", "ACM SIGGRAPH"],
  "siggraph asia": ["SIGGRAPH Asia", "ACM SIGGRAPH Asia"],
  tog: ["TOG", "ACM Transactions on Graphics"],
  tvcg: ["TVCG", "IEEE Transactions on Visualization and Computer Graphics"],
  vis: ["VIS", "IEEE Visualization Conference"],
  "ieee vis": ["VIS", "IEEE Visualization Conference"],
  eurovis: ["EuroVis", "Eurographics Conference on Visualization"],
  eurographics: ["Eurographics", "Annual Conference of the European Association for Computer Graphics"],

  // ===== 软件工程 / PL =====
  icse: ["ICSE", "International Conference on Software Engineering"],
  fse: ["FSE", "ACM Joint European Software Engineering Conference and Symposium on the Foundations of Software Engineering"],
  ase: ["ASE", "IEEE/ACM International Conference on Automated Software Engineering"],
  issta: ["ISSTA", "International Symposium on Software Testing and Analysis"],
  pldi: ["PLDI", "ACM SIGPLAN Conference on Programming Language Design and Implementation"],
  popl: ["POPL", "ACM SIGPLAN Symposium on Principles of Programming Languages"],
  oopsla: ["OOPSLA", "Object-Oriented Programming, Systems, Languages, and Applications"],
  tse: ["TSE", "IEEE Transactions on Software Engineering"],
  tosem: ["TOSEM", "ACM Transactions on Software Engineering and Methodology"],
  toplas: ["TOPLAS", "ACM Transactions on Programming Languages and Systems"],

  // ===== 计算机体系结构 / EDA / VLSI =====
  isca: ["ISCA", "International Symposium on Computer Architecture"],
  micro: ["MICRO", "IEEE/ACM International Symposium on Microarchitecture"],
  hpca: ["HPCA", "IEEE International Symposium on High-Performance Computer Architecture"],
  asplos: ["ASPLOS", "Architectural Support for Programming Languages and Operating Systems"],
  dac: ["DAC", "Design Automation Conference"],
  iccad: ["ICCAD", "IEEE/ACM International Conference on Computer-Aided Design"],
  date: ["DATE", "Design, Automation and Test in Europe"],
  fpl: ["FPL", "Field Programmable Logic"],
  fpga: ["FPGA", "ACM/SIGDA International Symposium on Field-Programmable Gate Arrays"],
  fccm: ["FCCM", "IEEE International Symposium on Field-Programmable Custom Computing Machines"],
  isscc: ["ISSCC", "IEEE International Solid-State Circuits Conference"],
  jssc: ["JSSC", "IEEE Journal of Solid-State Circuits"],
  tcad: ["TCAD", "IEEE Transactions on Computer-Aided Design of Integrated Circuits and Systems"],
  tc: ["TC", "IEEE Transactions on Computers"],
  taco: ["TACO", "ACM Transactions on Architecture and Code Optimization"],
  cal: ["CAL", "IEEE Computer Architecture Letters"],
  tvlsi: ["TVLSI", "IEEE Transactions on Very Large Scale Integration Systems"],
  tcas1: ["TCAS-I", "IEEE Transactions on Circuits and Systems I"],
  "tcas-i": ["TCAS-I", "IEEE Transactions on Circuits and Systems I"],
  tcas2: ["TCAS-II", "IEEE Transactions on Circuits and Systems II"],
  "tcas-ii": ["TCAS-II", "IEEE Transactions on Circuits and Systems II"],
  iscas: ["ISCAS", "IEEE International Symposium on Circuits and Systems"],
  "a-sscc": ["A-SSCC", "IEEE Asian Solid-State Circuits Conference"],
  asscc: ["A-SSCC", "IEEE Asian Solid-State Circuits Conference"],
  cicc: ["CICC", "IEEE Custom Integrated Circuits Conference"],
  esscirc: ["ESSCIRC", "European Solid-State Circuits Conference"],
  vlsi: ["VLSI", "Symposium on VLSI Technology and Circuits"],
  "vlsi symposium": ["VLSI", "Symposium on VLSI Technology and Circuits"],

  // ===== 机器人 =====
  icra: ["ICRA", "IEEE International Conference on Robotics and Automation"],
  iros: ["IROS", "IEEE/RSJ International Conference on Intelligent Robots and Systems"],
  rss: ["RSS", "Robotics: Science and Systems"],
  corl: ["CoRL", "Conference on Robot Learning"],
  ral: ["RAL", "IEEE Robotics and Automation Letters"],
  tro: ["TRO", "IEEE Transactions on Robotics"],
  ijrr: ["IJRR", "International Journal of Robotics Research"],

  // ===== 信号处理 / 通信 =====
  icassp: ["ICASSP", "IEEE International Conference on Acoustics, Speech and Signal Processing"],
  interspeech: ["Interspeech"],
  tsp: ["TSP", "IEEE Transactions on Signal Processing"],
  taslp: ["TASLP", "IEEE/ACM Transactions on Audio, Speech and Language Processing"],
  twc: ["TWC", "IEEE Transactions on Wireless Communications"],
  tcom: ["TCOM", "IEEE Transactions on Communications"],
  jsac: ["JSAC", "IEEE Journal on Selected Areas in Communications"],
  tit: ["TIT", "IEEE Transactions on Information Theory"],
  globecom: ["GLOBECOM", "IEEE Global Communications Conference"],
  icc: ["ICC", "IEEE International Conference on Communications"],

  // ===== 控制 / 自动化 =====
  tac: ["TAC", "IEEE Transactions on Automatic Control"],
  automatica: ["Automatica"],
  cdc: ["CDC", "IEEE Conference on Decision and Control"],
  acc: ["ACC", "American Control Conference"],
  tcst: ["TCST", "IEEE Transactions on Control Systems Technology"],

  // ===== 电力 / 能源 =====
  tpwrs: ["TPWRS", "IEEE Transactions on Power Systems"],
  tpel: ["TPEL", "IEEE Transactions on Power Electronics"],
  tsg: ["TSG", "IEEE Transactions on Smart Grid"],
  tse_energy: ["TSE", "IEEE Transactions on Sustainable Energy"],
  apec: ["APEC", "IEEE Applied Power Electronics Conference"],
  ecce: ["ECCE", "IEEE Energy Conversion Congress and Exposition"],
  pes: ["PES", "IEEE Power & Energy Society General Meeting"],

  // ===== 材料 / 纳米 / 物理 =====
  "advanced materials": ["Advanced Materials"],
  "acs nano": ["ACS Nano"],
  "nano letters": ["Nano Letters"],
  "physical review letters": ["Physical Review Letters"],
  prl: ["PRL", "Physical Review Letters"],
  prx: ["PRX", "Physical Review X"],
  "physical review x": ["Physical Review X"],
  prb: ["PRB", "Physical Review B"],
  pra: ["PRA", "Physical Review A"],
  prd: ["PRD", "Physical Review D"],
  "applied physics letters": ["Applied Physics Letters"],
  apl: ["APL", "Applied Physics Letters"],
  jap: ["JAP", "Journal of Applied Physics"],

  // ===== 化学 / 化工 =====
  jacs: ["JACS", "Journal of the American Chemical Society"],
  "angewandte chemie": ["Angewandte Chemie"],
  "chemical reviews": ["Chemical Reviews"],
  "chemical society reviews": ["Chemical Society Reviews"],
  "nature catalysis": ["Nature Catalysis"],
  acs: ["ACS", "American Chemical Society"],
  "acs catalysis": ["ACS Catalysis"],

  // ===== 生物 / 医学 =====
  bioinformatics: ["Bioinformatics"],
  "genome research": ["Genome Research"],
  "genome biology": ["Genome Biology"],
  "nucleic acids research": ["Nucleic Acids Research"],
  nar: ["NAR", "Nucleic Acids Research"],
  "plos biology": ["PLOS Biology"],
  "plos medicine": ["PLOS Medicine"],
  "plos one": ["PLOS ONE"],
  bmc: ["BMC", "BioMed Central"],
  recomb: ["RECOMB", "Research in Computational Molecular Biology"],
  ismb: ["ISMB", "Intelligent Systems for Molecular Biology"],

  // ===== 地球科学 / 环境 =====
  "nature geoscience": ["Nature Geoscience"],
  "nature climate change": ["Nature Climate Change"],
  "environmental science & technology": ["Environmental Science & Technology"],
  est: ["EST", "Environmental Science & Technology"],
  jgr: ["JGR", "Journal of Geophysical Research"],
  grl: ["GRL", "Geophysical Research Letters"],

  // ===== 数学 / 统计 =====
  jasa: ["JASA", "Journal of the American Statistical Association"],
  "annals of statistics": ["Annals of Statistics"],
  jrssb: ["JRSS-B", "Journal of the Royal Statistical Society Series B"],
  biometrika: ["Biometrika"],
  siam: ["SIAM"],
  "siam review": ["SIAM Review"],
  focs: ["FOCS", "IEEE Symposium on Foundations of Computer Science"],
  stoc: ["STOC", "ACM Symposium on Theory of Computing"],
  soda: ["SODA", "ACM-SIAM Symposium on Discrete Algorithms"],

  // ===== 教育 =====
  "computers & education": ["Computers & Education"],
  "internet and higher education": ["The Internet and Higher Education"],
  "educational technology & society": ["Educational Technology & Society"],
  "british journal of educational technology": ["British Journal of Educational Technology"],

  // ===== 管理 / 经济 =====
  mis: ["MIS Quarterly", "Management Information Systems Quarterly"],
  "information systems research": ["Information Systems Research"],
  isr: ["ISR", "Information Systems Research"],
  jmis: ["JMIS", "Journal of Management Information Systems"],

  // ===== 综合工程 IEEE Transactions =====
  tie: ["TIE", "IEEE Transactions on Industrial Electronics"],
  tii: ["TII", "IEEE Transactions on Industrial Informatics"],
  tits: ["TITS", "IEEE Transactions on Intelligent Transportation Systems"],
  tiv: ["TIV", "IEEE Transactions on Intelligent Vehicles"],
  tvt: ["TVT", "IEEE Transactions on Vehicular Technology"],
  tgrs: ["TGRS", "IEEE Transactions on Geoscience and Remote Sensing"],
  tmi: ["TMI", "IEEE Transactions on Medical Imaging"],
  tbme: ["TBME", "IEEE Transactions on Biomedical Engineering"],
  ted: ["TED", "IEEE Transactions on Electron Devices"],
  temc: ["TEMC", "IEEE Transactions on Electromagnetic Compatibility"],
  tmtt: ["TMTT", "IEEE Transactions on Microwave Theory and Techniques"],
  tap: ["TAP", "IEEE Transactions on Antennas and Propagation"],
  tnn: ["TNNLS", "IEEE Transactions on Neural Networks and Learning Systems"],
  tnnls: ["TNNLS", "IEEE Transactions on Neural Networks and Learning Systems"],
  tcyb: ["TCYB", "IEEE Transactions on Cybernetics"],
  tfs: ["TFS", "IEEE Transactions on Fuzzy Systems"],
  tec: ["TEC", "IEEE Transactions on Evolutionary Computation"],
  tsmc: ["TSMC", "IEEE Transactions on Systems, Man, and Cybernetics"],
  access: ["IEEE Access"],
  "ieee access": ["IEEE Access"],
  proceedings: ["Proceedings of the IEEE"],
  "proceedings of the ieee": ["Proceedings of the IEEE"],

  // ===== ACM 综合 =====
  csur: ["CSUR", "ACM Computing Surveys"],
  cacm: ["CACM", "Communications of the ACM"],
  jacm: ["JACM", "Journal of the ACM"],
};

export function expandVenues(venues: string[]): string[] {
  const expanded = new Set<string>();
  for (const v of venues) {
    const key = v.toLowerCase().trim();
    const aliases = VENUE_ALIASES[key];
    if (aliases) {
      aliases.forEach((a) => expanded.add(a));
    } else {
      expanded.add(v);
    }
  }
  return Array.from(expanded);
}

export async function searchSemanticScholar(
  query: string,
  opts: {
    maxResults?: number;
    venues?: string[];
    year?: string;
  } = {}
): Promise<AISearchResultPaper[]> {
  const limit = Math.min(Math.max(opts.maxResults ?? 8, 1), 30);
  const expandedVenues = opts.venues?.length ? expandVenues(opts.venues) : [];
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields:
      "paperId,title,abstract,authors,venue,year,externalIds,url,openAccessPdf,publicationDate"
  });
  if (expandedVenues.length) {
    params.set("venue", expandedVenues.join(","));
  }
  if (opts.year) {
    params.set("year", opts.year);
  }

  const fullUrl = `${S2_ENDPOINT}?${params.toString()}`;

  // 带退避重试（应对 429 限频）
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    response = await safeFetch(fullUrl, {
      headers: { "user-agent": "trick-cards/0.1 (+research-aid)" },
      cache: "no-store"
    });
    if (response.status !== 429) break;
    console.log(`[S2] 429 rate-limited, retry ${attempt + 1}/3...`);
  }
  if (!response || !response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    data?: Array<{
      paperId: string;
      title: string;
      abstract?: string | null;
      authors?: Array<{ name: string }>;
      venue?: string;
      year?: number;
      url?: string;
      externalIds?: Record<string, string | undefined>;
      openAccessPdf?: { url: string } | null;
      publicationDate?: string;
    }>;
  };
  return (data.data ?? [])
    .filter((item) => item.title && item.abstract)
    .map((item) => {
      const arxivId = item.externalIds?.ArXiv;
      const doi = item.externalIds?.DOI;
      const paperUrl =
        item.url ??
        (doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${item.paperId}`);
      return {
        source: "semantic_scholar" as const,
        id: item.paperId,
        title: item.title,
        authors: (item.authors ?? []).map((a) => a.name),
        abstract: item.abstract ?? "",
        url: paperUrl,
        pdfUrl: item.openAccessPdf?.url,
        published: item.publicationDate ?? undefined,
        venue: item.venue || undefined,
        year: item.year ?? undefined,
        primaryCategory: arxivId ? `arXiv:${arxivId}` : undefined
      };
    });
}

// ---- IEEE Xplore 页面解析（无 API，直接从页面 xplGlobal.document.metadata 提取）----

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * 抓 IEEE Xplore 页面上的 xplGlobal.document.metadata 对象，提取 DOI / 标题 / 摘要 / 作者 / 期刊 / 年份。
 * IEEE 没有公开 API，但页面里有完整的 JSON 元数据。
 */
export async function fetchIEEEXploreByUrl(
  url: string
): Promise<AISearchResultPaper | null> {
  try {
    const response = await safeFetch(url, {
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml"
      },
      cache: "no-store"
    });
    if (!response.ok) return null;
    const html = await response.text();

    // metadata 块格式：xplGlobal.document.metadata={...};
    // JSON 内部有大量嵌套花括号，需要做平衡括号解析
    const startMarker = "xplGlobal.document.metadata=";
    const startIdx = html.indexOf(startMarker);
    if (startIdx < 0) return null;
    let i = startIdx + startMarker.length;
    if (html[i] !== "{") return null;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let endIdx = -1;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inStr) {
        if (ch === "\\") escape = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    if (endIdx < 0) return null;
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(html.slice(startIdx + startMarker.length, endIdx));
    } catch {
      return null;
    }

    const get = <T>(key: string): T | undefined => meta[key] as T | undefined;

    const doi = get<string>("doi");
    const title =
      get<string>("title") ?? get<string>("displayDocTitle") ?? "";
    const abstract = get<string>("abstract") ?? "";
    const venue =
      get<string>("publicationTitle") ??
      get<string>("displayPublicationTitle") ??
      "";
    const yearStr = get<string>("publicationYear");
    const year = yearStr ? Number.parseInt(yearStr, 10) : undefined;
    const authorsRaw = get<string>("authorNames") ?? "";
    const authors = authorsRaw
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const articleId = get<string>("articleId");

    if (!title) return null;

    return {
      source: "crossref" as const, // 复用 crossref 类型（IEEE 也是 DOI 注册机构之一）
      id: doi ?? articleId ?? url,
      title,
      authors,
      abstract,
      url: doi ? `https://doi.org/${doi}` : url,
      pdfUrl: undefined,
      published: year ? `${year}-01-01` : undefined,
      venue: venue || undefined,
      year: Number.isFinite(year) ? year : undefined
    };
  } catch {
    return null;
  }
}

/**
 * 从任意输入（URL 或文本）里尝试提取 IEEE 文章号 → 拼成 IEEE Xplore URL。
 */
export function detectIEEEXploreUrl(input: string): string | null {
  const m = input.match(/ieeexplore\.ieee\.org\/document\/(\d{6,9})/i);
  if (m) return `https://ieeexplore.ieee.org/document/${m[1]}`;
  return null;
}

// ---- IEEE Xplore 搜索（通过搜索结果页抓取，覆盖 ISSCC / JSSC 等 IEEE 会议/期刊）----

/**
 * 已知 IEEE 会议/期刊缩写 → IEEE Xplore 内部 punumber 映射。
 * IEEE Xplore 搜索 API 支持 punumber 过滤，比纯关键词更精准。
 */
const IEEE_PUB_NUMBERS: Record<string, string> = {
  isscc: "1000657",
  jssc: "1000657",
  isca: "1000672",
  micro: "1000673",
  hpca: "1000674",
  dac: "1000645",
  iccad: "1000646",
  date: "1000650",
  iscas: "1000680",
  cicc: "1000648",
  asscc: "1000655",
  vlsi: "1000691",
  icassp: "1000660",
  tcas1: "1000676",
  tcas2: "1000677",
  tvlsi: "1000690",
  jssc_journal: "1000656",
};

/**
 * 在 IEEE Xplore 上搜索论文。通过抓取搜索结果页的 JSON 数据提取论文列表。
 * 适用于 ISSCC、JSSC、ISCA 等 IEEE 出版的会议/期刊。
 *
 * 实现策略：
 * 1. 优先走 OpenAlex（免费 API、无 CORS 问题）带 venue 过滤
 * 2. 如果 OpenAlex 命中不足，再通过 Crossref 带 ISSN 过滤补充
 * 3. 对每篇拿到的 DOI，尝试从 IEEE Xplore 页面补全摘要（IEEE 论文摘要 OpenAlex 常缺失）
 */
export async function searchIEEEXplore(
  query: string,
  opts: {
    maxResults?: number;
    venues?: string[];
  } = {}
): Promise<AISearchResultPaper[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 8, 1), 20);
  const expandedVenues = opts.venues?.length ? expandVenues(opts.venues) : [];

  // 策略 1：OpenAlex + venue 过滤
  const openAlexResults = await searchOpenAlex(query, {
    maxResults: max,
    venues: expandedVenues.length ? expandedVenues : undefined
  });

  // 策略 2：如果 OpenAlex 命中不足，Crossref 补充
  let crossrefResults: AISearchResultPaper[] = [];
  if (openAlexResults.length < max) {
    crossrefResults = await searchCrossrefByVenue(query, {
      maxResults: max - openAlexResults.length,
      venues: expandedVenues
    });
  }

  // 合并去重
  const seen = new Set<string>();
  const merged: AISearchResultPaper[] = [];
  for (const paper of [...openAlexResults, ...crossrefResults]) {
    const key = paper.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(paper);
    }
  }

  // 策略 3：对缺少摘要的论文，用 DOI 去 IEEE Xplore 页面补全
  const papersWithAbstract = await Promise.all(
    merged.slice(0, max).map(async (paper) => {
      // 摘要已足够长则跳过
      if (paper.abstract && paper.abstract.length > 50) return paper;
      // 尝试从 DOI 提取 IEEE 页面信息
      const doi = paper.id?.startsWith("10.") ? paper.id : paper.url?.match(/doi\.org\/(10\.[^\s]+)/)?.[1];
      if (!doi) return paper;
      const ieeePaper = await fetchIEEEXploreByDOI(doi);
      if (!ieeePaper || !ieeePaper.abstract) return paper;
      // 用 IEEE 页面的摘要和作者信息补充
      return {
        ...paper,
        abstract: ieeePaper.abstract.length > (paper.abstract?.length ?? 0)
          ? ieeePaper.abstract
          : paper.abstract,
        authors: paper.authors.length > 0 ? paper.authors : ieeePaper.authors,
        venue: paper.venue || ieeePaper.venue,
        pdfUrl: paper.pdfUrl ?? ieeePaper.pdfUrl
      } as AISearchResultPaper;
    })
  );

  return papersWithAbstract;
}

/**
 * 通过 DOI 去 IEEE Xplore 页面抓取论文元数据。
 * 使用 Crossref 解析 DOI → 找到 IEEE Xplore 的 document URL → 抓页面。
 */
async function fetchIEEEXploreByDOI(
  doi: string
): Promise<AISearchResultPaper | null> {
  try {
    // 先通过 Crossref 获取 IEEE Xplore 链接
    const crossrefResp = await safeFetch(`${CROSSREF_ENDPOINT}/${doi}`, {
      headers: {
        "user-agent": "trick-cards/0.1 (mailto:trick-cards@research-aid.app)"
      },
      cache: "no-store"
    });
    if (!crossrefResp.ok) return null;
    const crossrefData = (await crossrefResp.json()) as {
      message?: {
        link?: Array<{ "content-type"?: string; "URL"?: string }>;
      };
    };
    // 找 IEEE Xplore 链接
    const ieeeLink = crossrefData.message?.link?.find(
      (l) => l.URL?.includes("ieeexplore.ieee.org")
    );
    if (!ieeeLink?.URL) return null;
    return fetchIEEEXploreByUrl(ieeeLink.URL);
  } catch {
    return null;
  }
}

/**
 * 通过 Crossref API 搜索指定 venue 的论文。
 * Crossref 支持按 ISSN / container-title 过滤，适合 IEEE 期刊/会议。
 */
async function searchCrossrefByVenue(
  query: string,
  opts: {
    maxResults?: number;
    venues?: string[];
  } = {}
): Promise<AISearchResultPaper[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 5, 1), 15);
  if (!opts.venues?.length) return [];

  const expandedVenues = expandVenues(opts.venues);
  // Crossref 用 filter=container-title 按期刊/会议名过滤
  const params = new URLSearchParams({
    query,
    rows: String(max),
    sort: "relevance",
    select: "DOI,title,author,abstract,URL,published,container-title"
  });
  // Crossref 不支持 OR container-title，用第一个 venue 过滤
  if (expandedVenues.length) {
    params.set("query.container-title", expandedVenues[0]);
  }

  try {
    const response = await safeFetch(`${CROSSREF_ENDPOINT}?${params.toString()}`, {
      headers: {
        "user-agent": "trick-cards/0.1 (mailto:trick-cards@research-aid.app)"
      },
      cache: "no-store"
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: Array<{ given?: string; family?: string }>;
          abstract?: string;
          URL?: string;
          published?: { "date-parts"?: number[][] };
          "container-title"?: string[];
        }>;
      };
    };
    const items = data.message?.items ?? [];
    return items
      .filter((item) => item.title?.length)
      .map((item) => {
        const abstractRaw = item.abstract ?? "";
        const abstract = abstractRaw
          .replace(/<jats:[^>]+>/g, "")
          .replace(/<\/jats:[^>]+>/g, "")
          .replace(/<[^>]+>/g, "")
          .trim();
        const year = item.published?.["date-parts"]?.[0]?.[0];
        return {
          source: "crossref" as const,
          id: item.DOI ?? "",
          title: item.title![0],
          authors: (item.author ?? [])
            .map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim())
            .filter(Boolean)
            .slice(0, 10),
          abstract,
          url: item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : ""),
          pdfUrl: undefined,
          published: year ? `${year}-01-01` : undefined,
          venue: item["container-title"]?.[0],
          year
        } as AISearchResultPaper;
      });
  } catch {
    return [];
  }
}

// ---- OpenAlex（免费开放 API，无需 Key，无严格限频，2.5 亿+ 论文）----

const OPENALEX_ENDPOINT = "https://api.openalex.org/works";
const CROSSREF_ENDPOINT = "https://api.crossref.org/works";

/**
 * Crossref DOI 查询 —— 覆盖 1.5 亿 DOI，免费无 key，作为 OpenAlex/S2 的兜底。
 */
export async function fetchCrossrefByDOI(
  doi: string
): Promise<AISearchResultPaper | null> {
  try {
    const response = await safeFetch(`${CROSSREF_ENDPOINT}/${doi}`, {
      headers: {
        "user-agent": "trick-cards/0.1 (mailto:trick-cards@research-aid.app)"
      },
      cache: "no-store"
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      message?: {
        DOI?: string;
        title?: string[];
        author?: Array<{ given?: string; family?: string }>;
        abstract?: string;
        URL?: string;
        published?: { "date-parts"?: number[][] };
        "container-title"?: string[];
      };
    };
    const item = data.message;
    if (!item || !item.title?.length) return null;

    // Crossref 摘要常带 JATS XML 标签，简单清洗
    const abstractRaw = item.abstract ?? "";
    const abstract = abstractRaw
      .replace(/<jats:[^>]+>/g, "")
      .replace(/<\/jats:[^>]+>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    const year = item.published?.["date-parts"]?.[0]?.[0];

    return {
      source: "crossref" as const,
      id: item.DOI ?? doi,
      title: item.title[0],
      authors: (item.author ?? [])
        .map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim())
        .filter(Boolean)
        .slice(0, 10),
      abstract,
      url: item.URL ?? `https://doi.org/${doi}`,
      pdfUrl: undefined,
      published: year ? `${year}-01-01` : undefined,
      venue: item["container-title"]?.[0],
      year
    };
  } catch {
    return null;
  }
}

/**
 * 通过 DOI 直接查询单篇论文（无频控、稳定性优于 Semantic Scholar）。
 */
export async function fetchOpenAlexByDOI(
  doi: string
): Promise<AISearchResultPaper | null> {
  try {
    // OpenAlex 路径风格：/works/doi:10.x/yy —— 斜杠不能被 URL 编码
    const url = `${OPENALEX_ENDPOINT}/doi:${doi}?mailto=trick-cards@research-aid.app`;
    const response = await safeFetch(url, {
      headers: { "user-agent": "trick-cards/0.1 (mailto:trick-cards@research-aid.app)" },
      cache: "no-store"
    });
    if (!response.ok) return null;
    const item = (await response.json()) as {
      id?: string;
      doi?: string;
      title?: string;
      authorships?: Array<{ author?: { display_name?: string } }>;
      abstract_inverted_index?: Record<string, number[]>;
      primary_location?: {
        source?: { display_name?: string };
        pdf_url?: string;
        landing_page_url?: string;
      };
      publication_year?: number;
      publication_date?: string;
      open_access?: { oa_url?: string };
    };
    if (!item.title) return null;

    let abstract = "";
    if (item.abstract_inverted_index) {
      const entries: [string, number][] = [];
      for (const [word, positions] of Object.entries(item.abstract_inverted_index)) {
        for (const pos of positions) entries.push([word, pos]);
      }
      entries.sort((a, b) => a[1] - b[1]);
      abstract = entries.map((e) => e[0]).join(" ");
    }
    const cleanDoi = item.doi?.replace("https://doi.org/", "");
    const fallbackUrl =
      item.primary_location?.landing_page_url ??
      (cleanDoi ? `https://doi.org/${cleanDoi}` : item.id ?? "");

    return {
      source: "openalex" as const,
      id: item.id ?? "",
      title: item.title ?? "",
      authors: (item.authorships ?? [])
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean)
        .slice(0, 10),
      abstract,
      url: fallbackUrl,
      pdfUrl: item.open_access?.oa_url ?? item.primary_location?.pdf_url ?? undefined,
      published: item.publication_date ?? undefined,
      venue: item.primary_location?.source?.display_name ?? undefined,
      year: item.publication_year ?? undefined
    };
  } catch {
    return null;
  }
}

export async function searchOpenAlex(
  query: string,
  opts: {
    maxResults?: number;
    venues?: string[];
  } = {}
): Promise<AISearchResultPaper[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 10, 1), 25);

  // 构建过滤条件
  const filters: string[] = [];
  // 如果有 venue，用 OpenAlex 的 source.display_name 过滤
  if (opts.venues?.length) {
    const expanded = expandVenues(opts.venues);
    // OpenAlex 支持 OR 语法: source.display_name:name1|name2
    const venueFilter = expanded.map((v) => v.replace(/[|,]/g, " ")).join("|");
    filters.push(`primary_location.source.display_name.search:${venueFilter}`);
  }

  const params = new URLSearchParams({
    search: query,
    per_page: String(max),
    sort: "relevance_score:desc",
    select:
      "id,doi,title,authorships,abstract_inverted_index,primary_location,publication_year,publication_date,open_access,cited_by_count",
    mailto: "trick-cards@research-aid.app"
  });
  if (filters.length) {
    params.set("filter", filters.join(","));
  }

  const response = await safeFetch(`${OPENALEX_ENDPOINT}?${params.toString()}`, {
    headers: { "user-agent": "trick-cards/0.1 (mailto:trick-cards@research-aid.app)" },
    cache: "no-store"
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    results?: Array<{
      id?: string;
      doi?: string;
      title?: string;
      authorships?: Array<{ author?: { display_name?: string } }>;
      abstract_inverted_index?: Record<string, number[]>;
      primary_location?: {
        source?: { display_name?: string };
        pdf_url?: string;
        landing_page_url?: string;
      };
      publication_year?: number;
      publication_date?: string;
      open_access?: { oa_url?: string };
      cited_by_count?: number;
    }>;
  };

  return (data.results ?? [])
    .filter((item) => item.title)
    .map((item) => {
      // 还原倒排索引为摘要文本
      let abstract = "";
      if (item.abstract_inverted_index) {
        const entries: [string, number][] = [];
        for (const [word, positions] of Object.entries(item.abstract_inverted_index)) {
          for (const pos of positions) {
            entries.push([word, pos]);
          }
        }
        entries.sort((a, b) => a[1] - b[1]);
        abstract = entries.map((e) => e[0]).join(" ");
      }

      const doi = item.doi?.replace("https://doi.org/", "");
      const url =
        item.primary_location?.landing_page_url ??
        (doi ? `https://doi.org/${doi}` : item.id ?? "");
      const pdfUrl =
        item.open_access?.oa_url ?? item.primary_location?.pdf_url ?? undefined;

      return {
        source: "openalex" as const,
        id: item.id ?? "",
        title: item.title ?? "",
        authors: (item.authorships ?? [])
          .map((a) => a.author?.display_name ?? "")
          .filter(Boolean)
          .slice(0, 10),
        abstract,
        url,
        pdfUrl,
        published: item.publication_date ?? undefined,
        venue: item.primary_location?.source?.display_name ?? undefined,
        year: item.publication_year ?? undefined
      };
    });
}

// ---- GitHub（免费公开 API，无需 Key）----

export async function searchGitHub(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<AISearchResultWeb[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 5, 1), 10);
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(max)
  });
  const response = await safeFetch(
    `https://api.github.com/search/repositories?${params.toString()}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "trick-cards/0.1"
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return [];
  const data = (await response.json()) as {
    items?: Array<{
      full_name: string;
      html_url: string;
      description?: string | null;
      stargazers_count?: number;
      pushed_at?: string;
    }>;
  };
  return (data.items ?? []).map((repo) => ({
    source: "github" as const,
    title: repo.full_name + (repo.stargazers_count ? ` ⭐${repo.stargazers_count}` : ""),
    url: repo.html_url,
    snippet: repo.description ?? "",
    publishedAt: repo.pushed_at
  }));
}

// ---- 视频平台（Bilibili + YouTube，免费公开 API）----

export async function searchBilibili(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<AISearchResultWeb[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 5, 1), 10);
  const params = new URLSearchParams({
    keyword: query,
    search_type: "video",
    page: "1",
    pagesize: String(max)
  });
  const response = await safeFetch(
    `https://api.bilibili.com/x/web-interface/search/type?${params.toString()}`,
    {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        referer: "https://www.bilibili.com"
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return [];
  const data = (await response.json()) as {
    data?: {
      result?: Array<{
        title?: string;
        arcurl?: string;
        description?: string;
        pubdate?: number;
        play?: number;
        author?: string;
      }>;
    };
  };
  return (data.data?.result ?? []).slice(0, max).map((item) => ({
    source: "bilibili" as const,
    title: (item.title ?? "").replace(/<[^>]+>/g, ""),
    url: item.arcurl ?? "",
    snippet: [
      item.author ? `UP主: ${item.author}` : "",
      item.play ? `播放: ${item.play}` : "",
      item.description ?? ""
    ]
      .filter(Boolean)
      .join(" · "),
    publishedAt: item.pubdate
      ? new Date(item.pubdate * 1000).toISOString()
      : undefined
  }));
}

export async function searchYouTube(
  query: string,
  opts: { maxResults?: number } = {}
): Promise<AISearchResultWeb[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 5, 1), 10);
  // 使用 Invidious 公共实例的 API（免费，无需 Key）
  const instances = [
    "https://vid.puffyan.us",
    "https://invidious.snopyta.org",
    "https://invidious.kavin.rocks"
  ];
  for (const base of instances) {
    try {
      const params = new URLSearchParams({
        q: query,
        type: "video",
        sort_by: "relevance"
      });
      const response = await safeFetch(
        `${base}/api/v1/search?${params.toString()}`,
        {
          headers: { "user-agent": "trick-cards/0.1" },
          cache: "no-store",
          signal: AbortSignal.timeout(6000)
        }
      );
      if (!response.ok) continue;
      const data = (await response.json()) as Array<{
        type?: string;
        title?: string;
        videoId?: string;
        description?: string;
        author?: string;
        viewCount?: number;
        published?: number;
      }>;
      return data
        .filter((item) => item.type === "video" && item.videoId)
        .slice(0, max)
        .map((item) => ({
          source: "youtube" as const,
          title: item.title ?? "",
          url: `https://www.youtube.com/watch?v=${item.videoId}`,
          snippet: [
            item.author ?? "",
            item.viewCount ? `${item.viewCount.toLocaleString()} views` : "",
            item.description ?? ""
          ]
            .filter(Boolean)
            .join(" · "),
          publishedAt: item.published
            ? new Date(item.published * 1000).toISOString()
            : undefined
        }));
    } catch {
      continue;
    }
  }
  return [];
}

// ---- Tavily（可选增强） ----

export function isTavilyAvailable(override?: { tavilyApiKey?: string }): boolean {
  return Boolean(override?.tavilyApiKey || process.env.TAVILY_API_KEY);
}

export async function searchTavily(
  query: string,
  opts: {
    maxResults?: number;
    depth?: "basic" | "advanced";
    override?: { tavilyApiKey?: string };
  } = {}
): Promise<AISearchResultWeb[]> {
  const apiKey = opts.override?.tavilyApiKey || process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  const response = await safeFetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(Math.max(opts.maxResults ?? 6, 1), 20),
      search_depth: opts.depth ?? "basic",
      include_answer: false
    }),
    cache: "no-store"
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    results?: Array<{
      title: string;
      url: string;
      content?: string;
      published_date?: string;
    }>;
  };
  return (data.results ?? []).map((item) => ({
    source: "tavily" as const,
    title: item.title,
    url: item.url,
    snippet: item.content ?? "",
    publishedAt: item.published_date
  }));
}
