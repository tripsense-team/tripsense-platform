export type PartnerImageFileError = "invalidType" | "tooLarge";

export interface PartnerImageFileRules {
  maxBytes: number;
  allowedMimeTypes?: readonly string[];
  allowAnyImage?: boolean;
}

export function validatePartnerImageFile(
  file: File,
  rules: PartnerImageFileRules,
): PartnerImageFileError | null {
  const acceptedByExtension = /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
  const acceptedByMime = file.type.startsWith("image/");
  const isAllowed = rules.allowedMimeTypes
    ? rules.allowedMimeTypes.includes(file.type.toLowerCase())
    : rules.allowAnyImage === true && (acceptedByMime || acceptedByExtension);

  if (!isAllowed) return "invalidType";
  if (file.size > rules.maxBytes) return "tooLarge";
  return null;
}

export function createPartnerImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

export function releasePartnerImagePreview(previewUrl: string | null | undefined): void {
  if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
}
