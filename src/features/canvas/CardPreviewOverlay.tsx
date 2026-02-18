import {
  Fragment,
  memo,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { TextNode, ViewportState } from "../../types/canvas";
import {
  markdownToTiptapDoc,
  type TiptapJSONContent,
  type TiptapMark,
} from "./markdownCodec";

type CardPreviewOverlayProps = {
  container: HTMLElement;
  nodes: Record<string, TextNode>;
  viewport: ViewportState;
  editingNodeId: string | null;
};

type CardPreviewNodeProps = {
  node: TextNode;
  viewport: ViewportState;
};

function extractText(node: TiptapJSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  return (node.content ?? []).map((child) => extractText(child)).join("");
}

function wrapWithMark(
  mark: TiptapMark,
  content: ReactNode,
  key: string,
): ReactNode {
  if (mark.type === "bold" || mark.type === "strong") {
    return <strong key={key}>{content}</strong>;
  }

  if (mark.type === "italic" || mark.type === "em") {
    return <em key={key}>{content}</em>;
  }

  if (mark.type === "code") {
    return <code key={key}>{content}</code>;
  }

  if (mark.type === "link") {
    const href =
      typeof mark.attrs?.href === "string" && mark.attrs.href.length > 0
        ? mark.attrs.href
        : undefined;

    return (
      <a key={key} href={href}>
        {content}
      </a>
    );
  }

  return <Fragment key={key}>{content}</Fragment>;
}

function renderInlineNode(node: TiptapJSONContent, key: string): ReactNode {
  if (node.type === "hardBreak") {
    return <br key={key} />;
  }

  if (node.type === "text") {
    const rawText = node.text ?? "";
    if (rawText.length === 0) {
      return null;
    }

    const rendered = (node.marks ?? []).reduceRight<ReactNode>(
      (content, mark, index) =>
        wrapWithMark(mark, content, `${key}-mark-${index}`),
      rawText,
    );

    return <Fragment key={key}>{rendered}</Fragment>;
  }

  return <Fragment key={key}>{renderInlineNodes(node.content, key)}</Fragment>;
}

function renderInlineNodes(
  nodes: TiptapJSONContent[] | undefined,
  keyPrefix: string,
): ReactNode {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return nodes.map((node, index) =>
    renderInlineNode(node, `${keyPrefix}-inline-${index}`),
  );
}

function renderHeading(node: TiptapJSONContent, key: string): ReactNode {
  const rawLevel = node.attrs?.level;
  const level =
    typeof rawLevel === "number" ? Math.max(1, Math.min(6, rawLevel)) : 1;
  const content = renderInlineNodes(node.content, key);

  if (level === 1) {
    return <h1 key={key}>{content}</h1>;
  }

  if (level === 2) {
    return <h2 key={key}>{content}</h2>;
  }

  if (level === 3) {
    return <h3 key={key}>{content}</h3>;
  }

  if (level === 4) {
    return <h4 key={key}>{content}</h4>;
  }

  if (level === 5) {
    return <h5 key={key}>{content}</h5>;
  }

  return <h6 key={key}>{content}</h6>;
}

function renderBlockNode(node: TiptapJSONContent, key: string): ReactNode {
  if (node.type === "paragraph") {
    return <p key={key}>{renderInlineNodes(node.content, key)}</p>;
  }

  if (node.type === "heading") {
    return renderHeading(node, key);
  }

  if (node.type === "bulletList") {
    return <ul key={key}>{renderBlockNodes(node.content, key)}</ul>;
  }

  if (node.type === "orderedList") {
    const rawStart = node.attrs?.start;
    const start = typeof rawStart === "number" ? rawStart : undefined;
    return (
      <ol key={key} start={start}>
        {renderBlockNodes(node.content, key)}
      </ol>
    );
  }

  if (node.type === "listItem") {
    return <li key={key}>{renderBlockNodes(node.content, key)}</li>;
  }

  if (node.type === "codeBlock") {
    return (
      <pre key={key}>
        <code>{extractText(node)}</code>
      </pre>
    );
  }

  if (node.type === "blockquote") {
    return (
      <blockquote key={key}>{renderBlockNodes(node.content, key)}</blockquote>
    );
  }

  if (node.type === "horizontalRule") {
    return <hr key={key} />;
  }

  const fallbackText = extractText(node);
  if (fallbackText.length === 0) {
    return null;
  }

  return <p key={key}>{fallbackText}</p>;
}

function renderBlockNodes(
  nodes: TiptapJSONContent[] | undefined,
  keyPrefix: string,
): ReactNode {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return nodes.map((node, index) =>
    renderBlockNode(node, `${keyPrefix}-block-${index}`),
  );
}

const CardPreviewNode = memo(function CardPreviewNode({
  node,
  viewport,
}: CardPreviewNodeProps) {
  const previewBlocks = useMemo<TiptapJSONContent[]>(() => {
    try {
      const doc = markdownToTiptapDoc(node.content_markdown);
      return doc.content ?? [];
    } catch (error) {
      console.warn(
        "[CardPreviewOverlay] Failed to parse markdown preview. Falling back to plain paragraph.",
        error,
      );
      return [
        {
          type: "paragraph",
          content:
            node.content_markdown.length > 0
              ? [{ type: "text", text: node.content_markdown }]
              : undefined,
        },
      ];
    }
  }, [node.content_markdown]);

  const cardStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x * viewport.zoom + viewport.x}px`,
      top: `${node.y * viewport.zoom + viewport.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      transform: `scale(${viewport.zoom})`,
      transformOrigin: "top left",
    }),
    [
      node.height,
      node.width,
      node.x,
      node.y,
      viewport.x,
      viewport.y,
      viewport.zoom,
    ],
  );

  return (
    <div
      style={cardStyle}
      className="absolute overflow-hidden rounded-[10px] px-4 py-4"
    >
      <div className="card-preview__content h-full w-full">
        {renderBlockNodes(previewBlocks, node.id)}
      </div>
    </div>
  );
});

export function CardPreviewOverlay({
  container,
  nodes,
  viewport,
  editingNodeId,
}: CardPreviewOverlayProps) {
  const previewNodes = useMemo(() => {
    return Object.entries(nodes)
      .filter(([nodeId]) => nodeId !== editingNodeId)
      .map(([, node]) => node);
  }, [editingNodeId, nodes]);

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-20"
      role="presentation"
    >
      {previewNodes.map((node) => (
        <CardPreviewNode key={node.id} node={node} viewport={viewport} />
      ))}
    </div>,
    container,
  );
}
