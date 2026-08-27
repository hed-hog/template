import React from "react";
import { Loading } from "../loading";

export const LoadingPage: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <Loading/>
  </div>
);