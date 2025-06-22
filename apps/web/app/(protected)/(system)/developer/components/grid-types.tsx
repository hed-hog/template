export interface ColumnMeta {
  key: string // Corresponds to the key in the row data object
  label: string // Display name for the column header
  dataType: "string" | "number" | "boolean" | "date"
  width?: number // Optional: width in pixels
  defaultValue?: any // Default value for new cells in this column
}

export type RowData = Record<string, any> & { id: string } // Ensure each row has a unique ID

// Sample Column Definitions
export const sampleColumnMetas: ColumnMeta[] = [
  { key: "name", label: "Name", dataType: "string", width: 200, defaultValue: "" },
  { key: "age", label: "Age", dataType: "number", width: 80, defaultValue: 0 },
  { key: "isActive", label: "Active", dataType: "boolean", width: 100, defaultValue: false },
  { key: "email", label: "Email", dataType: "string", width: 250, defaultValue: "" },
  {
    key: "joinDate",
    label: "Join Date",
    dataType: "date",
    width: 150,
    defaultValue: new Date().toISOString().split("T")[0],
  },
  { key: "bio", label: "Biography", dataType: "string", width: 300, defaultValue: "" },
]

// Sample Initial Data
export const sampleInitialRows: RowData[] = [
  {
    id: crypto.randomUUID(),
    name: "Alice Wonderland",
    age: 30,
    isActive: true,
    email: "alice@example.com",
    joinDate: "2023-01-15",
    bio: "Curiouser and curiouser.",
  },
  {
    id: crypto.randomUUID(),
    name: "Bob The Builder",
    age: 45,
    isActive: false,
    email: "bob@example.com",
    joinDate: "2022-05-10",
    bio: "Can we fix it? Yes, we can!",
  },
  {
    id: crypto.randomUUID(),
    name: "Charlie Chaplin",
    age: 28,
    isActive: true,
    email: "charlie@example.com",
    joinDate: "2023-07-20",
    bio: "A day without laughter is a day wasted.",
  },
]

export const createNewRowData = (columns: ColumnMeta[]): RowData => {
  const newRow: RowData = { id: crypto.randomUUID() }
  columns.forEach((col) => {
    newRow[col.key] = col.defaultValue
  })
  return newRow
}
