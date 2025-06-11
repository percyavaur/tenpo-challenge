import React from "react";

export interface IAppState {
  theme: string;
  toggleTheme: () => void;
}

export const AppContext = React.createContext<IAppState>({} as IAppState);
