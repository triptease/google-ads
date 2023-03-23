import Long from "long";
type Primitives = string | number | undefined | null | Long;
type CastPrimitive<V> = V extends Long ? number : V;
type MapReturnType<X> = X extends Primitives ? CastPrimitive<X> : X extends {
    value?: infer V;
} ? CastPrimitive<V> : X extends Array<infer Y> ? Array<FlattenExtractObject<Y>> : FlattenExtractObject<X>;
type FlattenExtractObject<X> = {
    [key in keyof X]: MapReturnType<X[key]>;
};
export type flatten<T> = MapReturnType<T>;
export declare function flatten<T>(obj: T): MapReturnType<T>;
type Diff<T, U> = T extends U ? never : T;
type NonNullable<T> = Diff<T, null | undefined>;
type Require<Obj, Req extends keyof Obj | void> = {
    [P in Exclude<keyof Obj, Req>]?: Obj[P];
} & {
    [P in Extract<keyof Obj, Req>]-?: NonNullable<Obj[P]>;
};
export type extract<T, F extends keyof T | void = void> = Require<FlattenExtractObject<T>, F>;
export declare function extract<T, F extends keyof T>(obj: T, requiredFields?: F[]): Require<FlattenExtractObject<T>, F>;
export {};
