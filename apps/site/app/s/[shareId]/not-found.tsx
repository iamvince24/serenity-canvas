export default function NotFound() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "/";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fafaf8]">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8EDE6]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8B9D83"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 13h4" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[#1C1C1A] mb-3">
          找不到這張白板
        </h1>
        <p className="text-[#6B6B66] mb-8">
          這張白板可能已被設為私人，或連結已失效。
        </p>
        <a
          href={appUrl}
          className="inline-block rounded-lg bg-[#8B9D83] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#7A8C73] transition-colors"
        >
          前往 Serenity Canvas
        </a>
      </div>
    </main>
  );
}
