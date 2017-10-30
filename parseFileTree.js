/*
  The parseFileTree method takes a dropEvent and returns a promise that
  resolves to a files-by-path object like:
    {
      "image.png": [File],
      "documents/document.docx": [File],
      "documents/.DS_Store": [File],
      ...
    }

  Note: this is only tested in new versions of Chrome
*/

// For waiting until asynchronous tasks finish, like Promise.all
const waiter = onFinish => {
  let pending = 0;
  return {
    start() {
      pending++;
    },
    finish() {
      pending--;
      if (pending === 0) onFinish();
    },
    isFinished() {
      return pending === 0;
    }
  };
};

function toArray(obj) {
  return Array.prototype.slice.call(obj || [], 0);
}

function getAsEntry(item) {
  if (typeof item.getAsEntry === "function") return item.getAsEntry();
  else if (typeof item.webkitGetAsEntry === "function")
    return item.webkitGetAsEntry();
  throw new Error("Browser is not supported");
}

function fromFileList(list, options = {}) {
  if (!list || !list.length) return {};
  const files = {};
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    if (options.handleFile) options.handleFile(file, "");
    files[file.name] = file;
  }
  return files;
}

// Takes a drop event with files or dataTransfer and returns an object
// of (path, file) pairs
export default function parseFileTree(dropEvent, options = {}) {
  let dataTransferItemsList = [];
  let items;
  if (dropEvent.dataTransfer) {
    const dt = dropEvent.dataTransfer;
    if (dt.items && dt.items.length) items = dt.items;
    else return Promise.resolve(fromFileList(dt.files, options));
  } else if (dropEvent.target && dropEvent.target.files) {
    return Promise.resolve(fromFileList(dropEvent.target.files, options));
  }

  if (!items) return Promise.resolve([]);

  // We got items
  return new Promise((resolve, reject) => {
    const files = {};
    let pendingReads = waiter(() => resolve(files));
    const traverseTree = (item, path = "") => {
      if (!item) return;
      if (item.isFile) {
        // Base case, its a file
        pendingReads.start();
        item.file(function(file) {
          files[path + file.name] = file;
          if (options.handleFile) options.handleFile(file, path);
          pendingReads.finish();
        });
      } else if (item.isDirectory) {
        // Recursively get folder contents
        const dirReader = item.createReader();
        const isDoneInner = false;

        const handleEntries = function(entries) {
          if (entries.length < 1) {
            pendingReads.finish();
            return;
          }
          for (var i = 0; i < entries.length; i++) {
            traverseTree(entries[i], path + item.name + "/");
          }
          dirReader.readEntries(handleEntries);
        };

        // keep track of asynchronous reads, to know when we're done
        pendingReads.start();
        dirReader.readEntries(handleEntries);
      } else if (typeof item.length !== "undefined") {
        // It's an array of items, traverse each one
        toArray(item).forEach(item => {
          traverseTree(item, path);
        });
      } else {
        // It's a folder item, get its entry
        traverseTree(getAsEntry(item), path);
      }
    };

    traverseTree(items, "");
    if (pendingReads.isFinished()) resolve(files);
  });
}
