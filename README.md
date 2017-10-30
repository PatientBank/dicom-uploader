# dicom-uploader
(Incomplete) code from PatientBank's DICOM uploader

There are three files here:

1. `handleFileDrop.js`, which defines an drop event listener, for when the directory (or list of files) is dropped onto an element.
2. `parseFileTree.js`, which defines a useful helper to grab all dropped files and organize them by name.
3. `Dicomdir.js`, which defines a `Dicomdir` class and a `fromFileTree` method to instantiate the class.

There's some hacky stuff going on, and this code is copied from another codebase and not guaranteed to work (probably it won't work) as is.
