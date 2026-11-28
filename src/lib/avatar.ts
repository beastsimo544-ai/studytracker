const AVATAR_SIZE_PX = 160;
const MAX_STATIC_BYTES = 20 * 1024 * 1024; // 20 MB (resized immediately on canvas)
const MAX_GIF_BYTES = Math.round(1.5 * 1024 * 1024); // 1.5 MB for animated GIFs
const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
const GIF_BASE64_MAGIC = ";base64,R0lGOD";

export function notifyAvatarUpdated(avatarUrl: string | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("profile-avatar-updated", { detail: { avatarUrl } })
    );
  }
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

export function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isLikelyImageFile(file)) {
      reject(new Error("Please select an image file (PNG, JPG, WebP, or GIF)."));
      return;
    }

    const declaredGif = isLikelyGifFile(file);
    if (declaredGif && file.size > MAX_GIF_BYTES) {
      reject(new Error("Animated GIF profile picture must be under 1.5 MB."));
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
          reject(new Error("Animated GIF profile picture must be under 1.5 MB."));
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
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE_PX;
        canvas.height = AVATAR_SIZE_PX;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not initialize image canvas."));
          return;
        }

        // Center-crop to a clean square
        const side = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - side) / 2);
        const sy = Math.floor((img.height - side) / 2);

        ctx.drawImage(
          img,
          sx,
          sy,
          side,
          side,
          0,
          0,
          AVATAR_SIZE_PX,
          AVATAR_SIZE_PX
        );

        let dataUrl = canvas.toDataURL("image/webp", 0.82);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }

        resolve(dataUrl);
      };

      img.src = raw;
    };

    reader.readAsDataURL(file);
  });
}
