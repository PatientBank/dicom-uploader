import * as dicomParser from "dicom-parser";

export const ERRORS = {
  browser: "Incompatible browser",
  upload: "Upload does not look like a DICOM directory",
  corrupt: "Upload has a corrupt DICOMDIR"
};
export function DicomError(message) {
  this.name = "DicomError";
  this.message = message;
  this.stack = new Error().stack;
}
DicomError.prototype = new Error();

// This is some dark magic, these come from the DICOM spec
const tags = {
  directoryRecordSeq: "x00041220",
  referencedFileId: "x00041500",
  directoryRecordType: "x00041430",
  seriesNumber: "x00200011",
  seriesModality: "x00080060",
  studyDate: "x00080020"
};

// Handy representation for passing around dicomdir details
export default class Dicomdir {
  constructor(byteArray) {
    this.dataSet = dicomParser.parseDicom(byteArray);
  }

  readDicomdir(handlers = {}) {
    const sequence = this.dataSet.elements[tags.directoryRecordSeq];
    if (!sequence && sequence.items) throw new DicomError(ERRORS.corrupt);

    sequence.items.forEach(item => {
      if (
        item.dataSet &&
        item.dataSet.string(tags.directoryRecordType) === "STUDY"
      )
        if (handlers.onStudy)
          // Handle study entry
          handlers.onStudy(item.dataSet);
      if (
        item.dataSet &&
        item.dataSet.string(tags.directoryRecordType) === "SERIES"
      )
        if (handlers.onSeries)
          // Handle series entry
          handlers.onSeries(item.dataSet);
      if (
        item.dataSet &&
        item.dataSet.string(tags.directoryRecordType) === "IMAGE"
      )
        if (handlers.onImage)
          // Handle image entry
          handlers.onImage(item.dataSet);
    });
  }

  get study() {
    if (!this._study) {
      let study = null;
      this.readDicomdir({
        onStudy(studyDataSet) {
          if (!studyDataSet.elements[tags.studyDate]) return;
          study = {
            date: parse(studyDataSet.string(tags.studyDate))
          };
        }
      });
      this._study = study;
    }
    return this._study;
  }

  get images() {
    if (!this._images) {
      const images = [];
      this.readDicomdir({
        onImage(dataSet) {
          images.push({
            id: dataSet.string(tags.referencedFileId)
          });
        }
      });
      this._images = images;
    }
    return this._images;
  }

  get series() {
    if (!this._series) {
      let currentSeries = null;
      const series = [];
      this.readDicomdir({
        onSeries(dataSet) {
          currentSeries = {
            id: dataSet.string(tags.seriesNumber),
            modality: dataSet.string(tags.seriesModality),
            images: []
          };
          series.push(currentSeries);
        },
        onImage(dataSet) {
          if (!currentSeries) return;
          currentSeries.images.push({
            id: dataSet.string(tags.referencedFileId)
          });
        }
      });
      this._series = series;
    }
    return this._series;
  }

  get files() {
    if (!this._files) return [];
    return this._files;
  }

  set files(files) {
    this._files = files;
  }
}

// fromFileTree creates an instance of Dicomdir
// Returns a promise that resolves to the instance
export function fromFileTree(filesByName, dicomdirFile, dicompath) {
  // Helper function to create an empty instance of Dicomdir from a file's contents
  function createDicomdirFromFile(dicomdirFile) {
    return new Promise((resolve, reject) => {
      var reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result;
          const array = new Uint8Array(arrayBuffer);
          resolve(new Dicomdir(array));
        } catch (error) {
          reject(new DicomError(ERRORS.corrupt));
        }
      };
      reader.readAsArrayBuffer(dicomdirFile);
    });
  }

  // We need to store downcased names because some DICOMDIRs are case-insensitive
  const filesByCleanName = mapKeys(filesByName, (file, name) =>
    name.toLowerCase()
  );

  return createDicomdirFromFile(dicomdirFile).then(dicomdir => {
    dicomdirFile.id = "DICOMDIR";
    const files = dicomdir.images.map(image => {
      // Convert DICOM-style ID to actual path
      const filename = (dicompath + image.id.replace(/\\/g, "/")).toLowerCase();
      const file = filesByCleanName[filename];
      if (!file) throw new DicomError(ERRORS.corrupt);
      file.id = image.id.replace(/\\/g, "/");
      return file;
    });
    files.unshift(dicomdirFile);
    dicomdir.files = files;
    return dicomdir;
  });
}
