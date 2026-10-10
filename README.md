# Lead Engine - AI-Powered Sales Lead Management Platform

A production-grade SaaS application for discovering, managing, and converting business leads with AI-powered contact classification and intelligent website crawling.

## Features

### Core Capabilities
- **Company Discovery**: Search and discover companies across multiple sources (JustDial, IndiaMART, TradeIndia, Sulekha)
- **Smart Web Crawling**: Intelligent website crawling that follows prioritized paths (/contact, /about, /team, etc.) to extract contact information
- **AI Contact Classification**: Rule-based contact role classification and decision-maker scoring using local LLM compatibility
- **Lead Management**: Full lead lifecycle management with status tracking, scoring, and analytics
- **Contact Management**: Extract and organize contacts by role, decision-maker score, and contact information
- **Real-time Analytics**: Dashboard with statistics, charts, and lead distribution analysis
- **Search & Filter**: Powerful lead and contact search with filtering capabilities

### Technical Stack
- **Frontend**: Next.js 16 with React 19, TailwindCSS v4, SWR for state management
- **Backend**: Next.js API routes with in-memory database
- **Authentication**: JWT-based auth with HTTP-only cookies
- **Data Processing**: Zod for validation, Recharts for analytics visualizations
- **Web Crawling**: Cheerio for HTML parsing, Axios for HTTP requests
- **Security**: bcryptjs for password hashing, input validation on all endpoints

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm/yarn

### Installation

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables** (optional for JWT)
   ```bash
   # Generate a secure JWT secret for production
   openssl rand -base64 32
   # Add to .env.local (create if doesn't exist)
   JWT_SECRET=your_secret_here
   ```

3. **Start the development server**
   ```bash
   pnpm dev
   ```

4. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
app/
├── api/                      # Backend API routes
│   ├── auth/                # Authentication endpoints
│   ├── leads/               # Lead management endpoints
│   ├── discovery/           # Company discovery API
│   └── stats/               # Analytics API
├── dashboard/               # Protected dashboard pages
│   ├── page.tsx            # Main dashboard with analytics
│   └── discover/           # Company discovery interface
├── login/                   # Login page
├── register/                # Registration page
└── layout.tsx              # Root layout with auth provider

components/
├── lead-card.tsx           # Lead display card component
└── stat-card.tsx           # Statistics card component

lib/
├── types.ts                # Core data types and schemas
├── db.ts                   # In-memory database operations
├── auth.ts                 # JWT and password utilities
├── auth-context.tsx        # React auth context provider
├── crawler.ts              # Website crawling engine
├── classifier.ts           # Contact role classification
└── discovery.ts            # Company discovery simulation

