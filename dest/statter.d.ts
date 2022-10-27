export interface Statter {
    gauge(name: string, value: number, tags?: string[]): void;
    increment(name: string, value?: number, tags?: string[]): void;
    histogram(name: string, value: number, tags?: string[]): void;
}
export declare class NoOpStatter implements Statter {
    gauge(name: string, value: number, tags?: string[]): void;
    increment(name: string, value?: number, tags?: string[]): void;
    histogram(name: string, value: number, tags?: string[]): void;
}
