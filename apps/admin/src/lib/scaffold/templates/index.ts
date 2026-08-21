import type { ScaffoldPlan } from '../types';
import { renderDashboardTemplate } from './dashboard';
import { renderDetailFormTemplate } from './detail-form';
import { renderListTemplate } from './list';
import type { TemplateOutput } from './shared';

export type { TemplateOutput } from './shared';

export function renderTemplate(plan: ScaffoldPlan): TemplateOutput {
  switch (plan.template) {
    case 'list-kpi':
      return renderListTemplate(plan, true);
    case 'list-simple':
      return renderListTemplate(plan, false);
    case 'detail-form':
      return renderDetailFormTemplate(plan);
    case 'dashboard':
      return renderDashboardTemplate(plan);
    default:
      return renderListTemplate(plan, true);
  }
}
