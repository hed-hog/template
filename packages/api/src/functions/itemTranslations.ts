export const itemTranslations = <T extends any>(
  translationKey: string,
  item: T
) => {
  let locale = {};

  const translationData = item[translationKey];

  if (Array.isArray(translationData)) {
    if (translationData.length > 0) {
      locale = { ...translationData[0] };
    }
  } else if (translationData && typeof translationData === 'object') {
    locale = { ...translationData };
  }

  delete item[translationKey];

  return {
    ...(item as any),
    ...locale,
  };
};
