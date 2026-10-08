/* ------------------------------------------------------------------
   Papers. Add a new object to the list to add a paper.
   type:     "publication" | "preprint" | "project"
   links:    any link left empty ("") is hidden
   selected: true shows a star and keeps it in the "Selected" filter
   bibtex:   optional — generated automatically when omitted
   ------------------------------------------------------------------ */
window.PAPERS = [
  {
    title: "MAC-XA: Multi-view Anatomy-Correspondence Fusion for Coronary Stenosis Reporting from X-ray Angiography",
    authors: ["Chen Jia", "Co-author A", "Co-author B"],
    venue: "MICCAI 2026 (submitted)",
    year: 2026,
    type: "preprint",
    topics: ["Medical Imaging", "Multi-view Learning", "Report Generation"],
    image: "assets/paper1.png",
    selected: true,
    abstract:
      "We propose an explicit anatomy-correspondence learning framework for multi-view coronary X-ray angiography report generation. The method aligns anatomically corresponding regions across views and improves structured stenosis reporting by fusing clinically relevant evidence more reliably than implicit attention-based fusion.",
    links: { pdf: "", code: "", project: "", data: "" }
  },
  {
    title: "Retrieval-Augmented Chest X-ray Report Generation with Clinically Guided Fusion",
    authors: ["First Author A", "Chen Jia", "Author C"],
    venue: "MICCAI 2025",
    year: 2025,
    type: "publication",
    topics: ["Medical Imaging", "Report Generation", "Clinical AI"],
    image: "assets/paper2.png",
    selected: true,
    abstract:
      "This work studies retrieval-augmented report generation for chest X-ray interpretation, with a focus on reducing semantic errors and improving clinical faithfulness in generated reports.",
    links: { pdf: "", code: "", project: "", data: "" }
  },
  {
    title: "Legal Document Summarization with Domain-Aware Language Modeling",
    authors: ["Author A", "Chen Jia", "Author C"],
    venue: "NAACL 2025",
    year: 2025,
    type: "publication",
    topics: ["NLP", "Summarization"],
    image: "assets/paper3.png",
    selected: false,
    abstract:
      "We study domain-aware summarization for legal documents and investigate how task-specific modeling choices can improve summary quality and faithfulness in specialized domains.",
    links: { pdf: "", code: "", project: "" }
  }
];
