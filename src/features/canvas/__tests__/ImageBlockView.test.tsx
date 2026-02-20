import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeViewProps } from "@tiptap/react";
import { ImageBlockView } from "../images/ImageBlockView";
import { acquireImage, releaseImage } from "../images/imageUrlCache";

vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("../images/imageUrlCache", () => ({
  acquireImage: vi.fn(),
  releaseImage: vi.fn(),
}));

const mockAcquireImage = vi.mocked(acquireImage);
const mockReleaseImage = vi.mocked(releaseImage);

function createNodeViewProps(
  assetId = "asset-1",
  alt = "測試圖片",
): NodeViewProps {
  return {
    node: {
      attrs: {
        assetId,
        alt,
      },
    },
  } as unknown as NodeViewProps;
}

describe("ImageBlockView", () => {
  beforeEach(() => {
    mockAcquireImage.mockReset();
    mockReleaseImage.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("acquireImage 成功時會顯示圖片", async () => {
    mockAcquireImage.mockResolvedValue({
      objectUrl: "blob:image-1",
      image: {} as HTMLImageElement,
    });

    render(<ImageBlockView {...createNodeViewProps("asset-1", "封面")} />);

    const image = await screen.findByRole("img", { name: "封面" });
    expect(image.getAttribute("src")).toBe("blob:image-1");
  });

  it("acquireImage 失敗時會顯示錯誤狀態", async () => {
    mockAcquireImage.mockRejectedValue(new Error("load failed"));

    render(<ImageBlockView {...createNodeViewProps()} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load image:/)).toBeTruthy();
    });
  });

  it("unmount 時會呼叫 releaseImage", async () => {
    mockAcquireImage.mockResolvedValue({
      objectUrl: "blob:image-2",
      image: {} as HTMLImageElement,
    });

    const view = render(<ImageBlockView {...createNodeViewProps("asset-2")} />);
    await screen.findByRole("img", { name: "測試圖片" });

    view.unmount();

    expect(mockReleaseImage).toHaveBeenCalledWith("asset-2");
  });
});
