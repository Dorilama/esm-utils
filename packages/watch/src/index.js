// @ts-ignore it works in node 15.12, see also https://github.com/nodejs/node/pull/37179
import { watch as fsWatch, stat } from "fs/promises";
// @ts-ignore  TODO find why node resolve workspaces correctly but the ts-checker doesn't
import { walk } from "@dorilama/walk";
import { createDeferredPromise } from "./util.js";

/**
 * NOTE!!! node 15.12
 * watch function exported from fs/promises does not throw
 * with "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM"
 * if watching recursively on an unsupported platform.
 * see more here https://github.com/nodejs/node/blob/master/lib/internal/fs/watchers.js#L298
 * and here https://github.com/nodejs/node/blob/master/lib/fs.js#L1591
 *
 * need to detect the platform like here https://github.com/nodejs/node/blob/master/lib/fs.js#L159
 */
import { platform } from "process";

/**
 *
 * @typedef {'rename'|'change'} EventType
 * @typedef {AsyncGenerator<{ eventType: EventType, fileUrl: URL }, void, unknown>} Generator
 * @typedef {AsyncGenerator<{ eventType: EventType, filename: string }, void, unknown>} FSGenerator
 */

/**
 * @param {URL} url
 * @param {boolean} [recursive=false]
 * @param {number} [th=10]
 * @returns {Promise<[Generator , () => Promise<void>]>}
 */
export async function watch(url, recursive, th = 10) {
  const stats = await stat(url);
  if (stats.isFile()) {
    url = new URL("./", url);
  } else if (!url.href.endsWith("/")) {
    url = new URL(url + "/");
  }
  let dirs = [url];
  if (recursive && !(platform === "win32" || platform === "darwin")) {
    const [subdirs] = await walk(url);
    dirs = subdirs.concat(dirs);
    recursive = false;
  }
  const controllers = [];
  const promises = [];
  let last = { filename: "", time: 0 };
  const watchers = dirs.map(
    /**
     *
     * @param {URL} dir
     * @returns {[FSGenerator,URL,(value: any) => void]}
     */
    (dir) => {
      const { promise, resolve } = createDeferredPromise();
      promises.push(promise);
      const ac = new AbortController();
      const { signal } = ac;
      controllers.push(ac);
      const watcher = fsWatch(dir, { signal, recursive });
      return [watcher, dir, resolve];
    }
  );
  const generator = eventGenerator(watchers, th);
  const abort = async () => {
    controllers.forEach((ac) => ac.abort());
    await Promise.all(promises);
  };
  return [generator, abort];
}

/**
 *
 * @param {[FSGenerator,URL,(value: any) => void][]} watchers
 * @param {number} th
 * @returns {Generator}
 */
async function* eventGenerator(watchers, th) {
  let shouldYield = true;
  let { promise, resolve } = createDeferredPromise();
  watchers.map(async ([watcher, url, res]) => {
    let last = { filename: "", time: 0 };
    try {
      for await (const event of watcher) {
        const { eventType, filename } = event;
        const time = Date.now();
        if (filename !== last.filename || time > last.time + th) {
          last = { filename, time };
          const fileUrl = new URL(filename, url);
          resolve({ eventType, fileUrl });
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        shouldYield = false;
        res();
      } else {
        throw err;
      }
    }
  });
  while (shouldYield) {
    yield await promise;
    ({ promise, resolve } = createDeferredPromise());
  }
}
