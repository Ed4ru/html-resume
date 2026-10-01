// The type is imported inside the block: a top-level import would turn this file into an augmentation
// of a module that does not exist.
declare module 'virtual:resume-data' {
  const resume: import('./schema/index.ts').Resume;
  export default resume;
}
