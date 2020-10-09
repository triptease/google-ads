import _ from 'lodash';
import Long from 'long';

type Primitives = string | number | undefined | null | Long;
type CastPrimitive<V> = V extends Long ? number : V;
type MapReturnType<X> = X extends Primitives
  ? CastPrimitive<X>
  : X extends { value?: infer V }
  ? CastPrimitive<V>
  : X extends Array<infer Y>
  ? Array<FlatternExtractObject<Y>>
  : FlatternExtractObject<X>;

type FlatternExtractObject<X> = { [key in keyof X]: MapReturnType<X[key]> };

export type flattern<T> = MapReturnType<T>;

export function flattern<T>(obj: T): MapReturnType<T> {
  const anyObj = obj as any;

  if (anyObj instanceof Object && 'value' in anyObj) {
    if (Long.isLong(anyObj.value)) {
      return parseInt(anyObj.value, 10) as any;
    }
    return anyObj.value;
  }

  if (Long.isLong(anyObj)) {
    return parseInt(anyObj, 10) as any;
  }

  if (_.isArray(anyObj)) {
    return anyObj.map(flattern) as any;
  }

  if (anyObj instanceof Object) {
    const newObj = {} as any;
    Object.setPrototypeOf(newObj, Object.getPrototypeOf(anyObj));

    _.forOwn(anyObj, (fieldValue, fieldName) => {
      newObj[fieldName] = flattern(fieldValue);
    });

    return newObj;
  }

  return anyObj;
}

type Diff<T, U> = T extends U ? never : T;
type NonNullable<T> = Diff<T, null | undefined>;

type Require<Obj, Req extends keyof Obj | void> = { [P in Exclude<keyof Obj, Req>]?: Obj[P] } &
  { [P in Extract<keyof Obj, Req>]-?: NonNullable<Obj[P]> };

export type extract<T, F extends keyof T | void = void> = Require<FlatternExtractObject<T>, F>;
export function extract<T, F extends keyof T | void = void>(
  obj: T,
  requiredFields: F[] = []
): Require<FlatternExtractObject<T>, F> {
  const flatObject: any = flattern(obj);

  requiredFields.forEach(field => {
    const realValue = field in flatObject ? flatObject[field] : undefined;

    if (realValue == null || realValue === undefined) {
      throw new Error(`${field} does not exist on object`);
    }
  });

  return (flatObject as any) as Require<FlatternExtractObject<T>, F>;
}
