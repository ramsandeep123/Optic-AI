import PassportExtractor from "@/components/PassportExtractor";

export default function Home() {
  return (
    <div className="container">
      <header>
        <h1>
          AI DATA Extractor{" "}
          <span style={{ fontSize: "0.8rem", verticalAlign: "middle", opacity: 0.7 }}>
            PRO
          </span>
        </h1>
        <p className="subtitle">Supporting Images & Multiple Record Detection</p>
      </header>

      <main>
        <PassportExtractor />
      </main>
    </div>
  );
}
