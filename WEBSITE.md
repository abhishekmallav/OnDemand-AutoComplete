# Website

The landing page is a buildless static site. It uses `index.html`, `website.css`, `website.js`, the SVG in `icons/`, and the images in `screenshots/`. All asset URLs are relative so the site works under a GitHub Pages repository path. No installation or build step is required.

## Publish on GitHub Pages

1. Push these files to your GitHub repository.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the branch containing the website and **/ (root)**, then save.

The `.nojekyll` file allows GitHub Pages to serve the static files directly.

## Add the Chrome Web Store link

In `index.html`, find the `.store-placeholder` block. Replace its disabled `<span>` with an anchor to the real listing, for example:

```html
<a class="button primary" href="YOUR_CHROME_WEB_STORE_URL" target="_blank" rel="noopener noreferrer">Add to Chrome ↗</a>
```

Remove the “store link will be added” paragraph when the listing is ready.

## Preview

Open `index.html` in a browser. The site uses local assets and system fonts, so it also works without an internet connection. JavaScript powers the illustrative hero demo and screenshot selector. Without JavaScript, all five screenshots remain visible.
