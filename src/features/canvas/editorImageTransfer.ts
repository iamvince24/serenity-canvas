function isLikelyImageFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith("image/")) {
    return true;
  }

  return /\.(jpe?g|png|gif|webp)$/i.test(file.name);
}

export function extractImageFilesFromTransfer(
  dataTransfer: DataTransfer | null,
): File[] {
  if (!dataTransfer) {
    return [];
  }

  const files: File[] = [];
  const seen = new Set<string>();

  const pushIfImage = (file: File | null) => {
    if (!file || !isLikelyImageFile(file)) {
      return;
    }

    const key = `${file.name}:${file.size}:${file.type}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    files.push(file);
  };

  for (const file of Array.from(dataTransfer.files)) {
    pushIfImage(file);
  }

  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file") {
      continue;
    }

    pushIfImage(item.getAsFile());
  }

  return files;
}
