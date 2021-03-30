import { test } from "zora";
import { writeFile } from "fs/promises";
import { watch } from "../src/index.js";

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const folder = new URL("./test-folder/a/", import.meta.url);
const file = new URL("./a.txt", folder);
const otherFile = new URL("./b1/b1.txt", folder);

const simple = async (watchUrl, msg) => {
  await test("simple " + msg, async (t) => {
    const [watcher, abort] = await watch(watchUrl);
    let count = 0;
    (async () => {
      for await (const { fileUrl } of watcher) {
        await t.equal(fileUrl, file, "fileUrl");
        count++;
      }
    })();
    await writeFile(file, "lorem ipsum");
    await writeFile(file, "this is file a");
    await writeFile(file, "lorem ipsum");
    await t.equal(count, 1, "no doubled events");
    await writeFile(otherFile, "other file");
    await t.equal(count, 1, "subfolder didn't trigger an event");
    await sleep(15);
    await writeFile(file, "second time");
    await t.equal(count, 2, "second event");
    await sleep(15);
    await writeFile(file, "third time");
    await t.equal(count, 3, "third event");
    await abort();
  });
};

await simple(new URL("./test-folder/a", import.meta.url), "without '/'");
await simple(new URL("./test-folder/a/", import.meta.url), "with '/'");
await simple(new URL("./test-folder/a/a.txt", import.meta.url), "with file");

const abortTest = async (file, recursive, msg) => {
  await test("abort " + msg, async (t) => {
    const [watcher, abort] = await watch(folder, recursive);
    (async () => {
      for await (const { fileUrl } of watcher) {
        await t.fail("event after abort");
      }
    })();
    await abort();
    await writeFile(file, "asdf");
  });
};

await abortTest(file, false, "non recursive");
await abortTest(file, true, "recursive 1");
await abortTest(otherFile, true, "recursive 2");

await test("recursive", async (t) => {
  const [watcher, abort] = await watch(folder, true);
  const count = {
    [file.href]: 0,
    [otherFile.href]: 0,
  };
  (async () => {
    for await (const { fileUrl } of watcher) {
      await t.ok([file.href, otherFile.href].includes(fileUrl.href));
      count[fileUrl.href]++;
    }
  })();
  await writeFile(file, "lorem ipsum");
  await writeFile(file, "this is file a");
  await writeFile(file, "lorem ipsum");
  await t.equal(count[file.href], 1, "no doubled events");
  await writeFile(otherFile, "other file");
  await writeFile(otherFile, "hello world");
  await writeFile(otherFile, "lorem");
  await t.equal(count[otherFile], 1, "file in subfolder");
  await sleep(15);
  await writeFile(file, "second time");
  await t.equal(count[file.href], 2, "second event");
  await sleep(15);
  await writeFile(otherFile, "third time");
  await t.equal(count[otherFile], 2, "third event");
  await abort();
});
