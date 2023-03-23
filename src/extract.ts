import { isArray, forOwn } from "lodash";
import Long from "long";

type Primitives = string | number | undefined | null | Long;
type CastPrimitive<V> = V extends Long ? number : V;
type MapReturnType<X> = X extends Primitives
  ? CastPrimitive<X>
  : X extends { value?: infer V }
  ? CastPrimitive<V>
  : X extends Array<infer Y>
  ? Array<FlattenExtractObject<Y>>
  : FlattenExtractObject<X>;

type FlattenExtractObject<X> = { [key in keyof X]: MapReturnType<X[key]> };

export type flatten<T> = MapReturnType<T>;

function longToNumber(value: Long): number {
  return parseInt(value.toString(), 10);
}

export function flatten<T>(obj: T): MapReturnType<T> {
  const anyObj = obj as any;

  if (anyObj instanceof Object && "value" in anyObj) {
    if (Long.isLong(anyObj.value)) {
      return longToNumber(anyObj.value) as any;
    }
    return anyObj.value;
  }

  if (Long.isLong(anyObj)) {
    return longToNumber(anyObj) as any;
  }

  if (isArray(anyObj)) {
    return anyObj.map(flatten) as any;
  }

  if (anyObj instanceof Object) {
    const newObj = {} as any;
    Object.setPrototypeOf(newObj, Object.getPrototypeOf(anyObj));

    forOwn(anyObj, (fieldValue, fieldName) => {
      newObj[fieldName] = flatten(fieldValue);
    });

    return newObj;
  }

  return anyObj;
}

type Diff<T, U> = T extends U ? never : T;
type NonNullable<T> = Diff<T, null | undefined>;

type Require<Obj, Req extends keyof Obj | void> = {
  [P in Exclude<keyof Obj, Req>]?: Obj[P];
} & { [P in Extract<keyof Obj, Req>]-?: NonNullable<Obj[P]> };

export type extract<T, F extends keyof T | void = void> = Require<
  FlattenExtractObject<T>,
  F
>;
export function extract<T, F extends keyof T>(
  obj: T,
  requiredFields: F[] = []
): Require<FlattenExtractObject<T>, F> {
  const flatObject: any = flatten(obj);

  requiredFields.forEach((field) => {
    const realValue = field in flatObject ? flatObject[field] : undefined;

    if (realValue == null || realValue === undefined) {
      throw new Error(`${field.toString()} does not exist on object`);
    }
  });

  return flatObject as any as Require<FlattenExtractObject<T>, F>;
}
