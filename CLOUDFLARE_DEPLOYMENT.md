# Cloudflare Pages Deployment Guide

## Prerequisites
- A Cloudflare account
- Git repository connected to Cloudflare Pages
- Node.js project built with Vite

## Deployment Configuration

### Framework Preset
- **Framework preset**: `Vite`

### Build Configuration

#### Build Command
```bash
npm run build
```

**IMPORTANT**: Do NOT use `npx vitepress build`. This is a Vite + React app, not VitePress.

If Cloudflare auto-detects the wrong command, manually override it in the dashboard.

#### Build Output Directory
```
dist
```

#### Root Directory (Optional)
```
/
```

### Environment Variables

No environment variables are required for the basic deployment. If you need to add any in the future, configure them in:
**Cloudflare Dashboard** → **Pages** → **Your Project** → **Settings** → **Environment Variables**

Example environment variables you might add later:
```
NODE_VERSION=20.11.0
```

### Node.js Version

Cloudflare Pages uses Node.js 18 by default. To specify a different version, add an environment variable:

```
NODE_VERSION=20.11.0
```

Or create a `.nvmrc` file in your project root:
```
20.11.0
```

### Compatibility Flags

For Cloudflare Pages, you typically don't need compatibility flags for a Vite/React static site. However, if you encounter issues, you can set:

**In Cloudflare Dashboard** → **Pages** → **Your Project** → **Settings** → **Functions** → **Compatibility flags**

Common flags (if needed):
- `nodejs_compat` - For Node.js compatibility
- `streams_enable_constructors` - For streams support

## Deployment Steps

### Option 1: Direct Git Integration (Recommended)

1. **Connect Repository**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**
   - Select your Git provider (GitHub, GitLab, or Bitbucket)
   - Authorize Cloudflare to access your repositories
   - Select the `Sustainability-Signals` repository

2. **Configure Build Settings**
   - **Project name**: `sustainability-signals` (or your preferred name)
   - **Production branch**: `main` (or your default branch)
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

3. **Environment Variables** (Optional)
   - Click **Add variable** if you need any
   - Example: `NODE_VERSION` = `20.11.0`

4. **Deploy**
   - Click **Save and Deploy**
   - Wait for the build to complete (usually 2-5 minutes)
   - Your site will be available at: `https://sustainability-signals.pages.dev`

### Option 2: Direct Upload (Manual)

1. **Build Locally**
   ```bash
   npm install
   npm run build
   ```

2. **Upload via Wrangler CLI**
   ```bash
   # Install Wrangler
   npm install -g wrangler

   # Login to Cloudflare
   wrangler login

   # Deploy
   wrangler pages deploy dist --project-name=sustainability-signals
   ```

## Custom Domain Setup

1. **Add Custom Domain**
   - Go to your project in Cloudflare Dashboard
   - Navigate to **Custom domains** tab
   - Click **Set up a custom domain**
   - Enter your domain (e.g., `sustainabilitysignals.com`)
   - Follow DNS configuration instructions

2. **DNS Configuration**
   - Add a CNAME record pointing to your Pages URL
   - Or use Cloudflare nameservers for automatic configuration

## Automatic Deployments

Once connected via Git:
- **Production deployments**: Automatically triggered on commits to your main branch
- **Preview deployments**: Automatically created for pull requests
- Each preview gets a unique URL for testing

## Build Optimization

### Recommended `package.json` Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### Vite Configuration for Cloudflare Pages

Your `vite.config.ts` should already be configured correctly:
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/', // Use relative paths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Set to true for debugging
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000
  }
})
```

## Troubleshooting

### Wrong Build Command Detected
**Problem**: Cloudflare runs `npx vitepress build` instead of `npm run build`

**Solution**: 
1. Go to **Settings** → **Builds & deployments** in your Cloudflare Pages project
2. Override the build command to: `npm run build`
3. Verify output directory is: `dist`
4. Retry the deployment

The `wrangler.toml` file in your project should prevent this, but if it persists, manually override in dashboard.

### Build Fails with "Module not found"
- Ensure all dependencies are in `dependencies`, not `devDependencies`
- Run `npm install` locally to verify

### Build Timeout
- Optimize build process
- Reduce bundle size
- Consider code splitting

### Routing Issues (404 on refresh)
Create a `public/_redirects` file:
```
/* /index.html 200
```

**Note**: Ensure there are no extra spaces in the redirect rule, or it may cause infinite loop warnings.

For Cloudflare Pages specifically, you can also use the _routes.json approach if _redirects doesn't work:

Create `public/_routes.json`:
```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
```

Or create `public/_headers` for better performance:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

### TypeScript Errors During Build
Ensure `tsconfig.json` is properly configured and all types are installed.

## Performance Optimization

### Enable Cloudflare Features
- **Auto Minify**: HTML, CSS, JavaScript (in Dashboard → Speed)
- **Brotli Compression**: Automatic
- **HTTP/3**: Enabled by default
- **CDN**: Global distribution included

### Build Optimizations
```bash
# Analyze bundle size
npm run build -- --mode production

# Check for large dependencies
npx vite-bundle-visualizer
```

## Monitoring & Analytics

Enable in Cloudflare Dashboard:
- **Web Analytics**: Free, privacy-friendly analytics
- **Pages Analytics**: Build and deployment metrics
- **Real User Monitoring**: Performance insights

## Security Headers

Add to `public/_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Cost

Cloudflare Pages is **FREE** for:
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- 1 concurrent build
- Built-in DDoS protection
- Global CDN

## Support & Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Vite Documentation](https://vitejs.dev/)
- [Community Support](https://community.cloudflare.com/)

## Quick Deployment Checklist

- [ ] Repository pushed to GitHub/GitLab/Bitbucket
- [ ] Connected repository to Cloudflare Pages
- [ ] Set framework preset to "Vite"
- [ ] Verified build command: `npm run build`
- [ ] Verified output directory: `dist`
- [ ] Added NODE_VERSION environment variable (if needed)
- [ ] Configured custom domain (optional)
- [ ] Added _redirects file for SPA routing
- [ ] Deployed successfully
- [ ] Tested production URL

---

**Your Sustainability Signals dashboard will be live at:**
`https://[your-project-name].pages.dev`

Happy deploying! 🚀🌱
