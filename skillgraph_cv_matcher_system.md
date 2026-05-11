SkillGraph CV Matcher

Kế hoạch demo hệ thống Smart CV Matcher

Explainable CV Matching with Skill Graph Intelligence

Mục tiêu của demo không phải là xây hệ thống tuyển dụng production hoàn chỉnh, mà là chứng minh được:

SkillGraph CV Matcher không chỉ đọc CV và JD, mà còn hiểu cấu trúc kỹ năng, prerequisite skill, evidence từ CV, và tạo báo cáo giải thích được cho HR.

Cuộc thi yêu cầu sản phẩm AI giúp KTC tự động phân tích CV, so khớp với JD, xếp hạng ứng viên và gợi ý lý do phù hợp. MVP product link và video demo tối đa 2 phút cũng được khuyến khích.

1. Phiên bản hệ thống mới
Tên hệ thống
SkillGraph CV Matcher

Tagline
"Explainable CV Matching with Skill Graph Intelligence."

Định vị sản phẩm
A smart CV matching system that uses LLM extraction, vector search, Neo4j skill graph, and GNN-based graph similarity to rank candidates and explain skill gaps for Korean HR teams.

Nói đơn giản:

LLM đọc CV/JD
Vector search chuẩn hóa kỹ năng
Neo4j lưu skill graph
GNN tính độ phù hợp theo cấu trúc kỹ năng
PDF report giải thích kết quả cho HR

2. Kiến trúc tổng quan mới
┌────────────────────┐
│ HR Web Frontend │
│ Next.js │
└─────────┬──────────┘
│
▼
┌────────────────────┐
│ FastAPI Backend │
└─────────┬──────────┘
│
┌───────────────────┼───────────────────┐
▼ ▼ ▼
┌──────────────┐ ┌────────────────┐ ┌────────────────┐
│ PDF Parsing │ │ LLM Extraction │ │ Vector Search │
│ PyMuPDF │ │ CV/JD → JSON │ │ Skill Normalize│
└──────┬───────┘ └────────┬───────┘ └────────┬───────┘
│ │ │
└─────────────────────┼────────────────────┘
▼
┌────────────────┐
│ Neo4j │
│ Skill Graph │
└────────┬───────┘
│
▼
┌────────────────┐
│ GAT / GNN │
│ PyTorch Geom. │
└────────┬───────┘
│
▼
┌────────────────┐
│ Match Ranking │
│ Explanation │
│ PDF Report │
└────────────────┘

3. Tech stack chính thức
Frontend
Next.js
TypeScript
Tailwind CSS
React Flow
Recharts
Axios

Dùng để làm:

Upload JD PDF/text
Upload nhiều CV PDF
Dashboard ranking
Candidate detail
Skill graph visualization
Radar chart
Download PDF report

Backend
FastAPI
Python
Pydantic
Uvicorn

Dùng để làm API chính:

/api/jobs/analyze
/api/candidates/upload
/api/match/run
/api/report/export
/api/graph/view

PDF Parsing
PyMuPDF / fitz
pdfplumber optional
python-docx optional

Ưu tiên dùng PyMuPDF trước vì nhanh và dễ demo.

Vai trò:

CV PDF → raw text
JD PDF → raw text

LLM Extraction
Dùng một trong các API:

OpenAI GPT-4o-mini
Gemini Flash
Claude Haiku

Vai trò:

raw CV text → structured candidate JSON
raw JD text → structured job JSON

Vector Search
Có 2 lựa chọn.

Lựa chọn nhanh nhất
sentence-transformers
FAISS

Dùng local embedding model:

all-MiniLM-L6-v2

Lựa chọn nếu muốn dùng API
OpenAI text-embedding-3-small
FAISS

Vai trò:

"reactjs" → React
"postgres" → PostgreSQL
"server side rendering" → SSR
"dotnet core" → ASP.NET Core

Skill Graph Database
Neo4j
Neo4j Python Driver

