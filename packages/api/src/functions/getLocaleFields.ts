export const getLocaleFields = (item) => {
  const fields: {
    fieldName: string;
    localeCode: string;
    value: string;
    fieldNameLocale: string;
  }[] = [];

  for (const itemLocale of (item as any).locale ?? []) {
    for (const key in itemLocale) {
      if (key !== 'locale') {
        fields.push({
          fieldName: key,
          fieldNameLocale: `${itemLocale.locale.code}-${key}`,
          localeCode: itemLocale.locale.code,
          value: itemLocale[key],
        });
      }
    }
  }

  return fields;
};
