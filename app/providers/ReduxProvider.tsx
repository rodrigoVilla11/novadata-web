"use client";

import { Provider } from "react-redux";
import { store } from "@/redux/store"; // ajustá el path

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
