export interface TiledObjectProperty {
  name: string;
  value: string | number | boolean;
}

export type TiledObjectPropertyMap = Map<string, string | number | boolean>;

export const parseObjectProperties = (properties?: TiledObjectProperty[]): TiledObjectPropertyMap =>
  new Map((properties ?? []).map((property) => [property.name, property.value]));

export const readStringProperty = (
  properties: TiledObjectPropertyMap,
  name: string,
): string | undefined => {
  const value = properties.get(name);
  return typeof value === "string" ? value : undefined;
};

export const readNumberProperty = (
  properties: TiledObjectPropertyMap,
  name: string,
): number | undefined => {
  const value = properties.get(name);
  return typeof value === "number" ? value : undefined;
};