Lưu:

Skill nodes
Skill category
Prerequisite edges
Related skill edges
Specialization edges
Candidate skill evidence
JD required skills

GNN / GAT Prototype
PyTorch
PyTorch Geometric
NetworkX

Vai trò:

Encode candidate subgraph
Encode JD subgraph
Compare graph embeddings
Return graph similarity score

Quan trọng: với demo nhanh, nên làm GNN prototype dạng semi-simulated:

- Graph lấy từ Neo4j
- Convert sang PyTorch Geometric Data
- Node feature dùng embedding vector của skill
- GAT forward pass để tạo graph embedding
- Similarity bằng cosine similarity

Không nhất thiết phải train phức tạp. Có thể nói trong pitch:

For the MVP, we use a lightweight GAT prototype to encode skill subgraphs. The model can be further trained with historical hiring data in the production version.

Export Report PDF
ReportLab
WeasyPrint
Jinja2 HTML template

Khuyến nghị dùng:

Jinja2 + WeasyPrint

Flow:

match result JSON → HTML report → PDF report

Report gồm:

Candidate ranking
Skill match summary
Missing skills
Prerequisite coverage
Interview questions
Final recommendation

4. Kiến trúc data
4.1 JD JSON sau khi extract
JSON

{
"job_title": "Frontend Developer",
"required_skills": [
{
"name": "Next.js",
"importance": 5,
"category": "frontend",
"requirement_type": "must_have"
},
{
"name": "SSR",
"importance": 4,
"category": "frontend",
"requirement_type": "must_have"
},
{
"name": "PostgreSQL",
"importance": 3,
"category": "database",
"requirement_type": "nice_to_have"
}
],
"soft_skills": ["English Communication", "Teamwork"],
"experience_years": 1,
"language_requirements": ["English"]
}

4.2 CV JSON sau khi extract
JSON

{
"candidate_name": "Nguyen Van A",
"email": "nguyenvana@email.com",
"education": "Information Technology",
"technical_skills": [
{
"name": "React",
"confidence": 0.92,
"evidence": "Built an e-commerce frontend using React."
},
{
"name": "MySQL",
"confidence": 0.85,
"evidence": "Designed database schema for a food ordering system."
},
{
"name": "REST API",
"confidence": 0.88,
"evidence": "Integrated REST APIs between frontend and backend."
}
],
"projects": [
{
"name": "Food Ordering System",
"description": "A full-stack food ordering website.",
"skills_used": ["React", "Node.js", "MySQL", "REST API"]
}
]
}

5. Neo4j graph design
5.1 Node types
CYPHER

(:Skill)
(:Category)
(:Candidate)
(:Job)
(:Project)

5.2 Skill node
CYPHER

(:Skill {
name: "React",
category: "Frontend",
description: "A JavaScript library for building user interfaces",
level: "intermediate"
})

5.3 Relationships
CYPHER

(:Skill)-[:PREREQUISITE_OF]->(:Skill)
(:Skill)-[:RELATED_TO]->(:Skill)
(:Skill)-[:SPECIALIZATION_OF]->(:Skill)
(:Candidate)-[:HAS_SKILL]->(:Skill)
(:Job)-[:REQUIRES]->(:Skill)
(:Project)-[:USES_SKILL]->(:Skill)
(:Candidate)-[:HAS_PROJECT]->(:Project)

5.4 Ví dụ graph
CYPHER

MERGE (js:Skill {name: "JavaScript", category: "Frontend"})
MERGE (react:Skill {name: "React", category: "Frontend"})
MERGE (next:Skill {name: "Next.js", category: "Frontend"})
MERGE (ssr:Skill {name: "SSR", category: "Frontend"})
MERGE (sql:Skill {name: "SQL", category: "Database"})
MERGE (postgres:Skill {name: "PostgreSQL", category: "Database"})
MERGE (query:Skill {name: "Query Optimization", category: "Database"})
MERGE (js)-[:PREREQUISITE_OF {weight: 0.9}]->(react)
MERGE (react)-[:PREREQUISITE_OF {weight: 0.85}]->(next)
MERGE (next)-[:PREREQUISITE_OF {weight: 0.8}]->(ssr)
MERGE (sql)-[:PREREQUISITE_OF {weight: 0.85}]->(postgres)
MERGE (postgres)-[:PREREQUISITE_OF {weight: 0.8}]->(query)

