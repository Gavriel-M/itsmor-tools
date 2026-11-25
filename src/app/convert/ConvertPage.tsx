import PageShell from "../components/PageShell";
import DropZone from "./DropZone";
import SupportedFormats from "./SupportedFormats";

export default function ConvertPage() {
  return (
    <PageShell>
      <header className="max-w-3xl mb-10 md:mb-14">
        <p className="font-mono text-xs uppercase tracking-widest text-lapis mb-4">
          01 · Images
        </p>
        <h1 className="font-sans font-bold text-6xl md:text-8xl tracking-tighter mb-6">
          Convert
        </h1>
        <p className="font-sans text-xl md:text-2xl leading-snug tracking-tight">
          Your files never leave this tab —{" "}
          <span className="text-lapis">and you can check.</span>
        </p>
      </header>

      <DropZone />
      <SupportedFormats />
    </PageShell>
  );
}
