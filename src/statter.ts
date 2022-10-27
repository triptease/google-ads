export interface Statter {
  gauge(name: string, value: number, tags?: string[]): void;
  increment(name: string, value?: number, tags?: string[]): void;
  histogram(name: string, value: number, tags?: string[]): void;
}

export class NoOpStatter implements Statter {
  gauge(name: string, value: number, tags?: string[]) {}
  increment(name: string, value?: number, tags?: string[]) {}
  histogram(name: string, value: number, tags?: string[]) {}
}
