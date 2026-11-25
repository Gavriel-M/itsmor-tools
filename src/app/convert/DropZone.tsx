export default function DropZone() {
  return (
    <label className="group flex flex-col items-center justify-center gap-4 min-h-64 md:min-h-80 px-6 py-12 text-center bg-background border-2 border-dashed border-ink-3 cursor-pointer hover:border-lapis has-focus-visible:border-lapis has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-terracotta transition-colors duration-300">
      <input type="file" multiple accept="image/*" className="sr-only" />
      <span className="pointer-coarse:hidden font-sans font-bold text-2xl md:text-3xl tracking-tight">
        Drop images here
      </span>
      <span className="pointer-coarse:hidden font-mono text-xs text-ink-2">
        or
      </span>
      <span className="inline-block px-4 py-3 font-mono text-xs uppercase tracking-widest border border-text/15 group-hover:bg-text group-hover:text-background group-has-focus-visible:bg-text group-has-focus-visible:text-background transition-colors duration-300">
        Choose images
      </span>
      <span className="font-mono text-xs text-ink-2">
        As many as you like, converted right here.
      </span>
    </label>
  );
}
