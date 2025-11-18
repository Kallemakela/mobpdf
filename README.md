# Mobile PDF Reflow Viewer

A mobile-first web application for viewing PDFs with reflow capabilities using mupdf.js.

## Features

- Mobile-first responsive design
- PDF reflow for better readability on small screens
- Dark mode support
- Structured text extraction with heading preservation
- Clean, readable text rendering

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

## Testing

```bash
npm test
```

## Deployment to GitHub Pages

### Option 1: GitHub Actions (Recommended)

1. Push your code to GitHub
2. Go to your repository Settings → Pages
3. Under "Source", select "GitHub Actions"
4. The workflow will automatically deploy on push to `main` branch

The base path is set to `/mobilepdf/` - if your repository name is different, update `vite.config.js`:

```javascript
base: process.env.GITHUB_PAGES ? '/your-repo-name/' : '/',
```

### Option 2: Manual Deployment

```bash
npm run deploy
```

This uses `gh-pages` to deploy the `dist` folder. Make sure to install it first:

```bash
npm install --save-dev gh-pages
```

## License

MIT License - see LICENSE file for details

