import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageBlockView } from "./ImageBlockView";

export type ImageBlockAttributes = {
  assetId: string;
  alt?: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attributes: ImageBlockAttributes) => ReturnType;
    };
  }
}

export const ImageBlockExtension = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-asset-id"),
      },
      alt: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-asset-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { assetId: rawAssetId, ...rest } = HTMLAttributes;
    const assetId = typeof rawAssetId === "string" ? rawAssetId : "";
    const alt =
      typeof HTMLAttributes.alt === "string" ? HTMLAttributes.alt : "";

    return [
      "img",
      mergeAttributes(rest, {
        "data-asset-id": assetId,
        alt,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },

  addCommands() {
    return {
      setImageBlock:
        (attributes: ImageBlockAttributes) =>
        ({ commands }) => {
          if (!attributes.assetId) {
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              assetId: attributes.assetId,
              alt: attributes.alt ?? "",
            },
          });
        },
    };
  },
});
