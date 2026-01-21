# SustainabilitySignals

ESG market intelligence platform for tracking sustainability signals, analyzing company profiles, and making informed investment decisions.

🌐 **Live Demo**: [sustainabilitysignals.com](https://sustainabilitysignals.com)

## Features

- **Dashboard**: Real-time ESG momentum tracking, sector heatmaps, and signal alerts
- **Company Profiles**: Deep-dive ESG analysis with score breakdowns and risk factors
- **AI Insights**: GPT-powered explanations of ESG data (mock mode available)
- **Responsive Design**: Mobile-first, professional "Bloomberg-lite" interface

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **Charts**: ApexCharts
- **Routing**: React Router 7
- **SEO**: React Helmet Async

## Project Structure

```
src/
├── components/
│   ├── company/       # Company page components (charts, gauges)
│   ├── dashboard/     # Dashboard components (KPIs, tables, heatmaps)
│   ├── layout/        # Header, Footer, Layout wrapper
│   └── ui/            # Reusable UI components (Button, Card, Modal)
├── data/
│   └── mockData.ts    # Mock data for demo mode
├── pages/
│   ├── Landing.tsx    # Homepage
│   ├── Dashboard.tsx  # Main dashboard
│   ├── Company.tsx    # Company profile page
│   ├── About.tsx      # About page
│   └── Methodology.tsx # Methodology page
├── providers/
│   ├── refinitiv.ts   # Refinitiv data provider (mock + real)
│   ├── openai.ts      # OpenAI provider (mock + real)
│   └── index.ts       # Provider exports
├── types/
│   └── index.ts       # TypeScript interfaces
└── App.tsx            # Main app with routing
```

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/sustainability-signals.git
cd sustainability-signals

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_REFINITIV_API_KEY` | No | Refinitiv API key for real data |
| `VITE_OPENAI_API_KEY` | No | OpenAI API key for GPT features |
| `VITE_OPENAI_MODEL` | No | OpenAI model (default: gpt-4-turbo-preview) |

**Note**: The app runs fully with mock data when API keys are not configured.

## Deployment

### Cloudflare Pages (Recommended)

1. Push to GitHub/GitLab
2. Connect repository to Cloudflare Pages
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variables in dashboard

### Vercel

```bash
npm i -g vercel
vercel
```

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### Manual Deployment

```bash
npm run build
# Upload contents of `dist/` to any static host
```

## Replacing Mock Providers with Real APIs

### Refinitiv Integration

Edit `src/providers/refinitiv.ts`:

1. Set `VITE_REFINITIV_API_KEY` in your environment
2. Implement the TODO sections in each function
3. The app automatically switches from mock to real data when API key is present

```typescript
// Example: fetchCompanySnapshot implementation
export async function fetchCompanySnapshot(ticker: string) {
  if (!REFINITIV_API_KEY) {
    // Returns mock data
  }
  
  // TODO: Implement real API call
  const response = await fetch(`https://api.refinitiv.com/data/company/${ticker}`, {
    headers: { 'Authorization': `Bearer ${REFINITIV_API_KEY}` }
  });
  return transformRefinitivResponse(await response.json());
}
```

### OpenAI Integration

Edit `src/providers/openai.ts`:

1. Set `VITE_OPENAI_API_KEY` in your environment
2. Implement the TODO sections
3. Consider adding response caching to reduce API costs

```typescript
// Example: summarizeSignal implementation
export async function summarizeSignal(signal: Signal) {
  if (!OPENAI_API_KEY) {
    // Returns mock data
  }
  
  // TODO: Implement real API call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are an ESG analyst...' },
        { role: 'user', content: JSON.stringify(signal) }
      ]
    })
  });
  return parseGPTResponse(await response.json());
}
```

## Type Definitions

All data interfaces are defined in `src/types/index.ts`:

- `Signal` - Market/ESG signal events
- `CompanySnapshot` - Company ESG profile
- `MomentumPoint` - Time series data point
- `SectorScore` - Sector-level ESG metrics
- `KPIData` - Dashboard KPI cards
- `GPTExplanation` - AI analysis response

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## License

MIT

## Contact

- Email: gogunikhil@gmail.com
- Website: [sustainabilitysignals.com](https://sustainabilitysignals.com)