6. Vector search để normalize skill
Vấn đề
CV thường viết không chuẩn:

ReactJS
React.js
Postgres
Postgre
Server-side rendering
Dotnet
.NET Core

Nhưng graph cần chuẩn hóa thành:

React
PostgreSQL
SSR
ASP.NET Core

Flow normalize
Extracted skill from LLM
↓
Generate embedding
↓
Search nearest skill in FAISS index
↓
If similarity > threshold
↓
Map to canonical skill in Neo4j

Ví dụ output
JSON

{
"raw_skill": "reactjs",
"normalized_skill": "React",
"similarity": 0.94
}

JSON

{
"raw_skill": "server-side rendering",
"normalized_skill": "SSR",
"similarity": 0.89
}

7. GAT/GNN prototype design
7.1 Ý tưởng GNN trong hệ thống
Mỗi JD là một subgraph:

React → Next.js → SSR
SQL → PostgreSQL

Mỗi CV cũng là một subgraph:

JavaScript → React
SQL → MySQL
REST API

GNN sẽ encode hai subgraph này thành vector:

JD graph embedding
Candidate graph embedding

Sau đó tính:

cosine_similarity(candidate_embedding, jd_embedding)

7.2 Vì sao dùng GAT?
GAT hợp lý vì không phải skill nào cũng quan trọng như nhau.

Ví dụ JD yêu cầu:

Next.js importance 5
SSR importance 4
PostgreSQL importance 3

GAT có attention mechanism, có thể mô phỏng việc hệ thống "chú ý" nhiều hơn vào skill quan trọng.

We use a lightweight Graph Attention Network prototype to encode candidate and job skill subgraphs. This allows the system to consider not only whether two skills are similar, but also how they are connected in the skill graph.

7.3 GNN score
GNN Similarity Score = cosine(candidate_graph_embedding, jd_graph_embedding)

Ví dụ:

JSON

{
"candidate_name": "Nguyen Van A",
"gnn_similarity_score": 0.81
}

8. Final matching score
Không nên chỉ dùng GNN score. Nên kết hợp nhiều score để dễ giải thích.

Final Score =
35% Direct Skill Match
25% GNN Graph Similarity
20% Prerequisite Coverage
10% Project Evidence
10% Soft Skill / Language Fit

Ví dụ:

JSON

{
"candidate": "Nguyen Van A",
"final_score": 84,
"direct_match_score": 72,
"gnn_graph_score": 81,
"prerequisite_score": 90,
"evidence_score": 88,
"soft_skill_score": 80,
"recommendation": "Strong Potential"
}

Điểm hay của công thức này là:

Direct match cho HR dễ hiểu
GNN graph score cho AI/technical depth
Prerequisite score cho điểm khác biệt
Evidence score để chống keyword stuffing
Soft skill score để phù hợp ngữ cảnh tuyển dụng Hàn Quốc

9. Backend service design
9.1 Các service chính
PdfParserService
LLMExtractionService
SkillNormalizerService
Neo4jGraphService
GNNMatchingService
ScoringService
ExplanationService
PDFReportService

9.2 Flow backend đầy đủ
Receive JD PDF/text and CV PDFs
Parse PDF to raw text
Use LLM to extract structured JSON
Normalize skills with vector search
Store Job, Candidate, Skill relations in Neo4j
Query candidate and job subgraphs from Neo4j
Convert subgraphs to PyTorch Geometric format
Run GAT prototype to calculate graph similarity
Calculate final matching score
Generate explanation with LLM
Return dashboard JSON
Export HR PDF report
10. API design
10.1 Upload and analyze
HTTP

