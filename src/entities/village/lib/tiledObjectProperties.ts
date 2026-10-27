export interface TiledObjectProperty {
  name: string;
  value: string | number | boolean;
}

export type TiledObjectPropertyMap = Map<string, string | number | boolean>;

export const parseObjectProperties = (properties?: TiledObjectProperty[]): TiledObjectPropertyMap =>
  new Map((properties ?? []).map((property) => [property.name, property.value]));
