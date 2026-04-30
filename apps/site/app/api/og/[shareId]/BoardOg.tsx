export function BoardOg({ title, count }: { title: string; count: number }) {
  const fontSize = title.length > 40 ? 48 : 64;

  return (
    <div
      style={{
        display: "flex",
        width: "1200px",
        height: "630px",
        backgroundColor: "#FAFAF8",
        fontFamily: "NotoSansTC",
      }}
    >
      {/* Left column */}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 72px",
          gap: "32px",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              backgroundColor: "#8B9D83",
              borderRadius: "50% 50% 0 50%",
            }}
          />
          <span
            style={{
              fontSize: "18px",
              color: "#6B6B66",
              fontFamily: "NotoSansTC",
            }}
          >
            Serenity Canvas
          </span>
        </div>

        {/* Board title */}
        <div
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            color: "#1C1C1A",
            lineHeight: 1.2,
            fontFamily: "NotoSansTC",
          }}
        >
          {title}
        </div>

        {/* Card count badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(139,157,131,0.12)",
              borderRadius: "9999px",
              padding: "8px 20px",
              fontSize: "20px",
              color: "#6B7F63",
              fontFamily: "NotoSansTC",
            }}
          >
            {count} cards
          </div>
        </div>
      </div>

      {/* Right column */}
      <div
        style={{
          display: "flex",
          width: "380px",
          backgroundColor: "rgba(139,157,131,0.08)",
          borderLeft: "1px solid rgba(139,157,131,0.2)",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Decorative card stack */}
        <div
          style={{
            position: "absolute",
            width: "220px",
            height: "140px",
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.07)",
            top: "160px",
            left: "120px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "220px",
            height: "140px",
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.07)",
            top: "210px",
            left: "90px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "220px",
            height: "140px",
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.07)",
            top: "260px",
            left: "60px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        />
      </div>
    </div>
  );
}
