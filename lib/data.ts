import { Collection, Paper, TrickCard } from "@/lib/types";

const now = "2026-04-29T09:00:00.000Z";

export const demoCollections: Collection[] = [
  {
    id: "vision-language",
    name: "Vision-Language 视觉语言",
    description: "关注图文对齐、跨模态表示与视觉问答能力。",
    color: "#7C3AED",
    icon: "image",
    cardCount: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "ocr-document",
    name: "OCR / Document AI 文档理解",
    description: "面向扫描件、PDF 与复杂版面文档的解析流程。",
    color: "#2563EB",
    icon: "file-text",
    cardCount: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "video-understanding",
    name: "Video Understanding 视频理解",
    description: "处理长视频上下文、采样与关键片段抽取。",
    color: "#16A34A",
    icon: "video",
    cardCount: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "multimodal-rag",
    name: "Multimodal RAG 多模态检索",
    description: "统一管理图像、文档、音频和视频知识检索。",
    color: "#0891B2",
    icon: "database",
    cardCount: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "grounding-agents",
    name: "Grounding / Agents 视觉定位与智能体",
    description: "连接 Tool Use、执行安全与视觉定位能力。",
    color: "#9333EA",
    icon: "crosshair",
    cardCount: 1,
    createdAt: now,
    updatedAt: now
  }
];

