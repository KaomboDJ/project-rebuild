import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Part 1: "Correct Markdown rendering" + "Sanitize any rendered content".
// react-markdown never interprets raw HTML in the source unless rehype-raw
// is added (which we deliberately don't use), so this is already safe from
// script injection by construction - rehype-sanitize is applied on top as
// defense in depth against the AST itself, restricted to a conservative
// allowlist (defaultSchema minus anything that could carry a handler or an
// unexpected protocol).
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": (defaultSchema.attributes?.["*"] ?? []).filter((attr) => attr !== "className" && attr !== "class"),
  },
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose-coach">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
