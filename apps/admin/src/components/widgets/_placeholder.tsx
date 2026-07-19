// Placeholder intencional — não remover.
// O loader de widgets faz import(`@/components/widgets/${candidate}`); o
// Turbopack monta um context module sobre esta pasta e falha o build se ela
// estiver vazia. Este módulo mantém a pasta não-vazia. O nome com underscore
// nunca casa com um slug de widget (`core.<slug>` / `<slug>`), então o loader
// nunca o importa. Widgets reais são materializados como `<lib>.<slug>.tsx`.
export {};
