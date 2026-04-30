import MarkdownIt from "markdown-it";
import DOMPurify from "isomorphic-dompurify";

const SANITIZE_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "code",
    "pre",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "a",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ALLOWED_URI_REGEXP: /^(https?:\/\/|mailto:)/i,
};

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex("href");
  const href = hrefIndex >= 0 ? token.attrs![hrefIndex][1] : "";
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    const setAttr = (name: string, value: string) => {
      const i = token.attrIndex(name);
      if (i < 0) token.attrPush([name, value]);
      else token.attrs![i][1] = value;
    };
    setAttr("target", "_blank");
    setAttr("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderCardMarkdown(source: string | null | undefined): string {
  const html = md.render(source ?? "");
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
