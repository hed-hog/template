export const getWithLocale = (
  localeCode: string,
  tableLocaleName: string,
  data: any
) => {
  const locale = [...data[tableLocaleName]];

  delete data[tableLocaleName];

  const newData: any = { ...data, locale };
  const current = locale.find((l) => l.locale.code === localeCode);

  for (const key in current) {
    if (key !== 'locale') {
      newData[key] = current[key];
    }
  }

  return newData;
};
