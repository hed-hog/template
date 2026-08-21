'use client';

import { DataTable } from '@/components/custom/data-table';
import { columns, User } from '@/components/custom/data-table-columns-example';

// Dados de exemplo
const data: User[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'active',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob@example.com',
    status: 'inactive',
  },
  {
    id: 4,
    name: 'Alice Williams',
    email: 'alice@example.com',
    status: 'active',
  },
  {
    id: 5,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    status: 'inactive',
  },
];

export default function DataTableExamplePage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Manage your users and their accounts.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        searchColumn="name"
        searchPlaceholder="Search by name..."
        showColumnVisibility={true}
      />
    </div>
  );
}
