import Logo from "./Logo";
import { ITSMOR_URL } from "../site";

export default function SiteHeader() {
  return (
    <header className="relative z-10 p-4 md:p-6">
      <a
        href={ITSMOR_URL}
        className="group inline-flex items-center gap-2 text-text hover:text-terracotta focus-visible:text-terracotta transition-colors duration-300"
      >
        <Logo className="w-8 h-8 md:w-10 md:h-10" />
        <span className="font-sans font-bold text-lg md:text-xl tracking-tight">
          itsmor{" "}
          <span className="font-mono font-normal text-ink-2 group-hover:text-terracotta group-focus-visible:text-terracotta transition-colors duration-300">
            tools
          </span>
        </span>
      </a>
    </header>
  );
}
