export const getPhotoUrl = (
  fileId?: number | undefined | null | string
): string => {
  if (typeof fileId === 'string') {
    const parsedId = parseInt(fileId, 10);
    fileId = isNaN(parsedId) ? undefined : parsedId;
  }

  return typeof fileId === 'number' && fileId > 0
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/user/avatar/${fileId}`
    : '/placeholder.png';
};
