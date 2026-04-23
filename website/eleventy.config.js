import techdoc from "eleventy-plugin-techdoc";

export default function(eleventyConfig) {
  eleventyConfig.addPlugin(techdoc, {
    site: {
      name: "CommandTree",
      url: "https://commandtree.dev",
      description: "One sidebar. Every command. AI-powered.",
      stylesheet: "/assets/css/styles.css",
    },
    features: {
      blog: true,
      docs: true,
      darkMode: true,
      i18n: false,
    },
  });

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/site.webmanifest": "site.webmanifest" });

  eleventyConfig.addFilter("sortByDateDesc", (items) => {
    if (!items) { return []; }
    return [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  const cardSnippet = `<article class="blog-post">
    <a href="{{ cardHref }}" class="post-title">{{ cardTitle }}</a>
    <div class="post-meta">{{ cardMeta | safe }}</div>
    {% if cardExcerpt %}<p class="post-excerpt">{{ cardExcerpt }}</p>{% endif %}
    {% if cardTags and cardTags | length > 0 %}
    <div class="post-tags">
      {% for t in cardTags %}{% if t != 'post' and t != 'posts' %}<a href="/blog/tags/{{ t | slugify }}/" class="tag">{{ t }}</a>{% endif %}{% endfor %}
    </div>
    {% endif %}
  </article>`;

const blogIndexOverride = `---
layout: layouts/base.njk
title: CommandTree Blog - VS Code Command Runner Guide Updates
description: CommandTree release notes and practical VS Code task runner guides for command discovery, AI summaries, mise tasks, monorepo workflows, and workspace automation.
permalink: /blog/
---
<div class="blog-container">
  <header class="blog-header">
    <h1>Blog</h1>
    <p class="blog-subtitle">Release notes and practical guides for VS Code task discovery.</p>
  </header>
  <nav class="blog-nav">
    <a href="/blog/tags/" class="blog-nav-link">Tags</a>
    {% if collections.categoryList | length > 0 %}<a href="/blog/categories/" class="blog-nav-link">Categories</a>{% endif %}
  </nav>
  <div class="post-list">
  {% for post in collections.posts | sortByDateDesc %}
    {% set cardHref = post.url %}
    {% set cardTitle = post.data.title %}
    {% set cardMeta %}<time datetime="{{ post.date | isoDate }}">{{ post.date | dateFormat }}</time>{% if post.data.author %} &middot; {{ post.data.author }}{% endif %}{% endset %}
    {% set cardExcerpt = post.data.excerpt or post.data.description %}
    {% set cardTags = post.data.tags %}
    ${cardSnippet}
  {% endfor %}
  </div>
</div>`;

const tagsIndexOverride = `---
layout: layouts/base.njk
title: CommandTree Blog Tags - VS Code Task Runner Topics
description: Browse CommandTree blog tags for VS Code command runner topics including AI summaries, task discovery, mise tasks, monorepos, and workspace automation.
permalink: /blog/tags/
---
<div class="blog-container">
  <header class="blog-header">
    <h1>Tags</h1>
    <p class="blog-subtitle">Browse CommandTree posts by VS Code task runner topic.</p>
  </header>
  <nav class="blog-nav">
    <a href="/blog/" class="blog-nav-link">All posts</a>
    {% if collections.categoryList | length > 0 %}<a href="/blog/categories/" class="blog-nav-link">Categories</a>{% endif %}
  </nav>
  <ul class="taxonomy-grid">
  {% for tag in collections.tagList %}
    {% set count = collections.postsByTag[tag] | length %}
    <li><a href="/blog/tags/{{ tag | slugify }}/" class="taxonomy-card">
      <span class="taxonomy-name">{{ tag | capitalize }}</span>
      <span class="taxonomy-count">{{ count }} post{% if count != 1 %}s{% endif %}</span>
    </a></li>
  {% endfor %}
  </ul>
</div>`;

const categoriesIndexOverride = `---
layout: layouts/base.njk
title: CommandTree Blog Categories - VS Code Task Runner Guides
description: Browse CommandTree blog categories for VS Code command runner guides covering task discovery, AI summaries, mise tasks, and workspace automation.
permalink: /blog/categories/
---
<div class="blog-container">
  <header class="blog-header">
    <h1>Categories</h1>
    <p class="blog-subtitle">Browse CommandTree posts by guide category.</p>
  </header>
  <nav class="blog-nav">
    <a href="/blog/" class="blog-nav-link">All posts</a>
    <a href="/blog/tags/" class="blog-nav-link">Tags</a>
  </nav>
  <ul class="taxonomy-grid">
  {% for category in collections.categoryList %}
    {% set count = collections.postsByCategory[category] | length %}
    <li><a href="/blog/categories/{{ category | slugify }}/" class="taxonomy-card">
      <span class="taxonomy-name">{{ category | capitalize }}</span>
      <span class="taxonomy-count">{{ count }} post{% if count != 1 %}s{% endif %}</span>
    </a></li>
  {% endfor %}
  </ul>
  {% if (collections.categoryList | length) == 0 %}
  <p style="text-align:center;color:var(--color-muted);">No categories yet.</p>
  {% endif %}
</div>`;

  const tagsPagesOverride = `---
pagination:
  data: collections.tagList
  size: 1
  alias: tag
permalink: /blog/tags/{{ tag | slugify }}/
layout: layouts/base.njk
eleventyComputed:
  title: "{{ tag | capitalize }} Articles - CommandTree VS Code Task Runner Blog"
  description: "CommandTree articles tagged with {{ tag | capitalize }} for VS Code developers who need task discovery, command running, AI summaries, and workspace automation tips."
---
<div class="blog-container">
  <header class="blog-header">
    <h1>Posts tagged "{{ tag | capitalize }}"</h1>
    <p><a href="/blog/tags/">&larr; All tags</a></p>
  </header>
  <div class="post-list">
  {% for post in collections.postsByTag[tag] | sortByDateDesc %}
    {% set cardHref = post.url %}
    {% set cardTitle = post.data.title %}
    {% set cardMeta %}<time datetime="{{ post.date | isoDate }}">{{ post.date | dateFormat }}</time>{% if post.data.author %} &middot; {{ post.data.author }}{% endif %}{% endset %}
    {% set cardExcerpt = post.data.excerpt or post.data.description %}
    {% set cardTags = post.data.tags %}
    ${cardSnippet}
  {% endfor %}
  </div>
</div>`;

  const categoriesPagesOverride = `---
pagination:
  data: collections.categoryList
  size: 1
  alias: category
permalink: /blog/categories/{{ category | slugify }}/
layout: layouts/base.njk
eleventyComputed:
  title: "{{ category | capitalize }} Guides - CommandTree VS Code Task Runner Blog"
  description: "CommandTree posts in the {{ category }} category for VS Code developers covering command runners, task discovery, AI summaries, and workspace automation."
---
<div class="blog-container">
  <header class="blog-header">
    <h1>{{ category | capitalize }}</h1>
    <p><a href="/blog/categories/">&larr; All categories</a></p>
  </header>
  <div class="post-list">
  {% for post in collections.postsByCategory[category] | sortByDateDesc %}
    {% set cardHref = post.url %}
    {% set cardTitle = post.data.title %}
    {% set cardMeta %}<time datetime="{{ post.date | isoDate }}">{{ post.date | dateFormat }}</time>{% if post.data.author %} &middot; {{ post.data.author }}{% endif %}{% endset %}
    {% set cardExcerpt = post.data.excerpt or post.data.description %}
    {% set cardTags = post.data.tags %}
    ${cardSnippet}
  {% endfor %}
  </div>
</div>`;

  const sitemapOverride = `---json
{
  "permalink": "sitemap.xml",
  "eleventyExcludeFromCollections": true
}
---
<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  {%- for page in collections.all %}
  {%- set isTagPage = page.url.startsWith('/blog/tags/') %}
  {%- set isCategoryPage = page.url.startsWith('/blog/categories/') %}
  {%- if not page.data.eleventyExcludeFromCollections and not isTagPage and not isCategoryPage %}
  <url>
    <loc>{{ site.url }}{{ page.url }}</loc>
    <lastmod>{{ page.date | isoDate }}</lastmod>
    {%- if page.url == "/" or page.url == "/index.html" %}
    <priority>1.0</priority>
    <changefreq>weekly</changefreq>
    {%- elif "/docs/" in page.url %}
    <priority>0.8</priority>
    <changefreq>monthly</changefreq>
    {%- elif "/blog/" in page.url %}
    <priority>0.7</priority>
    <changefreq>monthly</changefreq>
    {%- else %}
    <priority>0.5</priority>
    <changefreq>monthly</changefreq>
    {%- endif %}
  </url>
  {%- endif %}
  {%- endfor %}
</urlset>`;

  const blogOverrides = {
    "blog/index.njk": blogIndexOverride,
    "blog/tags.njk": tagsIndexOverride,
    "blog/categories.njk": categoriesIndexOverride,
    "blog/tags-pages.njk": tagsPagesOverride,
    "blog/categories-pages.njk": categoriesPagesOverride,
    "sitemap.njk": sitemapOverride,
  };
  // Register as an inline plugin so it runs AFTER the techdoc plugin
  // (plugins are processed in addPlugin order, after the user config callback).
  // This lets us delete the techdoc-registered virtual templates and replace
  // them with our customised versions.
  eleventyConfig.addPlugin(function blogOverridesPlugin(ec) {
    for (const [path, content] of Object.entries(blogOverrides)) {
      delete ec.virtualTemplates[path];
      ec.addTemplate(path, content);
    }
  });

  const faviconLinks = [
    '  <link rel="icon" href="/favicon.ico" sizes="48x48">',
    '  <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">',
    '  <link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">',
    '  <link rel="manifest" href="/site.webmanifest">',
  ].join("\n");

  const isIconLink = (line) => {
    const t = line.trim();
    if (!t.startsWith("<link")) return false;
    return t.includes('rel="icon"')
      || t.includes("rel='icon'")
      || t.includes('rel="shortcut icon"')
      || t.includes("rel='shortcut icon'")
      || t.includes('rel="apple-touch-icon"')
      || t.includes("rel='apple-touch-icon'");
  };

  eleventyConfig.addTransform("favicon", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    const cleaned = content.split("\n").filter(l => !isIconLink(l)).join("\n");
    return cleaned.replace("</head>", faviconLinks + "\n</head>");
  });

  eleventyConfig.addTransform("copyright", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    const year = new Date().getFullYear();
    const original = `&copy; ${year} CommandTree`;
    const replacement = `&copy; ${year} <a href="https://www.nimblesite.co">Nimblesite Pty Ltd</a>`;
    return content.replace(original, replacement);
  });

  const blogHeroDefault = [
    '<div class="blog-hero-banner">',
    '  <div class="blog-hero-glow"></div>',
    '  <img src="/assets/images/logo.png" alt="CommandTree logo" class="blog-hero-logo">',
    '  <div class="blog-hero-branches">',
    '    <span class="branch branch-1"></span>',
    '    <span class="branch branch-2"></span>',
    '    <span class="branch branch-3"></span>',
    '  </div>',
    '</div>',
  ].join("\n");

  const blogHeroImages = {
    "/blog/ai-summaries-hover/": '/assets/images/ai-summary-banner.png',
  };

  const blogHeroLogos = {
    "/blog/mise-tasks-vscode/": {
      src: '/assets/images/mise-logo-light.svg',
      alt: 'mise-en-place logo',
    },
  };

  const makeBanner = (href) => {
    const logo = blogHeroLogos[href];
    if (logo) {
      return '<div class="blog-hero-banner">\n'
        + '  <div class="blog-hero-glow"></div>\n'
        + `  <img src="${logo.src}" alt="${logo.alt}" class="blog-hero-logo blog-hero-logo--wide">\n`
        + '</div>';
    }
    const img = blogHeroImages[href];
    if (!img) { return blogHeroDefault; }
    return '<div class="blog-hero-banner">\n'
      + `  <img src="${img}" alt="Blog post banner" class="blog-hero-screenshot">\n`
      + '</div>';
  };

  const ARTICLE_TAG = '<article class="blog-post">';

  const addBannersToCards = (content) => {
    const parts = content.split(ARTICLE_TAG);
    return parts.map((part, i) => {
      if (i === 0) { return part; }
      const hrefStart = part.indexOf('href="/blog/');
      const hrefEnd = hrefStart >= 0 ? part.indexOf('"', hrefStart + 6) : -1;
      const href = hrefStart >= 0 && hrefEnd >= 0
        ? part.substring(hrefStart + 6, hrefEnd)
        : "";
      return ARTICLE_TAG + "\n" + makeBanner(href) + part;
    }).join("");
  };

  // Returns true for pages that list ACTUAL BLOG POSTS (which deserve hero
  // banners on each card). The /blog/tags/ and /blog/categories/ index pages
  // list tags/categories — not posts — so they must NOT get banners.
  const isPostListingUrl = (url) => {
    if (!url) { return false; }
    if (url === "/blog/") { return true; }
    const prefixes = ["/blog/tags/", "/blog/categories/"];
    for (const prefix of prefixes) {
      if (!url.startsWith(prefix)) { continue; }
      if (!url.endsWith("/")) { continue; }
      const slug = url.slice(prefix.length, -1);
      if (slug.length === 0) { continue; }
      if (slug.includes("/")) { continue; }
      return true;
    }
    return false;
  };

  const isTaxonomyUrl = (url) => {
    if (!url) { return false; }
    return url.startsWith("/blog/tags/") || url.startsWith("/blog/categories/");
  };

  const findJsonLdBlock = (content) => {
    const open = '<script type="application/ld+json">';
    const close = "</script>";
    const openStart = content.indexOf(open);
    if (openStart < 0) { return null; }
    const jsonStart = openStart + open.length;
    const closeStart = content.indexOf(close, jsonStart);
    if (closeStart < 0) { return null; }
    return { jsonStart, closeStart };
  };

  const asCollectionPage = (item) => {
    if (item["@type"] !== "BlogPosting") { return item; }
    const collectionPage = { ...item, "@type": "CollectionPage" };
    delete collectionPage.author;
    delete collectionPage.datePublished;
    return collectionPage;
  };

  const renderJsonLd = (data) => JSON.stringify(data, null, 2).split("\n").join("\n  ");

  const rewriteTaxonomyJsonLd = (content) => {
    const block = findJsonLdBlock(content);
    if (!block) { return content; }
    try {
      const data = JSON.parse(content.slice(block.jsonStart, block.closeStart).trim());
      if (Array.isArray(data["@graph"])) {
        data["@graph"] = data["@graph"].map(asCollectionPage);
      }
      return content.slice(0, block.jsonStart) + "\n  " + renderJsonLd(data) + "\n  " + content.slice(block.closeStart);
    } catch {
      return content;
    }
  };

  const updateTaxonomySeo = (content) => rewriteTaxonomyJsonLd(content
    .replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex, follow">')
    .replace('<meta property="og:type" content="article">', '<meta property="og:type" content="website">'));

  eleventyConfig.addTransform("blogHero", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    if (!this.page.url?.startsWith("/blog/")) {
      return content;
    }
    if (isPostListingUrl(this.page.url)) {
      return addBannersToCards(content);
    }
    if (content.includes('blog-hero-banner')) {
      return content;
    }
    return content.replace(
      '<div class="blog-post-content">',
      '<div class="blog-post-content">\n' + makeBanner(this.page.url)
    );
  });

  eleventyConfig.addTransform("taxonomySeo", function(content) {
    if (!this.page.outputPath?.endsWith(".html") || !isTaxonomyUrl(this.page.url)) {
      return content;
    }
    return updateTaxonomySeo(content);
  });

  eleventyConfig.addTransform("llmsTxt", function(content) {
    if (!this.page.outputPath?.endsWith("llms.txt")) {
      return content;
    }
    const apiLine = "- API Reference: https://commandtree.dev/api/";
    const extras = [
      "- GitHub: https://github.com/Nimblesite/CommandTree",
      "- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=nimblesite.commandtree",
    ].join("\n");
    return content.replace(apiLine, extras);
  });

  eleventyConfig.addTransform("robotsTxt", function(content) {
    if (!this.page.outputPath?.endsWith("robots.txt")) {
      return content;
    }
    return content
      .replace("Disallow: /assets/", "Allow: /assets/images/\nDisallow: /assets/js/\nDisallow: /assets/css/");
  });

  eleventyConfig.addTransform("googleAnalytics", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    const gaSnippet = [
      '  <!-- Google tag (gtag.js) -->',
      '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-F1RPEMKELY"></script>',
      '  <script>',
      '    window.dataLayer = window.dataLayer || [];',
      '    function gtag(){dataLayer.push(arguments);}',
      "    gtag('js', new Date());",
      "    gtag('config', 'G-F1RPEMKELY');",
      '  </script>',
      '',
    ].join("\n");
    return content.replace("</head>", gaSnippet + "</head>");
  });

  eleventyConfig.addTransform("customScripts", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    const customScript = '\n  <script src="/assets/js/custom.js"></script>\n';
    return content.replace("</body>", customScript + "</body>");
  });

  eleventyConfig.addTransform("ogImageAlt", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    const altText = "CommandTree - One sidebar, every command in VS Code. Auto-discover 22 command types with AI-powered summaries.";
    const ogImageAltTag = `  <meta property="og:image:alt" content="${altText}">`;
    const twitterImageAltTag = `  <meta name="twitter:image:alt" content="${altText}">`;
    const ogImageHeightTag = 'og:image:height';
    const insertionPoint = content.indexOf(ogImageHeightTag);
    if (insertionPoint < 0) { return content; }
    const lineEnd = content.indexOf("\n", insertionPoint);
    if (lineEnd < 0) { return content; }
    const withOgAlt = content.slice(0, lineEnd + 1) + ogImageAltTag + "\n" + content.slice(lineEnd + 1);
    const twitterImageTag = 'twitter:image" content=';
    const twitterInsert = withOgAlt.indexOf(twitterImageTag);
    if (twitterInsert < 0) { return withOgAlt; }
    const twitterLineEnd = withOgAlt.indexOf("\n", twitterInsert);
    if (twitterLineEnd < 0) { return withOgAlt; }
    return withOgAlt.slice(0, twitterLineEnd + 1) + twitterImageAltTag + "\n" + withOgAlt.slice(twitterLineEnd + 1);
  });

  eleventyConfig.addTransform("articleMeta", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    if (!this.page.url?.startsWith("/blog/") || this.page.url === "/blog/") {
      return content;
    }
    const date = this.page.date;
    if (!date) { return content; }
    const isoDate = new Date(date).toISOString();
    const articleTags = [
      `  <meta property="article:published_time" content="${isoDate}">`,
      '  <meta property="article:author" content="Christian Findlay">',
    ].join("\n");
    const twitterCardTag = '<meta name="twitter:card"';
    const insertionPoint = content.indexOf(twitterCardTag);
    if (insertionPoint < 0) { return content; }
    const lineStart = content.lastIndexOf("\n", insertionPoint);
    return content.slice(0, lineStart + 1) + articleTags + "\n" + content.slice(lineStart + 1);
  });

  const stripTags = (html) => {
    let result = "";
    let inTag = false;
    for (const ch of html) {
      if (ch === "<") { inTag = true; continue; }
      if (ch === ">") { inTag = false; continue; }
      if (!inTag) { result += ch; }
    }
    return result.trim();
  };

  eleventyConfig.addTransform("faqSchema", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    if (!content.includes("?</a></h3>")) {
      return content;
    }
    const faqPairs = [];
    const h3Close = "</h3>";
    let searchFrom = 0;
    while (true) {
      const h3Start = content.indexOf("<h3 ", searchFrom);
      if (h3Start < 0) { break; }
      const h3End = content.indexOf(h3Close, h3Start);
      if (h3End < 0) { break; }
      const h3Content = content.slice(h3Start, h3End + h3Close.length);
      const question = stripTags(h3Content);
      if (!question.endsWith("?")) {
        searchFrom = h3End + h3Close.length;
        continue;
      }
      const pStart = content.indexOf("<p>", h3End);
      if (pStart < 0) { break; }
      const nextH = content.indexOf("<h", pStart + 3);
      const answerEnd = nextH >= 0 ? nextH : content.indexOf("</main>", pStart);
      if (answerEnd < 0) { break; }
      const answerBlock = content.slice(pStart, answerEnd).trim();
      const firstP = answerBlock.indexOf("</p>");
      const answerHtml = firstP >= 0 ? answerBlock.slice(3, firstP) : answerBlock.slice(3);
      const answerText = stripTags(answerHtml).trim();
      if (answerText.length > 0) {
        faqPairs.push({ question, answer: answerText });
      }
      searchFrom = h3End + h3Close.length;
    }
    if (faqPairs.length === 0) { return content; }
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqPairs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer,
        },
      })),
    };
    const scriptTag = `\n  <script type="application/ld+json">\n  ${JSON.stringify(faqSchema, null, 2).split("\n").join("\n  ")}\n  </script>`;
    return content.replace("</head>", scriptTag + "\n</head>");
  });

  eleventyConfig.addTransform("softwareAppSchema", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    if (this.page.url !== "/") {
      return content;
    }
    const softwareSchema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "CommandTree",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Windows, macOS, Linux",
      "description": "VS Code extension that auto-discovers 22 command types — shell scripts, npm, Make, Gradle, Cargo, Docker Compose, .NET, and more — in one sidebar with AI-powered summaries.",
      "url": "https://commandtree.dev",
      "downloadUrl": "https://marketplace.visualstudio.com/items?itemName=nimblesite.commandtree",
      "softwareRequirements": "Visual Studio Code",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "author": {
        "@type": "Organization",
        "name": "Nimblesite Pty Ltd",
        "url": "https://www.nimblesite.co",
      },
    };
    const scriptTag = `\n  <script type="application/ld+json">\n  ${JSON.stringify(softwareSchema, null, 2).split("\n").join("\n  ")}\n  </script>`;
    return content.replace("</head>", scriptTag + "\n</head>");
  });

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
