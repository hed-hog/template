import { TableColumn } from 'typeorm';

export const foreignColumn = ({
  name,
  isPrimary = false,
  isNullable = false,
}: {
  name: string;
  isPrimary?: boolean;
  isNullable?: boolean;
}) => {
  return {
    name,
    type: 'int',
    unsigned: true,
    isPrimary,
    isNullable,
  } as TableColumn;
};
