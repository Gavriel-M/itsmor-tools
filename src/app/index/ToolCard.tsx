interface ToolCardProps {
  title: string;
  category: string;
  href: string;
  description: string;
  index: number;
}

export default function ToolCard({
  title,
  category,
  href,
  description,
  index,
}: ToolCardProps) {
  const paddedIndex = String(index + 1).padStart(2, "0");

  return (
    <a
      href={href}
      className="group block py-7 md:py-10 border-t border-rule border-l-2 border-l-transparent hover:border-l-terracotta focus-visible:border-l-terracotta motion-safe:hover:pl-4 motion-safe:focus-visible:pl-4 transition-all duration-300"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
        <span className="md:col-span-2 font-mono text-xs text-lapis">
          {paddedIndex}
        </span>

        <h2 className="md:col-span-6 font-sans text-2xl md:text-4xl font-bold group-hover:text-lapis group-focus-visible:text-lapis transition-colors duration-300">
          {title}
        </h2>

        <div className="md:col-span-4 flex items-baseline md:justify-end gap-4">
          <span className="font-mono text-xs md:text-sm uppercase tracking-wider border border-text/15 px-2 py-1 rounded-full group-hover:bg-text group-hover:text-background transition-colors duration-300">
            {category}
          </span>
          <span
            aria-hidden="true"
            className="text-ink-3 group-hover:text-terracotta motion-safe:group-hover:translate-x-1 transition-all duration-300"
          >
            &rarr;
          </span>
        </div>
      </div>

      <p className="mt-3 md:ml-[calc(2/12*100%)] md:max-w-[50%] font-mono text-xs md:text-sm text-text/70">
        {description}
      </p>
    </a>
  );
}
