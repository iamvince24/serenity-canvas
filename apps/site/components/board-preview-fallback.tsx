type Props = {
  board: { id: string; title: string; node_count: number };
};

export default function BoardPreviewFallback({ board }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#fafaf8]">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[#1C1C1A]">{board.title}</h1>
        <p className="text-base text-[#1C1C1A]">
          這張白板包含 {board.node_count} 張卡片，太大無法在此預覽。
        </p>
        <p className="text-sm text-[#6B6B66]">
          請在 Serenity Canvas 編輯器中開啟以查看完整內容。
        </p>
        <a
          href={`${appUrl}/canvas/${board.id}`}
          className="mt-2 rounded-md bg-[#8B9D83] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#7A8C73] transition-colors"
        >
          在 Serenity Canvas 中開啟
        </a>
      </div>
    </div>
  );
}
