import { REPO_URL } from "../site";

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-rule">
      <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between font-mono text-xs text-ink-2">
        <p>Open source, MIT licensed. No analytics, no uploads.</p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start sm:self-auto inline-block px-3 py-2 uppercase tracking-widest text-text border border-text/15 hover:bg-text hover:text-background focus-visible:bg-text focus-visible:text-background transition-colors duration-300"
        >
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
