// @ts-ignore it works in node 15.12, see also https://github.com/nodejs/node/pull/37179
import { watch as fsWatch } from "fs/promises";
// @ts-ignore  TODO find why node resolve workspaces correctly but the ts-checker doesn't
import { walk } from "@dorilama/walk";

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
 */

/**
 * @param {URL} url
 * @param {boolean} [recursive=false]
 * @param {(url: URL, event:EventType)=>any} [cb]
 * @param {number} [th=10]
 * @returns {Promise<()=>void>}
 */
export async function watch(url, recursive, cb, th = 10) {
  let watchers;
  if (recursive && !(platform === "win32" || platform === "darwin")) {
    // TODO: try spawning a process with inotify first
    const [dirs] = await walk(url);
    dirs.push(url);
    watchers = dirs.map((u) => simpleWatch(u, false, cb, th));
  } else {
    watchers = [simpleWatch(url, recursive, cb, th)];
  }

  return async () => {
    const promises = watchers.map(([controller, done]) => {
      controller.abort();
      return done;
    });
    await Promise.all(promises);
  };
}

/**
 * @param {URL} url
 * @param {boolean} [recursive=false]
 * @param {(url: URL, event:EventType)=>any} [cb]
 * @param {number} [th=10]
 * @returns {[AbortController,Promise<void>]}
 */
function simpleWatch(url, recursive, cb, th = 10) {
  const ac = new AbortController();
  const { signal } = ac;
  if (!url.href.endsWith("/")) {
    url = new URL(url + "/");
  }
  async function w() {
    try {
      let last = { filename: "", time: 0 };
      const watcher = fsWatch(url, { signal, recursive });
      for await (const event of watcher) {
        const { eventType, filename } = event;
        const time = Date.now();
        if (filename !== last.filename || time > last.time + th) {
          last = { filename, time };
          const fileUrl = new URL(filename, url);
          if (cb) {
            await cb(fileUrl, eventType);
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      throw err;
    }
  }
  return [ac, w()];
}
