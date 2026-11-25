export const METADATA_FIELDS = [
  "location",
  "camera",
  "lens",
  "dateTaken",
  "software",
] as const;
export type MetadataField = (typeof METADATA_FIELDS)[number];

export type MetadataReport = Record<MetadataField, "removed" | "absent">;

export interface InputMetadata {
  report: MetadataReport;
  colourProfile: string | null;
  orientation: number | null;
}

export type Tags = Record<string, unknown>;

const FIELD_TAGS: Record<MetadataField, string[]> = {
  location: ["GPSLatitude", "GPSLongitude", "latitude", "longitude"],
  camera: ["Make", "Model"],
  lens: ["LensModel", "LensMake"],
  dateTaken: ["DateTimeOriginal", "CreateDate"],
  software: ["Software"],
};

export function describeMetadata(tags: Tags | undefined): InputMetadata {
  const present = (tag: string) => tags?.[tag] != null && tags[tag] !== "";
  const report = Object.fromEntries(
    METADATA_FIELDS.map((field) => [
      field,
      FIELD_TAGS[field].some(present) ? "removed" : "absent",
    ])
  ) as MetadataReport;
  return {
    report,
    colourProfile: stringTag(tags?.ProfileDescription),
    orientation:
      typeof tags?.Orientation === "number" ? tags.Orientation : null,
  };
}

function stringTag(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