public/                      # Static assets
└── icons/                   # App icons
```

## Core Modules

### Authentication (`lib/auth.ts`)
- Password hashing with bcryptjs
- JWT token generation and verification
- Cookie-based session management
- Protected API middleware

### Web Crawler (`lib/crawler.ts`)
- Smart crawling with priority-based link following
- Email, phone, and name extraction using regex patterns
- Social media link discovery
- Support for Indian phone number formats
- HTML parsing with Cheerio

### AI Classifier (`lib/classifier.ts`)
- Rule-based contact role classification (CEO, Manager, Sales, etc.)
- Decision-maker scoring based on role, email pattern, and context
- Lead qualification scoring based on company size and contact info
- Extensible pattern-based system

### Company Discovery (`lib/discovery.ts`)
- Simulated multi-source company discovery
- Support for 4 Indian cities and 8 industries
- Advanced discovery with source breakdown
- Realistic company generation

### Database (`lib/db.ts`)
- In-memory database for development
- CRUD operations for users, leads, contacts, and tasks
- Full-text search capabilities
- Analytics aggregation

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Leads
- `GET /api/leads` - List user's leads (with search query support)
- `POST /api/leads` - Create new lead
- `GET /api/leads/[id]` - Get specific lead
- `PATCH /api/leads/[id]` - Update lead
- `DELETE /api/leads/[id]` - Delete lead
- `POST /api/leads/[id]/crawl` - Trigger website crawl for lead
- `GET /api/leads/[id]/contacts` - Get lead's contacts
- `POST /api/leads/[id]/contacts` - Add contact to lead

### Company Discovery
- `GET /api/discovery` - Discover companies by industry and location
  - Query params: `industry`, `location`, `advanced=true/false`

### Analytics
- `GET /api/stats` - Get user's lead statistics

## Usage Guide

### 1. Register and Login
- Navigate to `/register` to create an account
- Enter name, email, company, and password (min 6 characters)
- Click "Create Account" to register

### 2. Discover Companies
- Click "Discover Companies" on the dashboard
- Select an industry and location
- Click "Search Companies" to find available leads
- Click "Add as Lead" to add a company to your pipeline

### 3. Manage Leads
- View all leads on the dashboard
- Click on a lead card to view details
- The system automatically crawls the company website to extract contacts
- Contacts are classified by role and scored for decision-maker likelihood

### 4. View Analytics
- Dashboard shows key metrics:
  - Total leads
  - Average lead score
  - Average contacts per lead
  - Qualified leads count
- Charts display leads by status and source distribution

## Development Features

### Data Models

**User**
```typescript
{
  id: string
  email: string
  password: string (hashed)
  name: string
  company: string
  createdAt: Date
  updatedAt: Date
}
```

**Lead**
```typescript
{
  id: string
  userId: string
  companyName: string
  industry: string
  source: 'JUSTDIAL' | 'INDIAMART' | 'TRADEINDIA' | 'SULEKHA' | 'MANUAL'
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'NEGOTIATING' | 'WON' | 'LOST'
  score: 0-100
  website: string (optional)
  location: string (optional)
  notes: string (optional)
  crawledAt: Date (optional)
  createdAt: Date
  updatedAt: Date
}
```

**Contact**
```typescript
{
  id: string
  leadId: string
  userId: string
  name: string
  email: string (optional)
  phone: string (optional)
  role: 'CEO' | 'FOUNDER' | 'MANAGER' | 'SALES' | 'MARKETING' | 'OPERATIONS' | 'HR' | 'FINANCE' | 'TECHNICAL' | 'OTHER'
  decisionMakerScore: 0-100
  source: 'crawled' | 'manual'
  createdAt: Date
  updatedAt: Date
}
```

## Customization & Extension

### Add Real Database Integration
Replace `lib/db.ts` functions with actual database calls:
```typescript
// Replace in-memory Map with Neon PostgreSQL
import { db } from '@vercel/postgres'

export async function getLeadsByUserId(userId: string) {
  const result = await db.query(
    'SELECT * FROM leads WHERE user_id = $1',
    [userId]
  )
  return result.rows
}
```

### Integrate Real Ollama
Update `lib/classifier.ts` to call actual Ollama instance:
```typescript
export async function classifyWithOllama(...) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'mistral',
      prompt: `Classify this contact...`,
    }),
  })
  // Parse and return classification
}
```

### Connect Real APIs
Replace simulated discovery in `lib/discovery.ts` with real API calls:
```typescript
export async function discoverCompanies(industry: string, location: string) {
  const response = await fetch(
    `https://api.justdial.com/search?industry=${industry}&location=${location}`
  )
  return response.json()
}
```

## Performance Optimizations

- **SWR**: Client-side data fetching and caching with automatic revalidation
- **Smart Crawling**: Prioritized link following reduces crawl time
- **Background Tasks**: Website crawling runs asynchronously
- **Search**: In-memory full-text search for instant filtering
- **Streaming**: Large result sets handled efficiently

## Security Features

- HTTP-only cookies prevent XSS attacks
- Password hashing with bcryptjs (10 salt rounds)
- JWT token verification on all protected routes
- Zod schema validation on all inputs
- User data isolation via userId filtering
- CORS protection through secure cookie settings

## Deployment

### Deploy to Vercel
```bash
# Push to GitHub
git push

# Vercel auto-deploys on push
# Or manually deploy
vercel deploy
```

### Environment Variables (Production)
```
JWT_SECRET=your_secure_secret_here
NODE_ENV=production
```

## Troubleshooting

### Dev server not starting?
```bash
rm -rf .next
pnpm install
pnpm dev
```

### Authentication issues?
- Clear cookies in browser DevTools
- Check JWT_SECRET is set
- Verify password meets 6+ character requirement

### Crawling failing?
- Check website is accessible
- Verify target paths exist (/contact, /about, /team)
- Check crawler timeout (5 seconds per page)

## Future Enhancements

- [ ] Real database integration (Neon PostgreSQL)
- [ ] Ollama AI integration for advanced classification
- [ ] Real company discovery APIs
- [ ] Email/SMS campaign automation
- [ ] Webhook integrations
- [ ] Advanced analytics and reporting
- [ ] Team collaboration features
- [ ] Mobile app
- [ ] Chrome extension for lead capture

## Support & Documentation

For issues, feature requests, or documentation updates, please refer to the inline code comments and type definitions in the source files.

## License

MIT