POST /api/analyze
Content-Type: multipart/form-data

Input:

job_description_file: PDF
candidate_files: PDF[]

Output:

JSON

{
"job_id": "job_001",
"ranking": [
{
"candidate_id": "c001",
"candidate_name": "Nguyen Van A",
"final_score": 84,
"recommendation": "Strong Potential",
"matched_skills": ["React", "JavaScript", "REST API"],
"missing_skills": ["SSR", "PostgreSQL"],
"prerequisite_matches": [
{
"candidate_skill": "React",
"supports_required_skill": "Next.js"
}
],
"gnn_graph_score": 81,
"report_url": "/api/report/c001"
}
]
}

10.2 Get candidate detail
HTTP

GET /api/candidates/{candidate_id}/match-detail

Output:

JSON

{
"candidate_name": "Nguyen Van A",
"final_score": 84,
"score_breakdown": {
"direct_match": 72,
"gnn_graph_similarity": 81,
"prerequisite_coverage": 90,
"project_evidence": 88,
"soft_skill_fit": 80
},
"matched_skills": [],
"missing_skills": [],
"skill_gap_explanation": "",
"interview_questions": []
}

10.3 Get graph visualization
HTTP

GET /api/graph/match/{candidate_id}

Output:

JSON

{
"nodes": [
{
"id": "React",
"label": "React",
"status": "candidate_has"
},
{
"id": "Next.js",
"label": "Next.js",
"status": "jd_required"
},
{
"id": "SSR",
"label": "SSR",
"status": "missing"
}
],
"edges": [
{
"source": "React",
"target": "Next.js",
"type": "prerequisite_of"
},
{
"source": "Next.js",
"target": "SSR",
"type": "prerequisite_of"
}
]
}

10.4 Export report
HTTP

GET /api/report/{candidate_id}

Output: PDF file

11. Frontend pages
Page 1: Upload Page
URL: /

UI:

Upload Job Description PDF
Upload Candidate CV PDFs
Button: Analyze Candidates

Nên có thêm sample button:

Use sample demo data

Rất quan trọng. Nếu upload lỗi lúc demo, bạn vẫn bấm sample data được.

Page 2: Dashboard Ranking
URL: /dashboard

Hiển thị:

Candidate ranking table
Final score
Recommendation
Top matched skills
Critical missing skills
Download report button

Page 3: Candidate Detail
URL: /candidate/:id

Hiển thị:

Score breakdown
Matched skills
Missing skills
Prerequisite coverage
Project evidence
GNN graph similarity
Interview questions

Page 4: Skill Graph View
Có thể nằm trong Candidate Detail. Dùng React Flow.

Màu node:

Green = candidate has this skill
Blue = JD requires this skill
Yellow = prerequisite / potential bridge
Red = missing critical skill
Gray = related skill

Ví dụ graph demo:

JavaScript → React → Next.js → SSR
SQL → PostgreSQL → Query Optimization

Page 5: PDF Report Preview
Có nút:

Download HR Report

Report có thể mở trong browser hoặc tải về.

12. Database seed cho Neo4j
Nên seed trước khoảng 100-150 skills, không cần quá nhiều.

Nhóm Frontend
HTML
CSS
JavaScript
TypeScript
React
Next.js
Vue.js
Angular
SSR
CSR
Routing
State Management
Redux
Tailwind CSS
Responsive Design
UI/UX

Nhóm Backend
REST API
GraphQL
Node.js
Express.js
NestJS
ASP.NET Core
Spring Boot
Authentication
JWT
OAuth
Microservices
Clean Architecture

Nhóm Database
SQL
MySQL
PostgreSQL
MongoDB
Database Design
Indexing
Query Optimization
Transaction
ORM
Entity Framework
Prisma

