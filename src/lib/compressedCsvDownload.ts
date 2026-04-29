interface DownloadCompressedCsvOptions {
  fileName: string;
  rawBytes: Uint8Array;
}

function buildCompressedFileName(fileName: string): string {
  const trimmedName = fileName.trim() || "participantes.csv";
  const baseName = trimmedName.replace(/\.csv$/i, "");

  return `${baseName}.csv.gz`;
}

async function gzipBytes(bytes: Uint8Array): Promise<Blob> {
  if (!("CompressionStream" in window)) {
    throw new Error("Este navegador no soporta compresión automática del CSV.");
  }

  const sourceBlob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const compressedStream = sourceBlob.stream().pipeThrough(new CompressionStream("gzip"));

  return new Response(compressedStream).blob();
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 0);
}

export async function downloadCompressedCsv({
  fileName,
  rawBytes,
}: DownloadCompressedCsvOptions): Promise<void> {
  const compressedBlob = await gzipBytes(rawBytes);

  triggerBrowserDownload(compressedBlob, buildCompressedFileName(fileName));
}
