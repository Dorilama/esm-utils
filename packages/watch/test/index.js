import { test } from "zora";
import { writeFile } from "fs/promises";
import { watch } from "../src/index.js";

// test("TODO write test for watch and test it on unix and windows", (t) => {
//   t.fail("TODO");
// });

test("non recursive", async (t) => {
  const watchTest = async (url, event) => {
    t.ok(["rename", "change"].includes(event));
    t.equal(url, new URL("./test-folder/a/a.txt", import.meta.url));
  };
  const abort = await watch(
    new URL("./test-folder/", import.meta.url),
    false,
    watchTest
  );
  await writeFile(new URL("./test-folder/a/a.txt", import.meta.url), "hello");
  await abort();
});
