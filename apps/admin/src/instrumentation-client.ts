import { registerBuildSkewRecovery } from "@hed-hog/next-build-skew";

// Chunk que sumiu entre deploys nem sempre chega a um error boundary: import
// dinâmico que falha só rejeita uma promise, e a seção some calada. O boundary
// cobre o render; isto cobre o resto. Ver src/app/error.tsx.
registerBuildSkewRecovery();
