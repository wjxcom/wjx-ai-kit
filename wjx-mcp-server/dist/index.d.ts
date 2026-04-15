#!/usr/bin/env node
import "./core/load-env.js";
export { createServer } from "./server.js";
export declare function main(): Promise<void>;
