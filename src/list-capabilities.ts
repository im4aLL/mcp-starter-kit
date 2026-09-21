import "reflect-metadata";

// Built composition seam for `scripts/list-capabilities.mjs`.
//
// This entry bundles the application capability list and the container-free
// metadata listing API together so the script reads decorator metadata from a
// single module instance. It never creates a container, resolves a
// constructor, or starts a transport.

export { getCapabilityTypes } from "./capabilities/capabilities";
export { listCapabilityMetadata } from "./core/list-capability-metadata";
