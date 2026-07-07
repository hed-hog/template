import { getLocaleFields } from './getLocaleFields';

export const getObjectFromLocaleFields = (item) => {
  const fields = getLocaleFields(item);

  const obj: any = {};

  for (const field of fields) {
    obj[field.fieldNameLocale] = field.value;
  }

  return obj;
};
