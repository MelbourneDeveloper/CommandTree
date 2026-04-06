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

  const makeBanner = (href) => {
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

  eleventyConfig.addTransform("blogHero", function(content) {
    if (!this.page.outputPath?.endsWith(".html")) {
      return content;
    }
    if (!this.page.url?.startsWith("/blog/")) {
      return content;
    }
    if (this.page.url === "/blog/") {
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

  eleventyConfig.addTransform("llmsTxt", function(content) {
    if (!this.page.outputPath?.endsWith("llms.txt")) {
      return content;
    }
    const apiLine = "- API Reference: https://commandtree.dev/api/";
    const extras = [
      "- GitHub: https://github.com/MelbourneDeveloper/CommandTree",
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
