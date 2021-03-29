// @ts-ignore it works in node 15.12, see also https://github.com/nodejs/node/pull/37179
import { watch as fsWatch } from "fs/promises";
// @ts-ignore  TODO find why node resolve this correctly but the checker doesn't
import { walk } from "@dorilama/walk";

import { platform } from "process";

/**
 * NOTE!!! node 15.12
 * watch function exported from fs/promises does not throw
 * ERR_FEATURE_UNAVAILABLE_ON_PLATFORM
 * if watching recursively on an unsupported platform.
 * see more here https://github.com/nodejs/node/blob/master/lib/internal/fs/watchers.js#L298
 * and here https://github.com/nodejs/node/blob/master/lib/fs.js#L1591
 *
 * we need to detect the platform like here https://github.com/nodejs/node/blob/master/lib/fs.js#L159
 */

/**
 *
 * @typedef {'rename'|'change'} EventType
 */

/**
 * @param {URL} url
 * @param {boolean} [recursive=false]
 * @param {(url: URL, event:EventType)=>any} [cb]
 * @param {number} [th=10]
 * @returns {Promise<()=>void>}
 */
export async function watch(url, recursive, cb, th = 10) {
  if (recursive && !(platform === "win32" || platform === "darwin")) {
    const watchers = await watchFallback(url, cb, th);
    return async () => {
      const promises = watchers.map(([controller, done]) => {
        controller.abort();
        return done;
      });
      await Promise.all(promises);
      return;
    };
  } else {
    const [controller, done] = watchStandard(url, recursive, cb, th);
    return async () => {
      controller.abort();
      await done;
      return;
    };
  }
}

/**
 * @param {URL} url
 * @param {boolean} [recursive=false]
 * @param {(url: URL, event:EventType)=>any} [cb]
 * @param {number} [th=10]
 * @returns {[AbortController,Promise<void>]}
 */
function watchStandard(url, recursive, cb, th = 10) {
  const ac = new AbortController();
  const { signal } = ac;
  if (!url.href.endsWith("/")) {
    url = new URL(url + "/");
  }
  async function w() {
    try {
      // console.log("start watching", url.href);
      let last = { filename: "", time: 0 };
      const watcher = fsWatch(url, { signal, recursive });
      for await (const event of watcher) {
        const { eventType, filename } = event;
        const time = Date.now();
        if (filename !== last.filename || time > last.time + th) {
          last = { filename, time };
          const fileUrl = new URL(filename, url);
          if (cb) {
            cb(fileUrl, eventType);
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // console.log("watcher aborted");
        return;
      }
      throw err;
    }
  }
  return [ac, w()];
}

/**
 * @param {URL} url
 * @param {(url: URL, event:EventType)=>any} [cb]
 * @param {number} [th=10]
 * @returns {Promise<[AbortController,Promise<void>][]>}
 */
async function watchFallback(url, cb, th = 10) {
  const [dirs] = await walk(url);
  dirs.push(url);
  return dirs.map((u) => watchStandard(u, false, cb, th));
}

const abort = await watch(new URL("../", import.meta.url), true, (u, e) =>
  console.log(u, e)
);
setTimeout(async () => {
  console.log("abort");
  await abort();
  console.log("done");
}, 30000);
