export interface DiagramTemplate {
  id: string;
  title: string;
  category: 'Machine Learning & AI' | 'Software Architecture' | 'Database Systems & ERD' | 'Cloud & DevOps' | 'System Design & Algorithms';
  tags: string[];
  description: string;
  diagramCode: string;
}

export const DIAGRAM_CATALOG: DiagramTemplate[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. MACHINE LEARNING & ARTIFICIAL INTELLIGENCE (ML)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'ml-end-to-end-training-pipeline',
    title: 'End-to-End Machine Learning Training & Deployment Pipeline',
    category: 'Machine Learning & AI',
    tags: ['ml', 'machine learning', 'pipeline', 'training', 'model', 'dataset', 'feature engineering', 'evaluation', 'mlops', 'deploy'],
    description: 'Comprehensive workflow from raw data ingestion, feature store, model training, evaluation metrics, model registry to serving.',
    diagramCode: `flowchart TD
    RawData[("🗄️ Raw Data Lake")] --> Ingest["📥 Ingestion & Validation Engine"]
    Ingest --> Cleaning["🧹 Data Preprocessing & Imputation"]
    Cleaning --> FeatureStore[("⚡ Feature Store")]
    
    subgraph Feature Engineering & Split
        FeatureStore --> FeatEng["🔬 Feature Scaling & Encoding"]
        FeatEng --> Split{"Train/Val/Test Split"}
        Split -->|"80% Train"| TrainSet[("🏋️ Training Set")]
        Split -->|"10% Val"| ValSet[("🔍 Validation Set")]
        Split -->|"10% Test"| TestSet[("🎯 Holdout Test Set")]
    end
    
    subgraph Model Optimization Loop
        TrainSet --> ModelTrain["🤖 Model Training & Estimators"]
        ValSet --> HyperTuning["⚙️ Hyperparameter Tuning (Optuna)"]
        HyperTuning --> ModelTrain
        ModelTrain --> EvalCheck{"Validation Metric >= Target?"}
        EvalCheck -->|"No"| FeatureStore
        EvalCheck -->|"Yes"| CandidateModel["📦 Candidate Artifact"]
    end
    
    subgraph Governance & Deployment
        CandidateModel --> ModelRegistry[("🏷️ MLflow Model Registry")]
        TestSet --> FinalBenchmark["📊 Final Test Benchmark"]
        ModelRegistry --> FinalBenchmark
        FinalBenchmark --> CanaryDeploy["🚀 Canary Deployment / A-B Test"]
        CanaryDeploy --> LiveInference["⚡ Real-Time Serving API"]
        LiveInference --> Monitoring["📈 Drift & Latency Monitor"]
        Monitoring -.->|"Data Drift Detected"| RawData
    end
    
    style RawData fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style FeatureStore fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style ModelTrain fill:#fdf4ff,stroke:#c026d3,stroke-width:2px
    style ModelRegistry fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style LiveInference fill:#fff7ed,stroke:#ea580c,stroke-width:2px`,
  },
  {
    id: 'ml-rag-architecture-pipeline',
    title: 'Retrieval-Augmented Generation (RAG) Architecture',
    category: 'Machine Learning & AI',
    tags: ['rag', 'retrieval', 'llm', 'vector', 'embedding', 'faiss', 'chunking', 'documents', 'ai', 'search'],
    description: 'Production RAG pipeline featuring document ingestion, dense vector search, reranking, augmented prompt construction, and LLM output.',
    diagramCode: `flowchart TD
    Docs[("📚 Academic Documents & PDFs")] --> Parser["📄 Document Parser & Cleaner"]
    Parser --> Chunker["✂️ Recursive Semantic Chunker"]
    Chunker --> Embedder["🧠 Embedding Engine (768-dim)"]
    Embedder --> VectorDB[("⚡ FAISS / Vector Database")]
    
    UserPrompt["👤 Student Query"] --> QueryEmbed["🧠 Query Embedder"]
    QueryEmbed --> CosineSearch{"🔍 Top-K Vector Search"}
    VectorDB --> CosineSearch
    
    subgraph Reranking & Synthesis
        CosineSearch -->|"Top-10 Chunks"| CrossEncoder["🎯 Cross-Encoder Reranker"]
        CrossEncoder -->|"Top-3 Relevant Context"| ContextInjector["💉 Prompt Augmentation Engine"]
        UserPrompt --> ContextInjector
        ContextInjector --> LLM["🤖 Large Language Model (LLM)"]
        LLM --> StreamResponse["💬 Structured Answer & Source Citations"]
    end
    
    StreamResponse --> UserUI["📱 StudySync AI Chatbot"]
    
    style Docs fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style VectorDB fill:#eff6ff,stroke:#2563eb,stroke-width:3px
    style LLM fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    style UserUI fill:#f0fdf4,stroke:#16a34a,stroke-width:2px`,
  },
  {
    id: 'ml-deep-learning-cnn-pipeline',
    title: 'Deep Learning Computer Vision (CNN) Pipeline',
    category: 'Machine Learning & AI',
    tags: ['cnn', 'deep learning', 'computer vision', 'neural network', 'image', 'classification', 'backprop', 'convolution'],
    description: 'End-to-end vision network illustrating data augmentation, convolutional layers, pooling, dense layers, loss, and backpropagation.',
    diagramCode: `flowchart TD
    InputImages[("🖼️ Raw Image Dataset")] --> Augment["🔄 Data Augmentation (Flip, Crop, Normalize)"]
    Augment --> ConvLayer1["🟦 Conv2D (32 Filters, 3x3) + ReLU"]
    ConvLayer1 --> MaxPool1["🟨 MaxPool2D (2x2)"]
    MaxPool1 --> ConvLayer2["🟦 Conv2D (64 Filters, 3x3) + ReLU"]
    ConvLayer2 --> MaxPool2["🟨 MaxPool2D (2x2)"]
    
    subgraph Deep Feature Extraction
        MaxPool2 --> ConvLayer3["🟦 Conv2D (128 Filters, 3x3) + BatchNorm"]
        ConvLayer3 --> GlobalAvgPool["🟩 Global Average Pooling"]
        GlobalAvgPool --> Dropout["🔲 Dropout (p=0.4)"]
    end
    
    subgraph Classification & Backprop
        Dropout --> Dense["🟧 Dense Fully-Connected Layer"]
        Dense --> Softmax{"Softmax Probabilities"}
        Softmax --> CrossEntropy["📉 Cross-Entropy Loss"]
        CrossEntropy -.->|"Adam Optimizer Gradients"| ConvLayer1
    end
    
    Softmax --> OutputClass["🏷️ Predicted Academic Class"]
    
    style InputImages fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style ConvLayer1 fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px
    style ConvLayer2 fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px
    style Dense fill:#fff7ed,stroke:#ea580c,stroke-width:2px
    style OutputClass fill:#f0fdf4,stroke:#16a34a,stroke-width:2px`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SOFTWARE ARCHITECTURE & AUTOMATION FLOWS
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'whatsapp-automation-flow',
    title: 'Automated WhatsApp Business Bot & Webhook Flow',
    category: 'Software Architecture',
    tags: ['whatsapp', 'webhook', 'automation', 'bot', 'chat', 'api', 'flow', 'meta', 'messaging'],
    description: 'Scalable WhatsApp chatbot architecture with webhook ingestion, HMAC validation, async queue, session manager, and response dispatch.',
    diagramCode: `flowchart TD
    User["👤 Mobile User"] -->|"1. Sends WhatsApp Msg"| WA_Cloud["📱 Meta WhatsApp Cloud API"]
    WA_Cloud -->|"2. Webhook POST Payload"| IngestGateway["🌐 API Ingestion Gateway"]
    
    subgraph Security & Queue Ingestion
        IngestGateway --> VerifySig{"3. HMAC-SHA256 Valid?"}
        VerifySig -->|"No (403)"| Reject["🚫 Drop & Log Unauthorized"]
        VerifySig -->|"Yes (200 OK)"| MsgQueue[("📬 RabbitMQ / Redis Message Queue")]
    end
    
    subgraph Bot Execution Engine
        MsgQueue --> BotWorker["⚙️ Async Bot Worker"]
        BotWorker --> StateCheck{"4. Session Exists in Cache?"}
        StateCheck -->|"No"| InitSession["🆕 Load User Context"]
        StateCheck -->|"Yes"| ActiveSession["⚡ Active Dialog State"]
        InitSession --> SessionDB[("🗄️ PostgreSQL / MongoDB")]
        ActiveSession --> SessionDB
        
        BotWorker --> IntentEngine["🧠 Natural Language Intent Matcher"]
        IntentEngine --> ActionRoute{"5. Route Action"}
        ActionRoute -->|"Menu Request"| MenuHandler["📋 Format Course Menu"]
        ActionRoute -->|"Deadline Query"| TaskHandler["⏰ Fetch Pending Tasks"]
        ActionRoute -->|"Live Support"| HumanAgent["👨‍💼 Escalate to Agent"]
    end
    
    subgraph Response Dispatcher
        MenuHandler --> Formatter["📤 Message Payload Formatter"]
        TaskHandler --> Formatter
        HumanAgent --> Formatter
        Formatter --> Dispatcher["🚀 WhatsApp Graph API Client"]
        Dispatcher -->|"6. Send WhatsApp JSON"| WA_Cloud
    end
    
    WA_Cloud -->|"7. Incoming Reply Notification"| User
    
    style User fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style WA_Cloud fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style MsgQueue fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style SessionDB fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    style Formatter fill:#fff7ed,stroke:#ea580c,stroke-width:2px`,
  },
  {
    id: 'event-driven-microservices-flow',
    title: 'Event-Driven Microservices Architecture (Kafka / Sagas)',
    category: 'Software Architecture',
    tags: ['microservices', 'event driven', 'kafka', 'architecture', 'saga', 'pubsub', 'distributed', 'services'],
    description: 'Production distributed microservices architecture coordinated via an event backbone with decoupled consumers and read stores.',
    diagramCode: `flowchart TD
    ClientApp["💻 Web / Mobile Client"] --> APIGateway["🚪 API Gateway & Rate Limiter"]
    
    subgraph Core Domain Services
        APIGateway --> OrderService["🛒 Order Management Service"]
        APIGateway --> UserService["👤 User & Auth Service"]
        APIGateway --> CourseService["📚 Course Catalog Service"]
    end
    
    subgraph Distributed Event Backbone
        OrderService -->|"Produce: OrderCreated"| KafkaBus[("⚡ Apache Kafka Event Stream")]
        UserService -->|"Produce: UserRegistered"| KafkaBus
        CourseService -->|"Produce: CourseUpdated"| KafkaBus
    end
    
    subgraph Event Consumers & Workers
        KafkaBus -->|"Consume: OrderCreated"| PaymentWorker["💳 Payment Processing Worker"]
        KafkaBus -->|"Consume: OrderCreated"| InventoryWorker["📦 Inventory Reservation Worker"]
        KafkaBus -->|"Consume: Event"| NotificationWorker["🔔 Email & SMS Notification Worker"]
    end
    
    subgraph Data Stores
        PaymentWorker --> PaymentDB[("🗄️ Payment Ledger DB")]
        InventoryWorker --> InventoryDB[("🗄️ Inventory DB")]
        NotificationWorker --> AnalyticsStore[("📊 Elasticsearch / ClickHouse")]
    end
    
    style ClientApp fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style APIGateway fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style KafkaBus fill:#fdf4ff,stroke:#c026d3,stroke-width:3px
    style PaymentDB fill:#f0fdf4,stroke:#16a34a,stroke-width:2px`,
  },
  {
    id: 'oauth2-jwt-authentication-flow',
    title: 'OAuth2 & JWT Token Exchange Flow',
    category: 'Software Architecture',
    tags: ['auth', 'oauth', 'jwt', 'security', 'login', 'token', 'authentication', 'authorization'],
    description: 'Standard secure OAuth2 authorization code flow with PKCE, JWT token minting, refresh token rotation, and API validation.',
    diagramCode: `flowchart TD
    User["👤 Student / User"] -->|"1. Click Login"| SPA["🖥️ Frontend Single Page App"]
    SPA -->|"2. Redirect /authorize with PKCE"| AuthServer["🔐 Authorization Server (Auth0/Keycloak)"]
    
    subgraph Identity Verification
        AuthServer --> PromptLogin["🔑 Present Login & MFA Challenge"]
        User -->|"3. Submit Credentials"| PromptLogin
        PromptLogin --> ValidateCreds{"4. Credentials Valid?"}
        ValidateCreds -->|"No"| AuthError["❌ Show Auth Error"]
        ValidateCreds -->|"Yes"| MintCode["🎫 Generate Authorization Code"]
    end
    
    MintCode -->|"5. Redirect with Code"| SPA
    SPA -->|"6. POST /token + CodeVerifier"| AuthServer
    AuthServer -->|"7. Return Access & Refresh Tokens"| SPA
    
    subgraph Resource Access
        SPA -->|"8. API Call: Bearer JWT"| APIGateway["🛡️ Backend API Gateway"]
        APIGateway --> VerifyJWT{"9. Verify Signature & Claims"}
        VerifyJWT -->|"Invalid/Expired"| Unauthorized["🚫 401 Unauthorized"]
        VerifyJWT -->|"Valid"| ProtectedAPI["✅ Authorized Academic Resource"]
    end
    
    style User fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style AuthServer fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style SPA fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style ProtectedAPI fill:#fff7ed,stroke:#ea580c,stroke-width:2px`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DATABASE SYSTEMS & ENTITY RELATIONSHIP (ERD)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'academic-lms-database-erd',
    title: 'StudySync Academic LMS Entity Relationship Diagram (ERD)',
    category: 'Database Systems & ERD',
    tags: ['erd', 'database', 'lms', 'academic', 'schema', 'sql', 'entities', 'relationships', 'tables'],
    description: 'Relational 3NF database schema for student courses, uploaded documents, vector chunks, deadlines, and task reminders.',
    diagramCode: `flowchart TD
    subgraph Users and Security
        USERS["👤 USERS
        - id: UUID [PK]
        - email: VARCHAR [UQ]
        - password_hash: VARCHAR
        - full_name: VARCHAR
        - role: ENUM
        - created_at: TIMESTAMP"]
    end
    
    subgraph Academic Curriculum
        COURSES["📚 COURSES
        - id: UUID [PK]
        - user_id: UUID [FK]
        - name: VARCHAR
        - code: VARCHAR
        - color_tag: VARCHAR
        - semester: VARCHAR"]
        
        DOCUMENTS["📄 DOCUMENTS
        - id: UUID [PK]
        - course_id: UUID [FK]
        - filename: VARCHAR
        - filepath: VARCHAR
        - file_size: INT
        - mime_type: VARCHAR"]
    end
    
    subgraph Vector Search Engine
        VECTOR_CHUNKS["⚡ VECTOR_CHUNKS
        - id: UUID [PK]
        - document_id: UUID [FK]
        - course_id: UUID [FK]
        - chunk_text: TEXT
        - embedding: VECTOR(768)
        - chunk_index: INT"]
    end
    
    subgraph Tasks & Deadlines
        TASKS["⏰ TASKS
        - id: UUID [PK]
        - user_id: UUID [FK]
        - course_id: UUID [FK]
        - title: VARCHAR
        - deadline: TIMESTAMP
        - priority: ENUM
        - is_completed: BOOLEAN"]
    end
    
    USERS -->|"1 : N (owns)"| COURSES
    COURSES -->|"1 : N (contains)"| DOCUMENTS
    DOCUMENTS -->|"1 : N (segmented into)"| VECTOR_CHUNKS
    COURSES -->|"1 : N (tagged in)"| TASKS
    USERS -->|"1 : N (assigned to)"| TASKS
    
    style USERS fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style COURSES fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style DOCUMENTS fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    style VECTOR_CHUNKS fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style TASKS fill:#fff7ed,stroke:#ea580c,stroke-width:2px`,
  },
  {
    id: 'ecommerce-database-erd',
    title: 'Enterprise E-Commerce Relational Database Schema (ERD)',
    category: 'Database Systems & ERD',
    tags: ['erd', 'database', 'ecommerce', 'orders', 'products', 'customers', 'schema', 'sql'],
    description: 'Production e-commerce relational schema covering customers, catalog, orders, order items, inventory, and payments.',
    diagramCode: `flowchart TD
    CUSTOMERS["👤 CUSTOMERS
    - customer_id: BIGINT [PK]
    - email: VARCHAR [UQ]
    - first_name: VARCHAR
    - last_name: VARCHAR
    - created_at: TIMESTAMP"]
    
    ORDERS["🛒 ORDERS
    - order_id: BIGINT [PK]
    - customer_id: BIGINT [FK]
    - total_amount: DECIMAL
    - order_status: VARCHAR
    - created_at: TIMESTAMP"]
    
    ORDER_ITEMS["📦 ORDER_ITEMS
    - item_id: BIGINT [PK]
    - order_id: BIGINT [FK]
    - product_id: BIGINT [FK]
    - unit_price: DECIMAL
    - quantity: INT"]
    
    PRODUCTS["🏷️ PRODUCTS
    - product_id: BIGINT [PK]
    - category_id: INT [FK]
    - title: VARCHAR
    - sku: VARCHAR [UQ]
    - price: DECIMAL"]
    
    CATEGORIES["📂 CATEGORIES
    - category_id: INT [PK]
    - name: VARCHAR
    - slug: VARCHAR [UQ]"]
    
    PAYMENTS["💳 PAYMENTS
    - payment_id: BIGINT [PK]
    - order_id: BIGINT [FK]
    - payment_method: VARCHAR
    - transaction_ref: VARCHAR
    - payment_status: VARCHAR"]
    
    CUSTOMERS -->|"1 : N places"| ORDERS
    ORDERS -->|"1 : N includes"| ORDER_ITEMS
    PRODUCTS -->|"1 : N appears in"| ORDER_ITEMS
    CATEGORIES -->|"1 : N classifies"| PRODUCTS
    ORDERS -->|"1 : 1 settled by"| PAYMENTS
    
    style CUSTOMERS fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style ORDERS fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style ORDER_ITEMS fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    style PRODUCTS fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style PAYMENTS fill:#fff7ed,stroke:#ea580c,stroke-width:2px`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CLOUD, DEVOPS & CI/CD
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'cicd-automated-deployment-pipeline',
    title: 'Modern CI/CD Automated Build, Test & Deployment Pipeline',
    category: 'Cloud & DevOps',
    tags: ['cicd', 'devops', 'pipeline', 'github actions', 'docker', 'kubernetes', 'deploy', 'testing', 'cloud'],
    description: 'Complete continuous integration and continuous deployment workflow from Git commit to Kubernetes production cluster.',
    diagramCode: `flowchart TD
    DevCommit["👨‍💻 Developer Git Push"] --> GitHubTrigger["🐙 GitHub Actions Trigger"]
    
    subgraph Continuous Integration (CI)
        GitHubTrigger --> LintCheck["🔍 Code Linting & TypeCheck"]
        LintCheck --> UnitTests["🧪 Automated Unit & Integration Tests"]
        UnitTests --> TestPass{"All Tests Pass?"}
        TestPass -->|"No"| FailAlert["❌ Notify Slack & Halt Build"]
        TestPass -->|"Yes"| SonarQube["🛡️ SonarQube Security Scan"]
        SonarQube --> DockerBuild["🐳 Build Container Image"]
        DockerBuild --> ContainerRegistry[("📦 Docker Hub / AWS ECR")]
    end
    
    subgraph Staging & Integration
        ContainerRegistry --> DeployStaging["🚀 Deploy to Staging Cluster"]
        DeployStaging --> EndToEnd["🔬 Cypress E2E Integration Suite"]
        EndToEnd --> StagingPass{"E2E Passed?"}
        StagingPass -->|"No"| RollbackStaging["⏪ Auto-Rollback Staging"]
        StagingPass -->|"Yes"| PromoteApproval{"Manual Signoff Required?"}
    end
    
    subgraph Production Rollout
        PromoteApproval -->|"Approved"| BlueGreenDeploy["🌐 Blue-Green K8s Rollout"]
        BlueGreenDeploy --> TrafficSwitch{"Health Check 200 OK?"}
        TrafficSwitch -->|"Healthy"| LiveProd["🎉 100% Production Traffic Live"]
        TrafficSwitch -->|"Unhealthy"| InstantRollback["🚨 Instant Traffic Rollback"]
    end
    
    style DevCommit fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style ContainerRegistry fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style LiveProd fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style FailAlert fill:#fef2f2,stroke:#dc2626,stroke-width:2px`,
  },
  {
    id: 'cloud-aws-multitier-architecture',
    title: 'High-Availability Multi-Tier Cloud Architecture',
    category: 'Cloud & DevOps',
    tags: ['aws', 'cloud', 'architecture', 'load balancer', 'ecs', 'rds', 'redis', 'cdn', 'infrastructure'],
    description: 'High availability AWS multi-region infrastructure with CloudFront CDN, Application Load Balancers, ECS container tasks, and Multi-AZ RDS.',
    diagramCode: `flowchart TD
    GlobalUsers["🌍 Global End Users"] --> Route53["🌐 AWS Route 53 DNS"]
    Route53 --> CloudFront["⚡ CloudFront CDN & WAF"]
    CloudFront -->|"Static Assets"| S3Bucket[("🪣 Amazon S3 Storage")]
    CloudFront -->|"Dynamic API"| ALB["⚖️ Application Load Balancer"]
    
    subgraph Availability Zone A (Primary)
        ALB --> ECS_A["🖥️ ECS Fargate Task A"]
        ECS_A --> Redis_Primary[("⚡ Redis Primary Cache")]
        ECS_A --> RDS_Primary[("🗄️ PostgreSQL Master RDS")]
    end
    
    subgraph Availability Zone B (Standby)
        ALB --> ECS_B["🖥️ ECS Fargate Task B"]
        ECS_B --> Redis_Replica[("⚡ Redis Read Replica")]
        ECS_B --> RDS_Replica[("🗄️ PostgreSQL Read Replica")]
    end
    
    RDS_Primary -.->|"Synchronous Multi-AZ Sync"| RDS_Replica
    Redis_Primary -.->|"Replication"| Redis_Replica
    
    ECS_A --> CloudWatch["📊 AWS CloudWatch Logs & Metrics"]
    ECS_B --> CloudWatch
    
    style GlobalUsers fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style CloudFront fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style ALB fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    style RDS_Primary fill:#f0fdf4,stroke:#16a34a,stroke-width:2px`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. SYSTEM DESIGN & ALGORITHMIC STATE MACHINES
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'distributed-rate-limiter-redis',
    title: 'Distributed Sliding Window Rate Limiter Architecture',
    category: 'System Design & Algorithms',
    tags: ['rate limit', 'redis', 'system design', 'sliding window', 'api gateway', 'algorithm', 'concurrency'],
    description: 'High throughput distributed sliding-window counter algorithm implemented via Redis sorted sets (ZSET) to protect APIs.',
    diagramCode: `flowchart TD
    ClientRequest["🌐 Incoming HTTP Request"] --> RateLimitMiddleware["🛡️ Rate Limiting Middleware"]
    RateLimitMiddleware --> KeyExtractor["🔑 Extract Client Identifier (IP / API Key)"]
    KeyExtractor --> RedisCall["⚡ Redis Atomic Pipeline (MULTI / EXEC)"]
    
    subgraph Redis Sliding Window Evaluation
        RedisCall --> ZRemRange["1. ZREMRANGEBYSCORE (Purge entries older than WindowStart)"]
        ZRemRange --> ZCard["2. ZCARD (Count requests in current window)"]
        ZCard --> LimitCheck{"3. Current Count < Max Limit?"}
        LimitCheck -->|"Count >= Limit (Exceeded)"| Reject429["🚫 429 Too Many Requests"]
        LimitCheck -->|"Count < Limit (Allowed)"| ZAdd["4. ZADD (Record Current Timestamp)"]
        ZAdd --> SetTTL["5. EXPIRE (Reset Sliding TTL)"]
    end
    
    Reject429 --> Return429["🛑 Return 429 with Retry-After Header"]
    SetTTL --> ForwardRequest["✅ Forward Request to Target Microservice"]
    ForwardRequest --> TargetService["🚀 Downstream Academic API Controller"]
    
    style ClientRequest fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style RedisCall fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style ForwardRequest fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style Reject429 fill:#fef2f2,stroke:#dc2626,stroke-width:2px`,
  },
  {
    id: 'academic-assignment-state-machine',
    title: 'Academic Assignment & Quiz Lifecycle State Machine',
    category: 'System Design & Algorithms',
    tags: ['state machine', 'lifecycle', 'workflow', 'assignment', 'quiz', 'status', 'academic'],
    description: 'Deterministic state transition machine governing student assignment lifecycles, draft submissions, grading, and deadlines.',
    diagramCode: `flowchart TD
    Start([● Task Created]) --> DRAFT["📝 DRAFT / PENDING"]
    
    DRAFT -->|"Student starts work"| IN_PROGRESS["⏳ IN_PROGRESS"]
    IN_PROGRESS -->|"Uploads document"| READY_TO_SUBMIT["📦 READY_FOR_REVIEW"]
    READY_TO_SUBMIT -->|"Clicks Submit"| SUBMITTED["📤 SUBMITTED"]
    
    subgraph Automated Evaluation
        SUBMITTED --> PlagiarismCheck{"Plagiarism Check"}
        PlagiarismCheck -->|"Similarity > 40%"| FLAGGED["🚩 FLAGGED_FOR_REVIEW"]
        PlagiarismCheck -->|"Clean (< 15%)"| AUTO_GRADED["🤖 EVALUATING"]
    end
    
    AUTO_GRADED --> ReviewByInstructor{"Instructor Review"}
    ReviewByInstructor -->|"Needs Revision"| REVISION_REQUESTED["🔄 REVISION_REQUESTED"]
    REVISION_REQUESTED --> IN_PROGRESS
    ReviewByInstructor -->|"Approved"| GRADED["🏆 GRADED & COMPLETED"]
    
    DRAFT -->|"Deadline passed without submission"| OVERDUE["⚠️ OVERDUE"]
    IN_PROGRESS -->|"Deadline passed"| OVERDUE
    OVERDUE -->|"Late penalty policy applied"| LATE_SUBMITTED["⏰ LATE_SUBMISSION"]
    LATE_SUBMITTED --> SUBMITTED
    
    GRADED --> Archived([✔ Stored in Academic Transcript])
    
    style Start fill:#f8fafc,stroke:#0f172a,stroke-width:2px
    style DRAFT fill:#eff6ff,stroke:#2563eb,stroke-width:2px
    style IN_PROGRESS fill:#fff7ed,stroke:#ea580c,stroke-width:2px
    style SUBMITTED fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    style GRADED fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    style OVERDUE fill:#fef2f2,stroke:#dc2626,stroke-width:2px`,
  },
];
