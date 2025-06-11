import React from "react";
import type { IUser } from "../../models/User";

export interface IAuthState {
  isAuthenticated: boolean;
  user?: IUser;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = React.createContext<IAuthState>({} as IAuthState);
