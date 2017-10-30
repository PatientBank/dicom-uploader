import { fromFileTree } from "./Dicomdir";
import parseFileTree from "./parseFileTree";

// This is the function that you'd attach to a "drop" event on an element
async function handleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  let dicomdirFile = undefined;
  let dicompath = undefined;

  const filesByName = await parseFileTree(e, {
    handleFile: (file, path) => {
      if (file.name === "DICOMDIR") {
        dicomdirFile = file;
        dicompath = path;
      }
    }
  });

  if (dicomdirFile) throw new Error("Doesn't look like a DICOM CD");

  const dicomdir = await fromFileTree(filesByName, dicomdirFile, dicompath);

  // Here you can access dicomdir.study, dicomdir.files, etc.

  // For example:
  dicomdir.files.map(file => {
    // file.id is the path to this file (as defined in DICOMDIR)
    // Note that one of these files will have id = "DICOMDIR"
    // uploadFileToS3(file, file.id);
  });
}
