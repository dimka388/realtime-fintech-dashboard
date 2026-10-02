/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * assembly/index/initialize
 * @param newInstrumentCount `i32`
 * @param seed `u32`
 */
export declare function initialize(newInstrumentCount: number, seed: number): void;
/**
 * assembly/index/updateFieldCount
 * @returns `i32`
 */
export declare function updateFieldCount(): number;
/**
 * assembly/index/generateBatch
 * @param updateCount `i32`
 * @returns `~lib/typedarray/Int32Array`
 */
export declare function generateBatch(updateCount: number): Int32Array;
