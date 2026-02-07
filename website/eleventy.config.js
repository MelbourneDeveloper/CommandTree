import techdoc from "eleventy-plugin-techdoc";

export default function(eleventyConfig) {
  eleventyConfig.addPlugin(techdoc, {
    site: {
      name: "CommandTree",
      url: "https://commandtree.dev",
      description: "One sidebar. Every command in your workspace.",
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

  const faviconLinks = [
    '  <link rel="icon" href="/favicon.ico" sizes="48x48">',
    '  <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">',
    '  <link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">',
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

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
