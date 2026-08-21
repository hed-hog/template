export const getLocalesFromItem = (item: any) => {
  if (item) {
    const fields: string[] = [];

    for (const itemLocale of (item as any).locale ?? []) {
      fields.push(itemLocale.locale.code);
    }

    return [...new Set(fields)];
  } else {
    return [];
  }
};