Nhóm DevOps
Git
GitHub
Docker
Linux
CI/CD
AWS
Azure
Deployment
Nginx

Nhóm AI/Data
Python
Machine Learning
Deep Learning
LLM
Prompt Engineering
Data Preprocessing
Pandas
Scikit-learn
PyTorch

Nhóm Soft Skills
English Communication
Teamwork
Remote Collaboration
Documentation
Problem Solving
Cross-cultural Communication
Korean Work Culture

13. Cách làm GNN prototype nhanh nhất
Không cần train model nặng.

Cách làm thực dụng
Bước 1: Skill node feature
Mỗi skill có vector embedding:

React → embedding vector
Next.js → embedding vector
SSR → embedding vector

Embedding lấy từ:

sentence-transformers

Bước 2: Query subgraph từ Neo4j
Với JD:

Lấy các required skills
Lấy prerequisite neighbors depth 1-2

Với candidate:

Lấy candidate skills
Lấy prerequisite neighbors depth 1-2

Bước 3: Convert sang PyTorch Geometric
nodes → x
edges → edge_index

Bước 4: GAT forward
GATConv → ReLU → GATConv → global_mean_pool

Bước 5: Similarity
cosine(candidate_graph_embedding, jd_graph_embedding)

Lưu ý quan trọng
Vì model chưa train sâu, nên dùng nó như một component trong score, không để nó quyết định toàn bộ.

GNN score chỉ chiếm 25%

Như vậy nếu GNN chưa hoàn hảo, hệ thống vẫn ổn nhờ direct match, prerequisite logic và evidence score.

14. PDF report cho HR
Nội dung report
SkillGraph CV Matcher Report
Job Title:
Frontend Developer
Candidate:
Nguyen Van A
Final Score:
84/100
Recommendation:
Strong Potential
Score Breakdown:
- Direct Skill Match: 72
- GNN Graph Similarity: 81
- Prerequisite Coverage: 90
- Project Evidence: 88
- Soft Skill Fit: 80
Matched Skills:
React, JavaScript, REST API, SQL
Missing Skills:
SSR, PostgreSQL, Query Optimization
Hidden Potential:
The candidate has React experience, which is a strong prerequisite for Next.js.
Suggested Interview Questions:
1. Can you explain the difference between CSR and SSR?
2. Have you used Next.js routing before?
3. How would you optimize a slow PostgreSQL query?
Final HR Note:
Recommended for technical interview.

Đây là phần rất hợp với yêu cầu cuộc thi vì đề bài có gợi ý hệ thống nên "xếp hạng ứng viên" và "gợi ý lý do phù hợp".

15. Thứ tự ưu tiên khi code
Vì stack khá mạnh, cần có chiến lược để không bị vỡ dự án.

Phase 1 - Làm pipeline chạy được trước
Ưu tiên:

PDF parsing
LLM extraction
Skill normalization
Simple scoring
Dashboard ranking

Chưa cần GNN đẹp ngay.

Phase 2 - Thêm Neo4j
Ưu tiên:

Seed skill graph
Store candidate/job skills
Query skill path
Show skill graph visualization

Phase 3 - Thêm GNN prototype
Ưu tiên:

Export graph from Neo4j
Convert to PyTorch Geometric
Run GAT forward
Return graph similarity score

Phase 4 - Thêm report PDF
Ưu tiên:

HTML template
Generate PDF
Download button

16. Roadmap demo 7 ngày
Day 1 - Setup project + seed graph
Backend:
FastAPI
Neo4j connection
skills_seed.cypher
PDF parser service
Frontend:
Next.js
Upload page
Basic layout

Deliverable:

Neo4j có skill graph
Frontend upload page chạy được

Day 2 - PDF parsing + LLM extraction
Backend:
Parse JD PDF
Parse CV PDF
LLM extract JD JSON
LLM extract CV JSON

Deliverable:

Upload PDF → nhận structured JSON

