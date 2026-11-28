const AVATAR_SIZE_PX = 160;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_GIF_BYTES = Math.round(1.5 * 1024 * 1024); // 1.5 MB for animated GIFs

export function notifyAvatarUpdated(avatarUrl: string | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("profile-avatar-updated", { detail: { avatarUrl } })
    );
  }
}

export function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image file (PNG, JPG, WebP, or GIF)."));
      return;
    }

    if (file.type === "image/gif") {
      if (file.size > MAX_GIF_BYTES) {
        reject(new Error("Animated GIF profile picture must be under 1.5 MB."));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        reject(new Error("Could not read the selected GIF."));
      };
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string" && result.startsWith("data:image/")) {
          resolve(result);
        } else {
          reject(new Error("Invalid or unsupported GIF format."));
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      reject(new Error("Image must be smaller than 10 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not read the selected image."));
    };

    reader.onload = () => {
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

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
