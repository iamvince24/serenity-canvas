export default function ShareLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fafaf8]">
      <div className="px-6 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#8B9D83] border-t-transparent" />
        <p className="text-lg font-medium text-[#1C1C1A]">正在載入分享白板</p>
        <p className="mt-2 text-sm text-[#6B6B66]">請稍候片刻</p>
      </div>
    </main>
  );
}
