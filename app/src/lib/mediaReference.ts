export const mediaRefPattern =
  /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export const isMediaReference = (value: string) => mediaRefPattern.test(value);