export const demoCards: TrickCard[] = [
  {
    id: "multimodal-rag-fusion",
    title: "Multimodal RAG Fusion",
    subtitle: "统一图像、文档与音频检索入口",
    description:
      "把多模态知识先拆成可索引片段，再在查询阶段融合召回结果，减少单模态 RAG 的盲区。",
    collectionId: "multimodal-rag",
    tags: ["VLM", "RAG", "Knowledge Engineering"],
    domain: "多模态检索",
    difficulty: "hard",
    status: "verified",
    problem:
      "图像、文档、音频和视频中的知识分散在不同索引里，普通文本 RAG 难以做统一召回。",
    solution:
      "按模态建立解析和嵌入管道，再在查询阶段基于意图选择混合召回与重排策略，最终把证据交给多模态模型完成生成。",
    benefits: ["Grounding 更强", "Recall 更高", "支持跨模态统一搜索"],
    costs: ["索引和解析链路更复杂", "存储成本上升", "查询延迟更难压缩"],
    tradeoffs: [
      "召回更完整，但工程复杂度显著提高。",
      "支持更多模态，但数据清洗和质量评估成本更高。"
    ],
    applicableScenarios: [
      "企业知识库",
      "研究资料检索",
      "多源技术文档问答"
    ],
    unsuitableScenarios: ["单一文本知识库", "极低延迟交互"],
    notes: [
      {
        id: "note-rag-1",
        content:
          "先做 query routing，再决定是否走多模态召回，比默认全模态检索更稳。",
        createdAt: now
      }
    ],
    sources: [
      {
        id: "source-rag-1",
        title: "Multimodal RAG system design notes",
        type: "manual",
        note: "来自项目内部方案整理。"
      }
    ],
    usages: [
      {
        id: "usage-rag-1",
        projectName: "Ops Copilot",
        scenario: "排查带截图与日志的线上问题",
        result: "相关上下文命中率明显提升",
        success: true,
        createdAt: now
      }
    ],
    relatedCardIds: ["ocr-aware-parsing", "vision-language-alignment"],
    coverImageId: "img-rag-cover",
    images: [
      {
        id: "img-rag-cover",
        cardId: "multimodal-rag-fusion",
        url: "/demo/multimodal-rag.svg",
        type: "cover",
        imageKind: "architecture",
        title: "Fusion retrieval pipeline",
        caption: "多模态索引进入统一推理编排。",
        tags: ["fusion", "pipeline"],
        createdAt: now
      }
    ],
    createdAt: now,
    updatedAt: "2026-04-28T13:00:00.000Z"
  },
  {
    id: "ocr-aware-parsing",
    title: "OCR-aware Parsing Pipeline",
    subtitle: "版面理解优先于纯文本抽取",
    description:
      "在 OCR 之前显式考虑版面结构和区域类型，避免把表格、脚注和正文混成一层文本。",
    collectionId: "ocr-document",
    tags: ["OCR", "Layout", "Document Parsing"],
    domain: "文档理解",
    difficulty: "medium",
    status: "verified",
    problem:
      "复杂 PDF 和扫描件中的结构信息容易在纯文本抽取中丢失，后续问答质量不稳定。",
    solution:
      "先做版面分块与阅读顺序推断，再分别处理表格、正文和图注，最后输出结构化块供 LLM 使用。",
    benefits: ["结构保留更好", "表格与脚注更少串行", "适合企业知识库"],
    costs: ["版面解析成本高", "OCR 错误会传播", "需要额外质量校验"],
    tradeoffs: [
      "结构更清晰，但前处理链路更长。",
      "解析更细，但不同文档模板需要持续调参。"
    ],
    applicableScenarios: ["扫描件知识库", "论文处理", "多栏 PDF 解析"],
    notes: [
      {
        id: "note-ocr-1",
        content: "表格和图注不要合并到正文 chunk，召回会明显变差。",
        createdAt: now
      }
    ],
    sources: [
      {
        id: "source-ocr-1",
        title: "Layout-aware document parsing",
        type: "paper",
        year: 2024
      }
    ],
    usages: [
      {
        id: "usage-ocr-1",
        projectName: "Research Vault",
        scenario: "解析双栏论文 PDF",
        result: "摘要和图表引用错位率下降",
        success: true,
        createdAt: now
      }
    ],
    relatedCardIds: ["multimodal-rag-fusion"],
    coverImageId: "img-ocr-cover",
    images: [
      {
        id: "img-ocr-cover",
        cardId: "ocr-aware-parsing",
        url: "/demo/ocr-pipeline.svg",
        type: "cover",
        imageKind: "pipeline",
        title: "Layout parsing stages",
        caption: "从 OCR 前的版面分块开始组织上下文。",
        tags: ["ocr", "layout"],
        createdAt: now
      }
    ],
    createdAt: now,
    updatedAt: "2026-04-27T16:00:00.000Z"
  },
  {
    id: "video-frame-sampling",
    title: "Video Frame Sampling Strategy",
    subtitle: "用代表性帧压缩长视频成本",
    description:
      "不要直接把长视频完整塞进模型，先基于时间和事件密度做抽帧，再保留关键片段。",
    collectionId: "video-understanding",
    tags: ["Video", "Sampling", "VLM"],
    domain: "视频理解",
    difficulty: "medium",
    status: "verified",
    problem:
      "视频帧数量过多，直接输入模型既昂贵又容易超出上下文限制。",
    solution:
      "按时间、场景切换、动作密度和业务事件进行分层采样，对关键帧再补充短窗口上下文。",
    benefits: ["降低推理成本", "保留关键镜头", "更适合批量处理"],
    costs: ["可能漏掉细节", "策略需要结合任务调优", "回放解释性变弱"],
    tradeoffs: [
      "速度更快，但完整性下降。",
      "策略更激进时，模型结论更依赖采样器质量。"
    ],
    applicableScenarios: ["长视频审核", "培训录屏摘要", "工业视频巡检"],
    notes: [
      {
        id: "note-video-1",
        content: "采样后最好保留关键帧前后 1-2 秒上下文，方便回看。",
        createdAt: now
      }
    ],
    sources: [
      {
        id: "source-video-1",
        title: "Frame selection for long-context VLMs",
        type: "blog",
        year: 2025
      }
    ],
    usages: [
      {
        id: "usage-video-1",
        projectName: "Support QA Review",
        scenario: "长录屏流程总结",
        result: "处理成本下降，摘要速度提升",
        success: true,
        createdAt: now
      }
    ],
    relatedCardIds: ["vision-language-alignment"],
    coverImageId: "img-video-cover",
    images: [
      {
        id: "img-video-cover",
        cardId: "video-frame-sampling",
        url: "/demo/video-sampling.svg",
        type: "cover",
        imageKind: "chart",
        title: "Sampling over timeline",
        caption: "关键帧和时间轴保持对齐。",
        tags: ["video", "timeline"],
        createdAt: now
      }
    ],
    createdAt: now,
    updatedAt: "2026-04-25T08:00:00.000Z"
  },
  {
    id: "vision-language-alignment",
    title: "Vision-Language Alignment",
    subtitle: "把图像表示投影到同一语义空间",
    description:
      "跨模态能力的基础不是堆更多 prompt，而是先保证视觉与文本表示能在统一空间内对齐。",
    collectionId: "vision-language",
    tags: ["VLM", "Alignment", "Projection"],
    domain: "视觉语言",
    difficulty: "hard",
    status: "todo",
    problem:
      "视觉特征和文本特征不在同一语义空间，会造成跨模态检索和问答不稳定。",
    solution:
      "通过投影层、对比学习和融合模块做表征对齐，并在训练目标中显式加入跨模态匹配约束。",
    benefits: ["图文匹配能力更强", "跨模态检索更稳", "视觉问答鲁棒性更好"],
    costs: ["需要高质量配对数据", "训练成本高", "迁移到新领域需要再校准"],
    tradeoffs: [
      "泛化能力更好，但训练资源要求高。",
      "对齐越强，领域适配阶段越依赖数据质量。"
    ],
    applicableScenarios: ["图文检索", "视觉问答", "多图比较推理"],
    notes: [
      {
        id: "note-vl-1",
        content: "如果下游任务是检索，alignment 的收益通常比 prompt 微调更直接。",
        createdAt: now
      }
    ],
    sources: [
      {
        id: "source-vl-1",
        title: "Cross-modal representation alignment",
        type: "paper",
        year: 2025
      }
    ],
    usages: [],
    relatedCardIds: ["multimodal-rag-fusion", "video-frame-sampling"],
    coverImageId: "img-vl-cover",
    images: [
      {
        id: "img-vl-cover",
        cardId: "vision-language-alignment",
        url: "/demo/vision-language.svg",
        type: "cover",
        imageKind: "architecture",
        title: "Visual-text projection",
        caption: "用中间投影层把视觉与语言表示对齐。",
        tags: ["vlm", "alignment"],
        createdAt: now
      }
    ],
    createdAt: now,
    updatedAt: "2026-04-24T11:00:00.000Z"
  },
  {
    id: "tool-calling-guardrails",
    title: "Tool Calling Guardrails",
    subtitle: "先管权限和参数，再谈自动化",
    description:
      "生产级 agent 不应该把工具调用当成黑盒，权限、参数和结果都需要显式校验。",
    collectionId: "grounding-agents",
    tags: ["Agent", "Tool Use", "Safety"],
    domain: "智能体工程",
    difficulty: "medium",
    status: "verified",
    problem:
      "Agent 调用工具时容易出现危险操作、错误参数或越权访问，失败时也缺乏明确兜底。",
    solution:
      "在调用前做权限检查和风险分类，在调用后做结果验证与可解释记录，必要时加入人工确认。",
    benefits: ["降低误操作风险", "提高执行可追踪性", "更适合生产环境"],
    costs: ["流程更长", "实现复杂度增加", "部分场景吞吐下降"],
    tradeoffs: [
      "安全性提高，但自动化体验会变慢。",
      "控制面更完整，但实现和维护成本更高。"
    ],
    applicableScenarios: ["生产级 Agent", "带写操作的工具编排", "高风险审批流"],
    notes: [
      {
        id: "note-tool-1",
        content: "权限检查和参数校验应独立于 prompt，不要全靠模型自觉。",
        createdAt: now
      }
    ],
    sources: [
      {
        id: "source-tool-1",
        title: "Agent execution safety checklist",
        type: "manual",
        year: 2026
      }
    ],
    usages: [
      {
        id: "usage-tool-1",
        projectName: "Internal Ops Agent",
        scenario: "审批后执行数据库维护命令",
        result: "误触发 destructive action 的风险下降",
        success: true,
        createdAt: now
      }
    ],
    relatedCardIds: ["multimodal-rag-fusion"],
    coverImageId: "img-tool-cover",
    images: [
      {
        id: "img-tool-cover",
        cardId: "tool-calling-guardrails",
        url: "/demo/tool-guardrails.svg",
        type: "cover",
        imageKind: "architecture",
        title: "Permission and validation flow",
        caption: "把权限控制和结果验证放到工具执行链路里。",
        tags: ["agent", "safety"],
        createdAt: now
      }
    ],
    createdAt: now,
    updatedAt: "2026-04-23T10:00:00.000Z"
  }
];

