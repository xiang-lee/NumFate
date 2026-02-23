# NumFate

NumFate is a fantasy-styled numerology web app. Users enter several numbers, then a Cloudflare Pages Function calls AI Builder chat completions and returns a polished destiny reading.

## Local Development

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run local dev server:

   ```bash
   npm run dev
   ```

## Environment Variables

- `AI_BUILDER_TOKEN`: AI Builder API token
- `AI_BUILDER_API_BASE`: API base URL
- `AI_BUILDER_MODEL`: model name (default `gemini-3-flash-preview`)

## Cloudflare Pages Settings

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `NumFate`
- Environment variables: set all three `AI_BUILDER_*` keys for Production and Preview