Day 3 - Vector search normalize skill
Backend:
Build skill embedding index
Normalize raw skills
Map normalized skills to Neo4j nodes

Deliverable:

"reactjs" → "React"
"postgres" → "PostgreSQL"
"server-side rendering" → "SSR"

Day 4 - Matching score + dashboard
Backend:
Direct match score
Prerequisite score from Neo4j paths
Evidence score
Final score
Frontend:
Ranking table
Candidate detail page
Score breakdown

Deliverable:

JD + 3 CVs → ranking dashboard

Day 5 - GNN/GAT prototype
Backend:
Query subgraph from Neo4j
Convert to PyTorch Geometric
Run GAT model
Return graph similarity score

Deliverable:

Candidate có gnn_graph_score
Final score có dùng GNN

Day 6 - Graph visualization + PDF report
Frontend:
React Flow skill graph
Radar chart
Download report button
Backend:
Generate HR PDF report

Deliverable:

Candidate detail đẹp, có graph, có report

Day 7 - Polish + video + slide
Fix UI
Prepare sample data
Record 2-minute demo
Prepare English slides
Prepare pitch script

Deliverable:

Product link
Demo video
PDF slide

17. MVP scope chốt lại
Bắt buộc phải có
✅ Upload JD PDF
✅ Upload 3 CV PDFs
✅ Parse PDF to text
✅ LLM extract skills
✅ Vector search normalize skills
✅ Neo4j skill graph
✅ Candidate ranking
✅ Skill gap explanation
✅ Candidate detail page
✅ Export HR PDF report

Nâng cao nhưng nên có
✅ GNN/GAT graph similarity score
✅ React Flow graph visualization
✅ Radar chart
✅ Suggested interview questions

Có thể bỏ nếu không kịp
❌ Authentication
❌ Admin/User role
❌ Large-scale skill taxonomy
❌ Real training dataset
❌ Full Korean language support
❌ Historical hiring analytics

18. Demo flow mới
Demo 2 phút
0:00-0:15 - Problem
KTC receives hundreds of CVs every week. Manual screening takes time and keyword-based tools cannot explain real skill readiness.

0:15-0:30 - Upload
Show:
Upload JD PDF
Upload 3 CV PDFs
Click Analyze

0:30-0:55 - AI extraction
Show:
Extracted JD skills
Extracted candidate skills
Normalized skills
Say:
The system parses PDF files, extracts structured skills using LLMs, and normalizes them using vector search.

0:55-1:20 - Ranking
Show:
Candidate ranking dashboard
Final score
Recommendation
Say:
The ranking is not based only on keywords. It combines direct match, prerequisite coverage, project evidence, and graph similarity.

1:20-1:40 - Skill graph
Show:
React → Next.js → SSR
SQL → PostgreSQL → Query Optimization
Say:
This candidate does not have SSR, but React shows strong prerequisite readiness for Next.js.

1:40-2:00 - PDF report
Show:
Download HR Report
Open PDF
Say:
HR can download an explainable report with matched skills, missing skills, hidden potential, and suggested interview questions.

19. Pitch angle để gây ấn tượng
Bạn nên nói rõ:

Most CV matching systems answer:
"How similar is this CV to this JD?"
SkillGraph CV Matcher answers:
"Which skills match, which prerequisite skills are missing, and why should HR shortlist or reject this candidate?"

Đây là khác biệt rất mạnh.

20. Cách trình bày AI Application
Trong slide How AI Works, nên để pipeline như sau:

PDF CV/JD
↓
PDF Parser
↓
LLM Skill Extraction
↓
Vector Skill Normalization
↓
Neo4j Skill Knowledge Graph
↓
GAT-based Graph Similarity
↓
Explainable Ranking + HR Report

Với mỗi phần, nói ngắn:

LLM understands unstructured CVs.
Vector search maps messy skill names into canonical skills.
Neo4j stores prerequisite relationships between skills.
GAT captures graph-based skill similarity.
LLM generates HR-friendly explanations.

