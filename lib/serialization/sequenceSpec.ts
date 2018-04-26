// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { PropertyPath } from "./propertyPath";
import { SerializationOptions, failDeserializeTypeCheck, failSerializeTypeCheck, resolveTypeSpec } from "./serializationOptions";
import { TypeSpec } from "./typeSpec";

export interface SequenceTypeSpec<TSerializedElement, TDeserializedElement> extends TypeSpec<TSerializedElement[], TDeserializedElement[]> {
  /**
   * The TypeSpec that defines each element in this SequenceTypeSpec.
   */
  elementSpec: TypeSpec<TSerializedElement, TDeserializedElement> | string;
}

/**
 * A type specification that describes how to validate and serialize a Sequence of elements.
 */
export function sequenceSpec<TSerializedElement, TDeserializedElement>(elementSpec: TypeSpec<TSerializedElement, TDeserializedElement> | string): SequenceTypeSpec<TSerializedElement, TDeserializedElement> {
  return {
    specType: `Sequence`,

    elementSpec: elementSpec,

    serialize(propertyPath: PropertyPath, value: TDeserializedElement[], options: SerializationOptions): TSerializedElement[] {
      let result: TSerializedElement[];
      if (!Array.isArray(value)) {
        failSerializeTypeCheck(options, propertyPath, value, "an Array");
        result = value;
      } else {
        const elementTypeSpec: TypeSpec<TSerializedElement, TDeserializedElement> = resolveTypeSpec(options, propertyPath, elementSpec);
        result = [];
        for (let i = 0; i < value.length; i++) {
          result[i] = elementTypeSpec.serialize(propertyPath.concat([i.toString()]), value[i], options);
        }
      }
      return result;
    },

    deserialize(propertyPath: PropertyPath, value: TSerializedElement[], options: SerializationOptions): TDeserializedElement[] {
      let result: TDeserializedElement[];
      if (!Array.isArray(value)) {
        failDeserializeTypeCheck(options, propertyPath, value, "an Array");
        result = value;
      } else {
        const elementTypeSpec: TypeSpec<TSerializedElement, TDeserializedElement> = resolveTypeSpec(options, propertyPath, elementSpec);
        result = [];
        for (let i = 0; i < value.length; i++) {
          result[i] = elementTypeSpec.deserialize(propertyPath.concat([i.toString()]), value[i], options);
        }
      }
      return result;
    }
  };
}