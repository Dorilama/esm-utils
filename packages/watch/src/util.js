/**
 *
 * this is from https://github.com/nodejs/node/blob/master/lib/internal/util.js#L423
 */
export function createDeferredPromise() {
  /**
   * @type {(value: any) => void}
   */
  let resolve;
  /**
   * @type {(reason?: any) => void}
   */
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
