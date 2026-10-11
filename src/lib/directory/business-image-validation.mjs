import sharp from "sharp";
import { createHash } from "node:crypto";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const types = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
export const imageUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** @param {Buffer} bytes */
export const imageHash = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Fully decode before keeping the original; never preserve metadata in derivatives.
 * @param {Buffer} bytes @param {string} declaredType
 */
export async function sanitizeBusinessImage(bytes, declaredType) {
  try {
    const format = types[/** @type {keyof typeof types} */ (declaredType)];
    if (!format || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new Error();
    const magic =
      format === "png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : format === "jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP";
    if (!magic) throw new Error();
    const decoder = sharp(bytes, {
      limitInputPixels: 12_000_000,
      failOn: "warning",
      animated: true,
    });
    const m = await decoder.metadata();
    if (
      m.format !== format ||
      (m.pages ?? 1) !== 1 ||
      !m.width ||
      !m.height ||
      m.width < 16 ||
      m.height < 16 ||
      m.width > 6000 ||
      m.height > 6000
    )
      throw new Error();
    const { data, info } = await decoder
      .autoOrient()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: 85 })
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_IMAGE_BYTES) throw new Error();
    return { bytes: data, width: info.width, height: info.height, sha256: imageHash(data) };
  } catch {
    throw new Error("invalid_image");
  }
}

/** @param {unknown} input */
export function validateImageDetails(input) {
  const d = /** @type {Record<string,unknown>} */ (input);
  if (
    !d ||
    !imageUuid.test(String(d.id)) ||
    !imageUuid.test(String(d.listingId)) ||
    !["logo", "image"].includes(String(d.kind)) ||
    typeof d.alt !== "string" ||
    d.alt.trim().length < 3 ||
    d.alt.length > 200 ||
    !["owned", "licensed"].includes(String(d.rightsBasis)) ||
    typeof d.source !== "string" ||
    d.source.trim().length < 3 ||
    d.source.length > 500 ||
    d.rightsAttested !== true
  )
    throw new Error("invalid_image_details");
  return {
    id: String(d.id).toLowerCase(),
    listingId: String(d.listingId).toLowerCase(),
    kind: String(d.kind),
    alt: d.alt.trim(),
    rightsBasis: String(d.rightsBasis),
    source: d.source.trim(),
  };
}
