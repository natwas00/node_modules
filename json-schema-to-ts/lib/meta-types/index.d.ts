import { Get } from "../utils";
import { Any, AnyType, ResolveAny } from "./any";
import { Never, NeverType, ResolveNever } from "./never";
import { Const, ConstType, ResolveConst } from "./const";
import { Enum, EnumType, ResolveEnum } from "./enum";
import { Primitive, PrimitiveType, ResolvePrimitive } from "./primitive";
import { Arr, ArrType, ResolveArr } from "./array";
import { Tuple, TupleType, ResolveTuple } from "./tuple";
import { Object, ObjectType, ResolveObject } from "./object";
import { Union, UnionType, ResolveUnion } from "./union";
import { Intersection, IntersectionType, ResolveIntersection } from "./intersection";
import { Error, ErrorType } from "./error";
import { Exclusion, ExclusionType, ResolveExclusion } from "./exclusion";
export declare type MetaType = AnyType | NeverType | ConstType | EnumType | PrimitiveType | ArrType | TupleType | ObjectType | UnionType | IntersectionType | ExclusionType | ErrorType;
export declare type Resolve<T, D = Exclude<T, undefined>> = {
    any: ResolveAny;
    never: ResolveNever;
    const: ResolveConst<D>;
    enum: ResolveEnum<D>;
    primitive: ResolvePrimitive<D>;
    array: ResolveArr<D>;
    tuple: ResolveTuple<D>;
    object: ResolveObject<D>;
    union: ResolveUnion<D>;
    intersection: ResolveIntersection<D>;
    exclusion: ResolveExclusion<D>;
    error: never;
}[Get<D, "type"> extends MetaType ? Get<D, "type"> : "error"];
export { Any, Never, Const, Enum, Primitive, Arr, Tuple, Object, Union, Intersection, Exclusion, Error, };
