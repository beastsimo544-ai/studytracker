const QUOTE_PREFIX = "STQ1:";
const MAX_QUOTE_CHARS = 140;
const MAX_IMAGE_DIM_PX = 420;
const MAX_STATIC_BYTES = 20 * 1024 * 1024;
const MAX_GIF_BYTES = Math.round(1.5 * 1024 * 1024);
const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
const GIF_BASE64_MAGIC = ";base64,R0lGOD";

export type ChampionQuoteContent = {
  text: string | null;
  imageUrl: string | null;
};

export type ChampionQuoteDraft = {
  text: string;
  imageUrl: string | null;
};

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function encodeDailyChampionQuote(
  text: string,
  imageUrl: string | null,
  date: Date = new Date()
): string | null {
  const cleanedText = text.trim().slice(0, MAX_QUOTE_CHARS);
  // Picture is strictly tied to the quote: when the quote is cleared, drop the image too.
  if (!cleanedText) {
    return null;
  }

  const safeImageUrl =
    typeof imageUrl === "string" && imageUrl.startsWith("data:image/")
      ? imageUrl
      : null;

  return `${QUOTE_PREFIX}${JSON.stringify({
    d: toLocalDateKey(date),
    t: cleanedText,
    ...(safeImageUrl ? { i: safeImageUrl } : {}),
  })}`;
}

export function parseDailyChampionQuote(
  raw: string | null | undefined,
  requireToday: boolean = true
): ChampionQuoteContent {
  if (!raw) {
    return { text: null, imageUrl: null };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: null, imageUrl: null };
  }

  if (trimmed.startsWith(QUOTE_PREFIX)) {
    try {
      const parsed = JSON.parse(trimmed.slice(QUOTE_PREFIX.length)) as {
        d?: unknown;
        t?: unknown;
        i?: unknown;
      };

      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.t !== "string"
      ) {
        return { text: null, imageUrl: null };
      }

      if (
        requireToday &&
        typeof parsed.d === "string" &&
        parsed.d !== toLocalDateKey(new Date())
      ) {
        return { text: null, imageUrl: null };
      }

      const text = parsed.t.trim().slice(0, MAX_QUOTE_CHARS) || null;
      if (!text) {
        return { text: null, imageUrl: null };
      }

      const imageUrl =
        typeof parsed.i === "string" && parsed.i.startsWith("data:image/")
          ? parsed.i
          : null;

      return { text, imageUrl };
    } catch {
      return { text: null, imageUrl: null };
    }
  }

  const legacyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\|([\s\S]*)$/);
  if (legacyMatch) {
    if (requireToday && legacyMatch[1] !== toLocalDateKey(new Date())) {
      return { text: null, imageUrl: null };
    }
    return {
      text: legacyMatch[2].trim().slice(0, MAX_QUOTE_CHARS) || null,
      imageUrl: null,
    };
  }

  return {
    text: trimmed.slice(0, MAX_QUOTE_CHARS) || null,
    imageUrl: null,
  };
}

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "" || file.type === "application/octet-stream") {
    return true;
  }
  return IMAGE_EXT_REGEX.test(file.name || "");
}

function isLikelyGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name || "");
}

function normalizeImageDataUrl(raw: string, forceGif: boolean): string {
  if (raw.includes(GIF_BASE64_MAGIC)) {
    return raw.replace(
      /^data:[^;]*;base64,/i,
      "data:image/gif;base64,"
    );
  }
  if (forceGif && /^data:application\/octet-stream;base64,/i.test(raw)) {
    return raw.replace(
      /^data:application\/octet-stream;base64,/i,
      "data:image/gif;base64,"
    );
  }
  return raw;
}

export function resizeQuoteImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isLikelyImageFile(file)) {
      reject(new Error("Please select an image file (PNG, JPG, WebP, or GIF)."));
      return;
    }

    const declaredGif = isLikelyGifFile(file);
    if (declaredGif && file.size > MAX_GIF_BYTES) {
      reject(new Error("Animated GIF quote picture must be under 1.5 MB."));
      return;
    }

    if (!declaredGif && file.size > MAX_STATIC_BYTES) {
      reject(new Error("Image must be smaller than 20 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not read the selected image."));
    };

    reader.onload = () => {
      const raw = reader.result;
      if (typeof raw !== "string" || !raw.startsWith("data:")) {
        reject(new Error("Invalid or unsupported image format."));
        return;
      }

      const hasGifMagic = raw.includes(GIF_BASE64_MAGIC);
      if (declaredGif || hasGifMagic) {
        if (file.size > MAX_GIF_BYTES) {
          reject(new Error("Animated GIF quote picture must be under 1.5 MB."));
          return;
        }
        resolve(normalizeImageDataUrl(raw, true));
        return;
      }

      const img = new Image();

      img.onerror = () => {
        reject(new Error("Invalid or unsupported image format."));
      };

      img.onload = () => {
        const largestDim = Math.max(img.width, img.height, 1);
        const scale = Math.min(1, MAX_IMAGE_DIM_PX / largestDim);
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not initialize image canvas."));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        let dataUrl = canvas.toDataURL("image/webp", 0.78);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        }

        resolve(dataUrl);
      };

      img.src = raw;
    };

    reader.readAsDataURL(file);
  });
}
