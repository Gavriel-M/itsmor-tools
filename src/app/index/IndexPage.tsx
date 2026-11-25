import PageShell from "../components/PageShell";
import ToolCard from "./ToolCard";

const tools = [
  {
    title: "Convert",
    category: "Images",
    href: "/convert/",
    description:
      "Convert images between JPEG, PNG, WebP, AVIF and HEIC, on your own machine.",
  },
];

export default function IndexPage() {
  return (
    <PageShell>
      <header className="mb-16 md:mb-24">
        <h1 className="font-sans font-bold text-6xl md:text-8xl tracking-tighter mb-6">
          Tools
        </h1>
        <p className="font-mono text-sm md:text-base max-w-md leading-relaxed text-text/70">
          Small, private tools that run entirely in your browser.
        </p>
      </header>

      <ul className="border-b border-rule">
        {tools.map((tool, index) => (
          <li key={tool.title}>
            <ToolCard {...tool} index={index} />
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
