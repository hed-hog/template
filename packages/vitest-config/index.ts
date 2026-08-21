// Utilidades de teste compartilhadas para os apps de frontend. Reexporta o MSW
// para os apps mockarem a API sem declarar `msw` diretamente.
export { server } from './msw';
export { http, HttpResponse } from 'msw';
