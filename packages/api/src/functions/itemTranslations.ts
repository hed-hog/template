export const itemTranslations = <T extends any>(
  translationKey: string,
  item: T
) => {
  let locale = {};

  if (item[translationKey] && item[translationKey]?.length > 0) {
    locale = { ...item[translationKey][0] };
  }

  delete item[translationKey];

  return {
    ...(item as any),
    ...locale,
  };
};
