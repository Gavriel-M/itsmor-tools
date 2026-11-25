import { expose } from "comlink";
import { probeCanvas, probeDecode } from "./capabilities";
import { runTask } from "./pipeline";

const api = { convert: runTask, probeCanvas, probeDecode };

export type WorkerApi = typeof api;

expose(api);
