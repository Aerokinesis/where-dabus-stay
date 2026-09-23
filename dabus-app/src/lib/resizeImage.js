// Downscale + recompress an image File in the browser before upload.
// Phones hand us 4–12 MB HEIC/JPEGs; the carousel never shows more than
// ~800 CSS px wide, so 1600px on the long edge is plenty for 2x screens and
// lands around 150–300 KB. Keeps the free Supabase storage quota healthy.
//
// Returns a JPEG Blob. Falls back to the original file if the browser can't
// decode it (createImageBitmap handles HEIC on Safari, not on Chrome).
export async function resizeImage(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  return blob || file;
}