21. Cách nói về GNN cho an toàn
Không nên nói:

We trained a powerful GNN model that perfectly predicts hiring success.

Vì điều này dễ bị hỏi vặn: data đâu, train thế nào, evaluate thế nào?

Nên nói:

In the MVP, we implement a lightweight GAT prototype to encode candidate and job skill subgraphs. This demonstrates how graph representation learning can improve CV matching beyond keyword and embedding similarity. In production, the model can be trained with historical recruitment outcomes.

Câu này trung thực và có chiều sâu.

22. Bộ sample data nên chuẩn bị
Bạn nên chuẩn bị đúng 1 JD và 3 CV.

JD
Frontend Developer Intern / Junior
We are looking for a Frontend Developer who can build modern web applications using React and Next.js. The candidate should understand JavaScript, TypeScript, REST API integration, SSR, routing, and basic database concepts. Experience with PostgreSQL and performance optimization is a plus. Good English communication and remote collaboration are required.

Candidate A
Strong React foundation, REST API, JavaScript, MySQL, real e-commerce project.

Expected result:

Strong Potential
High prerequisite coverage
Missing SSR and PostgreSQL

Candidate B
Lists Next.js, React, PostgreSQL, but weak project evidence.

Expected result:

Good direct match
Weak evidence
Needs technical verification

Candidate C
Backend-heavy: Java, Spring Boot, MySQL, Docker, REST API.

Expected result:

Partial match
Better for backend role
Frontend gaps are clear

Demo này sẽ cho thấy hệ thống phân biệt được:

Keyword match
Real evidence
Prerequisite potential
Wrong-role candidate

23. Cấu trúc slide mới
Slide 1 - Title
SkillGraph CV Matcher
Explainable AI CV Matching with Skill Graph Intelligence

Slide 2 - Problem
KTC receives hundreds of CVs every week.
Manual screening is slow.
Keyword matching misses real skill readiness.

Slide 3 - Key Insight
Hiring is not just matching words.
It is matching skill structure.

Slide 4 - Solution
SkillGraph CV Matcher analyzes CVs and JDs, maps skills into a knowledge graph, ranks candidates, and explains skill gaps.

Slide 5 - AI Pipeline
PDF Parser → LLM Extraction → Vector Normalization → Neo4j Graph → GAT Similarity → Explainable Report

Slide 6 - Skill Graph
JavaScript → React → Next.js → SSR
SQL → PostgreSQL → Query Optimization

Slide 7 - Product Demo
Upload JD
Upload CVs
View ranking
Open candidate detail
Download HR report

Slide 8 - Why This Wins
Explainable
Prerequisite-aware
Evidence-based
Reusable across jobs
Designed for Korean HR teams

Slide 9 - Business Impact
Reduce screening time
Improve shortlist quality
Help HR defend decisions
Discover hidden potential candidates

Slide 10 - Roadmap
MVP: Smart CV matching
Next: Interview assistant
Next: Korean-Vietnamese onboarding and skill development platform

24. Kết luận kế hoạch mới
Với yêu cầu công nghệ mới, hệ thống nên được chốt như sau:

Frontend:
Next.js + Tailwind + React Flow + Recharts
Backend:
FastAPI
AI:
LLM extraction + vector search normalization + GAT prototype
Graph:
Neo4j skill knowledge graph
PDF:
PyMuPDF for parsing
WeasyPrint/Jinja2 for HR report export

Điểm quan trọng nhất: Đừng để GNN trở thành phần làm chậm dự án. Hãy biến GNN thành một prototype score trong hệ thống, còn phần demo chính vẫn là ranking, explanation, skill graph và PDF report.

Với cách này, demo vừa có chiều sâu kỹ thuật, vừa bám đúng bài toán Smart CV Matcher, vừa có sản phẩm đủ trực quan để thuyết phục doanh nghiệp Hàn Quốc.