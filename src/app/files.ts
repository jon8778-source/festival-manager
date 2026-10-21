// Getting files out of the browser: the device share sheet where there is one, else a download.

/** Share the file where the device supports it, otherwise download it. */
export async function saveFile(name: string, text: string, type: string): Promise<void> {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (error) {
    // The player closed the share sheet: nothing more to do.
    if (error instanceof DOMException && error.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