export const demoPapers: Paper[] = [
  {
    id: "paper-fusion-rag",
    title: "Fusion Retrieval for Multimodal RAG",
    authors: ["Wei Lin", "Anna Park", "Zhi Chen"],
    venue: "ACL",
    year: 2025,
    abstract:
      "提出 modality-aware query routing 与跨模态加权召回，在企业文档场景显著优于纯文本 RAG。",
    url: "https://arxiv.org/abs/0000.fusion-rag",
    pdfUrl: "https://arxiv.org/pdf/0000.fusion-rag",
    tags: ["RAG", "Multimodal", "Retrieval"],
    status: "reading",
    rating: 4,
    notes:
      "重点看第 4 节的 query routing 实现细节；附录 B 的失败案例分析值得抄进 trick card。",
    generatedTrickIds: ["multimodal-rag-fusion"],
    collectionId: "multimodal-rag",
    addedAt: "2026-04-26T09:00:00.000Z",
    updatedAt: "2026-04-29T09:00:00.000Z"
  },
  {
    id: "paper-layout-parsing",
    title: "Layout-aware Document Parsing",
    authors: ["Maria Gomez", "Tomohiro Sato"],
    venue: "EMNLP",
    year: 2024,
    abstract:
      "系统化讨论 OCR 之前的版面分块方法，并发布在多模板文档上的可复用基线。",
    url: "https://arxiv.org/abs/0000.layout-parsing",
    tags: ["OCR", "Layout", "Document AI"],
    status: "read",
    rating: 5,
    notes: "和 ocr-aware-parsing 卡片直接对应，可补一节「双栏 PDF 阅读顺序推断」。",
    generatedTrickIds: ["ocr-aware-parsing"],
    collectionId: "ocr-document",
    addedAt: "2026-04-21T09:00:00.000Z",
    updatedAt: "2026-04-27T16:00:00.000Z"
  },
  {
    id: "paper-frame-sampling",
    title: "Frame Selection for Long-context VLMs",
    authors: ["Hao Zhang", "Lei Wu"],
    venue: "Blog · 工程经验",
    year: 2025,
    abstract:
      "整理工业界关于视频长上下文采样的几种策略，给出按事件密度做分层采样的实证收益。",
    url: "https://example.com/blog/frame-sampling",
    tags: ["Video", "Sampling", "VLM"],
    status: "todo",
    rating: undefined,
    notes: "",
    generatedTrickIds: [],
    collectionId: "video-understanding",
    addedAt: "2026-04-28T09:00:00.000Z",
    updatedAt: "2026-04-28T09:00:00.000Z"
  },
  {
    id: "paper-vl-alignment",
    title: "Cross-modal Representation Alignment",
    authors: ["Sara Cohen", "Jin Park"],
    venue: "arXiv",
    year: 2025,
    abstract:
      "讨论视觉与语言表征在统一空间内的对齐方法，对图文检索与视觉问答都有正向效果。",
    url: "https://arxiv.org/abs/0000.vl-alignment",
    tags: ["VLM", "Alignment", "Projection"],
    status: "todo",
    rating: undefined,
    notes: "",
    generatedTrickIds: [],
    collectionId: "vision-language",
    addedAt: "2026-04-22T09:00:00.000Z",
    updatedAt: "2026-04-22T09:00:00.000Z"
  },
  {
    id: "paper-agent-safety",
    title: "Agent Execution Safety Checklist",
    authors: ["Ops Working Group"],
    venue: "Industry Manual",
    year: 2026,
    abstract:
      "对生产级 agent 工具调用的权限模型、参数校验与人在回路设计给出可操作 checklist。",
    url: "https://example.com/manuals/agent-safety",
    tags: ["Agent", "Tool Use", "Safety"],
    status: "shelved",
    rating: 3,
    notes: "可以做完成度更高之后再细看，目前用 tool-calling-guardrails 卡片即可。",
    generatedTrickIds: ["tool-calling-guardrails"],
    collectionId: "grounding-agents",
    addedAt: "2026-04-18T09:00:00.000Z",
    updatedAt: "2026-04-23T10:00:00.000Z"
  }
];
