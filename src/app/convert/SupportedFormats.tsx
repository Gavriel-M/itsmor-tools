const formats = [
  { direction: "In", names: ["JPEG", "PNG", "WebP", "AVIF", "HEIC"] },
  { direction: "Out", names: ["JPEG", "PNG", "WebP", "AVIF"] },
];

export default function SupportedFormats() {
  return (
    <dl className="mt-6 flex flex-col sm:flex-row gap-x-10 gap-y-2 font-mono text-xs">
      {formats.map(({ direction, names }) => (
        <div key={direction} className="flex gap-3">
          <dt className="w-8 sm:w-auto uppercase tracking-widest text-lapis">
            {direction}
          </dt>
          <dd className="text-ink-2">{names.join(" · ")}</dd>
        </div>
      ))}
    </dl>
  );
}
