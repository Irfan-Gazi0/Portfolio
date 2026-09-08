/* ---------------------------------------------------------------------------
   cv.js — the single source of truth for the 3D site.

   Site geometry is axis-aligned and lives in world units (1 unit = 1 metre).
   Exhibits name a hoarding run and a slot; modules/site.js derives the world
   transform, so a compound can be resized without touching any board.

   NOTE: this content is a deliberate duplicate of index.html. When the CV
   changes, both must be updated. See README.md.
--------------------------------------------------------------------------- */

export const PROFILE = {
  name: 'Irfan Gazi',
  tagline: 'M.S. Construction Engineering & Management · University of Nebraska–Lincoln',
  email: 'igazi2@huskers.unl.edu',
  links: [
    { label: 'CV (PDF)', href: '../data/CV_Irfan_Gazi.pdf' },
    { label: 'ORCID', href: 'https://orcid.org/0009-0004-5817-8845' },
    { label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=Nkbeio8AAAAJ&hl=en' },
    { label: 'ResearchGate', href: 'https://www.researchgate.net/profile/Irfan-Gazi' },
    { label: 'GitHub', href: 'https://github.com/Irfan-Gazi0' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/irfan-gazi' },
  ],
};

/* --- zones -----------------------------------------------------------------
   The site plan. A plus-shaped cluster of five fenced compounds: the site
   office at the origin, four working compounds adjoining it, and open ground
   all around that you can walk out into through the outer gates.

   Each boundary hoarding is drawn exactly once: the site office owns all four
   of its runs (each with an internal opening), and each compound marks the
   shared run 'none' so the two never z-fight.

   runs: 'solid' | 'door' (internal opening, 5 m) | 'gate' (outer gate, 4 m) | 'none'
--------------------------------------------------------------------------- */

export const DOOR_WIDTH = 5;    // internal opening between compounds
export const GATE_WIDTH = 4;    // outer gate onto the wider site
export const WALL_HEIGHT = 5.6; // site hoarding, tall enough to carry the boards
export const SITE_HALF = 60;    // perimeter fence sits this far out on each axis

export const ZONES = [
  {
    id: 'office',
    label: 'Site Office',
    code: 'A',
    blurb: 'Start here — induction, contact and current notices',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    accent: 0x0e6e6e,
    walls: { north: 'door', south: 'door', east: 'door', west: 'door' },
    spawn: { x: 0, z: 8, heading: Math.PI },
  },
  {
    id: 'planroom',
    label: 'Plan Room',
    code: 'B',
    blurb: 'Two journal articles, three in progress, two presented',
    bounds: { minX: -12, maxX: 12, minZ: -30, maxZ: -12 },
    accent: 0x2b6cb0,
    walls: { north: 'gate', south: 'none', east: 'solid', west: 'solid' },
  },
  {
    id: 'systems',
    label: 'Systems Container',
    code: 'C',
    blurb: 'Systems built and released',
    bounds: { minX: 12, maxX: 30, minZ: -12, maxZ: 12 },
    accent: 0x4e8b3a,
    walls: { north: 'solid', south: 'solid', east: 'gate', west: 'none' },
  },
  {
    id: 'fabrication',
    label: 'Fabrication Yard',
    code: 'D',
    blurb: 'BIM modelling and coordination',
    bounds: { minX: -30, maxX: -12, minZ: -12, maxZ: 12 },
    accent: 0xc2570f,
    walls: { north: 'solid', south: 'solid', east: 'none', west: 'gate' },
  },
  {
    id: 'milestones',
    label: 'Milestone Row',
    code: 'E',
    blurb: '',
    bounds: { minX: -12, maxX: 12, minZ: 12, maxZ: 30 },
    accent: 0x8a5fa8,
    walls: { north: 'none', south: 'gate', east: 'solid', west: 'solid' },
  },
];

/* --- exhibits --------------------------------------------------------------
   Site notice boards bolted to the hoarding.

   kind: 'portrait' | 'paper' | 'repo' | 'project' | 'milestone' | 'board'
   `zone` + `wall` name the hoarding run, `slot` orders boards along it, and
   `size` is [width, height] in metres — match the aspect of the image, because
   the board is built from these numbers.
   `body` is an array of paragraphs. `figures` are extra images in the panel.
--------------------------------------------------------------------------- */

export const EXHIBITS = [
  /* ===================== SITE OFFICE ===================== */
  {
    id: 'portrait',
    zone: 'office', wall: 'south', slot: 1, size: [2.6, 3.14],
    kind: 'portrait',
    focal: true,   // the spawn point is derived to stand in front of this
    texture: '../images/profile.webp',
    title: 'Irfan Gazi',
    venue: 'M.S. student & Graduate Research Assistant',
    body: [
      'Graduate Research Assistant at the Autonomous Vehicles and Robotics Laboratory · M.S. expected June 2027 · open to PhD positions and research collaborations from mid-2027.',
      'I am an M.S. student and Graduate Research Assistant at the Durham School of Architectural Engineering and Construction, University of Nebraska–Lincoln, advised by Dr. Kyungki Kim, with Dr. Chun-Hsing (Jun) Ho as co-PI. My current project, funded by the Nebraska Department of Transportation, trains construction inspectors inside virtual job sites instead of on live ones. Alongside it I build the XR and AI training portal for a Clean Cities Jumpstart project on electric-vehicle emergency response, led by Dr. Nathan Huynh with Dr. Kyungki Kim as co-PI, reported to the National Laboratory of the Rockies.',
      'My work sits where generative AI meets the physical job site. I build the mixed-reality environments that training runs inside, and I work on giving language models real authority over physical systems without giving up the determinism safety-critical work depends on — wrapping probabilistic plans in structures that can be audited before anything moves: behaviour trees, priority hierarchies, and action vocabularies a plan is not allowed to step outside.',
      'Before Nebraska I completed a B.Sc. (Engg.) in Building Engineering and Construction Management at KUET, Bangladesh, graduating 5th of 79. My undergraduate thesis coupled BIM, supervised machine learning, and a Unity virtual environment to make the embodied carbon of a concrete mix visible while the design is still being decided. I grew up in Dhaka, and I brew coffee far too seriously.',
    ],
    links: [
      { label: 'Durham School', href: 'https://engineering.unl.edu/durhamschool/' },
      { label: 'Dr. Kyungki Kim', href: 'https://engineering.unl.edu/durhamschool/person/kyungki-kim/' },
    ],
  },
  {
    id: 'links',
    zone: 'office', wall: 'south', slot: 0, size: [2.6, 1.9],
    kind: 'board',
    title: 'Find me',
    venue: 'Profiles & contact',
    body: ['Everything below is public. The CV PDF is the same one linked from the 2D site.'],
    links: PROFILE.links.concat([{ label: 'Email', href: 'mailto:igazi2@huskers.unl.edu' }]),
  },
  {
    id: 'news',
    zone: 'office', wall: 'south', slot: 2, size: [2.6, 1.9],
    kind: 'board',
    title: 'News',
    venue: 'Recent updates',
    list: [
      ['2026-09', 'Our XR and AI first-responder training portal is presented in the NEC4 Jumpstart webinar.'],
      ['2026-08', 'Served as a judge at the UNL Office of Graduate Studies Summer Research Symposium 2026.'],
      ['2026-08', 'Our study on occupational risk prioritization is published in Scientific Reports.'],
      ['2026-07', 'Gave my first talk in the US, on our AI and immersive AR/VR inspector-training project, at the NDOT & UNL Research Summit 2026.'],
      ['2026-06', 'Awarded the Calvin C. Solem Fellowship for the 2026–27 academic year at the Durham School of Architectural Engineering and Construction.'],
      ['2026-05', 'Awarded a Chancellor’s Graduate Research Grant travel award by UNL for the Spring 2026 cycle.'],
      ['2026-05', 'Our LLM-orchestrated Robotic Health Attendant framework is published in Applied Sciences.'],
      ['2026-04', 'Served as graduate research advisor to the Clark Construction Group capstone team, on a voice-first custom GPT that drafts Procore daily logs from a foreman’s spoken site notes.'],
      ['2026-03', 'Presented InspectionGPT, our agentic RAG–MCP chatbot for inspector training, at the CI & CRC joint conference in San Antonio, Texas.'],
      ['2025-08', 'Started my M.S. in Construction Engineering and Management at UNL as a Graduate Research Assistant with Dr. Kyungki Kim, on an NDOT-funded project training construction inspectors in virtual environments.'],
      ['2024-11', 'Scored 7.5 overall on IELTS.'],
      ['2024-03', 'Completed my undergraduate degree at KUET.'],
      ['2024-02', 'Organized Builtech Fest 5.0, the largest national construction management competition in Bangladesh.'],
      ['2023-10', 'Runners-up in the Technical Poster Presentation on sustainable construction at Civil Convivial 3.0.'],
    ],
  },
  /* ===================== PLAN ROOM ===================== */
  {
    id: 'rha',
    zone: 'planroom', wall: 'north', slot: 0, size: [5.2, 3.16],
    kind: 'paper',
    texture: '../images/rha-robot-skills.webp',
    venue: 'Applied Sciences 16(11):5320 · 2026',
    status: 'published',
    title: 'LLM-Orchestrated Framework for Multifunctional Robotic Health Attendant (RHA) in Healthcare Environments',
    authors: 'Kyungki Kim, {me}, John Windle, Christian Haas, Melissa Christian, Tom Windle, Nicholas Armstrong, Logan Doorlag, Tuankhanh Dao',
    body: [
      'A nursing-assistant robot takes instructions in plain language and decomposes them across three branches — physical (navigation, manipulation, medication delivery), communicational (dialog with patients and clinicians), and informational (retrieving and summarizing clinical knowledge). Several LLMs and sensing nodes are combined so that facility data, patient records, and clinician commands are all in scope when the robot and the building decide what to do next.',
      'The open-source controller routes every generated plan through a deterministic six-priority behaviour tree, re-evaluated on each tick, so a facility emergency preempts whatever task is in flight and the model never reaches a motor command on its own.',
    ],
    caption: 'Skills the RHA exposes to the planner, exercised in the simulated hospital: speak, navigate, pick, place, and parameters such as visual_alert.',
    figures: [
      { src: '../images/rha-facility-skills.webp', caption: 'The action vocabulary shared by the building and the robot — what an LLM plan is allowed to name.' },
      { src: '../images/rha-hospital-plan.webp', caption: 'The simulated ward the framework was evaluated in, with a medication-delivery route.' },
    ],
    links: [
      { label: 'Paper (DOI)', href: 'https://doi.org/10.3390/app16115320' },
      { label: 'Code', href: 'https://github.com/Irfan-Gazi0/robot-multi-agent-pytree' },
    ],
  },
  {
    id: 'risk',
    zone: 'planroom', wall: 'north', slot: 1, size: [3.4, 3.34],
    kind: 'paper',
    texture: '../images/risk-framework-phases.webp',
    venue: 'Scientific Reports · 2026',
    status: 'published',
    title: 'A hybrid framework for occupational risk prioritization in construction projects using Monte Carlo simulation and utility theory',
    authors: 'Md Tanvir Rahman Rifat, Shuvo Dip Datta, Md. Mehrab Hossain, Md Shah Jamal, Marcel Maghiar, Sani Aliyu, {me}',
    body: [
      'Static risk matrices reduce an accident to one probability and one severity number, and say nothing about how a decision-maker actually weighs a rare catastrophe against a frequent nuisance. Survey responses from 112 professionals across 43 Bangladeshi infrastructure projects parameterize triangular distributions over 30 occupational risks; 5,000 Monte Carlo iterations give exposure distributions rather than point estimates, and an exponential utility function then re-ranks them separately for risk-averse, risk-neutral, and risk-seeking profiles. Falls from height, contact with overhead power lines, and same-level falls come out most critical.',
    ],
    caption: 'The three phases of the framework, from literature-derived risk register through simulation to a perception-weighted ranking.',
    figures: [
      { src: '../images/risk-respondent-map.webp', caption: 'Where the 112 respondents worked, across five divisions of Bangladesh.' },
      { src: '../images/risk-matrix.webp', caption: 'The baseline 5×5 matrix and mitigation bands the simulation output is compared against.' },
    ],
    links: [{ label: 'Paper (DOI)', href: 'https://doi.org/10.1038/s41598-026-63788-2' }],
  },
  {
    id: 'drone',
    zone: 'planroom', wall: 'west', slot: 0, size: [3.2, 2.63],
    kind: 'paper',
    texture: '../images/drone-dl-pipeline.webp',
    venue: 'In Preparation · First Author',
    status: 'pending',
    title: 'A Systematic Review of Deep Learning-Based Drone Applications in the Construction Industry',
    body: [
      'A PRISMA-guided review of how deep learning is actually being flown on construction sites. Convolutional networks and the YOLO family dominate the literature for object detection, site monitoring, and structural assessment, and the review traces where each is credibly accurate across the phases of a project — and where reported performance thins out.',
    ],
    meta: 'Supervisor: Dr. Md. Habibur Rahman Sobuz',
    figures: [
      { src: '../images/drone-keyword-map.webp', caption: 'Keyword co-occurrence map across the reviewed corpus.' },
      { src: '../images/drone-theme-flow.webp', caption: 'How themes shift across 2018–2024.' },
    ],
    links: [{ label: 'Supervisor (ORCID)', href: 'https://orcid.org/0000-0002-6279-5406' }],
  },
  {
    id: 'carbon',
    zone: 'planroom', wall: 'east', slot: 0, size: [3.8, 2.08],
    kind: 'paper',
    texture: '../images/carbon-vr-unity.webp',
    venue: 'B.Sc. Thesis · KUET 2024',
    status: 'pending',
    title: 'BIM-Integrated Virtual Reality Framework for Machine Learning Enhanced Carbon Footprint Reduction',
    body: [
      'BIM supports preconstruction evaluation but has no natural way to show embodied carbon while a mix is still being chosen. Supervised regressors trained on sampled concrete mixture data predict embodied carbon per mix — XGBoost fit best at R² = 0.95 against 0.54 for Lasso and 0.61 for a plain ANN — and were exported behind a web application. A Unity environment then binds that predictor to the Revit quantities, so selecting a column or a slab reports its mass, CO₂ intensity, and the saving available from an alternative mix, in place, in the model.',
    ],
    meta: 'Supervisor: Dr. Md. Ikramul Hoque',
    figures: [
      { src: '../images/carbon-ml-metrics.webp', caption: 'Model comparison — XGBoost leads on all three metrics.' },
      { src: '../images/carbon-revit-model.webp', caption: 'The source Revit model the quantities are drawn from.' },
    ],
    links: [{ label: 'Supervisor (Scholar)', href: 'https://scholar.google.com/citations?user=054j2_8AAAAJ&hl=en' }],
  },
  {
    id: 'digitaltwin',
    zone: 'planroom', wall: 'west', slot: 1, size: [2.4, 1.7],
    kind: 'paper',
    venue: 'Under Review · Int. J. of Building Pathology and Adaptation',
    status: 'pending',
    title: 'Applications of Digital Twin Based on BIM in Construction 4.0: A Systematic Literature Review',
    body: [
      'Where BIM-derived digital twins have genuinely been deployed under the Construction 4.0 banner, and which of the claimed applications are still proposals rather than practice.',
    ],
  },
  {
    id: 'presentations',
    zone: 'planroom', wall: 'west', slot: 2, size: [3.2, 2.2],
    kind: 'board',
    title: 'Conference Presentations',
    venue: '2026',
    rows: [
      ['InspectionGPT: Advancing Inspector Training Workflow in NDOT with an Agentic RAG-MCP Based Chatbot',
       'Poster · March 2026',
       'CI & CRC joint conference, San Antonio, TX — Irfan Gazi, Kyungki Kim. A chatbot that answers a trainee inspector’s questions from the NDOT construction manuals with the passage it drew on cited beside the answer, so a new inspector can check the source rather than take the model’s word for it. Retrieval and the tools the agent may call are separated behind MCP, which keeps the manuals swappable and the agent’s reach explicit. Supported by the Nebraska Department of Transportation.'],
      ['AI and Immersive AR/VR for Sustained Material and Construction Inspection Training and Knowledge Retention',
       'Talk · July 2026',
       'NDOT & University of Nebraska–Lincoln Research Summit 2026 — the project talk for our NDOT-funded work: InspectionGPT as a cited knowledge base and virtual mentor for new inspectors, and the immersive VR environment it is being embedded in, so an inspector practises against a virtual site rather than a live one. PI Kyungki Kim, Co-PI Chun-Hsing (Jun) Ho.'],
    ],
  },

  /* ===================== SYSTEMS CONTAINER ===================== */
  {
    id: 'pytree',
    zone: 'systems', wall: 'east', slot: 0, size: [3.0, 2.0],
    kind: 'repo',
    title: 'Safety-Gated LLM Controller for a Hospital Robot',
    venue: 'Python · py_trees · LLM orchestration · Docker · pytest',
    body: [
      'LLM task plans are probabilistic; hospital hardware is not allowed to be. This controller puts a deterministic six-priority behaviour tree between gpt-4o-mini and the actuators — infrastructure emergency, access control, plan validation, medication safety, ambiguity, then execution. The root selector keeps no memory between ticks, so a facility emergency preempts an in-flight task on the very next tick rather than after it completes.',
      '15 unit tests and 8 deterministic scenarios cover invalid JSON, unknown skills, medication overdoses and contradictory orders; one is an adversarial prompt injection, which the tree refuses.',
    ],
    meta: 'Irfan-Gazi0/robot-multi-agent-pytree · related to the Applied Sciences 2026 paper.',
    links: [
      { label: 'Repository', href: 'https://github.com/Irfan-Gazi0/robot-multi-agent-pytree' },
      { label: 'Paper (DOI)', href: 'https://doi.org/10.3390/app16115320' },
    ],
  },
  {
    id: 'litepack',
    zone: 'systems', wall: 'east', slot: 1, size: [3.0, 2.0],
    kind: 'repo',
    title: 'Token-Budget-Aware Retrieval for Medical Literature',
    venue: 'Python · RAG · Pinecone · OpenAI · FastAPI · React',
    body: [
      'Retrieval systems rank passages; they rarely decide what to leave out. Given a fixed 1,800-token context budget, the LitePack scorer trades relevance against redundancy, keyword coverage and passage length, then packs greedily up to the budget.',
      'Benchmarked against cosine-similarity ranking and MMR over a Pinecone index of PubMed chunks, across 20 clinical questions: LitePack answered using the fewest prompt tokens (1,734) at the highest ROUGE-L (0.476) and keyword support (0.93).',
    ],
    meta: 'Irfan-Gazi0/LitePack-RAG',
    links: [{ label: 'Repository', href: 'https://github.com/Irfan-Gazi0/LitePack-RAG' }],
  },
  {
    id: 'jumpstart',
    zone: 'systems', wall: 'north', slot: 0, size: [3.6, 2.01],
    kind: 'project',
    texture: '../images/ev-vr-portal-still.webp',
    venue: 'Nebraska Clean Cities & Communities Coalition (NEC4) · Jumpstart · 2025 – present',
    title: 'Modernizing EV Emergency Response Training Through XR and AI',
    authors: 'PI Dr. Nathan Huynh (Nebraska Transportation Center), Co-PI Dr. Kyungki Kim (Durham School); {me} builds the portal, the retrieval chatbot and the VR integration.',
    body: [
      'Electric-vehicle emergency response is taught in a room, on a day, by an instructor — and that is exactly what caps how many firefighters and EMTs ever receive it. This project rebuilds one such session as something a responder can walk into from a browser or a headset, on their own shift.',
      'Three components sit in one First Responder Portal: a three-part 360° recording of the emergency response training Southeast Community College delivered in York, Nebraska; a chatbot grounded in manufacturer Emergency Response Guides and rescue sheets, asked by typing or by speaking; and 360° scans of three City of Lincoln fleet EVs, each captured hood open and hood closed so a component named in the video can be found on the vehicle. Click and drag on a screen, or “Enter VR” in a headset browser and stand where the camera stood.',
      'Funded by a Clean Cities and Communities Jumpstart award and reported to the National Laboratory of the Rockies, the Department of Energy lab renamed from NREL in December 2025.',
    ],
    caption: 'The proof-of-concept VR interface: the training plays around you, and the same panel holds the playback controls and the chatbot — hold the trigger to ask out loud, or type.',
    links: [
      { label: 'First Responder Portal', href: 'https://nec4-jumpstart.streamlit.app/' },
      { label: 'NEC4', href: 'https://nec4.unl.edu/' },
      { label: 'Code', href: 'https://github.com/Irfan-Gazi0/RAG_Responder' },
    ],
  },
  {
    id: 'responder',
    zone: 'systems', wall: 'north', slot: 1, size: [3.0, 2.0],
    kind: 'repo',
    title: 'Emergency Response Assistant for Electric Vehicles',
    venue: 'LangChain · GPT-4o · Pinecone · Whisper · n8n · three.js',
    body: [
      'A first-responder portal for electric-vehicle incidents: a 360° walkthrough of a Ford Mach-E beside a chatbot that routes each question to the source that can actually answer it — the 38-page Emergency Response Guide for procedure, the rescue sheet for where the high-voltage components sit, and Whisper-transcribed training narration for everything in between.',
      'Roughly 578 documents across three Pinecone namespaces, with a routing agent picking between them per question.',
    ],
    meta: 'Irfan-Gazi0/RAG_Responder',
    links: [{ label: 'Repository', href: 'https://github.com/Irfan-Gazi0/RAG_Responder' }],
  },
  {
    id: 'misinfo',
    zone: 'systems', wall: 'south', slot: 0, size: [3.0, 2.0],
    kind: 'repo',
    title: 'COVID-19 Misinformation Classifier under Temporal Drift',
    venue: 'TensorFlow · Keras · NLP · LSTM',
    body: [
      'Trained on May articles and tested on July ones, so the distribution genuinely shifts instead of being shuffled into a convenient split. Five experiments across LNN, LSTM and MLP heads over Count and TF-IDF bag-of-words features, scored on recall for the minority class rather than the accuracy that class imbalance makes meaningless.',
    ],
    meta: 'Irfan-Gazi0/covid19-misinfo-detector-nlp',
    links: [{ label: 'Repository', href: 'https://github.com/Irfan-Gazi0/covid19-misinfo-detector-nlp' }],
  },
  {
    id: 'mlstudies',
    zone: 'systems', wall: 'east', slot: 2, size: [3.0, 2.0],
    kind: 'repo',
    title: 'Machine Learning Foundations — Five Controlled Studies',
    venue: 'Jupyter · scikit-learn · NumPy',
    body: ['Short write-ups that each isolate a single variable.'],
    links: [
      { label: 'k-NN: structured vs. unstructured', href: 'https://github.com/Irfan-Gazi0/ML-kNN-Classification-Study' },
      { label: 'Binary classification via logistic regression', href: 'https://github.com/Irfan-Gazi0/ML-LNN-Classification-Study' },
      { label: 'Multi-class softmax regression', href: 'https://github.com/Irfan-Gazi0/ML-Softmax-Classification-Study' },
      { label: 'Depth, activation and learning rate on MNIST', href: 'https://github.com/Irfan-Gazi0/MLP-Experiments-on-MNIST' },
      { label: 'Hand-tuned MLPs on CIFAR-10', href: 'https://github.com/Irfan-Gazi0/MLP-Image-Classification-CIFAR-10' },
    ],
  },

  /* ===================== FABRICATION YARD ===================== */
  {
    id: 'plumbing',
    zone: 'fabrication', wall: 'west', slot: 0, size: [4.0, 2.95],
    kind: 'project',
    texture: '../images/bim-plumbing-3d.webp',
    venue: 'Autodesk Revit · AutoCAD',
    title: 'Revit-Based Architectural and Plumbing Coordination',
    body: [
      'A unified architectural and plumbing model for a commercial building, built from parametric components so hot and cold supply, drainage, and fixture connections stay consistent when anything moves. Routes, pipe sizes, and equipment placements carry through to the construction drawings, with legacy AutoCAD data cross-referenced to keep the two sets in agreement.',
    ],
    figures: [
      { src: '../images/bim-architectural-3d.webp', caption: 'The architectural model the services are coordinated against.' },
      { src: '../images/bim-water-supply-drawing.webp', caption: 'Water supply drawing with diameters and elevations.' },
    ],
  },
  {
    id: 'hvac',
    zone: 'fabrication', wall: 'north', slot: 0, size: [4.0, 2.89],
    kind: 'project',
    texture: '../images/hvac-3d.webp',
    venue: 'Autodesk Revit',
    title: 'HVAC System Design and BIM Coordination',
    body: [
      'Supply, return, and exhaust ducting modelled alongside chilled-water piping and the fan coil unit, sized to hold the design flow rates through every branch. The drawings carry duct dimensions, flow in L/s, and device tags at each diffuser, so the coordination decisions survive the handoff to site instead of living only in the model.',
    ],
    figures: [
      { src: '../images/hvac-drawing.webp', caption: 'Duct sizes, elevations and flow rates per branch.' },
      { src: '../images/hvac-coordination.webp', caption: 'All services overlaid for coordination review.' },
    ],
  },
  {
    id: 'clash',
    zone: 'fabrication', wall: 'south', slot: 0, size: [4.2, 2.61],
    kind: 'project',
    texture: '../images/clash-detective.webp',
    venue: 'Autodesk Navisworks · Revit',
    title: 'Clash Detection and Model Coordination',
    body: [
      'Federating the architectural, structural, and MEP models into Navisworks surfaced 123 clashes in a single Clash Detective run, each pinned to a level and grid intersection so it could be assigned and closed. Catching them at design stage is the whole point: the same conflicts found on site are rework, and rework is the expensive way to learn about them.',
    ],
    figures: [
      { src: '../images/clash-plan-view.webp', caption: 'Working through the results list clash by clash.' },
      { src: '../images/clash-building-render.webp', caption: 'The coordinated building.' },
    ],
  },

  /* ===================== MILESTONE ROW ===================== */
];
