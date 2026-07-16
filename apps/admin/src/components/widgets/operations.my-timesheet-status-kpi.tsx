'use client';

import SharedOperationsWidget from './operations.shared-operations-widget';

interface WidgetLayoutLike {
  name?: string;
  slug?: string;
}

interface OperationsWidgetProps {
  widget?: WidgetLayoutLike;
  onRemove?: () => void;
}

export default function OperationsWidget(props: OperationsWidgetProps) {
  return <SharedOperationsWidget {...props} slug='my-timesheet-status-kpi' />;
}
