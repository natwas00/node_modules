import { Get } from "../../utils";
import { MetaType, Never, Error } from "..";
import { Value } from "../primitive";
import { ExcludeUnion } from "./union";
import { ExcludeIntersection } from "./intersection";
import { ExcludeExclusion } from "./exclusion";
export declare type ExcludeFromPrimitive<A, B> = {
    any: Never;
    never: A;
    const: A;
    enum: A;
    primitive: Value<A> extends Value<B> ? Never : A;
    array: A;
    tuple: A;
    object: A;
    union: ExcludeUnion<A, B>;
    intersection: ExcludeIntersection<A, B>;
    exclusion: ExcludeExclusion<A, B>;
    error: B;
    errorTypeProperty: Error<"Missing type property">;
}[Get<B, "type"> extends MetaType ? Get<B, "type"> : "errorTypeProperty"];
