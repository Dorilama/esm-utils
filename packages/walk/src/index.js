import { readdir } from "fs/promises";
/**
 * Given a file URL return the list of files and dirs
 * default to walk recursively
 * @param {URL} url
 * @param {boolean} [recursive=true]
 * @returns {Promise<[URL[],  URL[]]>}
 */
export async function walk(url, recursive = true) {
  const entries = await readdir(url, { withFileTypes: true });
  if (!url.href.endsWith("/")) {
    url = new URL(url + "/");
  }
  let dirs = [];
  let files = [];
  const promises = entries.map(async (file) => {
    if (file.isDirectory()) {
      const folderUrl = new URL(file.name + "/", url);
      if (recursive) {
        const [subDirs, subFiles] = await walk(folderUrl);
        dirs = dirs.concat(folderUrl, subDirs);
        files = files.concat(subFiles);
      } else {
        dirs.push(folderUrl);
      }
    } else {
      files.push(new URL(file.name, url));
    }
  });
  await Promise.all(promises);
  return [dirs, files];
}
