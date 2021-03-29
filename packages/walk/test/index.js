import { test, skip, equal } from "zora";
import { walk } from "../src/index.js";

test("non recursive", async (t) => {
  const runTests = (t, dirs, files) => {
    t.equal(
      dirs,
      [
        new URL("./test-folder/a/b1/", import.meta.url),
        new URL("./test-folder/a/b2/", import.meta.url),
      ],
      "dirs"
    );
    t.equal(
      files,
      [new URL("./test-folder/a/a.txt", import.meta.url)],
      "files"
    );
  };
  t.test("folder ending with '/'", async (t) => {
    let { dirs, files } = await walk(
      new URL("./test-folder/a/", import.meta.url),
      false
    );
    runTests(t, dirs, files);
  });
  t.test("folder ending without '/'", async (t) => {
    let { dirs, files } = await walk(
      new URL("./test-folder/a", import.meta.url),
      false
    );
    runTests(t, dirs, files);
  });
});

test("recursive", async (t) => {
  const runTests = (t, dirs, files) => {
    t.equal(
      dirs,
      [
        new URL("./test-folder/a/", import.meta.url),
        new URL("./test-folder/a/b2/", import.meta.url),
        new URL("./test-folder/a/b1/", import.meta.url),
        new URL("./test-folder/a/b1/c/", import.meta.url),
      ],
      "dirs"
    );
    t.equal(
      files,
      [
        new URL("./test-folder/a/a.txt", import.meta.url),
        new URL("./test-folder/a/b2/b2.txt", import.meta.url),
        new URL("./test-folder/a/b1/b1.txt", import.meta.url),
        new URL("./test-folder/a/b1/c/c.txt", import.meta.url),
      ],
      "files"
    );
  };
  t.test("folder ending with '/'", async (t) => {
    let { dirs, files } = await walk(
      new URL("./test-folder/", import.meta.url)
    );
    runTests(t, dirs, files);
  });
  t.test("folder ending without '/'", async (t) => {
    let { dirs, files } = await walk(new URL("./test-folder", import.meta.url));
    runTests(t, dirs, files);
  });
});
